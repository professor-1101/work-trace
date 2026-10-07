#!/usr/bin/env node
'use strict';
// worktrace-collect — deterministic git evidence collector CLI.
// Exit codes: 0 = success (even when zero commits today), 1 = real failure
// (bad config, broken repository, git missing, limit exceeded), 2 = usage error.

const path = require('path');
const fs = require('fs');
const config = require('../lib/config');
const git = require('../lib/git');
const time = require('../lib/time');
const { VERSION } = require('../lib/version');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') out.config = argv[++i];
    else if (a === '--date') out.date = argv[++i];
    else if (a === '--now') out.now = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--version') out.version = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else out._.push(a);
  }
  return out;
}

const HELP = `worktrace-collect ${VERSION}
Deterministic git evidence collector for the WORKTRACE /report workflow.

Usage:
  node tools/bin/collect.js [--config <worktrace.yaml>] [--date YYYY-MM-DD] [--out <evidence.json>]

Options:
  --config <path>  Explicit worktrace.yaml (else: $WORKTRACE_CONFIG, ./worktrace.yaml, ~/.cline/worktrace/worktrace.yaml)
  --date <YYYY-MM-DD>  Override the target date (default: today in configured timezone)
  --out <path>   Write JSON to file instead of stdout
  --version      Print version
  -h, --help     Show help

Output: machine-readable JSON evidence document (schemaVersion 1).
Exit: 0 ok | 1 collection/config failure | 2 usage error.`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args.version) {
    console.log(VERSION);
    return 0;
  }
  let cfg;
  try {
    cfg = config.load(args.config);
  } catch (e) {
    console.error(`worktrace-collect: ${e.message}`);
    return 1;
  }
  let targetDate;
  let nowInstant = new Date();
  try {
    if (args.now) {
      const d = new Date(args.now);
      if (Number.isNaN(d.getTime())) throw new Error(`--now must be a parseable ISO-8601 instant, got: ${args.now}`);
      nowInstant = d;
    }
    if (args.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error(`--date must be YYYY-MM-DD, got: ${args.date}`);
      targetDate = args.date;
    } else {
      targetDate = time.resolveTargetDate(nowInstant, cfg.timezone, cfg.date.behavior);
    }
  } catch (e) {
    console.error(`worktrace-collect: ${e.message}`);
    return 2;
  }
  // git availability check (cross-platform: spawnSync('git') without shell)
  const probe = git.runGit(process.cwd(), ['--version'], 1 << 20);
  if (!probe.ok) {
    console.error('worktrace-collect: `git` executable not found on PATH. Install Git and retry.');
    return 1;
  }
  let doc;
  try {
    doc = git.collectAll(cfg, targetDate, nowInstant);
  } catch (e) {
    console.error(`worktrace-collect: ${e.message}`);
    return 1;
  }
  const json = JSON.stringify(doc, null, 2);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, json + '\n', 'utf8');
    console.error(`worktrace-collect: wrote ${args.out} (${doc.totals.repositories} repos, ${doc.totals.commits} commits on ${targetDate}).`);
  } else {
    console.log(json);
  }
  return doc.hasRealFailure ? 1 : 0;
}

process.exit(main());
