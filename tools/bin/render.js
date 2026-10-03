#!/usr/bin/env node
'use strict';
// worktrace-render — deterministic validator/renderer/CLI for the grouped
// tasks document produced by the LLM step of /report.
//
//   node tools/bin/render.js validate-workitems --evidence evidence.json --work-items wi.json
//   node tools/bin/render.js validate-tasks --work-items wi.json --tasks tasks.json [--evidence evidence.json] [--config worktrace.yaml]
//   node tools/bin/render.js render --tasks tasks.json [--out report.txt | stdout]
//   node tools/bin/render.js check --file report.txt --tasks tasks.json
//   node tools/bin/render.js persist --tasks tasks.json --config worktrace.yaml [--date YYYY-MM-DD] [--work-items wi.json]
//
// `persist` is the final validation gate (v3.1.0): it re-validates grouping,
// Work Item preservation and configured 3x3 limits, renders, validates the
// rendered document invariants, and only then writes atomically. Invalid
// grouped output can never reach storage.
//
// Exit: 0 ok | 1 validation failure | 2 usage/config error.

const fs = require('fs');
const path = require('path');
const { validateWorkItems } = require('../lib/workitems');
const { validateTasksDoc, renderTasks, validateRendered, effectiveLimits } = require('../lib/render');
const config = require('../lib/config');
const storage = require('../lib/storage');
const time = require('../lib/time');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

function failPrint(errors) {
  for (const e of errors) console.error(`FAIL: ${e}`);
  return errors.length ? 1 : 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  try {
    switch (cmd) {
      case 'validate-workitems': {
        const wi = readJson(args['work-items']);
        let collected = null;
        if (args.evidence) collected = readJson(args.evidence);
        const r = validateWorkItems(wi, collected);
        if (r.ok) console.log(`OK: ${wi.projects.reduce((n, p) => n + p.workItems.length, 0)} canonical Work Items validated.`);
        process.exit(failPrint(r.errors));
        break;
      }
      case 'validate-tasks': {
        const wi = readJson(args['work-items']);
        const tasks = readJson(args.tasks);
        const base = validateWorkItems(wi, args.evidence ? readJson(args.evidence) : null);
        if (!base.ok) process.exit(failPrint(base.errors));
        let limits = undefined;
        if (args.config) limits = effectiveLimits(config.load(args.config));
        const r = validateTasksDoc(tasks, wi, limits);
        if (r.ok) console.log('OK: grouping valid; all Work Item reports preserved verbatim; configured 3x3 limits satisfied.');
        process.exit(failPrint(r.errors));
        break;
      }
      case 'render': {
        const tasks = readJson(args.tasks);
        const text = renderTasks(tasks);
        if (args.out) {
          fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
          fs.writeFileSync(args.out, text, 'utf8');
          console.log(text === '' ? 'EMPTY: no tasks to render.' : `OK: rendered ${args.out}`);
        } else {
          process.stdout.write(text);
        }
        process.exit(0);
        break;
      }
      case 'check': {
        const text = fs.readFileSync(args.file, 'utf8');
        const tasks = args.tasks ? readJson(args.tasks) : null;
        const r = validateRendered(text, tasks);
        if (r.ok && r.empty) console.log('WARN: report file is empty (no commits/no work items).');
        else if (r.ok) console.log('OK: plain-text format invariants hold.');
        process.exit(failPrint(r.errors));
        break;
      }
      case 'persist': {
        // v3.1.0 PERSIST GATE: invalid grouped output must NEVER reach storage.
        // Order: load config -> load tasks (and optional work-items/evidence)
        // -> validate grouping contract + Work Item preservation + configured
        // 3x3 limits -> render -> validate rendered document invariants ->
        // atomic persist. Any failure exits non-zero without writing.
        const cfg = config.load(args.config);
        const date = args.date || time.resolveTargetDate(new Date(), cfg.timezone, cfg.date.behavior);
        const tasks = readJson(args.tasks);
        const limits = effectiveLimits(cfg);
        const tGrouping = validateTasksDoc(tasks, args['work-items'] ? readJson(args['work-items']) : null, limits);
        if (!tGrouping.ok) process.exit(failPrint(tGrouping.errors));
        const text = renderTasks(tasks);
        const tRendered = validateRendered(text, tasks);
        if (!tRendered.ok) process.exit(failPrint(tRendered.errors));
        const dest = storage.persistReport(cfg, date, text);
        console.log(dest);
        process.exit(0);
        break;
      }
      default:
        console.error(
          'Usage: worktrace-render <validate-workitems|validate-tasks|render|check|persist> [options]\n' +
            'Run "node tools/bin/render.js" with a subcommand; see tools/bin/render.js header for the contract.'
        );
        process.exit(2);
    }
  } catch (e) {
    console.error(`worktrace-render: ${e.message}`);
    process.exit(e instanceof SyntaxError ? 2 : 1);
  }
}

main();
