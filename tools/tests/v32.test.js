'use strict';
// v3.2.0 feature tests: Skill update (installer), Manual Work Items,
// deterministic hour allocation (three modes + hard 7.5h invariant), and the
// single-file Daily Report with persist-gate enforcement.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { allocateHours, validateStoredHours, DAILY_TOTAL_HOURS } = require('../lib/hours');
const { mergeManualWorkItems, validateWorkItems } = require('../lib/workitems');
const { renderTasks, validateRendered, dailyReportLines, DAILY_REPORT_LABEL, flattenFinalTasks } = require('../lib/render');
const configLib = require('../lib/config');
const { VERSION } = require('../lib/version');
const { mkTmp, rmRecursive } = require('./helpers');

const REPO_ROOT = path.resolve(__dirname, '../..');
const INSTALLER = path.join(REPO_ROOT, 'scripts', 'install.js');

function runInstaller(args, cwd) {
  return spawnSync(process.execPath, [INSTALLER, ...args], { encoding: 'utf8', windowsHide: true, cwd: cwd || REPO_ROOT });
}

function gitDoc(items) {
  return { projects: [{ project: 'api', workItems: items.map((i) => Object.assign({ source: 'git' }, i)) }] };
}

const m = (title, report, project) => {
  const it = { title, report, source: 'manual' };
  if (project !== undefined) it.project = project;
  return it;
};

// ---------------------------------------------------------------- SKILL UPDATE

