'use strict';
// Configuration loading + validation for the WORKTRACE workflow.
// Search order (first match wins):
//   1. --config <path> CLI flag
//   2. WORKTRACE_CONFIG environment variable
//   3. ./worktrace.yaml in the current workspace
//   4. ~/.cline/worktrace/worktrace.yaml (global; %USERPROFILE%\\.cline\\worktrace on Windows)

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('./yaml');

const DEFAULTS = {
  projectsRoot: null, // required
  reportRoot: null,   // required
  timezone: 'Asia/Tehran',
  date: { behavior: 'today' }, // today | offset:<N>  (offset days relative to "today" in configured tz)
  discovery: {
    maxDepth: 6,
    followSymlinks: false,
    skipDirs: ['node_modules', '.venv', 'venv', '__pycache__', '.next', 'target', 'build', 'dist'],
    include: [],   // repo-relative (to projectsRoot) glob-ish prefixes; empty = all
    exclude: [],   // repo-relative prefixes that stop descent
    ignore: [],    // repos whose derived project name is ignored entirely
    nameOverrides: {}, // absolute repo path -> project display name
  },
  limits: {
    maxRepos: 200,
    maxCommitsPerRepo: 500,
    maxEvidenceBytesPerCommit: 200 * 1024,
    maxStatFiles: 200,
    // Grouping contract (3×3 rule). Configuration-driven; the validator and
    // persist gate use these values, never hard-coded constants.
    maxTasksPerRepository: 3,
    maxSubtasksPerTask: 3,
    // v3.2.0 audit: there is NO `dailyTotalHours` config key — the 7.5h daily
    // ceiling is a HARD product invariant owned by tools/lib/hours.js
    // (DAILY_TOTAL_HOURS). Setting it in worktrace.yaml is rejected below.
  },
  output: {
    layout: '{root}/YYYY/MM/DD/report.txt',
    atomicReplace: true,
  },
};

function globalConfigDir() {
  return path.join(os.homedir(), '.cline', 'worktrace');
}

function findConfigPath(explicit) {
  if (explicit) {
    const p = path.resolve(explicit);
    if (!fs.existsSync(p)) throw new Error(`Config file not found: ${p}`);
    return p;
  }
  if (process.env.WORKTRACE_CONFIG) {
    const p = path.resolve(process.env.WORKTRACE_CONFIG);
    if (!fs.existsSync(p)) throw new Error(`WORKTRACE_CONFIG points to a missing file: ${p}`);
    return p;
  }
  const local = path.resolve('worktrace.yaml');
  if (fs.existsSync(local)) return local;
  const g = path.join(globalConfigDir(), 'worktrace.yaml');
  if (fs.existsSync(g)) return g;
  return null;
}

