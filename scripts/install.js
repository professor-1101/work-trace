#!/usr/bin/env node
'use strict';
// WORKTRACE installer — installing/updating the unified `report` Skill.
// One Skill architecture (v3.3.0): .github/skills/report -> invoked as /report.
// No second skill; all semantic rules live inside the unified Skill.
//
// Usage:
//   node scripts/install.js --target <dir> [--no-npm]      initial install
//   node scripts/install.js --target <dir> --update        sync managed files
//   node scripts/install.js --target <dir> --check         report version/health
// Exit codes: 0 ok, 1 error, 2 usage, 3 conflict on --update.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { VERSION } = require('../tools/lib/version');

function parseArgs(argv) {
  const out = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--no-npm') out.noNpm = true;
    else if (a === '--update') out.update = true;
    else if (a === '--check') out.check = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else out.positional.push(a);
  }
  return out;
}
const REPO_ROOT = path.resolve(__dirname, '..');
const SKILL_SRC = path.join(REPO_ROOT, '.github', 'skills', 'report');
const TOOLS_SRC = path.join(REPO_ROOT, 'tools');
const EXAMPLE_CFG = path.join(REPO_ROOT, 'config', 'worktrace.example.yaml');
// The unified Skill is installed under BOTH layouts so it is discoverable by
// Copilot (.github/skills/report -> /report) and by Cline (.cline/skills/report).
const SKILL_TARGETS = [
  path.join('.github', 'skills', 'report'),
  path.join('.cline', 'skills', 'report'),
];
// Managed = files owned by the installer (may be updated/removed on --update).
const MANAGED_PREFIXES = [
  path.join('.github', 'skills', 'report'),
  path.join('.cline', 'skills', 'report'),
  path.join('.cline', 'worktrace'),
  'tools',
];
function sh(cmd, args, cwd) {
  return spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, cwd: cwd || REPO_ROOT });
}
function listFiles(dir, base) {
  const rel = base || '';
  const out = [];
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (_) {
    return out;
  }
  for (const n of names) {
    if (n === 'node_modules' || n === '.worktrace') continue;
    const abs = path.join(dir, n);
    const st = fs.statSync(abs);
    const r = rel ? rel + path.sep + n : n;
    if (st.isDirectory()) out.push(...listFiles(abs, r));
    else out.push(r);
  }
  return out;
}
const crypto = require('crypto');
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
// Snapshot of a source tree: relpath -> sha256
function snapshot(sourceDir) {
  const map = {};
  for (const rel of listFiles(sourceDir)) {
    map[rel.split(path.sep).join('/')] = sha256(fs.readFileSync(path.join(sourceDir, rel)));
  }
  return map;
}
// Snapshot of what the installer WROTE into the target, keyed by installed
// path (rel to target, posix) -> sha256. Stored in the baseline manifest.
function installedSnapshot(target) {
  const map = {};
  for (const t of SKILL_TARGETS) {
    const dir = path.join(target, t);
    for (const rel of listFiles(dir)) {
      map[[t, ...rel.split(path.sep)].join('/')] = sha256(fs.readFileSync(path.join(dir, rel)));
    }
  }
  const toolsDir = path.join(target, 'tools');
  for (const rel of listFiles(toolsDir)) {
    map[['tools', ...rel.split(path.sep)].join('/')] = sha256(fs.readFileSync(path.join(toolsDir, rel)));
  }
  return map;
}
function readManifest(target) {
  const p = path.join(target, '.cline', 'worktrace', 'manifest.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}
function writeManifest(target, manifest) {
  const p = path.join(target, '.cline', 'worktrace', 'manifest.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
function copyTree(sourceDir, targetDir) {
  for (const rel of listFiles(sourceDir)) {
    const src = path.join(sourceDir, rel);
    const dest = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}
function doInstall(target, noNpm) {
  fs.mkdirSync(target, { recursive: true });
  // Unified Skill under both layouts (one source tree copied twice).
  for (const t of SKILL_TARGETS) {
    copyTree(SKILL_SRC, path.join(target, t));
  }
  // Deterministic tools.
  copyTree(TOOLS_SRC, path.join(target, 'tools'));
  // Version marker + baseline manifest (what we wrote, for --update/--check).
  const verDir = path.join(target, '.cline', 'worktrace');
  fs.mkdirSync(verDir, { recursive: true });
  fs.writeFileSync(path.join(verDir, 'version'), VERSION + '\n', 'utf8');
  writeManifest(target, {
    version: VERSION,
    updatedAt: new Date().toISOString(),
    trees: { 'skills/report': snapshot(SKILL_SRC), tools: snapshot(TOOLS_SRC) },
    installed: installedSnapshot(target),
  });
  // Starter config — never overwrite an existing user config.
  const cfgDest = path.join(target, 'worktrace.yaml');
  if (!fs.existsSync(cfgDest) && fs.existsSync(EXAMPLE_CFG)) {
    fs.copyFileSync(EXAMPLE_CFG, cfgDest);
  } else if (fs.existsSync(cfgDest)) {
    console.log('kept existing worktrace.yaml');
  }
  if (!noNpm) {
    const r = sh('npm', ['install', '--omit=dev'], path.join(target, 'tools'));
    if (r.status !== 0) console.error('npm install failed (continuing; node deps may be needed); ' + (r.stderr || '').split('\n')[0]);
  }
  console.log(`installed worktrace ${VERSION} into ${target} (unified report Skill -> /report)`);
}
function doUpdate(target) {
  const manifest = readManifest(target);
  if (!manifest || !manifest.installed) {
    console.error('NOT INSTALLED: target has no worktrace installation baseline. Run a plain install first.');
    return 1;
  }
  const installed = manifest.installed; // installedRel -> sha256 (as we wrote it)
  let added = 0, updated = 0, removed = 0, conflicted = [], localOnly = 0;
  const sourceSnap = {};
  sourceSnap['skills/report'] = snapshot(SKILL_SRC);
  sourceSnap['tools'] = snapshot(TOOLS_SRC);
  // Build the desired installed layout from the current source.
  const desired = {};
  for (const [k, v] of Object.entries(sourceSnap)) {
    for (const [rel, h] of Object.entries(v)) {
      if (k === 'skills/report') {
        for (const t of SKILL_TARGETS) desired[[t, ...rel.split('/')].join('/')] = h;
      } else {
        desired[['tools', ...rel.split('/')].join('/')] = h;
      }
    }
  }
  // 1. Files that should exist: add or update; detect local modification.
  for (const [instRel, h] of Object.entries(desired)) {
    const dest = path.join(target, ...instRel.split('/'));
    if (!installed.hasOwnProperty(instRel)) {
      // New upstream file.
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const srcRel = instRel.replace(path.join('.github', 'skills', 'report') + '/', '').replace(path.join('.cline', 'skills', 'report') + '/', '');
        const src = path.join(instRel.startsWith('tools') ? TOOLS_SRC : SKILL_SRC, ...srcRel.split('/'));
        fs.copyFileSync(src, dest);
        added++;
      }
    } else if (installed[instRel] === h) {
      // Unchanged: ensure present (no rewrite -> mtime preserved).
      if (!fs.existsSync(dest)) {
        const srcRel = instRel.replace(path.join('.github', 'skills', 'report') + '/', '').replace(path.join('.cline', 'skills', 'report') + '/', '');
        const src = path.join(instRel.startsWith('tools') ? TOOLS_SRC : SKILL_SRC, ...srcRel.split('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    } else {
      // Upstream changed. Only overwrite if the installed copy is unmodified.
      const cur = fs.existsSync(dest) ? sha256(fs.readFileSync(dest)) : null;
      if (cur === installed[instRel]) {
        const srcRel = instRel.replace(path.join('.github', 'skills', 'report') + '/', '').replace(path.join('.cline', 'skills', 'report') + '/', '');
        const src = path.join(instRel.startsWith('tools') ? TOOLS_SRC : SKILL_SRC, ...srcRel.split('/'));
        fs.copyFileSync(src, dest);
        updated++;
      } else if (cur) {
        conflicted.push(instRel);
      }
    }
  }
  // 2. Managed files deleted upstream: remove only if unmodified locally.
  for (const instRel of Object.keys(installed)) {
    if (desired.hasOwnProperty(instRel)) continue;
    const dest = path.join(target, ...instRel.split('/'));
    if (!fs.existsSync(dest)) continue;
    const cur = sha256(fs.readFileSync(dest));
    if (cur === installed[instRel]) {
      fs.unlinkSync(dest);
      removed++;
    }
  }
  // 3. Local-only (non-managed) files inside managed dirs: count, never touch.
  for (const dirRel of [path.join('.github', 'skills', 'report'), path.join('.cline', 'skills', 'report')]) {
    const dir = path.join(target, dirRel);
    for (const rel of listFiles(dir)) {
      const instRel = [dirRel, ...rel.split(path.sep)].join('/');
      if (!desired.hasOwnProperty(instRel)) localOnly++;
    }
  }
  console.log(`skill report: ${added} added, ${updated} updated, ${removed} removed (managed, unmodified)${localOnly ? `, ${localOnly} local-only (untouched)` : ''}`);
  if (conflicted.length) {
    console.error('CONFLICT: locally modified managed files are NOT overwritten:');
    for (const c of conflicted) console.error('  ' + c);
    console.error('Revert local edits or apply them upstream, then re-run --update.');
    return 3;
  }
  // Refresh baseline to the now-installed state.
  writeManifest(target, {
    version: VERSION,
    updatedAt: new Date().toISOString(),
    trees: { 'skills/report': snapshot(SKILL_SRC), tools: snapshot(TOOLS_SRC) },
    installed: installedSnapshot(target),
  });
  return 0;
}
function doCheck(target) {
  const manifest = readManifest(target);
  if (!manifest || !manifest.installed) {
    console.error('NOT INSTALLED: ' + target);
    return 1;
  }
  // Incoherence: any managed file missing or drifted from what we installed.
  const problems = [];
  for (const [instRel, h] of Object.entries(manifest.installed)) {
    const dest = path.join(target, ...instRel.split('/'));
    if (!fs.existsSync(dest)) { problems.push('missing: ' + instRel); continue; }
    if (sha256(fs.readFileSync(dest)) !== h) problems.push('drift: ' + instRel);
  }
  console.log('worktrace ' + manifest.version + (problems.length ? ' — INCOHERENT' : ' — installed'));
  for (const p of problems) console.error('  ' + p);
  return problems.length ? 1 : 0;
}
function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || !a.target) {
    console.log('worktrace installer ' + VERSION + '\nUsage: node scripts/install.js --target <dir> [--no-npm | --update | --check]');
    return a.help ? 0 : 2;
  }
  if (a.update && a.check) { console.error('--update and --check are mutually exclusive.'); return 2; }
  try {
    if (a.check) return doCheck(path.resolve(a.target));
    if (a.update) return doUpdate(path.resolve(a.target));
    doInstall(path.resolve(a.target), a.noNpm);
    return 0;
  } catch (e) {
    console.error('worktrace installer: ' + (e && e.message ? e.message : e));
    return 1;
  }
}
process.exit(main());
