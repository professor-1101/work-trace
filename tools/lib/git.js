'use strict';
// Deterministic git evidence collector. NO semantic grouping, NO Persian text.
// Cross-platform: only Node fs/path + the `git` CLI (spawned with argument
// arrays — never shell strings). Handles .git dirs and .git files (worktrees /
// submodules), nested repos, broken repos, detached HEAD, empty repos.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const GIT_SEP = '\x1f'; // unit separator between fields
const REC_SEP = '\x1e'; // record separator between commits

function gitArgs(repoDir, args) {
  return ['-C', repoDir, ...args];
}

function runGit(repoDir, args, maxBuffer) {
  const res = spawnSync('git', gitArgs(repoDir, args), {
    encoding: 'utf8',
    maxBuffer: maxBuffer || 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (res.error) {
    return { ok: false, error: String(res.error.message || res.error) };
  }
  if (res.status !== 0) {
    return { ok: false, code: res.status, stderr: (res.stderr || '').trim() };
  }
  return { ok: true, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// ---- repository discovery -------------------------------------------------

function isGitRepo(dir) {
  try {
    const st = fs.lstatSync(path.join(dir, '.git'));
    if (st.isDirectory() || st.isFile()) return true;
  } catch (_) {}
  // bare repository: HEAD + objects + refs present at top level
  try {
    if (
      fs.existsSync(path.join(dir, 'HEAD')) &&
      fs.existsSync(path.join(dir, 'objects')) &&
      fs.existsSync(path.join(dir, 'refs'))
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function matchPrefixList(rel, list) {
  // rel: posix path relative to projectsRoot. Entries act as directory
  // prefixes or exact paths ("apps/*" treated as prefix "apps/").
  return list.some((entryRaw) => {
    let entry = toPosix(String(entryRaw)).replace(/\\/g, '/');
    if (entry.endsWith('/**') || entry.endsWith('/*')) entry = entry.replace(/\/\*\*?$/, '');
    if (entry === '') return false;
    if (rel === entry) return true;
    if (rel.startsWith(entry + '/')) return true;
    return false;
  });
}

function deriveProjectName(repoAbs, projectsRoot, overrides) {
  // nameOverrides keys are matched against the repo path relative to
  // projectsRoot (posix separators), falling back to absolute path.
  const rel = toPosix(path.relative(projectsRoot, repoAbs));
  for (const [k, v] of Object.entries(overrides || {})) {
    const kk = toPosix(k).replace(/\\/g, '/');
    if (kk === rel || kk === toPosix(repoAbs).replace(/\\/g, '/')) return String(v);
  }
  if (rel && rel !== '.') {
    // stable name from relative path: "apps/foo" -> "foo"; nested keeps tail
    const partsArr = rel.split('/').filter(Boolean);
    return partsArr[partsArr.length - 1];
  }
  return path.basename(repoAbs);
}

function discoverRepositories(cfg) {
  const root = cfg.projectsRoot;
  const disc = cfg.discovery;
  const found = [];
  const visitedRealDirs = new Map(); // realpath -> first-seen relative path
  const warnings = [];

  function walk(dir, depth, relPosix) {
    if (depth > disc.maxDepth) return;
    let realDir;
    try {
      realDir = fs.realpathSync(dir);
    } catch (e) {
      warnings.push({ dir, reason: `inaccessible: ${e.message}` });
      return;
    }
    const seenRel = visitedRealDirs.get(realDir);
    if (seenRel !== undefined) {
      // Symlink loop / duplicate directory. The repo-level dedup below only
      // sees entries this walk actually reached, so when the first visit was
      // pruned (e.g. by an include/exclude filter or maxDepth) we must record
      // the alias here — otherwise duplicate detection would silently vanish
      // depending on filter configuration. Deterministic: keyed by realpath.
      // Guard against loops: only record each alias path once.
      if (!found.some((f) => f.rel === relPosix)) {
        found.push({ abs: dir, rel: relPosix, depth, dupOfReal: realDir, dupOfRel: seenRel });
      }
      return;
    }
    visitedRealDirs.set(realDir, relPosix);

    if (disc.exclude.length && matchPrefixList(relPosix, disc.exclude)) return;

    let isRepo = false;
    try {
      isRepo = isGitRepo(dir);
    } catch (_) {}
    if (isRepo) {
      // Record even if already present from a duplicate-alias push above.
      if (!found.some((f) => f.rel === relPosix)) {
        found.push({ abs: dir, rel: relPosix, depth });
      } else {
        // An alias entry for this same path exists; upgrade it to a normal
        // repo entry (it is the canonical visit).
        const ex = found.find((f) => f.rel === relPosix);
        delete ex.dupOfReal;
        delete ex.dupOfRel;
      }
      // Nested repositories inside a repo are still discovered, but recorded
      // as nested under their parent (caller dedups deterministically).
      // Never descend into .git internals of this repository.
    }

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      warnings.push({ dir, reason: `unreadable directory: ${e.message}` });
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) {
        if (ent.isSymbolicLink() && disc.followSymlinks) {
          // handled below via lstat check
        } else if (ent.isSymbolicLink() && !disc.followSymlinks) {
          continue;
        } else {
          continue;
        }
      }
      const name = ent.name;
      if (name === '.git') continue;
      if (disc.skipDirs.includes(name)) continue;
      if (ent.isSymbolicLink() && !disc.followSymlinks) continue;
      const childAbs = path.join(dir, name);
      const childRel = relPosix ? `${relPosix}/${name}` : name;
      walk(childAbs, depth + 1, childRel);
    }
  }

  walk(root, 0, '');

  // Deterministic ordering by relative path.
  let repos = [...found].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  // Canonicalize + detect duplicates (same realpath) BEFORE the include
  // filter, so a nested or symlink-duplicate repository can never survive as
  // "active" merely because its parent entry was filtered out. First entry in
  // sorted order wins; later same-realpath entries are recorded as duplicates.
  const byReal = new Map();
  const deduped = [];
  for (const r of repos) {
    // Alias recorded during the walk whose canonical directory was pruned
    // before repo-level dedup could see it (e.g. projects root itself, or a
    // path cut by exclude/maxDepth). Mark it as a duplicate deterministically.
    if (r.dupOfReal && !byReal.has(r.dupOfReal)) {
      deduped.push({ ...r, duplicateOf: r.dupOfRel, reason: 'same realpath (symlink/duplicate)' });
      continue;
    }
    let real;
    try {
      real = fs.realpathSync(r.abs);
    } catch (_) {
      real = r.abs;
    }
    if (byReal.has(real)) {
      deduped.push({ ...r, duplicateOf: byReal.get(real), reason: 'same realpath (symlink/duplicate)' });
      continue;
    }
    byReal.set(real, r.rel);
    deduped.push(r);
  }

  // Apply include filter (empty list = all) after dedup. Duplicates remain in
  // the ignored set regardless of filters — detection stays deterministic.
  repos = deduped.filter((r) => !r.duplicateOf && (!disc.include.length || matchPrefixList(r.rel, disc.include)));
  const dupRecords = deduped.filter((r) => r.duplicateOf);

  const active = [];
  const ignored = [];
  const nested = [];

  // Duplicate-path records always land in `ignored` (even when the include
  // filter removed their parent), keeping detection deterministic.
  for (const r of dupRecords) {
    const projectName = deriveProjectName(r.abs, root, disc.nameOverrides);
    ignored.push({ path: r.abs, relativePath: r.rel, projectName, duplicateOf: r.duplicateOf, reason: 'duplicate-path' });
  }

  for (const r of repos) {
    const projectName = deriveProjectName(r.abs, root, disc.nameOverrides);
    const rec = { path: r.abs, relativePath: r.rel, projectName, duplicateOf: null };
    if (matchPrefixList(r.rel, disc.ignore) || disc.ignore.includes(projectName)) {
      ignored.push({ ...rec, reason: 'ignored-by-config' });
      continue;
    }
    active.push(rec);
  }

  // Mark nested repos: an active repo whose relative path starts with another
  // active repo's relative path + '/' is nested. It stays collectable, but the
  // relationship is recorded so the workflow can flag double counting.
  for (const a of active) {
    for (const b of active) {
      if (a !== b && b.relativePath && a.relativePath.startsWith(b.relativePath + '/')) {
        (a.nestedUnder = a.nestedUnder || []).push(b.relativePath);
        nested.push({ repo: a.relativePath, under: b.relativePath });
      }
    }
  }

  if (active.length > cfg.limits.maxRepos) {
    throw new Error(
      `Discovered ${active.length} repositories, exceeding limits.maxRepos=${cfg.limits.maxRepos}. Narrow discovery or raise the limit.`
    );
  }

  return { repositories: active, ignored, nested, warnings };
}

// ---- commit collection ----------------------------------------------------

function repoState(repoDir) {
  const out = { head: null, detached: false, empty: false, branch: null, worktree: false, error: null };
  const rev = runGit(repoDir, ['rev-parse', '--verify', 'HEAD'], 1 << 20);
  if (!rev.ok) {
    // Could be an empty repository (no commits yet) or a broken one.
    const inside = runGit(repoDir, ['rev-parse', '--is-inside-work-tree'], 1 << 20);
    const bare = runGit(repoDir, ['rev-parse', '--is-bare-repository'], 1 << 20);
    if (!inside.ok && !(bare.ok && bare.stdout.trim() === 'true')) {
      out.error = rev.stderr || 'not a git repository';
      return out;
    }
    const anyRef = runGit(repoDir, ['rev-list', '--max-count=1', '--all'], 1 << 20);
    if (anyRef.ok && anyRef.stdout.trim() === '') out.empty = true;
    else if (!anyRef.ok) out.error = anyRef.stderr;
    return out;
  }
  out.head = rev.stdout.trim();
  const ab = runGit(repoDir, ['symbolic-ref', '--short', '-q', 'HEAD'], 1 << 20);
  if (ab.ok && ab.stdout.trim()) out.branch = ab.stdout.trim();
  else out.detached = true;
  const wt = runGit(repoDir, ['rev-parse', '--git-common-dir'], 1 << 20);
  if (wt.ok) {
    const common = path.resolve(repoDir, wt.stdout.trim());
    const own = runGit(repoDir, ['rev-parse', '--absolute-git-dir'], 1 << 20);
    if (own.ok && path.resolve(own.stdout.trim()) !== common) out.worktree = true;
  }
  return out;
}

const LOG_FORMAT = ['%H', '%h', '%p', '%an', '%ae', '%ad', '%at', '%cn', '%ce', '%cd', '%ct', '%s', '%B'].join(GIT_SEP) + REC_SEP;

function collectCommitsInRange(repoDir, startMs, endMs, cfg) {
  // Commits reachable from HEAD whose COMMITTER date falls in [start,end).
  // Author dates are preserved per commit; filtering on committer date is the
  // deterministic, rebase-safe convention documented in the README.
  const sinceArg = `--since=${Math.floor(startMs / 1000)}`;
  const untilArg = `--until=${Math.floor(endMs / 1000)}`;
  const res = runGit(
    repoDir,
    ['log', 'HEAD', sinceArg, untilArg, `--max-count=${cfg.limits.maxCommitsPerRepo}`, `--format=${LOG_FORMAT}`, '--date=iso-strict'],
    64 * 1024 * 1024
  );
  if (!res.ok) {
    const err = res.stderr || '';
    if (/does not have any commits yet|unknown revision|bad default/i.test(err)) return { commits: [], logError: null };
    return { commits: [], logError: err };
  }
  const raw = res.stdout;
  const records = raw.split(REC_SEP).map((r) => r.replace(/^\n/, '')).filter((r) => r.trim() !== '');
  let commits = [];
  for (const rec of records) {
    const f = rec.split(GIT_SEP);
    if (f.length < 13) continue;
    const [hash, shortHash, parents, authorName, authorEmail, authorDate, authorTs, committerName, committerEmail, commitDate, commitTs, subject, body] = f;
    const parentList = parents.trim() ? parents.trim().split(' ') : [];
    commits.push({
      hash,
      shortHash,
      isMerge: parentList.length > 1,
      parents: parentList,
      author: { name: authorName, email: authorEmail, date: authorDate.trim(), timestamp: Number(authorTs) },
      committer: { name: committerName, email: committerEmail, date: commitDate.trim(), timestamp: Number(commitTs) },
      subject: subject,
      message: body.replace(/\n+$/, ''),
      bot: detectBot(authorName, authorEmail),
    });
  }
  // Post-filter to the EXACT [startMs, endMs) committer-date interval.
  // git's --since/--until date-first-walk optimization can include older
  // commits whose ancestors fall inside the window; that would break day
  // boundaries, so membership is enforced deterministically here.
  commits = commits.filter((c) => c.committer.timestamp * 1000 >= startMs && c.committer.timestamp * 1000 < endMs);
  return { commits, logError: null };
}

function detectBot(name, email) {
  const s = `${name} ${email}`.toLowerCase();
  return /(bot|noreply|no-reply|\[ci\]|github-actions|dependabot|renovate|snyk)/.test(s);
}

function collectCommitEvidence(repoDir, commit, cfg) {
  const ev = { stats: null, files: [], diff: null, truncated: false };
  const isMerge = commit.isMerge;
  const statArgs = isMerge
    ? ['show', '--first-parent', '--stat', '--format=', commit.hash]
    : ['show', '--stat', '--format=', commit.hash];
  const stat = runGit(repoDir, statArgs, cfg.limits.maxEvidenceBytesPerCommit * 4);
  if (stat.ok) {
    const lines = stat.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length) {
      const summary = lines[lines.length - 1];
      const m = /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/.exec(summary);
      ev.stats = {
        files: m ? Number(m[1]) : null,
        insertions: m && m[2] ? Number(m[2]) : null,
        deletions: m && m[3] ? Number(m[3]) : null,
      };
      const fileLines = lines.slice(0, -1).slice(0, cfg.limits.maxStatFiles);
      ev.files = fileLines.map((l) => l.trim());
      if (lines.length - 1 > cfg.limits.maxStatFiles) ev.truncated = true;
    }
  }
  // Full patch only when it fits the budget; otherwise names-only evidence.
  const showArgs = isMerge
    ? ['show', '--first-parent', '--format=', '--patch', '--unified=3', '--find-renames', commit.hash]
    : ['show', '--format=', '--patch', '--unified=3', '--find-renames', commit.hash];
  const patch = runGit(repoDir, showArgs, cfg.limits.maxEvidenceBytesPerCommit + 1024 * 1024);
  if (patch.ok) {
    if (Buffer.byteLength(patch.stdout, 'utf8') <= cfg.limits.maxEvidenceBytesPerCommit) {
      ev.diff = patch.stdout;
    } else {
      ev.diff = null;
      ev.truncated = true;
    }
  } else if (patch.code === null && String(patch.error || '').includes('maxBuffer')) {
    ev.diff = null;
    ev.truncated = true;
  }
  return ev;
}

function collectRepository(repoRec, cfg, targetDate, timeZone) {
  const { dayBounds } = require('./time');
  const result = {
    project: repoRec.projectName,
    path: repoRec.path,
    relativePath: repoRec.relativePath,
    state: repoState(repoRec.path),
    commits: [],
    errors: [],
  };
  if (result.state.error) {
    result.errors.push(`broken repository: ${result.state.error}`);
    return result;
  }
  if (result.state.empty || !result.state.head) {
    return result; // empty repo: no commits today, valid outcome
  }
  const bounds = dayBounds(targetDate, timeZone);
  const { commits, logError } = collectCommitsInRange(repoRec.path, bounds.startMs, bounds.endMs, cfg);
  if (logError) result.errors.push(`git log failed: ${logError}`);
  for (const c of commits) {
    c.evidence = collectCommitEvidence(repoRec.path, c, cfg);
    result.commits.push(c);
  }
  if (result.commits.length >= cfg.limits.maxCommitsPerRepo) {
    result.warnings = [`commit count hit limits.maxCommitsPerRepo=${cfg.limits.maxCommitsPerRepo}; older commits on this date may be missing`];
  }
  return result;
}

function collectAll(cfg, targetDate, now) {
  const timeZone = cfg.timezone;
  const discovery = discoverRepositories(cfg);
  const repos = [];
  let hasRealFailure = false;
  for (const r of discovery.repositories) {
    const rr = collectRepository(r, cfg, targetDate, timeZone);
    repos.push(rr);
    if (rr.errors.length) hasRealFailure = true;
  }
  const totalCommits = repos.reduce((n, r) => n + r.commits.length, 0);
  return {
    schemaVersion: 1,
    generatedAt: (now || new Date()).toISOString(),
    timezone: timeZone,
    targetDate,
    configPath: cfg._configPath || null,
    projectsRoot: cfg.projectsRoot,
    repositories: repos,
    discovery: {
      ignored: discovery.ignored,
      nested: discovery.nested,
      warnings: discovery.warnings,
    },
    totals: { repositories: repos.length, repositoriesWithCommits: repos.filter((r) => r.commits.length > 0).length, commits: totalCommits },
    hasRealFailure,
  };
}

module.exports = { discoverRepositories, collectAll, collectRepository, repoState, isGitRepo, deriveProjectName, runGit };
