'use strict';
// Behavioral tests for the deterministic git collector (Phase 3/4).
// Covers required behaviors: repository discovery, nested repositories, no
// repository, no commits today, commits today, multiple repositories, date
// boundaries, timezone, merges, broken repositories, Windows/Linux paths.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const gitLib = require('../lib/git');
const timeLib = require('../lib/time');
const configLib = require('../lib/config');
const { mkTmp, rmRecursive, git, initRepoWithCommit, addCommit } = require('./helpers');

function baseCfg(root, extra) {
  const raw = Object.assign({ projectsRoot: root, reportRoot: path.join(root, '..', 'reports'), timezone: 'Asia/Tehran' }, extra || {});
  return configLib.validateAndNormalize(raw, '<test>');
}

test('1. repository discovery finds .git dirs and .git files (worktrees/submodules)', () => {
  const tmp = mkTmp('wt-discover-');
  try {
    const root = path.join(tmp, 'projects');
    const main = path.join(root, 'mainrepo');
    initRepoWithCommit(main, { message: 'feat: base' });
    // linked worktree -> .git FILE (not dir)
    git(main, ['worktree', 'add', '--detach', path.join(root, 'wt1'), 'HEAD']);
    const disc = gitLib.discoverRepositories(baseCfg(root));
    const rels = disc.repositories.map((r) => r.relativePath).sort();
    assert.ok(rels.includes('mainrepo'), 'main repo found');
    assert.ok(rels.includes('wt1'), 'worktree (.git file) found');
  } finally {
    rmRecursive(tmp);
  }
});

test('2. nested repositories are discovered and marked nestedUnder', () => {
  const tmp = mkTmp('wt-nested-');
  try {
    const root = path.join(tmp, 'projects');
    initRepoWithCommit(path.join(root, 'outer'), { message: 'feat: outer' });
    initRepoWithCommit(path.join(root, 'outer', 'inner'), { message: 'feat: inner' });
    const disc = gitLib.discoverRepositories(baseCfg(root));
    const inner = disc.repositories.find((r) => r.projectName === 'inner');
    assert.ok(inner, 'nested repo discovered');
    assert.deepStrictEqual(inner.nestedUnder, ['outer']);
    assert.ok(disc.nested.some((n) => n.repo === 'outer/inner' && n.under === 'outer'));
  } finally {
    rmRecursive(tmp);
  }
});

test('2b. duplicate realpath detected deterministically even with include filter', () => {
  if (process.platform === 'win32') return; // symlink test is POSIX here; Windows dup covered by walker realpath guard
  const tmp = mkTmp('wt-dup-');
  try {
    const real = path.join(tmp, 'realroot', 'app');
    initRepoWithCommit(real, { message: 'feat: app' });
    const root = path.join(tmp, 'projects');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(path.join(tmp, 'realroot'), path.join(root, 'mirror'));
    fs.symlinkSync(real, path.join(root, 'app-alias'));
    const cfg = baseCfg(root, { discovery: { followSymlinks: true, include: ['app-alias'] } });
    const disc = gitLib.discoverRepositories(cfg);
    // Only one active copy; the other recorded as duplicate-path.
    assert.strictEqual(disc.repositories.length, 1);
    assert.ok(disc.ignored.some((i) => i.reason === 'duplicate-path'));
  } finally {
    rmRecursive(tmp);
  }
});

test('3. no repository under projects root yields zero repos, exit-ok shape', () => {
  const tmp = mkTmp('wt-empty-root-');
  try {
    const root = path.join(tmp, 'projects');
    fs.mkdirSync(path.join(root, 'plaindir'), { recursive: true });
    fs.writeFileSync(path.join(root, 'plaindir', 'readme.txt'), 'no git here');
    const doc = gitLib.collectAll(baseCfg(root), '2026-10-03', new Date('2026-10-03T12:00:00Z'));
    assert.strictEqual(doc.repositories.length, 0);
    assert.strictEqual(doc.totals.commits, 0);
    assert.strictEqual(doc.hasRealFailure, false);
  } finally {
    rmRecursive(tmp);
  }
});

