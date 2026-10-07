'use strict';
// Shared test helpers: deterministic git fixtures + temp dirs.
// All git invocations use argument arrays (no shell) so tests behave the
// same on Linux and Windows.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmRecursive(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) {
    // Node <14.14 fallback
    if (fs.existsSync(p)) {
      for (const e of fs.readdirSync(p)) {
        const fp = path.join(p, e);
        if (fs.lstatSync(fp).isDirectory()) rmRecursive(fp);
        else fs.unlinkSync(fp);
      }
      fs.rmdirSync(p);
    }
  }
}

function git(repoDir, args, env) {
  const res = spawnSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    env: Object.assign(
      {},
      process.env,
      {
        GIT_AUTHOR_NAME: 'Tester',
        GIT_AUTHOR_EMAIL: 'tester@example.com',
        GIT_COMMITTER_NAME: 'Tester',
        GIT_COMMITTER_EMAIL: 'tester@example.com',
      },
      env || {}
    ),
  });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${res.status}): ${res.stderr}`);
  }
  return res.stdout;
}

// Create a repo with one commit at an explicit committer/author epoch.
// opts: { dateEpochSec, message, file, content, authorName, authorEmail }
function initRepoWithCommit(repoDir, opts) {
  opts = opts || {};
  fs.mkdirSync(repoDir, { recursive: true });
  git(repoDir, ['init', '--quiet', '-b', 'main']);
  const file = opts.file || 'file.txt';
  fs.writeFileSync(path.join(repoDir, file), opts.content || 'content\n');
  git(repoDir, ['add', '--all']);
  const iso = new Date((opts.dateEpochSec || Math.floor(Date.now() / 1000)) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const env = {};
  env.GIT_AUTHOR_DATE = iso;
  env.GIT_COMMITTER_DATE = iso;
  if (opts.authorName) env.GIT_AUTHOR_NAME = opts.authorName;
  if (opts.authorEmail) env.GIT_AUTHOR_EMAIL = opts.authorEmail;
  git(repoDir, ['commit', '--quiet', '-m', opts.message || 'feat: initial'], env);
  return repoDir;
}

function addCommit(repoDir, opts) {
  opts = opts || {};
  const file = opts.file || `f-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  fs.writeFileSync(path.join(repoDir, file), opts.content || 'x\n');
  git(repoDir, ['add', '--all']);
  const env = {};
  if (opts.dateEpochSec) {
    const iso = new Date(opts.dateEpochSec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    env.GIT_AUTHOR_DATE = iso;
    env.GIT_COMMITTER_DATE = iso;
  }
  if (opts.committerEpochSec && !opts.dateEpochSec) {
    env.GIT_COMMITTER_DATE = new Date(opts.committerEpochSec * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  if (opts.authorName) env.GIT_AUTHOR_NAME = opts.authorName;
  if (opts.authorEmail) env.GIT_AUTHOR_EMAIL = opts.authorEmail;
  git(repoDir, ['commit', '--quiet', '-m', opts.message || 'chore: update'], env);
}

module.exports = { mkTmp, rmRecursive, git, initRepoWithCommit, addCommit };
