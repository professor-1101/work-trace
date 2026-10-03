'use strict';
// v3.1.0 regression suite: separator semantics (N-1 between repositories,
// zero inside a repository section), persist validation gate (CLI), DST-
// sensitive day windows, revert evidence, real CLI E2E workflow with
// deterministic rerun, version consistency and legacy-file removal.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const { renderTasks, validateRendered, validateTasksDoc, effectiveLimits } = require('../lib/render');
const time = require('../lib/time');
const { VERSION } = require('../lib/version');
const { mkTmp, rmRecursive, initRepoWithCommit, addCommit, git } = require('./helpers');

const REPO_ROOT = path.resolve(__dirname, '../..');
const wi = (title, report) => ({ title, report });

test('v3.1 separator semantics: one section per repository; N-1 separators; none between tasks of one repo', () => {
  const doc = {
    projects: [
      { project: 'alpha', tasks: [{ title: 'A1', subtasks: [wi('w1', 'r1')] }, { title: 'A2', subtasks: [wi('w2', 'r2')] }] },
      { project: 'beta', tasks: [{ title: 'B1', subtasks: [wi('w3', 'r3')] }] },
      { project: 'gamma', tasks: [{ title: 'G1', subtasks: [wi('w4', 'r4')] }, { title: 'G2', subtasks: [wi('w5', 'r5')] }] },
    ],
  };
  const text = renderTasks(doc);
  const seps = text.split('\n').filter((l) => l.trim() === '---');
  assert.strictEqual(seps.length, 2, '3 repositories -> exactly 2 separators');
  // No separator between the two tasks of alpha: "alpha - A1" and "alpha - A2"
  // must be in the same section (no --- line between them).
  const alphaSection = text.split('\n\n---\n\n')[0];
  assert.ok(alphaSection.includes('alpha - A1') && alphaSection.includes('alpha - A2'), 'both alpha tasks in one section');
  assert.ok(!alphaSection.includes('---'), 'no separator inside a repository section');
  assert.ok(validateRendered(text, doc).ok);
  // Single repository with multiple tasks -> zero separators.
  const single = renderTasks({ projects: [doc.projects[0]] });
  assert.strictEqual(single.split('\n').filter((l) => l.trim() === '---').length, 0);
  assert.ok(validateRendered(single, { projects: [doc.projects[0]] }).ok);
});

test('v3.1 validator rejects a document with a separator inside one repository section', () => {
  const doc = {
    projects: [
      { project: 'alpha', tasks: [{ title: 'A1', subtasks: [wi('w1', 'r1')] }, { title: 'A2', subtasks: [wi('w2', 'r2')] }] },
      { project: 'beta', tasks: [{ title: 'B1', subtasks: [wi('w3', 'r3')] }] },
    ],
  };
  // Corrupt: insert an extra "---" between alpha's two task blocks.
  const good = renderTasks(doc);
  const corrupted = good.replace('alpha - A2', '---\n\nalpha - A2');
  const res = validateRendered(corrupted, doc);
  assert.ok(!res.ok, 'extra in-section separator detected');
  assert.ok(res.errors.some((e) => /separator line\(s\)|inside repository section/i.test(e)), res.errors.join('; '));
});

