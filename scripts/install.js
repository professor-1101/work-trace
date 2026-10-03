#!/usr/bin/env node
'use strict';
// WORKTRACE installer/updater — cross-platform, idempotent, config-preserving.
//
//   node scripts/install.js            # install or update (same command)
//   node scripts/install.js --target <dir>   # install into a specific Cline workspace
//   node scripts/install.js --global         # install skills/tools under ~/.cline
//   node scripts/install.js --check          # report installed version, make no changes
//
// What it installs (per current official Cline documentation):
//   - the existing Skill        -> <target>/.cline/skills/worktrace-daily-report/
//     (docs: https://docs.cline.bot/customization/skills — "Place skill
//      directories in .cline/skills/ (workspace) or ~/.cline/skills/ (global)")
//   - the /report workflow skill -> <target>/.cline/skills/worktrace-report/
//     (any enabled skill is invocable as a slash command; same doc page +
//      https://docs.cline.bot/core-workflows/using-commands#skills-via-slash-commands)
//   - deterministic tools      -> <target>/tools/  (+ npm install for yaml dep)
//   - config template          -> <target>/worktrace.yaml  (NEVER overwritten
//                                  if it already exists — user config preserved)
//   - marker                   -> <target>/.cline/worktrace/version  (installed VERSION)
//
// No curl-pipe-to-shell: run `git clone` yourself, then `node scripts/install.js`.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { VERSION } = require('../tools/lib/version');

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') out.target = argv[++i];
    else if (argv[i] === '--global') out.global = true;
    else if (argv[i] === '--check') out.check = true;
    else if (argv[i] === '--no-npm') out.noNpm = true;
  }
  return out;
}

function targetDir(args) {
  if (args.target) return path.resolve(args.target);
  if (args.global) return os.homedir(); // global skills: ~/.cline/skills per docs
  return process.cwd();
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

// Recursive copy that never deletes files absent from source unless `mirror`
// is set (used only inside managed skill dirs to remove stale files).
function copyTree(src, dest, mirror) {
  ensureDir(dest);
  const srcEntries = fs.readdirSync(src);
  const destEntries = fs.existsSync(dest) ? fs.readdirSync(dest) : [];
  for (const e of srcEntries) {
    const s = path.join(src, e);
    const d = path.join(dest, e);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyTree(s, d, mirror);
    else fs.copyFileSync(s, d);
  }
  if (mirror) {
    for (const e of destEntries) {
      if (!srcEntries.includes(e)) {
        const d = path.join(dest, e);
        rmRecursive(d);
      }
    }
  }
}

function rmRecursive(p) {
  const st = fs.lstatSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) rmRecursive(path.join(p, e));
    fs.rmdirSync(p);
  } else fs.unlinkSync(p);
}

function readMarker(target) {
  const f = path.join(target, '.cline', 'worktrace', 'version');
  try {
    return fs.readFileSync(f, 'utf8').trim();
  } catch (_) {
    return null;
  }
}

function writeMarker(target) {
  const dir = path.join(target, '.cline', 'worktrace');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'version'), VERSION + '\n', 'utf8');
}

function installSkill(target, name, srcDir) {
  const dest = path.join(target, '.cline', 'skills', name);
  if (!fs.existsSync(srcDir)) throw new Error(`Missing source skill directory: ${srcDir}`);
  copyTree(srcDir, dest, true); // managed by installer; stale files removed
  return dest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = targetDir(args);
  const marker = readMarker(target);

  if (args.check) {
    if (marker) console.log(`WORKTRACE workflow v${marker} installed at ${target}`);
    else console.log(`WORKTRACE workflow not installed at ${target} (repo ships v${VERSION}).`);
    process.exit(marker === VERSION ? 0 : marker ? 3 : 1);
  }

  console.log(`WORKTRACE install/update -> ${target} (package v${VERSION})${marker ? ` [previously v${marker}]` : ''}`);

  // 1. Existing reporting Skill — copied verbatim, never rewritten.
  const skillDest = installSkill(target, 'worktrace-daily-report', path.join(REPO_ROOT, '.cline', 'skills', 'worktrace-daily-report'));
  console.log(`  skill   : ${skillDest}`);

  // 2. The /report workflow skill (orchestration layer).
  const wfDest = installSkill(target, 'worktrace-report', path.join(REPO_ROOT, '.cline', 'skills', 'worktrace-report'));
  console.log(`  /report : ${wfDest}`);

  // 3. Deterministic tools.
  const toolsDest = path.join(target, 'tools');
  copyTree(path.join(REPO_ROOT, 'tools'), toolsDest, true);
  console.log(`  tools   : ${toolsDest}`);

  // 4. Config template — preserved if present (never overwrite user config).
  const cfgDest = path.join(target, 'worktrace.yaml');
  const example = path.join(REPO_ROOT, 'config', 'worktrace.example.yaml');
  if (fs.existsSync(cfgDest)) {
    console.log(`  config  : kept existing ${cfgDest} (not modified)`);
  } else {
    fs.copyFileSync(example, cfgDest);
    console.log(`  config  : created ${cfgDest} from template — EDIT projectsRoot/reportRoot/timezone before first use`);
  }

  // 5. Optional dependency install (yaml parser). Falls back to bundled subset
  //    parser when offline; therefore failure here is a warning, not fatal.
  if (!args.noNpm) {
    const res = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: toolsDest,
      encoding: 'utf8',
      windowsHide: true,
      shell: process.platform === 'win32', // npm on Windows is a .cmd shim
    });
    if (res.status === 0) console.log('  deps    : npm install ok');
    else console.warn('  deps    : npm install failed (offline?) — bundled YAML subset parser will be used instead');
  }

  writeMarker(target);
  console.log(`Done. Invoke "/report" in Cline (chat) or run:`);
  console.log(`  cline "/report" --cwd "${target}"   # headless via Cline CLI`);
  process.exit(0);
}

main();
