'use strict';
// Deterministic storage: config-driven report root, auto-created date
// directories, daily filename from `output.layout`, atomic replacement so a
// re-run overwrites cleanly instead of accumulating duplicates.

const fs = require('fs');
const os = require('os');
const path = require('path');

// Expand `{root}/YYYY/MM/DD/report.txt` with the target date.
// Supported tokens: {root}, YYYY, MM, DD. Path separators in the layout may be
// "/" or platform-native; both work on Linux and Windows.
function resolveReportPath(layout, reportRoot, targetDate) {
  const [y, m, d] = targetDate.split('-');
  if (!y || !m || !d) throw new Error(`Bad target date: ${targetDate}`);
  let rel = String(layout);
  rel = rel.replace(/\{root\}/g, '');
  rel = rel.replace(/YYYY/g, y).replace(/MM/g, m).replace(/DD/g, d);
  rel = rel.replace(/^\/+/, '').replace(/\\/g, path.sep).replace(/\//g, path.sep);
  return path.join(reportRoot, rel);
}

// Atomic write: write to a temp file in the same directory, then rename over
// the destination. On Windows, rename over an existing file is not atomic by
// itself, so unlink-then-rename is used (documented behavior: last run wins).
function atomicWriteText(destPath, text) {
  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${path.basename(destPath)}-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, text, 'utf8');
  try {
    if (process.platform === 'win32') {
      try { fs.unlinkSync(destPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      fs.renameSync(tmp, destPath);
    } else {
      fs.renameSync(tmp, destPath);
    }
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
  return destPath;
}

function persistReport(cfg, targetDate, text) {
  const dest = resolveReportPath(cfg.output.layout, cfg.reportRoot, targetDate);
  atomicWriteText(dest, text);
  return dest;
}

module.exports = { resolveReportPath, atomicWriteText, persistReport };

// CLI entry for the LLM step of /report:
//   node tools/lib/storage.js --layout "<layout>" --root <reportRoot> --date <YYYY-MM-DD> [--stdin]
// Reads report text from stdin and prints the final absolute path. Kept tiny
// so the Skill workflow can call it through the Cline terminal tool on any OS.
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  if (getArg('--print-path')) {
    const p = resolveReportPath(getArg('--layout') || '{root}/YYYY/MM/DD/report.txt', path.resolve(getArg('--root')), getArg('--date'));
    console.log(p);
    process.exit(0);
  }
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    const cfgish = {
      output: { layout: getArg('--layout') || '{root}/YYYY/MM/DD/report.txt' },
      reportRoot: path.resolve(getArg('--root')),
    };
    const dest = persistReport(cfgish, getArg('--date'), text);
    console.log(dest);
  });
}