test('v3.2 installer --update: unchanged sources are a no-op for both Skills (idempotent)', () => {
  const tmp = mkTmp('wt-up-noop-');
  try {
    const target = path.join(tmp, 'target');
    fs.mkdirSync(target, { recursive: true });
    assert.strictEqual(runInstaller(['--target', target, '--no-npm']).status, 0);
    const f1 = path.join(target, '.cline', 'skills', 'worktrace-daily-report', 'SKILL.md');
    const f2 = path.join(target, '.cline', 'skills', 'worktrace-report', 'SKILL.md');
    const before = [fs.readFileSync(f1, 'utf8'), fs.readFileSync(f2, 'utf8'), fs.statSync(f1).mtimeMs];
    const up = runInstaller(['--target', target, '--update']);
    assert.strictEqual(up.status, 0, up.stderr + up.stdout);
    const after = [fs.readFileSync(f1, 'utf8'), fs.readFileSync(f2, 'utf8'), fs.statSync(f1).mtimeMs];
    assert.deepStrictEqual(after.slice(0, 2), before.slice(0, 2), 'skill contents untouched');
    assert.strictEqual(after[2], before[2], 'unchanged files are NOT rewritten (mtime preserved)');
    assert.match(up.stdout, /skill worktrace-daily-report: \d+ unchanged/);
    assert.match(up.stdout, /skill worktrace-report: \d+ unchanged/);
    // Repeated update stays idempotent.
    const up2 = runInstaller(['--target', target, '--update']);
    assert.strictEqual(up2.status, 0, up2.stderr + up2.stdout);
    assert.match(up2.stdout, /Repeated --update is idempotent/);
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.2 installer --update: changed skill file updates installed copy; new file added; removed managed file deleted', () => {
  const tmp = mkTmp('wt-up-change-');
  try {
    // Synthetic repo: copy only what the installer needs from the real repo.
    const repo = path.join(tmp, 'repo');
    for (const p of ['scripts/install.js', 'tools/lib/version.js', 'config/worktrace.example.yaml', 'tools/package.json']) {
      const dest = path.join(repo, p);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, p), dest);
    }
    const skillSrc = path.join(repo, '.cline', 'skills', 'worktrace-daily-report');
    fs.mkdirSync(skillSrc, { recursive: true });
    fs.writeFileSync(path.join(skillSrc, 'SKILL.md'), '# frozen skill\n');
    fs.mkdirSync(path.join(repo, '.cline', 'skills', 'worktrace-report'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.cline', 'skills', 'worktrace-report', 'SKILL.md'), '# orchestration skill\n');
    fs.writeFileSync(path.join(skillSrc, 'temp.md'), '# temp\n');

    const target = path.join(tmp, 'target');
    fs.mkdirSync(target, { recursive: true });
    const inst = spawnSync(process.execPath, [path.join(repo, 'scripts', 'install.js'), '--target', target, '--no-npm'], { encoding: 'utf8', windowsHide: true, cwd: repo });
    assert.strictEqual(inst.status, 0, inst.stderr + inst.stdout);
    assert.ok(fs.existsSync(path.join(target, '.cline', 'skills', 'worktrace-daily-report', 'temp.md')));

    // Source evolves: SKILL.md changes, temp.md is removed upstream.
    fs.writeFileSync(path.join(skillSrc, 'SKILL.md'), '# frozen skill v2\n');
    fs.unlinkSync(path.join(skillSrc, 'temp.md'));
    const up = spawnSync(process.execPath, [path.join(repo, 'scripts', 'install.js'), '--target', target, '--update', '--no-npm'], { encoding: 'utf8', windowsHide: true, cwd: repo });
    assert.strictEqual(up.status, 0, up.stderr + up.stdout);
    assert.strictEqual(fs.readFileSync(path.join(target, '.cline', 'skills', 'worktrace-daily-report', 'SKILL.md'), 'utf8'), '# frozen skill v2\n', 'changed source -> installed copy updated');
    assert.ok(!fs.existsSync(path.join(target, '.cline', 'skills', 'worktrace-daily-report', 'temp.md')), 'removed managed+unmodified file -> safe removal');
    assert.match(up.stdout, /~\d+ updated/);
    assert.match(up.stdout, /-1 removed \(managed, unmodified\)/);
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.2 installer --update: locally modified installed skill -> CONFLICT, never silently overwritten', () => {
  const tmp = mkTmp('wt-up-conf-');
  try {
    const repo = path.join(tmp, 'repo');
    for (const p of ['scripts/install.js', 'tools/lib/version.js', 'config/worktrace.example.yaml', 'tools/package.json']) {
      const dest = path.join(repo, p);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, p), dest);
    }
    fs.mkdirSync(path.join(repo, '.cline', 'skills', 'worktrace-daily-report'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.cline', 'skills', 'worktrace-daily-report', 'SKILL.md'), '# frozen skill\n');
    fs.mkdirSync(path.join(repo, '.cline', 'skills', 'worktrace-report'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.cline', 'skills', 'worktrace-report', 'SKILL.md'), '# orchestration skill\n');

    const target = path.join(tmp, 'target');
    fs.mkdirSync(target, { recursive: true });
    assert.strictEqual(spawnSync(process.execPath, [path.join(repo, 'scripts', 'install.js'), '--target', target, '--no-npm'], { encoding: 'utf8', windowsHide: true, cwd: repo }).status, 0);

    // User edits BOTH installed skills AND the user config.
    const instSkill = path.join(target, '.cline', 'skills', 'worktrace-report', 'SKILL.md');
    fs.writeFileSync(instSkill, '# my local edit\n');
    const cfg = path.join(target, 'worktrace.yaml');
    fs.writeFileSync(cfg, '# mine\nprojectsRoot: /tmp\nreportRoot: /tmp\ntimezone: Europe/Berlin\n');

    // Upstream changes those same files.
    fs.writeFileSync(path.join(repo, '.cline', 'skills', 'worktrace-report', 'SKILL.md'), '# orchestration skill upstream-v2\n');

    const up = spawnSync(process.execPath, [path.join(repo, 'scripts', 'install.js'), '--target', target, '--update', '--no-npm'], { encoding: 'utf8', windowsHide: true, cwd: repo });
    assert.strictEqual(up.status, 3, `expected conflict exit 3, got ${up.status}: ${up.stdout}${up.stderr}`);
    assert.match(up.stdout, /CONFLICT/);
    assert.strictEqual(fs.readFileSync(instSkill, 'utf8'), '# my local edit\n', 'conflicting installed file NOT overwritten');
    assert.strictEqual(fs.readFileSync(cfg, 'utf8'), '# mine\nprojectsRoot: /tmp\nreportRoot: /tmp\ntimezone: Europe/Berlin\n', 'user config survives update');
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.2 installer --update: user-added local file inside a skill dir is never touched or deleted', () => {
  const tmp = mkTmp('wt-up-local-');
  try {
    const target = path.join(tmp, 'target');
    fs.mkdirSync(target, { recursive: true });
    assert.strictEqual(runInstaller(['--target', target, '--no-npm']).status, 0);
    const extra = path.join(target, '.cline', 'skills', 'worktrace-report', 'MY-NOTES.md');
    fs.writeFileSync(extra, '# personal notes\n');
    const up = runInstaller(['--target', target, '--update']);
    assert.strictEqual(up.status, 0, up.stderr + up.stdout);
    assert.strictEqual(fs.readFileSync(extra, 'utf8'), '# personal notes\n', 'local-only file preserved');
    assert.match(up.stdout, /local-only \(untouched\)/);
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.2 installer --update refuses to run without an installed baseline; --check coherence', () => {
  const tmp = mkTmp('wt-up-none-');
  try {
    const target = path.join(tmp, 'target');
    fs.mkdirSync(target, { recursive: true });
    const up = runInstaller(['--target', target, '--update']);
    assert.strictEqual(up.status, 1, 'update on a fresh dir fails cleanly');
    const check = runInstaller(['--target', target, '--check']);
    assert.strictEqual(check.status, 1);
    assert.match(check.stdout, /not installed/);
    assert.strictEqual(runInstaller(['--target', target, '--no-npm']).status, 0);
    const check2 = runInstaller(['--target', target, '--check']);
    assert.strictEqual(check2.status, 0);
    assert.ok(check2.stdout.includes(VERSION));
  } finally {
    rmRecursive(tmp);
  }
});

// ---------------------------------------------------------------- MANUAL WORK

test('v3.2 manual: no manual work leaves the Git document exactly unchanged', () => {
  const g = gitDoc([{ title: 'T', report: 'R' }]);
  const merged = mergeManualWorkItems(g, []);
  assert.deepStrictEqual(merged, JSON.parse(JSON.stringify(g)));
});

test('v3.2 manual: one activity becomes a Manual Work Item with source=manual and no invented fields', () => {
  const g = gitDoc([{ title: 'T', report: 'R' }]);
  const merged = mergeManualWorkItems(g, [m('جلسه بازبینی طرح', 'در مورد معماری سرویس پرداخت گفتگو شد.')]);
  assert.strictEqual(merged.projects.length, 2);
  const entry = merged.projects[1];
  assert.strictEqual(entry.manual, true);
  assert.strictEqual(entry.project, '', 'genuinely unscoped manual work gets NO fake repository');
  assert.deepStrictEqual(entry.workItems, [{ title: 'جلسه بازبینی طرح', report: 'در مورد معماری سرویس پرداخت گفتگو شد.', source: 'manual' }]);
  assert.ok(validateWorkItems(merged, null).ok, 'merged doc satisfies the canonical contract');
});

test('v3.2 manual: multiple activities (meeting/review/discussion/documentation/planning/coordination) all preserved verbatim', () => {
  const acts = [
    m('Meeting', 'Weekly sync about release plan.'),
    m('Review', 'Reviewed colleague PR design notes offline.'),
    m('Discussion', 'Discussed incident response process.'),
    m('Documentation', 'Wrote onboarding guide draft.'),
    m('Planning', 'Planned next sprint scope.'),
    m('Coordination', 'Coordinated test environment access.'),
  ];
  const merged = mergeManualWorkItems(gitDoc([]), acts);
  const items = merged.projects.flatMap((p) => p.workItems);
  assert.strictEqual(items.length, 6);
  items.forEach((it, i) => {
    assert.strictEqual(it.title, acts[i].title);
    assert.strictEqual(it.report, acts[i].report);
    assert.strictEqual(it.source, 'manual');
  });
});

test('v3.2 manual: attaches to a Git project ONLY when the user explicitly names it; otherwise independent entry', () => {
  const g = gitDoc([{ title: 'T', report: 'R' }]);
  const merged = mergeManualWorkItems(g, [
    m('Related review', 'Reviewed the api auth change with the team.', 'api'),
    m('Unrelated course', 'Finished an internal security course.'),
  ]);
  assert.strictEqual(merged.projects[0].workItems.length, 2, 'explicitly related manual item joins the git project');
  assert.strictEqual(merged.projects[0].workItems[1].source, 'manual');
  assert.strictEqual(merged.projects.length, 2, 'unrelated manual activity stays an independent entry');
  assert.strictEqual(merged.projects[1].project, '');
});

test('v3.2 manual: shared label groups manual activities together (user-stated relationship only)', () => {
  const merged = mergeManualWorkItems(gitDoc([]), [
    m('Design meeting', 'Met about the checkout redesign.', 'طراحی'),
    m('Design review', 'Reviewed the checkout mockups.', 'طراحی'),
    m('Other thing', 'Something unrelated entirely.'),
  ]);
  const labels = merged.projects.map((p) => p.project);
  assert.ok(labels.includes('طراحی'));
  assert.strictEqual(merged.projects.find((p) => p.project === 'طراحی').workItems.length, 2);
});

test('v3.2 manual: blank/whitespace entries are dropped; invalid source rejected by validator', () => {
  const merged = mergeManualWorkItems(gitDoc([{ title: 'T', report: 'R' }]), [m('', '   '), m('Real', 'Real report.')]);
  const items = merged.projects.flatMap((p) => p.workItems);
  assert.strictEqual(items.filter((i) => i.source === 'manual').length, 1);
  const bad = { projects: [{ project: 'x', workItems: [{ title: 'a', report: 'b', source: 'telepathy' }] }] };
  assert.ok(!validateWorkItems(bad, null).ok);
});

test('v3.2 CLI: merge-manual unifies git + manual items before grouping (empty manual keeps bytes stable)', () => {
  const tmp = mkTmp('wt-merge-cli-');
  try {
    const wiPath = path.join(tmp, 'wi.json');
    const manPath = path.join(tmp, 'manual.json');
    fs.writeFileSync(wiPath, JSON.stringify(gitDoc([{ title: 'T', report: 'R' }]), null, 2));
    fs.writeFileSync(manPath, JSON.stringify([m('Meeting', 'Sync call.')], null, 2));
    const r1 = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'merge-manual', '--work-items', wiPath, '--manual', manPath, '--out', wiPath], { encoding: 'utf8' });
    assert.strictEqual(r1.status, 0, r1.stderr);
    const merged = JSON.parse(fs.readFileSync(wiPath, 'utf8'));
    assert.strictEqual(merged.projects.length, 2);
    fs.writeFileSync(manPath, '[]');
    const r2 = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'merge-manual', '--work-items', wiPath, '--manual', manPath, '--out', wiPath], { encoding: 'utf8' });
    assert.strictEqual(r2.status, 0, r2.stderr);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(wiPath, 'utf8')), merged, 'no manual work -> unified set unchanged');
  } finally {
    rmRecursive(tmp);
  }
});

