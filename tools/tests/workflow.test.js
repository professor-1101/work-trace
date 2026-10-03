'use strict';
// Behavioral tests for grouping validation, 3x3 enforcement, output format,
// task-title prefix, prohibited labels, Markdown ban, `---` separator,
// date-based storage and repeated-run determinism.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { renderTasks, validateTasksDoc, validateRendered } = require('../lib/render');
const { validateWorkItems } = require('../lib/workitems');
const storage = require('../lib/storage');
const { mkTmp, rmRecursive } = require('./helpers');

const wi = (title, report) => ({ title, report });

function tasksDoc(projects) {
  return { projects };
}

test('11. three-task grouping valid when each task holds canonical items verbatim', () => {
  const expected = tasksDoc([{ project: 'alpha', workItems: [wi('T1', 'R1'), wi('T2', 'R2'), wi('T3', 'R3')] }]);
  const doc = tasksDoc([
    {
      project: 'alpha',
      tasks: [
        { title: 'A', subtasks: [wi('T1', 'R1')] },
        { title: 'B', subtasks: [wi('T2', 'R2')] },
        { title: 'C', subtasks: [wi('T3', 'R3')] },
      ],
    },
  ]);
  const res = validateTasksDoc(doc, expected);
  assert.ok(res.ok, res.errors.join('; '));
});

test('12. four subtasks in one task violates the 3-subtask cap', () => {
  const items = [wi('a', '1'), wi('b', '2'), wi('c', '3'), wi('d', '4')];
  const expected = tasksDoc([{ project: 'p', workItems: items }]);
  const doc = tasksDoc([{ project: 'p', tasks: [{ title: 'X', subtasks: items }] }]);
  const res = validateTasksDoc(doc, expected);
  assert.ok(!res.ok && res.errors.some((e) => /3-subtask limit/.test(e)));
});

test('12b. four tasks in one repo violates the 3-task cap', () => {
  const items = [wi('a', '1'), wi('b', '2'), wi('c', '3'), wi('d', '4')];
  const expected = tasksDoc([{ project: 'p', workItems: items }]);
  const doc = tasksDoc([
    {
      project: 'p',
      tasks: items.map((s) => ({ title: s.title + ' task', subtasks: [s] })),
    },
  ]);
  const res = validateTasksDoc(doc, expected);
  assert.ok(!res.ok && res.errors.some((e) => /3-task limit/.test(e)));
});

test('13. independent outcomes are preserved: rewriting/shortening/dropping detected', () => {
  const expected = tasksDoc([{ project: 'p', workItems: [wi('Fix crash after feature X', 'متن اصلی گزارش با جزئیات کامل.'), wi('Add docs', 'گزارش مستندات.')] }]);
  // Rewritten report:
  const rewritten = tasksDoc([{ project: 'p', tasks: [{ title: 'T', subtasks: [wi('Fix crash after feature X', 'متن کوتاه‌شده.'), wi('Add docs', 'گزارش مستندات.')] }] }]);
  let res = validateTasksDoc(rewritten, expected);
  assert.ok(!res.ok && res.errors.some((e) => /VERBATIM/.test(e)), 'rewrite detected');
  // Dropped item:
  const dropped = tasksDoc([{ project: 'p', tasks: [{ title: 'T', subtasks: [wi('Add docs', 'گزارش مستندات.')] }] }]);
  res = validateTasksDoc(dropped, expected);
  assert.ok(!res.ok && res.errors.some((e) => /missing from the grouped output/.test(e)), 'drop detected');
  // Merged into one item:
  const merged = tasksDoc([{ project: 'p', tasks: [{ title: 'T', subtasks: [wi('Fix crash after feature X', 'متن اصلی گزارش با جزئیات کامل.\n\nگزارش مستندات.')] }] }]);
  res = validateTasksDoc(merged, expected);
  assert.ok(!res.ok, 'merge without verbatim pair is invalid');
});

test('14. >9 genuinely independent outcomes cannot fit 3x3 — failure is detectable', () => {
  const items = Array.from({ length: 10 }, (_, i) => wi(`item ${i}`, `report ${i}`));
  const expected = tasksDoc([{ project: 'p', workItems: items }]);
  // Best possible packing under 3x3 leaves one item out; any attempt fails:
  const packed = tasksDoc([
    {
      project: 'p',
      tasks: [0, 1, 2].map((t) => ({
        title: `task ${t}`,
        subtasks: [0, 1, 2].map((s) => items[t * 3 + s]).filter(Boolean),
      })),
    },
  ]);
  const res = validateTasksDoc(packed, expected);
  assert.ok(!res.ok, 'overflow must fail validation');
  assert.ok(res.errors.some((e) => /missing from the grouped output/.test(e)), 'dropped outcome reported explicitly');
  // And a fabricated 4th task also fails the cap — no silent escape hatch.
  const four = tasksDoc([{ project: 'p', tasks: [0, 1, 2, 3].map((t) => ({ title: `task ${t}`, subtasks: [items[t]] })) }]);
  const res2 = validateTasksDoc(four, expected);
  assert.ok(!res2.ok && res2.errors.some((e) => /3-task limit/.test(e)));
});

