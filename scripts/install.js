#!/usr/bin/env node
'use strict';
// WORKTRACE installer/updater — cross-platform, idempotent, config-preserving.
//
//   node scripts/install.js                  # install (or update in place)
//   node scripts/install.js --update         # explicit UPDATE of installed
//                                            # Skills + tools (see below)
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
//   - managed manifest         -> <target>/.cline/worktrace/manifest.json
//     (SHA-256 of every installer-managed file; powers --update)
//
// UPDATE semantics (`node scripts/install.js --update`, both Skills compared
// as COMPLETE directories, not only SKILL.md):
//   - unchanged source files              -> untouched (no writes)
//   - changed source files                -> installed copy updated
//   - locally modified installed file     -> NEVER silently overwritten;
//                                             reported as CONFLICT (exit 3);
//                                             the pristine copy stays intact
//   - source file removed                 -> installed copy deleted ONLY when
//                                             installer-managed AND unmodified;
//                                             otherwise kept and reported
//   - files never managed by the installer-> always left alone
//   - user worktrace.yaml                 -> never touched by any mode
//   - repeated update                       -> idempotent ("unchanged")
// Plain install (no flags) keeps its v3.1 behavior: full mirror of managed
// trees, config preserved.
//
// No curl-pipe-to-shell: run `git clone` yourself, then `node scripts/install.js`.

const crypto = require('crypto');
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
    else if (argv[i] === '--update') out.update = true;
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

// ---- update machinery -----------------------------------------------------

function sha256File(f) {
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}

// Deterministic rel-path -> sha256 map over a whole directory tree.
// `skip` lists directory names never hashed (dependency payloads such as
// tools/node_modules are not installer-managed content).
function hashTree(dir, skip) {
  const skipSet = new Set(skip || []);
  const map = {};
  if (!fs.existsSync(dir)) return map;
  const walk = (d, prefix) => {
    for (const e of fs.readdirSync(d).sort()) {
      if (prefix === '' && skipSet.has(e)) continue; // top-level skips only
      const full = path.join(d, e);
      const rel = prefix ? `${prefix}/${e}` : e;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, rel);
      else map[rel] = sha256File(full);
    }
  };
  walk(dir, '');
  return map;
}

function manifestPath(target) {
  return path.join(target, '.cline', 'worktrace', 'manifest.json');
}

function readManifest(target) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(target), 'utf8'));
  } catch (_) {
    return null;
  }
}

function writeManifest(target, m) {
  ensureDir(path.dirname(manifestPath(target)));
  fs.writeFileSync(manifestPath(target), JSON.stringify(m, null, 2) + '\n', 'utf8');
}

// Compare one managed tree (source dir vs installed dir) using the complete
// directory contents — every file, not only SKILL.md. Classifies each entry:
//   added            new in source, absent in target
//   updated          present in both, source content differs, installed copy
//                    matches the last-known managed hash (unmodified)
//   unchanged        identical bytes on both sides
//   conflict         BOTH sides changed relative to the managed baseline —
//                    never silently overwritten; local file stays untouched
//   local-only       extra file in target that the installer never managed
//   removed-clean    managed + unmodified file gone from source -> delete
//   removed-kept     managed file gone from source but locally modified -> keep
function planTreeUpdate(srcDir, destDir, managed /* rel->hash */) {
  const plan = { added: [], updated: [], unchanged: [], conflicts: [], removed: [], keptRemoved: [], localOnly: [] };
  const srcHashes = hashTree(srcDir);
  const dstHashes = hashTree(destDir);
  const allKeys = [...new Set([...Object.keys(srcHashes), ...Object.keys(dstHashes)])].sort();
  for (const k of allKeys) {
    const inSrc = Object.prototype.hasOwnProperty.call(srcHashes, k);
    const inDst = Object.prototype.hasOwnProperty.call(dstHashes, k);
    const base = managed ? managed[k] : undefined; // hash at last successful install
    if (inSrc && !inDst) {
      plan.added.push(k);
    } else if (inSrc && inDst) {
      if (srcHashes[k] === dstHashes[k]) plan.unchanged.push(k);
      else if (base !== undefined && base !== dstHashes[k]) plan.conflicts.push(k); // locally modified
      else plan.updated.push(k); // source changed (or untracked-new but matching? -> update)
    } else if (!inSrc && inDst) {
      if (base === undefined) plan.localOnly.push(k); // never installer-managed: leave alone
      else if (base === dstHashes[k]) plan.removed.push(k); // managed + unmodified -> safe delete
      else plan.keptRemoved.push(k); // managed but locally modified -> keep, report
    }
  }
  return plan;
}

function applyTreeUpdate(srcDir, destDir, plan) {
  for (const k of plan.added.concat(plan.updated)) {
    const d = path.join(destDir, k);
    ensureDir(path.dirname(d));
    fs.copyFileSync(path.join(srcDir, k), d);
  }
  for (const k of plan.removed) {
    const d = path.join(destDir, k);
    if (fs.existsSync(d)) rmRecursive(d);
  }
  // Conflicts, kept-removed deletions and local-only files are NEVER touched.
}

function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const st = fs.statSync(dir);
  if (!st.isDirectory()) return;
  for (const e of fs.readdirSync(dir)) pruneEmptyDirs(path.join(dir, e));
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