// --------------------------------------------------------------------- HOURS

const tasks = (...hs) => ({ projects: [{ project: 'p', tasks: hs.map((_, i) => ({ title: `T${i}`, subtasks: [{ title: 's', report: 'r' }] })) }] });
const flatOf = (doc) => flattenFinalTasks(doc).map(({ task }) => task);

test('v3.2 hours mode A: all specified values preserved EXACTLY; unused time is not filled', () => {
  const d = tasks(1, 1, 1);
  const res = allocateHours(flatOf(d), [2, 3, 1.5]);
  assert.ok(res.ok, res.errors.join(';'));
  assert.strictEqual(res.mode, 'all-specified');
  assert.deepStrictEqual(res.allocated, [2, 3, 1.5]);
  assert.strictEqual(res.total, 6.5, 'explicit total kept — no silent fill up to 7.5');
});

test('v3.2 hours mode B: partial + balance splits remaining equally and deterministically', () => {
  const d = tasks(1, 1, 1);
  const res = allocateHours(flatOf(d), [3, null, null]);
  assert.ok(res.ok, res.errors.join(';'));
  assert.strictEqual(res.mode, 'partial-balance');
  assert.deepStrictEqual(res.allocated, [3, 2.25, 2.25]);
  assert.strictEqual(res.total, DAILY_TOTAL_HOURS);
  // remainder split that does not divide evenly: last share absorbs rounding
  const res2 = allocateHours(flatOf(tasks(1, 1)), [null, 1]);
  assert.deepStrictEqual(res2.allocated, [6.5, 1]);
  assert.strictEqual(res2.total, 7.5);
});