test('4/5/6. no commits today vs commits today across multiple repositories', () => {
  const tmp = mkTmp('wt-commits-');
  try {
    const root = path.join(tmp, 'projects');
    // Commit at 2026-10-03 08:00 Tehran == 04:30 UTC
    const tehranToday = Math.floor(Date.UTC(2026, 9, 3, 4, 30, 0) / 1000);
    initRepoWithCommit(path.join(root, 'alpha'), { message: 'feat: alpha today', dateEpochSec: tehranToday });
    initRepoWithCommit(path.join(root, 'beta'), { message: 'fix: beta yesterday', dateEpochSec: tehranToday - 86400 });
    const cfg = baseCfg(root);
    const doc = gitLib.collectAll(cfg, '2026-10-03', new Date('2026-10-03T12:00:00Z'));
    assert.strictEqual(doc.repositories.length, 2, 'multiple repositories collected');
    const alpha = doc.repositories.find((r) => r.project === 'alpha');
    const beta = doc.repositories.find((r) => r.project === 'beta');
    assert.strictEqual(alpha.commits.length, 1);
    assert.strictEqual(beta.commits.length, 0, 'yesterday commit excluded from today');
    assert.strictEqual(doc.totals.repositoriesWithCommits, 1);
    // Evidence preservation: full message + hash + dates + stat/diff present.
    const c = alpha.commits[0];
    assert.match(c.hash, /^[0-9a-f]{40}$/);
    assert.strictEqual(c.subject, 'feat: alpha today');
    assert.ok(c.evidence.stats && c.evidence.stats.files >= 1);
    assert.ok(typeof c.evidence.diff === 'string' && c.evidence.diff.includes('+++'));
    assert.ok(c.author.date && c.committer.date, 'author and committer dates preserved');
  } finally {
    rmRecursive(tmp);
  }
});

test('7. date boundaries: first second of local day included, last excluded', () => {
  const tmp = mkTmp('wt-bounds-');
  try {
    const root = path.join(tmp, 'projects');
    const bounds = timeLib.dayBounds('2026-10-03', 'Asia/Tehran'); // +03:30
    const firstSec = Math.floor(bounds.startMs / 1000); // 00:00:00 Tehran
    const lastSec = Math.floor(bounds.endMs / 1000) - 1; // 23:59:59 Tehran
    const afterEnd = Math.floor(bounds.endMs / 1000); // next day 00:00:00
    const repo = path.join(root, 'edge');
    initRepoWithCommit(repo, { message: 'feat: first second', dateEpochSec: firstSec });
    addCommit(repo, { message: 'feat: last second', dateEpochSec: lastSec, file: 'b.txt' });
    addCommit(repo, { message: 'feat: tomorrow', dateEpochSec: afterEnd, file: 'c.txt' });
    const doc = gitLib.collectAll(baseCfg(root), '2026-10-03', new Date('2026-10-03T12:00:00Z'));
    const msgs = doc.repositories[0].commits.map((c) => c.subject);
    // NOTE: git's --since/--until filter walks by commit date BUT keeps any
    // commit whose ancestors touch the window; the collector post-filters to
    // the exact [start,end) committer-date interval (see collectCommitsInRange).
    assert.deepStrictEqual(msgs.sort(), ['feat: first second', 'feat: last second']);
  } finally {
    rmRecursive(tmp);
  }
});

test('8. timezone changes which instant counts as "today"', () => {
  // Same instant: 2026-10-03T00:10:00Z is Oct 3 in UTC but still Oct 2 in Tehran (03:40 offset).
  const inst = new Date('2026-10-03T00:10:00Z');
  assert.strictEqual(timeLib.resolveTargetDate(inst, 'UTC', 'today'), '2026-10-03');
  assert.strictEqual(timeLib.resolveTargetDate(inst, 'Asia/Tehran', 'today'), '2026-10-03'); // 03:40 -> still Oct 3
  const inst2 = new Date('2026-10-02T21:00:00Z');
  assert.strictEqual(timeLib.resolveTargetDate(inst2, 'UTC', 'today'), '2026-10-02');
  assert.strictEqual(timeLib.resolveTargetDate(inst2, 'Asia/Tehran', 'today'), '2026-10-03'); // 00:30 next day
  assert.strictEqual(timeLib.resolveTargetDate(inst2, 'America/New_York', 'today'), '2026-10-02'); // 17:00 same day
  // offset behavior
  assert.strictEqual(timeLib.resolveTargetDate(inst2, 'Asia/Tehran', 'offset:-1'), '2026-10-02');
});

test('9. merge commits flagged, parents kept, first-parent evidence collected', () => {
  const tmp = mkTmp('wt-merge-');
  try {
    const root = path.join(tmp, 'projects');
    const repo = path.join(root, 'm');
    initRepoWithCommit(repo, { message: 'feat: base' });
    git(repo, ['checkout', '-q', '-b', 'feature']);
    addCommit(repo, { message: 'feat: inside feature', file: 'feat.txt' });
    git(repo, ['checkout', '-q', 'main']);
    addCommit(repo, { message: 'feat: main change', file: 'main.txt' });
    git(repo, ['merge', '-q', '--no-ff', '-m', 'Merge branch feature', 'feature']);
    const epochNow = Math.floor(Date.now() / 1000);
    const doc = gitLib.collectAll(baseCfg(root), timeLib.ymd(new Date(epochNow * 1000), 'UTC'), new Date());
    const commits = doc.repositories[0].commits;
    const merge = commits.find((c) => c.isMerge);
    assert.ok(merge, 'merge commit detected');
    assert.strictEqual(merge.parents.length, 2);
    assert.ok(merge.evidence.stats, 'merge keeps first-parent stat evidence');
  } finally {
    rmRecursive(tmp);
  }
});

