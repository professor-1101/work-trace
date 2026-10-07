'use strict';
// Tests for config loading/validation, YAML parser fallback, installer
// idempotence + user-config preservation, and single-source versioning.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const configLib = require('../lib/config');
const yamlLib = require('../lib/yaml');
const { VERSION } = require('../lib/version');
const { mkTmp, rmRecursive } = require('./helpers');

test('config: full example file parses (subset parser) and validates', () => {
  const example = path.resolve(__dirname, '../../config/worktrace.example.yaml');
  const raw = yamlLib.loadFile(example);
  assert.ok(raw && typeof raw === 'object');
  assert.strictEqual(raw.timezone, 'Asia/Tehran');
  // The example uses placeholder paths; validate with roots replaced by real dirs.
  const tmp = mkTmp('wt-cfg-');
  try {
    const projectsRoot = path.join(tmp, 'projects');
    fs.mkdirSync(projectsRoot, { recursive: true });
    const merged = JSON.parse(JSON.stringify(raw));
    merged.projectsRoot = projectsRoot;
    merged.reportRoot = path.join(tmp, 'reports');
    const cfg = configLib.validateAndNormalize(merged, example);
    assert.strictEqual(cfg.timezone, 'Asia/Tehran');
    assert.strictEqual(cfg.output.layout, '{root}/YYYY/MM/DD/report.txt');
    assert.deepStrictEqual(cfg.discovery.skipDirs, raw.discovery.skipDirs);
    assert.strictEqual(cfg.limits.maxCommitsPerRepo, 500);
  } finally {
    rmRecursive(tmp);
  }
});

test('config: invalid values rejected with clear errors', () => {
  const tmp = mkTmp('wt-cfg-bad-');
  try {
    const projectsRoot = path.join(tmp, 'projects');
    fs.mkdirSync(projectsRoot, { recursive: true });
    assert.throws(() => configLib.validateAndNormalize({ projectsRoot, reportRoot: tmp, timezone: 'Not/AZone' }, 'x'), /Invalid IANA timezone/);
    assert.throws(() => configLib.validateAndNormalize({ projectsRoot, reportRoot: tmp, date: { behavior: 'tomorrow' } }, 'x'), /date\.behavior/);
    assert.throws(() => configLib.validateAndNormalize({ projectsRoot, reportRoot: tmp, limits: { maxRepos: 0 } }, 'x'), /limits\.maxRepos/);
    assert.throws(() => configLib.validateAndNormalize({ projectsRoot, reportRoot: tmp, output: { layout: 'YYYY/report.txt' } }, 'x'), /\{root\}/);
    assert.throws(() => configLib.validateAndNormalize({ reportRoot: tmp }, 'x'), /projectsRoot.*is required/);
    assert.throws(() => configLib.validateAndNormalize({ projectsRoot: path.join(tmp, 'nope'), reportRoot: tmp }, 'x'), /does not exist/);
  } finally {
    rmRecursive(tmp);
  }
});

test('config: search order honors WORKTRACE_CONFIG over ./worktrace.yaml', () => {
  const tmp = mkTmp('wt-cfg-order-');
  const cwd = process.cwd();
  try {
    process.chdir(tmp);
    fs.writeFileSync(path.join(tmp, 'worktrace.yaml'), `projectsRoot: "${tmp.replace(/\\/g, '\\\\')}"\nreportRoot: "${tmp.replace(/\\/g, '\\\\')}"\ntimezone: UTC\n`);
    const envFile = path.join(tmp, 'env.yaml');
    fs.writeFileSync(envFile, `projectsRoot: "${tmp.replace(/\\/g, '\\\\')}"\nreportRoot: "${tmp.replace(/\\/g, '\\\\')}"\ntimezone: Europe/Berlin\n`);
    const a = configLib.load();
    assert.strictEqual(a.timezone, 'UTC');
    process.env.WORKTRACE_CONFIG = envFile;
    const b = configLib.load();
    assert.strictEqual(b.timezone, 'Europe/Berlin');
    delete process.env.WORKTRACE_CONFIG;
  } finally {
    process.chdir(cwd);
    rmRecursive(tmp);
  }
});

test('yaml subset parser handles quoted strings, inline lists, nested maps', () => {
  const src = [
    'projectsRoot: "C:\\\\Users\\\\me\\\\projects" # comment',
    'timezone: Asia/Tehran',
    'discovery:',
    '  include: ["apps/web", "libs/core"]',
    '  skipDirs:',
    '    - node_modules',
    '    - dist',
    '  nameOverrides:',
    '    apps/web: "Frontend Portal"',
    'limits:',
    '  maxRepos: 200',
    'output:',
    '  layout: "{root}/YYYY/MM/DD/report.txt"',
    '  atomicReplace: true',
  ].join('\n');
  const obj = yamlLib.parse(src);
  assert.strictEqual(obj.projectsRoot, 'C:\\Users\\me\\projects');
  assert.deepStrictEqual(obj.discovery.include, ['apps/web', 'libs/core']);
  assert.deepStrictEqual(obj.discovery.skipDirs, ['node_modules', 'dist']);
  assert.strictEqual(obj.discovery.nameOverrides['apps/web'], 'Frontend Portal');
  assert.strictEqual(obj.limits.maxRepos, 200);
  assert.strictEqual(obj.output.atomicReplace, true);
});