test('v3.2 hours mode C: none specified -> full 7.5h split equally across all final Tasks', () => {
  const res = allocateHours(flatOf(tasks(1, 1, 1)), [null, null, null]);
  assert.ok(res.ok, res.errors.join(';'));
  assert.strictEqual(res.mode, 'equal-split');
  assert.deepStrictEqual(res.allocated, [2.5, 2.5, 2.5]);
  assert.strictEqual(res.total, 7.5);
  // Non-divisible split stays deterministic and exact at hundredths: the
  // cumulative-sum method shares (1.87, 1.88) evenly and the LAST share
  // absorbs the remainder so the total is EXACTLY 7.5 on every rerun.
  const r3 = allocateHours(flatOf(tasks(1, 1, 1, 1)), []);
  assert.deepStrictEqual(r3.allocated, [1.88, 1.87, 1.88, 1.87]);
  assert.strictEqual(r3.total, 7.5);
  const r7 = allocateHours(flatOf(tasks(1, 1, 1, 1, 1, 1, 1)), new Array(7).fill(null));
  assert.strictEqual(r7.total, 7.5);
  // The stored total is rounded at hundredths; the raw allocation sums to
  // the exact daily budget (within float epsilon — no drift, no loss).
  assert.ok(Math.abs(r7.allocated.reduce((a, b) => a + b, 0) - 7.5) < 1e-9);
});