test('v3.1 DST-sensitive day window: Tehran 03:30 local day vs America/New_York DST spring-forward day', () => {
  // Asia/Tehran observed DST through 2022: the spring-transition day
  // 2022-03-21 (00:00 -> 01:00 jump at 03:30 local) is 23h long. After Iran
  // abolished DST (effective 2022-09), later years are constant +03:30 and
  // the same calendar day is a full 24h. The engine must follow real IANA
  // tz data in both regimes — never a fixed 24h assumption.
  const d2021 = time.dayBounds('2021-03-21', 'Asia/Tehran');
  assert.strictEqual(d2021.endMs - d2021.startMs, 23 * 3600 * 1000, 'Tehran 2021-03-21 spring-transition day is 23h');
  const d2022 = time.dayBounds('2022-03-21', 'Asia/Tehran');
  assert.strictEqual(d2022.endMs - d2022.startMs, 23 * 3600 * 1000, 'Tehran 2022-03-21 spring-transition day is 23h');
  for (const y of [2023, 2024]) {
    const b = time.dayBounds(`${y}-03-21`, 'Asia/Tehran');
    assert.strictEqual(b.endMs - b.startMs, 24 * 3600 * 1000, `Tehran ${y}-03-21 is a full 24h day (no DST after 2022)`);
  }
  // US spring-forward 2026-03-08: local day is 23 hours long.
  const sf = time.dayBounds('2026-03-08', 'America/New_York');
  assert.strictEqual(sf.endMs - sf.startMs, 23 * 3600 * 1000, 'spring-forward day is 23h');
  // Fall-back 2026-11-01: local day is 25 hours long.
  const fb = time.dayBounds('2026-11-01', 'America/New_York');
  assert.strictEqual(fb.endMs - fb.startMs, 25 * 3600 * 1000, 'fall-back day is 25h');
  // Half-open membership: an instant exactly at dayStart belongs to that day;
  // an instant at nextDayStart does NOT.
  const msInTZ = (dateStr, hourMinSec, tz) => {
    // build an instant from a UTC epoch by checking Intl parts round-trip
    return dateStr;
  };
  const p = time.parts(new Date(sf.startMs), 'America/New_York');
  assert.strictEqual(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, '2026-03-08');
  const pNext = time.parts(new Date(sf.endMs), 'America/New_York');
  assert.strictEqual(`${pNext.year}-${String(pNext.month).padStart(2, '0')}-${String(pNext.day).padStart(2, '0')}`, '2026-03-09', 'end bound is exclusive next day');
  void msInTZ;
});

test('v3.1 collector keeps revert commits as first-class evidence', () => {
  const tmp = mkTmp('wt-revert-');
  try {
    const cfgDir = path.join(tmp, 'projects');
    fs.mkdirSync(cfgDir, { recursive: true });
    const repo = path.join(cfgDir, 'svc');
    const base = Math.floor(Date.UTC(2026, 9, 3, 10, 0, 0) / 1000);
    initRepoWithCommit(repo, { message: 'feat: add risky flag', dateEpochSec: base, file: 'flag.txt', content: 'on\n' });
    addCommit(repo, { message: 'Revert "feat: add risky flag"\n\nThis reverts commit deadbeef.', dateEpochSec: base + 60, file: 'flag.txt', content: 'off\n' });
    const cfgFile = path.join(tmp, 'worktrace.yaml');
    fs.writeFileSync(cfgFile, `projectsRoot: "${cfgDir.replace(/\\/g, '\\\\')}"\nreportRoot: "${tmp.replace(/\\/g, '\\\\')}/reports"\ntimezone: UTC\n`);
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'collect.js'), '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout);
    const svc = out.repositories.find((r) => r.project === 'svc');
    assert.ok(svc, 'repo discovered');
    const rev = svc.commits.find((c) => /Revert/.test(c.message));
    assert.ok(rev, 'revert commit collected with full message');
    assert.ok(/This reverts commit/.test(rev.message), 'revert body preserved (not one-line summary)');
    assert.strictEqual(rev.isRevert, true, 'revert flagged per collector contract');
    const nonRev = svc.commits.find((c) => !/Revert/.test(c.message));
    assert.strictEqual(nonRev.isRevert, false, 'normal commits not misflagged');
  } finally {
    rmRecursive(tmp);
  }
});

function writeCfg(tmp, projectsRoot, timezone) {
  const cfgFile = path.join(tmp, 'worktrace.yaml');
  fs.writeFileSync(cfgFile, `projectsRoot: "${projectsRoot.replace(/\\/g, '\\\\')}"\nreportRoot: "${path.join(tmp, 'reports').replace(/\\/g, '\\\\')}"\ntimezone: ${timezone || 'UTC'}\nlimits:\n  maxTasksPerRepository: 3\n  maxSubtasksPerTask: 3\n`);
  return cfgFile;
}