function expandHome(p) {
  if (typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function validateAndNormalize(raw, configPath) {
  const cfg = JSON.parse(JSON.stringify(DEFAULTS));
  const errors = [];
  if (!raw || typeof raw !== 'object') errors.push('Config is empty or not a mapping.');
  if (errors.length) throw new Error(errors.join('\n'));

  const get = (obj, key) => (obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined);

  const projectsRoot = expandHome(get(raw, 'projectsRoot'));
  const reportRoot = expandHome(get(raw, 'reportRoot'));
  if (!projectsRoot || typeof projectsRoot !== 'string') errors.push('`projectsRoot` is required (string).');
  if (!reportRoot || typeof reportRoot !== 'string') errors.push('`reportRoot` is required (string).');
  if (typeof projectsRoot === 'string' && projectsRoot && !fs.existsSync(projectsRoot)) {
    errors.push(`projectsRoot does not exist: ${projectsRoot}`);
  }

  cfg.projectsRoot = projectsRoot ? path.resolve(projectsRoot) : null;
  cfg.reportRoot = reportRoot ? path.resolve(reportRoot) : null;

  const tz = get(raw, 'timezone');
  if (tz !== undefined) {
    if (typeof tz !== 'string' || !isValidTimezone(tz)) errors.push(`Invalid IANA timezone: ${JSON.stringify(tz)}`);
    else cfg.timezone = tz;
  }

  const date = get(raw, 'date');
  if (date && typeof date === 'object') {
    const b = get(date, 'behavior');
    if (b !== undefined) {
      if (b === 'today') cfg.date.behavior = 'today';
      else if (/^offset:-?\d+$/.test(String(b))) cfg.date.behavior = String(b);
      else errors.push('`date.behavior` must be "today" or "offset:<N>" (e.g. "offset:-1").');
    }
  }

  const disc = get(raw, 'discovery');
  if (disc && typeof disc === 'object') {
    if (get(disc, 'maxDepth') !== undefined) {
      const d = Number(disc.maxDepth);
      if (!Number.isInteger(d) || d < 1 || d > 30) errors.push('`discovery.maxDepth` must be an integer 1..30.');
      else cfg.discovery.maxDepth = d;
    }
    if (get(disc, 'followSymlinks') !== undefined) cfg.discovery.followSymlinks = !!disc.followSymlinks;
    for (const k of ['skipDirs', 'include', 'exclude', 'ignore']) {
      if (disc[k] !== undefined) {
        if (!Array.isArray(disc[k])) errors.push(`\`discovery.${k}\` must be a list of strings.`);
        else cfg.discovery[k] = disc[k].map(String);
      }
    }
    if (disc.nameOverrides !== undefined) {
      const no = disc.nameOverrides;
      if (typeof no !== 'object' || Array.isArray(no)) errors.push('`discovery.nameOverrides` must be a mapping of repo path -> project name.');
      else {
        for (const [k, v] of Object.entries(no)) cfg.discovery.nameOverrides[k] = String(v);
      }
    }
  }

  const lim = get(raw, 'limits');
  if (lim && typeof lim === 'object') {
    for (const k of [
      'maxRepos',
      'maxCommitsPerRepo',
      'maxEvidenceBytesPerCommit',
      'maxStatFiles',
      'maxTasksPerRepository',
      'maxSubtasksPerTask',
    ]) {
      if (lim[k] !== undefined) {
        const n = Number(lim[k]);
        if (!Number.isInteger(n) || n <= 0) errors.push(`\`limits.${k}\` must be a positive integer.`);
        else cfg.limits[k] = n;
      }
    }
    // v3.2.0 audit: the 7.5h daily ceiling is a HARD product invariant and is
    // NOT configurable. Any `limits.dailyTotalHours` key in user config — of
    // any value, including 7.5 — is rejected loudly (never silently ignored).
    if ('dailyTotalHours' in lim) {
      errors.push('`limits.dailyTotalHours` is not a valid configuration key: the daily hour ceiling is a hard product invariant (total hours <= 7.5h) owned by the hours module; remove this key from your config.');
    }
  }

  const out = get(raw, 'output');
  if (out && typeof out === 'object') {
    if (out.layout !== undefined) {
      const l = String(out.layout);
      if (!l.includes('{root}')) errors.push('`output.layout` must contain the `{root}` placeholder.');
      else cfg.output.layout = l;
    }
    if (out.atomicReplace !== undefined) cfg.output.atomicReplace = !!out.atomicReplace;
  }

  if (errors.length) {
    throw new Error(`Invalid configuration (${configPath}):\n- ` + errors.join('\n- '));
  }
  cfg._configPath = configPath;
  return cfg;
}

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (_) {
    return false;
  }
}

function load(explicitPath) {
  const p = findConfigPath(explicitPath);
  if (!p) {
    throw new Error(
      'No worktrace.yaml found. Create one at ./worktrace.yaml or ' +
        path.join(globalConfigDir(), 'worktrace.yaml') +
        ' (see config/worktrace.example.yaml).'
    );
  }
  const raw = yaml.loadFile(p);
  return validateAndNormalize(raw, p);
}

module.exports = { load, loadFile: load, validateAndNormalize, findConfigPath, globalConfigDir, DEFAULTS, isValidTimezone };