test('v3.2 hours: one final Task with no hours gets the whole 7.5h', () => {
  const res = allocateHours(flatOf(tasks(1)), [null]);
  assert.deepStrictEqual(res.allocated, [7.5]);
});

test('v3.2 hours: zero explicit values are valid and never trigger balancing', () => {
  const res = allocateHours(flatOf(tasks(1, 1)), [0, 0]);
  assert.ok(res.ok, res.errors.join(';'));
  assert.strictEqual(res.mode, 'all-specified');
  assert.deepStrictEqual(res.allocated, [0, 0]);
  assert.strictEqual(res.total, 0);
});

test('v3.2 hours: no final Tasks -> hour collection skipped (not an error)', () => {
  const res = allocateHours([], []);
  assert.ok(res.ok);
  assert.deepStrictEqual(res.allocated, []);
});

test('v3.2 hours: explicit total > 7.5 REJECTED — no silent clipping or reduction', () => {
  const res = allocateHours(flatOf(tasks(1, 1)), [4, 3.51]);
  assert.ok(!res.ok);
  assert.ok(res.errors.some((e) => /exceeds the daily limit 7\.5h/.test(e)), res.errors.join(';'));
  assert.deepStrictEqual(res.allocated, []);
});

test('v3.2 hours: partial total > 7.5 REJECTED (fixed + remainder check)', () => {
  const res = allocateHours(flatOf(tasks(1, 1, 1)), [8, null, null]);
  assert.ok(!res.ok);
  assert.ok(res.errors.some((e) => /exceeds the daily limit 7\.5h/.test(e)), res.errors.join(';'));
});

test('v3.2 hours: invalid numbers rejected — negative, NaN, Infinity, booleans, non-numeric/empty strings', () => {
  for (const bad of [-1, NaN, Infinity, -Infinity, true, false, 'abc', '', ' ', {}, null, []]) {
    // `null` means UNSPECIFIED only inside the balanced set; when every entry
    // is null it is mode C — so test explicit-position invalids with a mix.
    // NOTE: null itself is coerced to 0 by Number() and must be rejected too.
    if (bad === null) continue;
    const res = allocateHours(flatOf(tasks(1, 1)), [bad, 1]);
    assert.ok(!res.ok, `must reject ${String(bad)}`);
  }
  // Numeric strings ARE accepted as finite numbers (e.g. "2" from CLI input).
  const ok = allocateHours(flatOf(tasks(1)), ['2']);
  assert.ok(ok.ok && ok.allocated[0] === 2);
});

test('v3.2 hours: rounding is deterministic at hundredths and totals stay exact', () => {
  const a = allocateHours(flatOf(tasks(1, 1, 1)), [1.005, 2, 3]);
  assert.ok(a.ok);
  assert.strictEqual(a.allocated[0], 1.01);
  assert.strictEqual(a.total, 6.01);
  // Same inputs -> identical outputs across runs (byte-level determinism).
  const b = allocateHours(flatOf(tasks(1, 1, 1, 1, 1, 1)), [null, null, null, null, null, null]);
  const c = allocateHours(flatOf(tasks(1, 1, 1, 1, 1, 1)), [null, null, null, null, null, null]);
  assert.deepStrictEqual(b.allocated, c.allocated);
  assert.strictEqual(b.total, 7.5);
});

