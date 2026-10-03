'use strict';
// YAML loading for worktrace.yaml.
// Prefers the `yaml` npm package when installed; otherwise falls back to a
// deterministic subset parser that supports the documented WORKTRACE config
// schema (nested maps, block sequences of scalars or maps, inline flow lists,
// quoted strings, comments). The fallback is intentionally limited: any
// construct it cannot understand raises a clear error instead of guessing.

const fs = require('fs');

let externalYaml = null;
try {
  externalYaml = require('yaml');
} catch (_) {
  externalYaml = null;
}

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if ((s.startsWith('"') && s.endsWith('"') && s.length >= 2)) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return s.slice(1, -1);
    }
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map((item) => parseScalar(item));
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    const obj = {};
    if (inner === '') return obj;
    for (const pair of splitFlow(inner)) {
      const kv = parseKey(pair.trim());
      if (!kv) throw new Error(`Unparseable inline YAML mapping entry: "${pair}"`);
      obj[kv.key] = parseScalar(kv.rest);
    }
    return obj;
  }
  return s;
}

function splitFlow(inner) {
  const parts = [];
  let depth = 0;
  let cur = '';
  let inQ = null;
  for (const c of inner) {
    if (inQ) {
      cur += c;
      if (c === inQ) inQ = null;
      continue;
    }
    if (c === '"' || c === "'") { inQ = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

function parseKey(raw) {
  const idx = findColon(raw);
  if (idx === -1) return null;
  const key = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + 1).trim();
  const unq = (k) => {
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) return k.slice(1, -1);
    return k;
  };
  return { key: unq(key), rest };
}

function findColon(line) {
  let inQ = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === inQ) inQ = null; continue; }
    if (c === '"' || c === "'") { inQ = c; continue; }
    if (c === ':' && (i + 1 >= line.length || line[i + 1] === ' ')) return i;
  }
  return -1;
}

function indentOf(line) {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

// Minimal but strict subset parser.
function parseSubset(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const noTab = raw.replace(/\t/g, '  ');
    const stripped = stripComment(noTab);
    if (stripped.trim() === '') continue;
    lines.push({ text: stripped.replace(/\s+$/, ''), indent: indentOf(stripped) });
  }
  if (lines.length === 0) return {};
  let pos = 0;

  function parseBlock(indent) {
    // Returns map or list depending on first line.
    if (pos >= lines.length) return {};
    if (lines[pos].text.trim().startsWith('- ') || lines[pos].text.trim() === '-') {
      return parseList(indent);
    }
    return parseMap(indent);
  }

  function parseMap(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent) {
      const line = lines[pos].text.trim();
      if (line.startsWith('- ') || line === '-') break;
      const kv = parseKey(line);
      if (!kv) throw new Error(`Unparseable YAML line: "${lines[pos].text}"`);
      pos++;
      if (kv.rest === '' ) {
        if (pos < lines.length && lines[pos].indent > indent) {
          obj[kv.key] = parseBlock(lines[pos].indent);
        } else if (pos < lines.length && lines[pos].indent === indent && lines[pos].text.trim().startsWith('-') && indent === lines[pos].indent) {
          // sequence at same indent as key (common YAML style)
          obj[kv.key] = parseList(indent);
        } else {
          obj[kv.key] = null;
        }
      } else {
        obj[kv.key] = parseScalar(kv.rest);
      }
    }
    return obj;
  }

  function parseList(indent) {
    const arr = [];
    while (pos < lines.length && lines[pos].indent === indent && (lines[pos].text.trim().startsWith('- ') || lines[pos].text.trim() === '-')) {
      const itemText = lines[pos].text.trim().replace(/^-\s*/, '');
      lines[pos] = { text: ' '.repeat(indent + 2) + itemText, indent: indent + 2 };
      if (itemText === '') {
        pos++;
        if (pos < lines.length && lines[pos].indent > indent) arr.push(parseBlock(lines[pos].indent));
        else arr.push(null);
        continue;
      }
      if (findColon(itemText) !== -1) {
        arr.push(parseMap(indent + 2));
      } else {
        pos++;
        arr.push(parseScalar(itemText));
      }
    }
    return arr;
  }

  const result = parseBlock(lines[0].indent);
  if (pos < lines.length) {
    throw new Error(`Unexpected indentation at line: "${lines[pos].text}"`);
  }
  return result;
}

function parse(text, filename) {
  if (externalYaml) {
    try {
      return externalYaml.parse(text);
    } catch (e) {
      throw new Error(`Invalid YAML in ${filename || '(string)'}: ${e.message}`);
    }
  }
  try {
    return parseSubset(text);
  } catch (e) {
    throw new Error(`Invalid YAML in ${filename || '(string)'}: ${e.message}`);
  }
}

function loadFile(pathname) {
  const fsText = fs.readFileSync(pathname, 'utf8');
  const doc = parse(fsText, pathname);
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error(`Config ${pathname} must contain a YAML mapping at the top level.`);
  }
  return doc;
}

module.exports = { parse, loadFile, parseSubset, hasExternalYaml: () => !!externalYaml };