test('v3.1 persist gate: invalid grouped output NEVER reaches storage; valid output persists atomically and reruns byte-identical', () => {
  const tmp = mkTmp('wt-gate-');
  try {
    const cfgFile = writeCfg(tmp, tmp);
    const tasksPath = path.join(tmp, 'tasks.json');
    const wiPath = path.join(tmp, 'wi.json');
    const workItems = { projects: [{ project: 'alpha', workItems: [wi('t1', 'r1'), wi('t2', 'r2'), wi('t3', 'r3'), wi('t4', 'r4')] }] };
    fs.writeFileSync(wiPath, JSON.stringify(workItems));
    // Invalid: 4 tasks > configured cap 3 AND t4 dropped.
    const bad = { projects: [{ project: 'alpha', tasks: [{ title: 'X', subtasks: [wi('t1', 'r1')] }] }] };
    fs.writeFileSync(tasksPath, JSON.stringify(bad));
    const runPersist = () => spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'persist', '--tasks', tasksPath, '--work-items', wiPath, '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true });
    const badRun = runPersist();
    assert.strictEqual(badRun.status, 1, 'persist fails on invalid grouping');
    const dest = path.join(tmp, 'reports', '2026', '10', '03', 'report.txt');
    assert.ok(!fs.existsSync(dest), 'nothing written on failed validation');
    assert.ok(badRun.stderr.includes('missing from the grouped output'), 'drop reported explicitly');
    // Valid grouping under the cap: 3 tasks x ... use 4 items packed 2+2 into 2 tasks.
    const good = { projects: [{ project: 'alpha', tasks: [{ title: 'Obj A', subtasks: [wi('t1', 'r1'), wi('t2', 'r2')] }, { title: 'Obj B', subtasks: [wi('t3', 'r3'), wi('t4', 'r4')] }] }] };
    fs.writeFileSync(tasksPath, JSON.stringify(good));
    const okRun = runPersist();
    assert.strictEqual(okRun.status, 0, okRun.stderr);
    assert.ok(fs.existsSync(dest));
    const first = fs.readFileSync(dest, 'utf8');
    assert.ok(first.startsWith('alpha - Obj A'), first.slice(0, 40));
    assert.ok(!first.includes('---'), 'single repository -> no separators');
    // Deterministic rerun: byte-identical.
    assert.strictEqual(runPersist().status, 0);
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), first, 'rerun byte-identical');
    assert.deepStrictEqual(fs.readdirSync(path.dirname(dest)), ['report.txt'], 'atomic replace leaves no temp files');
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.1 persist gate: rewritten Work Item report blocks storage', () => {
  const tmp = mkTmp('wt-gate2-');
  try {
    const cfgFile = writeCfg(tmp, tmp);
    const wiPath = path.join(tmp, 'wi.json');
    const tasksPath = path.join(tmp, 'tasks.json');
    fs.writeFileSync(wiPath, JSON.stringify({ projects: [{ project: 'p', workItems: [wi('title', 'اصل گزارش')] }] }));
    fs.writeFileSync(tasksPath, JSON.stringify({ projects: [{ project: 'p', tasks: [{ title: 'T', subtasks: [wi('title', 'گزارش کوتاه‌شده')] }] }] }));
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'persist', '--tasks', tasksPath, '--work-items', wiPath, '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(res.status, 1);
    assert.ok(res.stderr.includes('VERBATIM'), 'rewrite detected by name');
    assert.ok(!fs.existsSync(path.join(tmp, 'reports', '2026', '10', '03', 'report.txt')));
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.1 E2E CLI workflow: discover -> collect -> work items fixture -> validate -> render -> check -> persist (multi-repo, verbatim)', () => {
  const tmp = mkTmp('wt-e2e-');
  try {
    const projectsRoot = path.join(tmp, 'projects');
    fs.mkdirSync(projectsRoot, { recursive: true });
    // Committers use explicit EPOCH offsets from Tehran midnight of the
    // target day (UTC 2026-10-02T20:30Z), so window membership is correct
    // regardless of the machine running the tests.
    const tehranDayStart = Math.floor(time.dayBounds('2026-10-03', 'Asia/Tehran').startMs / 1000);
    const base = tehranDayStart + 9 * 3600; // 09:00 Tehran
    const alpha = path.join(projectsRoot, 'alpha');
    initRepoWithCommit(alpha, { message: 'feat(auth): add session refresh endpoint', dateEpochSec: base, file: 'auth.js', content: 'refresh()\n' });
    addCommit(alpha, { message: 'fix(auth): guard token expiry race', dateEpochSec: base + 120, file: 'auth.js', content: 'refresh()+guard\n' });
    const beta = path.join(projectsRoot, 'nested', 'beta');
    initRepoWithCommit(beta, { message: 'docs: deploy runbook', dateEpochSec: base + 300, file: 'RUNBOOK.md', content: '# steps\n' });
    // yesterday commit (before Tehran day start) must NOT appear
    addCommit(alpha, { message: 'chore: old', dateEpochSec: tehranDayStart - 3600, file: 'old.txt', content: 'x\n' });

    const cfgFile = writeCfg(tmp, projectsRoot, 'Asia/Tehran');
    const evidencePath = path.join(tmp, 'evidence.json');
    const collect = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'collect.js'), '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(collect.status, 0, collect.stderr);
    fs.writeFileSync(evidencePath, collect.stdout);
    const evidence = JSON.parse(collect.stdout);
    const names = evidence.repositories.map((r) => r.project).sort();
    assert.deepStrictEqual(names, ['alpha', 'beta'], 'nested discovery works');
    const alphaCommits = evidence.repositories.find((r) => r.project === 'alpha').commits;
    assert.strictEqual(alphaCommits.length, 2, 'today-only window excludes yesterday commit');

    // Canonical Work Items (stand-in for frozen Skill output; verbatim strings).
    const wiDoc = {
      projects: [
        { project: 'alpha', workItems: [wi('Session refresh endpoint shipped', 'مدرک: feat(auth): add session refresh endpoint'), wi('Token expiry race fixed', 'مدرک: fix(auth): guard token expiry race')] },
        { project: 'beta', workItems: [wi('Deploy runbook documented', 'مدرک: docs: deploy runbook')] },
      ],
    };
    const wiPath = path.join(tmp, 'wi.json');
    fs.writeFileSync(wiPath, JSON.stringify(wiDoc));
    const vw = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'validate-workitems', '--evidence', evidencePath, '--work-items', wiPath], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(vw.status, 0, vw.stderr);

    // Grouping fixture (LLM judgment stand-in): alpha's two items share one objective.
    const tasks = {
      projects: [
        { project: 'alpha', tasks: [{ title: 'احراز هویت مقاوم شد', subtasks: wiDoc.projects[0].workItems }] },
        { project: 'beta', tasks: [{ title: 'مستندسازی استقرار', subtasks: wiDoc.projects[1].workItems }] },
      ],
    };
    const tasksPath = path.join(tmp, 'tasks.json');
    fs.writeFileSync(tasksPath, JSON.stringify(tasks));
    const vt = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'validate-tasks', '--work-items', wiPath, '--tasks', tasksPath, '--evidence', evidencePath, '--config', cfgFile], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(vt.status, 0, vt.stderr);

    const reportPath = path.join(tmp, 'report.txt');
    const rr = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'render', '--tasks', tasksPath, '--out', reportPath], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(rr.status, 0, rr.stderr);
    const ck = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'check', '--file', reportPath, '--tasks', tasksPath], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(ck.status, 0, ck.stderr);
    const rendered = fs.readFileSync(reportPath, 'utf8');
    assert.strictEqual(rendered.split('\n').filter((l) => l.trim() === '---').length, 1, 'two repos -> one separator');
    // Verbatim preservation in the artifact itself:
    for (const p of wiDoc.projects) for (const w of p.workItems) { assert.ok(rendered.includes(w.title) && rendered.includes(w.report), `verbatim WI present: ${w.title}`); }

    const pp = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'persist', '--tasks', tasksPath, '--work-items', wiPath, '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(pp.status, 0, pp.stderr);
    const dest = pp.stdout.trim();
    assert.ok(dest.endsWith(path.join('2026', '10', '03', 'report.txt')), dest);
    const persisted = fs.readFileSync(dest, 'utf8');
    assert.strictEqual(persisted, rendered, 'persisted bytes equal rendered bytes');
    // Rerun: byte-identical, no duplicates.
    assert.strictEqual(spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'persist', '--tasks', tasksPath, '--work-items', wiPath, '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true }).status, 0);
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), persisted, 'deterministic rerun');
    assert.deepStrictEqual(fs.readdirSync(path.dirname(dest)), ['report.txt']);
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.1 empty-day end-to-end produces an empty file', () => {
  const tmp = mkTmp('wt-empty-');
  try {
    const projectsRoot = path.join(tmp, 'projects');
    fs.mkdirSync(projectsRoot, { recursive: true });
    const cfgFile = writeCfg(tmp, projectsRoot);
    const tasksPath = path.join(tmp, 'tasks.json');
    fs.writeFileSync(tasksPath, '{"projects":[]}');
    const pp = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools', 'bin', 'render.js'), 'persist', '--tasks', tasksPath, '--config', cfgFile, '--date', '2026-10-03'], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(pp.status, 0, pp.stderr);
    assert.strictEqual(fs.readFileSync(pp.stdout.trim(), 'utf8'), '', 'empty day -> empty file');
  } finally {
    rmRecursive(tmp);
  }
});