test('10. broken repository: error recorded, hasRealFailure=true; empty repo: clean success', () => {
  const tmp = mkTmp('wt-broken-');
  try {
    const root = path.join(tmp, 'projects');
    // empty repo (has .git, no commits) — valid outcome, not a failure
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    git(empty, ['init', '--quiet', '-b', 'main']);
    // broken repo: .git dir exists but objects removed
    const broken = path.join(root, 'broken');
    initRepoWithCommit(broken, { message: 'feat: will break' });
    rmRecursive(path.join(broken, '.git', 'objects'));
    const doc = gitLib.collectAll(baseCfg(root), '2026-10-03', new Date());
    const emptyRec = doc.repositories.find((r) => r.project === 'empty');
    const brokenRec = doc.repositories.find((r) => r.project === 'broken');
    assert.ok(emptyRec.state.empty === true || !emptyRec.state.head, 'empty repo recognized');
    assert.strictEqual(emptyRec.errors.length, 0);
    assert.ok(brokenRec.errors.some((e) => /broken repository/.test(e)), 'broken repo flagged');
    assert.strictEqual(doc.hasRealFailure, true, 'real failure propagates for non-zero exit');
  } finally {
    rmRecursive(tmp);
  }
});

test('10b. detached HEAD handled without error', () => {
  const tmp = mkTmp('wt-detached-');
  try {
    const root = path.join(tmp, 'projects');
    const repo = path.join(root, 'd');
    initRepoWithCommit(repo, { message: 'feat: one' });
    addCommit(repo, { message: 'feat: two', file: 'b.txt' });
    git(repo, ['checkout', '-q', '--detach', 'HEAD~1']);
    const st = gitLib.repoState(repo);
    assert.strictEqual(st.detached, true);
    assert.strictEqual(st.error, null);
    assert.ok(st.head);
  } finally {
    rmRecursive(tmp);
  }
});

test('10c. bot commits flagged but never filtered; multiline messages preserved', () => {
  const tmp = mkTmp('wt-bot-');
  try {
    const root = path.join(tmp, 'projects');
    const repo = path.join(root, 'b');
    initRepoWithCommit(repo, {
      message: 'chore: bump deps\n\nBody line one.\nBody line two.',
      authorName: 'dependabot[bot]',
      authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
    });
    const doc = gitLib.collectAll(baseCfg(root), timeLib.ymd(new Date(), 'UTC'), new Date());
    const c = doc.repositories[0].commits[0];
    assert.strictEqual(c.bot, true);
    assert.ok(c.message.includes('Body line one.') && c.message.includes('Body line two.'), 'multiline body intact');
  } finally {
    rmRecursive(tmp);
  }
});

test('deriveProjectName applies nameOverrides and tail-of-path default', () => {
  const root = path.join(os.tmpdir(), 'irrelevant');
  assert.strictEqual(gitLib.deriveProjectName(path.join(root, 'apps', 'web'), root, {}), 'web');
  assert.strictEqual(gitLib.deriveProjectName(path.join(root, 'apps', 'web'), root, { 'apps/web': 'Frontend Portal' }), 'Frontend Portal');
});

test('21/22. cross-platform path handling: layouts with / and \\ resolve per-platform', () => {
  const storage = require('../lib/storage');
  // Linux-style layout on the current platform:
  const p = storage.resolveReportPath('{root}/YYYY/MM/DD/report.txt', path.resolve('/base'), '2026-10-03');
  assert.ok(p.endsWith(`report.txt`));
  assert.ok(p.startsWith(path.resolve('/base')));
  const segs = p.split(path.sep);
  assert.deepStrictEqual(segs.slice(-4), ['2026', '10', '03', 'report.txt']);
  // Windows-style layout string must normalize to native separators too:
  const w = storage.resolveReportPath('{root}\\YYYY\\MM\\DD\\report.txt', path.resolve('.'), '2026-10-03');
  assert.ok(w.endsWith('report.txt'));
  assert.ok(w.split(path.sep).slice(-4).join('/') === '2026/10/03/report.txt');
});