test('23+24. installer is idempotent and preserves user configuration', () => {
  const tmp = mkTmp('wt-install-');
  try {
    const target = path.join(tmp, 'target');
    fs.mkdirSync(target, { recursive: true });
    const repoRoot = path.resolve(__dirname, '../..');
    const run = () =>
      spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'install.js'), '--target', target, '--no-npm'], {
        encoding: 'utf8',
        windowsHide: true,
      });
    const first = run();
    assert.strictEqual(first.status, 0, first.stderr + first.stdout);
    // ONE unified report Skill installed under both discovery layouts.
    const skillSrc = path.join(repoRoot, '.github', 'skills', 'report', 'SKILL.md');
    const ghDst = path.join(target, '.github', 'skills', 'report', 'SKILL.md');
    const clineDst = path.join(target, '.cline', 'skills', 'report', 'SKILL.md');
    assert.ok(fs.existsSync(ghDst));
    assert.ok(fs.existsSync(clineDst));
    assert.strictEqual(fs.readFileSync(ghDst, 'utf8'), fs.readFileSync(skillSrc, 'utf8'), 'skill copied verbatim (.github)');
    assert.strictEqual(fs.readFileSync(clineDst, 'utf8'), fs.readFileSync(skillSrc, 'utf8'), 'skill copied verbatim (.cline)');
    // No second WorkTrace skill may be installed (one-skill architecture).
    assert.ok(!fs.existsSync(path.join(target, '.github', 'skills', 'worktrace-daily-report')));
    assert.ok(!fs.existsSync(path.join(target, '.github', 'skills', 'worktrace-report')));
    assert.ok(!fs.existsSync(path.join(target, '.cline', 'skills', 'worktrace-report')));
    assert.ok(!fs.existsSync(path.join(target, '.cline', 'skills', 'worktrace-daily-report')));
    // Unified frontmatter: the /report identity.
    const fm = fs.readFileSync(ghDst, 'utf8');
    assert.ok(fm.includes('name: report'), 'frontmatter name is report (the /report identity)');
    assert.ok(fm.startsWith('---\nname: report'), 'skill frontmatter starts with name: report');
    assert.ok(fs.existsSync(path.join(target, 'tools', 'bin', 'collect.js')));
    // Version marker written.
    assert.strictEqual(fs.readFileSync(path.join(target, '.cline', 'worktrace', 'version'), 'utf8').trim(), VERSION);
    // User edits the generated config...
    const userCfg = path.join(target, 'worktrace.yaml');
    const edited = fs.readFileSync(userCfg, 'utf8').replace('timezone: Asia/Tehran', 'timezone: Europe/Berlin');
    fs.writeFileSync(userCfg, edited);
    // ...then re-runs the installer (update): config must be preserved.
    const second = run();
    assert.strictEqual(second.status, 0, second.stderr + second.stdout);
    assert.ok(second.stdout.includes('kept existing'), 'installer reports preserving config');
    assert.strictEqual(fs.readFileSync(userCfg, 'utf8'), edited, 'user config preserved across update');
    // Third run: still fine (idempotence).
    assert.strictEqual(run().status, 0);
    // --check reports installed version.
    const check = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'install.js'), '--target', target, '--check'], { encoding: 'utf8', windowsHide: true });
    assert.strictEqual(check.status, 0);
    assert.ok(check.stdout.includes(VERSION));
  } finally {
    rmRecursive(tmp);
  }
});

test('25. single authoritative version source consistent everywhere', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools', 'package.json'), 'utf8'));
  assert.strictEqual(pkg.version, VERSION, 'package.json matches version.js');
  const versionFile = path.join(repoRoot, 'VERSION');
  if (fs.existsSync(versionFile)) {
    assert.strictEqual(fs.readFileSync(versionFile, 'utf8').trim(), VERSION, 'VERSION file matches');
  }
  const skillMd = fs.readFileSync(path.join(repoRoot, '.github', 'skills', 'report', 'SKILL.md'), 'utf8');
  assert.ok(skillMd.includes(`version: "${VERSION}"`), 'workflow skill metadata matches');
  const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
  assert.ok(changelog.includes(`## ${VERSION}`), 'CHANGELOG documents current version');
});