test('v3.2 version consistency across all derived locations', () => {
  assert.strictEqual(VERSION, '3.2.0');
  assert.strictEqual(fs.readFileSync(path.join(REPO_ROOT, 'VERSION'), 'utf8').trim(), VERSION);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools', 'package.json'), 'utf8')).version, VERSION);
  const skill = fs.readFileSync(path.join(REPO_ROOT, '.cline', 'skills', 'worktrace-report', 'SKILL.md'), 'utf8');
  assert.ok(skill.includes(`version: "${VERSION}"`));
  const changelog = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
  assert.ok(changelog.includes(`## ${VERSION}`), 'current version documented');
  assert.ok(changelog.includes('## 3.0.0'), 'historical entries remain');
});

test('v3.1 legacy All-in-One files are gone and have zero live references', () => {
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'WORKTRACE-ALL-IN-ONE.md')), 'WORKTRACE-ALL-IN-ONE.md removed');
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'scripts', 'build-all-in-one.sh')), 'build-all-in-one.sh removed');
  // Live reference scan: README may mention removal explicitly; CHANGELOG refs
  // are historical; nothing else may reference either file.
  const files = ['README.md', 'CHANGELOG.md', '.clinerules/worktrace-workflow.md', '.cline/skills/worktrace-report/SKILL.md', '.cline/skills/worktrace-report/docs/grouping.md', '.cline/skills/worktrace-report/docs/output-format.md', 'scripts/install.js', 'config/worktrace.example.yaml'];
  for (const f of files) {
    if (!fs.existsSync(path.join(REPO_ROOT, f))) continue;
    const src = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    if (f === 'README.md' || f === 'CHANGELOG.md') {
      // allowed: removal documentation / historical changelog only
      continue;
    }
    assert.ok(!/WORKTRACE-ALL-IN-ONE|build-all-in-one/.test(src), `live reference in ${f}`);
  }
});