// Update one managed tree end-to-end; returns the plan and the new managed
// hash map (source hashes) for the manifest. `skip` names top-level dirs that
// are never installer-managed (dependency payloads).
function updateManagedTree(label, srcDir, destDir, oldManaged, skip) {
  if (!fs.existsSync(srcDir)) throw new Error(`Missing source directory: ${srcDir}`);
  const plan = planTreeUpdate(srcDir, destDir, oldManaged || {}, skip);
  applyTreeUpdate(srcDir, destDir, plan);
  // Remove directories that became empty after deletions (managed scope only).
  if (plan.removed.length && fs.existsSync(destDir)) pruneEmptyDirs(destDir);
  const summary = [
    `${label}: ${plan.unchanged.length} unchanged`,
    plan.added.length ? `+${plan.added.length} added` : null,
    plan.updated.length ? `~${plan.updated.length} updated` : null,
    plan.conflicts.length ? `!${plan.conflicts.length} CONFLICT (local modifications preserved)` : null,
    plan.removed.length ? `-${plan.removed.length} removed (managed, unmodified)` : null,
    plan.keptRemoved.length ? `=${plan.keptRemoved.length} removed-from-source but kept (locally modified)` : null,
    plan.localOnly.length ? `${plan.localOnly.length} local-only (untouched)` : null,
  ].filter(Boolean).join(', ');
  return { plan, summary, hashes: hashTree(srcDir, skip) };
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

const MANAGED_TREES = () => [
  { label: 'skill worktrace-daily-report', src: path.join(REPO_ROOT, '.cline', 'skills', 'worktrace-daily-report'), destKey: ['skills', 'worktrace-daily-report'], dest: (t) => path.join(t, '.cline', 'skills', 'worktrace-daily-report') },
  { label: 'skill worktrace-report', src: path.join(REPO_ROOT, '.cline', 'skills', 'worktrace-report'), destKey: ['skills', 'worktrace-report'], dest: (t) => path.join(t, '.cline', 'skills', 'worktrace-report') },
  { label: 'tools', src: path.join(REPO_ROOT, 'tools'), destKey: ['tools'], dest: (t) => path.join(t, 'tools'), skip: ['node_modules'] },
];

function runUpdate(target, args) {
  const marker = readMarker(target);
  if (!marker) {
    console.error(`WORKTRACE is not installed at ${target} (no version marker). Run a plain install first.`);
    process.exit(1);
  }
  const manifest = readManifest(target);
  if (!manifest) {
    console.error(`No installer manifest found at ${manifestPath(target)}. Cannot tell which installed files were locally modified.`);
    console.error('Run a plain install once to establish the managed baseline, then use --update.');
    process.exit(1);
  }
  console.log(`WORKTRACE update check -> ${target} (installed v${marker}, repo ships v${VERSION})`);
  let conflicts = 0;
  const newManifest = { version: VERSION, updatedAt: null, trees: {} };
  for (const t of MANAGED_TREES()) {
    const dest = t.dest(target);
    const oldManaged = (manifest.trees && manifest.trees[t.destKey.join('/')]) || {};
    // Skip hashing node_modules inside tools for change detection speed &
    // correctness (installer never manages dependency payloads).
    const res = updateManagedTree(t.label, t.src, dest, oldManaged, t.skip);
    newManifest.trees[t.destKey.join('/')] = res.hashes;
    console.log(`  ${res.summary}`);
    for (const c of res.plan.conflicts) console.log(`    CONFLICT: ${t.label}/${c} — installed copy has local modifications; NOT overwritten. Resolve manually (back up your edit, then re-run).`);
    for (const k of res.plan.keptRemoved) console.log(`    KEPT: ${t.label}/${k} — removed from source but locally modified; kept untouched.`);
    conflicts += res.plan.conflicts.length;
  }
  // User config: NEVER touched by update.
  const cfgDest = path.join(target, 'worktrace.yaml');
  console.log(`  config  : ${fs.existsSync(cfgDest) ? `kept existing ${cfgDest} (never modified by update)` : 'absent — run a plain install to create it from template'}`);
  writeManifest(target, newManifest);
  if (conflicts > 0) {
    console.log(`Done with ${conflicts} conflict(s): conflicting files were NOT overwritten (exit 3).`);
    process.exit(3);
  }
  if (marker !== VERSION) {
    writeMarker(target);
    console.log(`  marker  : v${marker} -> v${VERSION}`);
  } else {
    writeMarker(target);
    console.log(`  marker  : v${VERSION} (unchanged)`);
  }
  console.log('Done. Repeated --update is idempotent (everything reports unchanged).');
  process.exit(0);
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

  if (args.update) {
    runUpdate(target, args);
    return;
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

  // 6. Establish the managed-file manifest that powers `--update` conflict
  //    detection (complete directory hashes for both Skills + tools).
  const manifest = { version: VERSION, updatedAt: null, trees: {} };
  for (const t of MANAGED_TREES()) {
    manifest.trees[t.destKey.join('/')] = hashTree(t.src, t.skip);
  }
  writeManifest(target, manifest);

  writeMarker(target);
  console.log(`Done. Invoke "/report" in Cline (chat) or run:`);
  console.log(`  cline "/report" --cwd "${target}"   # headless via Cline CLI`);
  console.log(`Later upgrades: node scripts/install.js --update [--target/--global]`);
  process.exit(0);
}

main();