test('15. task titles carry `{Project} - {Task Title}`; subtasks never get the prefix', () => {
  const doc = tasksDoc([
    { project: 'Alpha', tasks: [{ title: 'زیرساخت', subtasks: [wi('عنوان آیتم', 'گزارش آیتم.')] }] },
  ]);
  const text = renderTasks(doc);
  assert.ok(text.startsWith('Alpha - زیرساخت\n'), 'heading has project prefix');
  const lines = text.split('\n');
  const subIdx = lines.indexOf('عنوان آیتم');
  assert.ok(subIdx >= 0, 'subtask title line present as-is');
  assert.ok(!lines.some((l) => l.startsWith('Alpha - عنوان')), 'no project prefix on subtasks');
});

test('16. prohibited structural labels rejected', () => {
  const doc = tasksDoc([
    { project: 'p', tasks: [{ title: 'Subtask: کار', subtasks: [wi('x', 'y')] }] },
  ]);
  const text = renderTasks(doc);
  const res = validateRendered(text, doc);
  assert.ok(!res.ok && res.errors.some((e) => /Prohibited structural label/.test(e)));
  // Exact label lines too:
  assert.ok(validateRendered('Task 1\nمحتوا\n', null).errors.some((e) => /Prohibited/.test(e)));
  assert.ok(validateRendered('Report\nمحتوا\n', null).errors.some((e) => /Prohibited/.test(e)));
  assert.ok(validateRendered('Repository\nمحتوا\n', null).errors.some((e) => /Prohibited/.test(e)));
});

test('17. markdown constructs rejected', () => {
  for (const bad of ['# عنوان', '**bold** متن', 'کد `x` این-line', '- bullet', '1. numbered', '| a | b |']) {
    const res = validateRendered(bad + '\n', null);
    assert.ok(!res.ok, `must reject: ${bad}`);
    assert.ok(res.errors.some((e) => /Markdown\/format violation/.test(e)));
  }
});

test('18. exact `---` separator between task sections, nothing else', () => {
  const doc = tasksDoc([
    { project: 'p1', tasks: [{ title: 'A', subtasks: [wi('i1', 'r1')] }, { title: 'B', subtasks: [wi('i2', 'r2')] }] },
    { project: 'p2', tasks: [{ title: 'C', subtasks: [wi('i3', 'r3')] }] },
  ]);
  const text = renderTasks(doc);
  const sepLines = text.split('\n').filter((l) => l.trim() === '---');
  assert.strictEqual(sepLines.length, 2, 'three sections -> two separators');
  assert.ok(text.split('\n').every((l) => l !== ' ---' && l !== '--- '), 'separators are exactly "---"');
  assert.ok(!text.includes('***') && !text.includes('___'));
  const res = validateRendered(text, doc);
  assert.ok(res.ok, res.errors.join('; '));
});

test('canonical Work Items contract validated against evidence document', () => {
  const collected = { repositories: [{ project: 'alpha' }, { project: 'beta' }] };
  assert.ok(validateWorkItems(tasksDoc([{ project: 'alpha', workItems: [wi('t', 'r')] }]), collected).ok);
  const bad = validateWorkItems(tasksDoc([{ project: 'gamma', workItems: [wi('t', 'r')] }]), collected);
  assert.ok(!bad.ok && bad.errors.some((e) => /not among collected repositories/.test(e)));
  const emptyReport = validateWorkItems(tasksDoc([{ project: 'alpha', workItems: [wi('t', '  ')] }]), collected);
  assert.ok(!emptyReport.ok);
});

test('19+20. date-based storage layout, auto-created dirs, deterministic re-run overwrite', () => {
  const tmp = mkTmp('wt-store-');
  try {
    const cfg = { reportRoot: path.join(tmp, 'reports'), output: { layout: '{root}/YYYY/MM/DD/report.txt' } };
    const doc = tasksDoc([{ project: 'p', tasks: [{ title: 'A', subtasks: [wi('i', 'r')] }] }]);
    const text = renderTasks(doc);
    const dest = storage.persistReport(cfg, '2026-10-03', text);
    assert.strictEqual(dest, path.join(tmp, 'reports', '2026', '10', '03', 'report.txt'));
    assert.ok(fs.existsSync(dest));
    // Repeated run: same bytes, single file, atomic replace (no accumulation).
    storage.persistReport(cfg, '2026-10-03', text);
    const dir = path.dirname(dest);
    const entries = fs.readdirSync(dir);
    assert.deepStrictEqual(entries, ['report.txt'], 'no temp/duplicate files left behind');
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), text);
    // Different date -> different path.
    const dest2 = storage.persistReport(cfg, '2026-10-04', text);
    assert.ok(dest2.includes(path.join('10', '04')));
    // Empty day -> empty file (documented behavior).
    const emptyDest = storage.persistReport(cfg, '2026-10-05', renderTasks({ projects: [] }));
    assert.strictEqual(fs.readFileSync(emptyDest, 'utf8'), '');
  } finally {
    rmRecursive(tmp);
  }
});

test('rendering is deterministic: input order does not change output bytes', () => {
  const a = tasksDoc([
    { project: 'zz', tasks: [{ title: 'B task', subtasks: [wi('s2', 'r2'), wi('s1', 'r1')] }] },
    { project: 'aa', tasks: [{ title: 'A task', subtasks: [wi('s3', 'r3')] }] },
  ]);
  const b = tasksDoc([
    { project: 'aa', tasks: [{ title: 'A task', subtasks: [wi('s3', 'r3')] }] },
    { project: 'zz', tasks: [{ title: 'B task', subtasks: [wi('s1', 'r1'), wi('s2', 'r2')] }] },
  ]);
  assert.strictEqual(renderTasks(a), renderTasks(b));
});