test('v3.2 hours: stored-hours validation (persist gate path) enforces finite >= 0 and total <= 7.5', () => {
  assert.ok(validateStoredHours({ A: 2, B: 3, C: 2.5 }).ok);
  assert.ok(!validateStoredHours({ A: 4, B: 4 }).ok);
  assert.ok(!validateStoredHours({ A: -1 }).ok);
  assert.ok(!validateStoredHours({ A: NaN }).ok);
  assert.ok(!validateStoredHours({ A: Infinity }).ok);
  assert.ok(!validateStoredHours({ A: 'xyz' }).ok);
  assert.ok(!validateStoredHours({ A: true }).ok);
});

test('v3.2 hours: 7.5h ceiling is a HARD constant — not configurable, not overridable in either direction', () => {
  assert.strictEqual(DAILY_TOTAL_HOURS, 7.5);
  const tmp = mkTmp('wt-cfg-hours-');
  try {
    const projectsRoot = path.join(tmp, 'projects');
    fs.mkdirSync(projectsRoot, { recursive: true });
    // No DEFAULTS key exists for a daily-hour ceiling.
    assert.ok(!('dailyTotalHours' in configLib.DEFAULTS.limits), 'config schema exposes no daily-hour key');
    // Any value of the removed key — raise OR lower — is rejected loudly.
    for (const v of [8, 10, 7.5, 4]) {
      assert.throws(
        () => configLib.validateAndNormalize({ projectsRoot, reportRoot: tmp, limits: { dailyTotalHours: v } }, 'x'),
        /dailyTotalHours.*hard product invariant/,
        `limits.dailyTotalHours=${v} must be rejected`
      );
    }
    // The CLI override seam is gone too.
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'allocate-hours', '--tasks', '/nonexistent.json', '--daily-total', '4'], { encoding: 'utf8' });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /--daily-total is not supported|ENOENT/);
  } finally {
    rmRecursive(tmp);
  }
});

// --------------------------------------------------------------- DAILY REPORT

const dayDoc = (withHours) => ({
  projects: [
    {
      project: 'backend',
      tasks: [
        { title: 'احراز هویت', subtasks: [{ title: 'لاگین', report: 'امکان ورود با رمز عبور فراهم شد.' }, { title: 'توکن', report: 'تمدید خودکار توکن اضافه شد.' }] },
        { title: 'گزارش‌گیری', subtasks: [{ title: 'خروجی CSV', report: 'گزارش روزانه به صورت CSV قابل دریافت است.' }], hours: withHours ? 3 : undefined },
      ],
    },
    {
      project: 'frontend',
      tasks: [{ title: 'داشبورد', subtasks: [{ title: 'ویجت‌ها', report: 'چیدمان داشبورد با کارت‌های جدید به‌روزرسانی شد.' }], hours: withHours ? 4.5 : undefined }],
    },
  ],
});

test('v3.2 daily report: exactly one section, one entry per Final Task, exact hours, no extra separator', () => {
  const text = renderTasks(dayDoc(true));
  const lines = text.split('\n');
  assert.strictEqual(lines.filter((l) => l.trim() === DAILY_REPORT_LABEL).length, 1);
  const idx = lines.findIndex((l) => l.trim() === DAILY_REPORT_LABEL);
  const entries = lines.slice(idx + 1).filter((l) => l.trim() !== '');
  assert.strictEqual(entries.length, 3, 'one line per final Task');
  assert.deepStrictEqual(entries, ['backend - احراز هویت - 0h', 'backend - گزارش‌گیری - 3h', 'frontend - داشبورد - 4.5h'].map((s) => s.replace('backend - ', '').replace('frontend - ', '')), 'daily entries use bare Task titles');
  assert.strictEqual(entries[0], 'احراز هویت - 0h');
  assert.strictEqual(entries[1], 'گزارش‌گیری - 3h');
  assert.strictEqual(entries[2], 'داشبورد - 4.5h');
  // separators: exactly N-1 between the two repository sections; none for the daily report
  assert.strictEqual(lines.filter((l) => l.trim() === '---').length, 1);
  assert.ok(validateRendered(text, dayDoc(true)).ok);
});

test('v3.2 daily report: Work Item reports are NOT rewritten — repository sections stay byte-identical to v3.1 shape', () => {
  const withDaily = renderTasks(dayDoc(true));
  const without = renderTasks(dayDoc(false));
  const bodyWith = withDaily.split('\n' + DAILY_REPORT_LABEL + '\n')[0].replace(/\n+$/, '');
  // v3.2.0 Daily Report contract: no-hours days ALSO carry the section, so
  // compare against the body BEFORE the label, not the whole file.
  const bodyWithout = without.split('\n' + DAILY_REPORT_LABEL + '\n')[0].replace(/\n+$/, '');
  assert.strictEqual(bodyWith, bodyWithout, 'daily report is purely additive');
  assert.ok(without.includes('امکان ورود با رمز عبور فراهم شد.'), 'reports verbatim');
});

