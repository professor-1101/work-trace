#!/usr/bin/env node
'use strict';
// worktrace-render — deterministic validator/renderer/CLI for the grouped
// tasks document produced by the LLM step of /report.
//
//   node tools/bin/render.js validate-workitems --evidence evidence.json --work-items wi.json
//   node tools/bin/render.js merge-manual --work-items wi.json --manual manual.json [--evidence evidence.json] [--out wi.json]
//   node tools/bin/render.js task-order --tasks tasks.json
//   node tools/bin/render.js validate-tasks --work-items wi.json --tasks tasks.json [--evidence evidence.json] [--config worktrace.yaml]
//   node tools/bin/render.js allocate-hours --tasks tasks.json --alloc '["2",3,null]' [--config worktrace.yaml] [--out tasks.json]
//   node tools/bin/render.js render --tasks tasks.json [--out report.txt | stdout]
//   node tools/bin/render.js check --file report.txt --tasks tasks.json
//   node tools/bin/render.js persist --tasks tasks.json --config worktrace.yaml [--date YYYY-MM-DD] [--work-items wi.json]
//
// `persist` is the final validation gate (v3.1.0, extended in v3.2.0): it
// re-validates grouping, Work Item preservation and configured 3x3 limits,
// validates stored Task hours (finite >= 0, total <= daily limit 7.5),
// renders, validates the rendered document invariants INCLUDING the single
// Daily Report section (one entry per Final Task, hours matching stored Task
// hours, no extra separator), and only then writes atomically. Invalid output
// can never reach storage.
//
// Exit: 0 ok | 1 validation failure | 2 usage/config error.