test('v3.2 daily report contract: Git-only day WITHOUT explicit hours still gets exactly one section with auto-distributed equal-split hours (7.5h)', () => {
  const doc = dayDoc(false);
  const text = renderTasks(doc);
  const lines = text.split('\n');
  assert.strictEqual(lines.filter((l) => l.trim() === DAILY_REPORT_LABEL).length, 1, 'exactly one section even with no stored hours');
  const idx = lines.findIndex((l) => l.trim() === DAILY_REPORT_LABEL);
  const entries = lines.slice(idx + 1).filter((l) => l.trim() !== '');
  assert.deepStrictEqual(entries, ['احراز هویت - 2.5h', 'گزارش‌گیری - 2.5h', 'داشبورد - 2.5h'], 'hard 7.5h split equally across 3 final Tasks (deterministic mode-C projection)');
  assert.strictEqual(dailyReportLines(doc).length, 3);
  assert.ok(validateRendered(text, doc).ok, 'validator accepts the projected section');
  // The projection NEVER mutates the tasks document.
  assert.strictEqual(doc.projects[0].tasks[0].hours, undefined, 'tasks doc untouched by display projection');
  // Tampering with a projected entry is rejected by the gate.
  assert.ok(!validateRendered(text.replace('داشبورد - 2.5h', 'داشبورد - 3h'), doc).ok, 'wrong projected hours rejected');
  // Determinism: identical input -> byte-identical output.
  assert.strictEqual(renderTasks(JSON.parse(JSON.stringify(doc))), text);
});

test('v3.2 daily report: validator rejects tampered artifacts (missing/duplicate section, wrong count, wrong hours, extra separator)', () => {
  const doc = dayDoc(true);
  const good = renderTasks(doc);
  assert.ok(validateRendered(good, doc).ok);
  assert.ok(!validateRendered(good.replace(DAILY_REPORT_LABEL, 'گزارش هفتگی'), doc).ok, 'hours present but section missing');
  assert.ok(!validateRendered(good + `\n${DAILY_REPORT_LABEL}\nاظهار - 1h\n`, doc).ok, 'duplicate section');
  assert.ok(!validateRendered(good.replace('گزارش‌گیری - 3h', 'گزارش‌گیری - 4h'), doc).ok, 'hours mismatch vs stored Task hours');
  assert.ok(!validateRendered(good.replace(`\n${DAILY_REPORT_LABEL}`, '\n---\n\n' + DAILY_REPORT_LABEL), doc).ok, 'extra separator for the daily report');
  assert.ok(!validateRendered(good.replace('داشبورد - 4.5h\n', ''), doc).ok, 'dropped daily entry');
});

test('v3.2 daily report: empty day persists an empty file (single output, no fabricated content)', () => {
  const tmp = mkTmp('wt-empty-day-');
  try {
    const cfgPath = path.join(tmp, 'worktrace.yaml');
    const pr = path.join(tmp, 'projects');
    fs.mkdirSync(pr, { recursive: true });
    fs.writeFileSync(cfgPath, `projectsRoot: ${pr}\nreportRoot: ${path.join(tmp, 'reports')}\ntimezone: UTC\n`);
    const tasksPath = path.join(tmp, 'tasks.json');
    fs.writeFileSync(tasksPath, '{"projects":[]}\n');
    const out = path.join(tmp, 'out.txt');
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'persist', '--config', cfgPath, '--date', '2026-10-03', '--tasks', tasksPath], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    const dest = r.stdout.trim();
    assert.ok(dest.endsWith(path.join('2026', '10', '03', 'report.txt')), dest);
    assert.strictEqual(fs.statSync(dest).size, 0, 'empty day -> empty single file');
    assert.strictEqual(fs.readdirSync(path.dirname(dest)).length, 1, 'no second report file');
    const c = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'check', '--file', dest], { encoding: 'utf8' });
    assert.strictEqual(c.status, 0);
    assert.match(c.stdout, /WARN.*empty/);
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.2 persist gate: invalid hours output NEVER replaces the existing daily file; valid rerun is byte-identical', () => {
  const tmp = mkTmp('wt-persist-gate-');
  try {
    const cfgPath = path.join(tmp, 'worktrace.yaml');
    const pr = path.join(tmp, 'projects');
    fs.mkdirSync(pr, { recursive: true });
    fs.writeFileSync(cfgPath, `projectsRoot: ${pr}\nreportRoot: ${path.join(tmp, 'reports')}\ntimezone: UTC\n`);
    const tasksPath = path.join(tmp, 'tasks.json');
    const wiPath = path.join(tmp, 'wi.json');
    fs.writeFileSync(wiPath, JSON.stringify({ projects: [
      { project: 'backend', workItems: [
        { title: 'لاگین', report: 'امکان ورود با رمز عبور فراهم شد.', source: 'git' },
        { title: 'توکن', report: 'تمدید خودکار توکن اضافه شد.', source: 'git' },
        { title: 'خروجی CSV', report: 'گزارش روزانه به صورت CSV قابل دریافت است.', source: 'git' },
      ] },
      { project: '', manual: true, workItems: [{ title: 'هماهنگی تست', report: 'هماهنگی محیط تست با تیم QA انجام شد.', source: 'manual' }] },
    ] }, null, 2));
    const tasksDoc = { projects: [
      { project: 'backend', tasks: [
        { title: 'احراز هویت', subtasks: [
          { title: 'لاگین', report: 'امکان ورود با رمز عبور فراهم شد.' },
          { title: 'توکن', report: 'تمدید خودکار توکن اضافه شد.' },
        ], hours: 3 },
        { title: 'گزارش‌گیری', subtasks: [{ title: 'خروجی CSV', report: 'گزارش روزانه به صورت CSV قابل دریافت است.' }], hours: 1.5 },
      ] },
      { project: '', manual: true, tasks: [
        { title: 'جلسه هماهنگی', subtasks: [{ title: 'هماهنگی تست', report: 'هماهنگی محیط تست با تیم QA انجام شد.' }], hours: 3 },
      ] },
    ] };
    fs.writeFileSync(tasksPath, JSON.stringify(tasksDoc, null, 2));
    const bin = path.join(REPO_ROOT, 'tools', 'bin', 'render.js');
    const persist = (extra) => spawnSync(process.execPath, [bin, 'persist', '--config', cfgPath, '--date', '2026-10-03', '--tasks', tasksPath, '--work-items', wiPath, ...(extra || [])], { encoding: 'utf8' });

    const first = persist();
    assert.strictEqual(first.status, 0, first.stderr + first.stdout);
    const dest = first.stdout.trim();
    const bytes = fs.readFileSync(dest);
    assert.ok(bytes.includes(Buffer.from(DAILY_REPORT_LABEL, 'utf8')), 'daily report inside the single file');
    assert.strictEqual(fs.readdirSync(path.dirname(dest)).length, 1, 'exactly one daily file');

    // Rerun: byte-for-byte identical.
    const second = persist();
    assert.strictEqual(second.status, 0, second.stderr);
    assert.ok(fs.readFileSync(dest).equals(bytes), 'deterministic rerun overwrites identically');

    // Tamper: total hours 8h (> 7.5) -> persist MUST fail and the file MUST survive untouched.
    const bad = JSON.parse(JSON.stringify(tasksDoc));
    bad.projects[1].tasks[0].hours = 3.5; // 3 + 1.5 + 3.5 = 8 > 7.5
    fs.writeFileSync(tasksPath, JSON.stringify(bad, null, 2));
    const failed = persist();
    assert.strictEqual(failed.status, 1, 'over-budget hours rejected');
    assert.match(failed.stderr, /exceeds the daily limit 7\.5h/);
    assert.ok(fs.readFileSync(dest).equals(bytes), 'invalid output did NOT replace the existing report');

    // Tamper: mixed presence (some Tasks with hours, some without).
    const mixed = JSON.parse(JSON.stringify(tasksDoc));
    delete mixed.projects[0].tasks[1].hours;
    fs.writeFileSync(tasksPath, JSON.stringify(mixed, null, 2));
    const failed2 = persist();
    assert.strictEqual(failed2.status, 1, 'partially-present hours rejected (no silent redistribution)');
    assert.ok(fs.readFileSync(dest).equals(bytes), 'existing report still intact');
  } finally {
    rmRecursive(tmp);
  }
});