const fs = require('fs');
const path = require('path');
const { validateWorkItems } = require('../lib/workitems');
const { validateTasksDoc, renderTasks, validateRendered, effectiveLimits, sortProjects, sortTasks, flattenFinalTasks } = require('../lib/render');
const hoursLib = require('../lib/hours');
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
      case 'merge-manual': {
        // v3.2.0 MANUAL WORK: unify Git Work Items with the Manual Work Items
        // the user actually described (answer to «کار دیگه‌ای امروز نکردی؟»).
        // Happens BEFORE grouping. Empty manual list -> git doc unchanged.
        const { mergeManualWorkItems } = require('../lib/workitems');
        const wi = readJson(args['work-items']);
        const manual = args.manual ? readJson(args.manual) : [];
        const list = Array.isArray(manual) ? manual : Array.isArray(manual.items) ? manual.items : [];
        const merged = mergeManualWorkItems(wi, list);
        const r = validateWorkItems(merged, args.evidence ? readJson(args.evidence) : null);
        if (!r.ok) process.exit(failPrint(r.errors));
        const text = JSON.stringify(merged, null, 2) + '\n';
        if (args.out) fs.writeFileSync(args.out, text, 'utf8');
        else process.stdout.write(text);
        console.error(`OK: unified work items (${list.length} manual item(s) merged).`);
        process.exit(0);
        break;
      }
      case 'task-order': {
        // v3.2.0: print the deterministic FINAL task order — the EXACT shared
        // render order (lib/render flattenFinalTasks) used by `allocate-hours`
        // and the Daily Report, so hour answers map to Tasks without guessing.
        const tasks = readJson(args.tasks);
        flattenFinalTasks(tasks).forEach(({ project, task }, i) => {
          console.log(`${i}\t${project ? project + ' - ' : ''}${task.title}`);
        });
        process.exit(0);
        break;
      }
      case 'validate-tasks': {
        const wi = readJson(args['work-items']);
        const tasks = readJson(args.tasks);
        const base = validateWorkItems(wi, args.evidence ? readJson(args.evidence) : null);
        if (!base.ok) process.exit(failPrint(base.errors));
        let limits = undefined;
        if (args.config) {
          const cfg = config.load(args.config);
          limits = effectiveLimits(cfg);
          // HARD 7.5h ceiling: config has NO influence on the hour limit
          // (v3.2.0 audit — `limits.dailyTotalHours` is rejected at load).
        }
        const r = validateTasksDoc(tasks, wi, limits);
        if (r.ok) console.log('OK: grouping valid; all Work Item reports preserved verbatim; configured 3x3 limits satisfied.');
        process.exit(failPrint(r.errors));
        break;
      }
      case 'allocate-hours': {
        // v3.2.0 HOURS: deterministic allocation ONLY (no LLM judgment).
        // Runs AFTER final Tasks are determined. `--alloc` is a JSON array
        // aligned with the FINAL task order the renderer will use (projects
        // alphabetical, tasks alphabetical within project): number = explicit
        // user value (preserved exactly), null = unspecified (balanced).
        // Modes: all specified / partial+balance / none -> equal split of the
        // HARD daily total (7.5h product invariant — not configurable).
        // Explicit total > limit -> REJECT. No final tasks -> hour skipped.
        const tasks = readJson(args.tasks);
        const alloc = args.alloc ? JSON.parse(args.alloc) : [];
        if (!Array.isArray(alloc)) {
          console.error('FAIL: --alloc must be a JSON array of numbers/nulls aligned with final task order.');
          process.exit(2);
        }
        // v3.2.0 audit: the hour ceiling is a HARD constant (7.5h product
        // invariant) — config is NOT loaded for hour math at all and there is
        // NO --daily-total override: nothing may raise OR lower the invariant.
        if (args['daily-total'] !== undefined) {
          console.error('FAIL: --daily-total is not supported: total hours <= 7.5h is a hard product invariant and cannot be configured or overridden in either direction.');
          process.exit(2);
        }
        if (args.config) config.load(args.config); // still validate the config file shape
        // Final task order = the shared renderer order (single source of truth).
        const flat = flattenFinalTasks(tasks).map(({ task }) => task);
        if (flat.length === 0) {
          console.log('OK: no final Tasks — hour collection skipped.');
          process.exit(0);
        }
        if (alloc.length !== flat.length) {
          console.error(`FAIL: --alloc has ${alloc.length} entries but there are ${flat.length} final Tasks (aligned by deterministic render order).`);
          process.exit(1);
        }
        const res = hoursLib.allocateHours(flat, alloc);
        if (!res.ok) process.exit(failPrint(res.errors));
        flat.forEach((t, i) => { t.hours = res.allocated[i]; });
        const text = JSON.stringify(tasks, null, 2) + '\n';
        if (args.out) fs.writeFileSync(args.out, text, 'utf8');
        else process.stdout.write(text);
        console.error(`OK: hours allocated (mode=${res.mode}, total=${res.total}h, limit=${hoursLib.DAILY_TOTAL_HOURS}h).`);
        process.exit(0);
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
        // PERSIST GATE (v3.1.0 core + v3.2.0 extensions): invalid output must
        // NEVER reach storage. Order: load config -> load tasks (and optional
        // work-items/evidence) -> validate grouping contract + Work Item
        // preservation + configured 3x3 limits + stored Task hours -> render
        // -> validate rendered document invariants (single Daily Report
        // section, one entry per Final Task, hours match stored Task hours,
        // separator/plain-text invariants) -> atomic persist. Any failure
        // exits non-zero WITHOUT touching the existing daily file.
        const cfg = config.load(args.config);
        const date = args.date || time.resolveTargetDate(new Date(), cfg.timezone, cfg.date.behavior);
        const tasks = readJson(args.tasks);
        const limits = effectiveLimits(cfg);
        // HARD 7.5h ceiling — constant-owned; nothing (config/flags/opts) influences it.
        const tGrouping = validateTasksDoc(tasks, args['work-items'] ? readJson(args['work-items']) : null, limits);
        if (!tGrouping.ok) process.exit(failPrint(tGrouping.errors));
        // Hours gate: when the document carries hour data, every final Task
        // must have a finite >= 0 value and the total must not exceed the
        // hard daily limit (re-checked here independently of the grouping pass).
        const flatTasks = flattenFinalTasks(tasks).map(({ task }) => task);
        const anyHours = flatTasks.some((t) => t.hours !== undefined && t.hours !== null);
        if (anyHours) {
          const map = {};
          flatTasks.forEach((t, i) => { map[`task#${i}:${t.title}`] = t.hours === undefined || t.hours === null ? 0 : t.hours; });
          const hv = hoursLib.validateStoredHours(map);
          if (!hv.ok) process.exit(failPrint(hv.errors));
        }
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
          'Usage: worktrace-render <validate-workitems|merge-manual|task-order|validate-tasks|allocate-hours|render|check|persist> [options]\n' +
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
