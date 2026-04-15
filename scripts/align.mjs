import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const WHISPER_BAK = path.join(ROOT, 'src', 'captions.whisper.bak.json');
const SCRIPT_TXT = path.join(ROOT, 'src', 'script.txt');
const WORDS_JSON = path.join(ROOT, 'src', 'words.json');

const whisperRaw = JSON.parse(readFileSync(WHISPER_BAK, 'utf8'));
const script = readFileSync(SCRIPT_TXT, 'utf8');

function norm(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['\u2019`\u00b4]/g, "'")
    .replace(/[^a-z0-9']/g, '')
    .trim();
}

// Flatten whisper tokens → lista di parole con start
const flat = [];
for (let i = 0; i < whisperRaw.length; i++) {
  const tok = whisperRaw[i];
  const next = whisperRaw[i + 1];
  const tStart = tok.startInSeconds;
  const tEnd = next ? next.startInSeconds : tStart + 0.4;
  const words = tok.text.trim().split(/\s+/).filter(Boolean);
  const totalChars = words.reduce((s, w) => s + Math.max(w.length, 1), 0);
  let cursor = tStart;
  for (const word of words) {
    const share = (Math.max(word.length, 1) / totalChars) * (tEnd - tStart);
    flat.push({text: word, startInSeconds: cursor});
    cursor += share;
  }
}
for (let i = 0; i < flat.length; i++) {
  flat[i].endInSeconds = i + 1 < flat.length ? flat[i + 1].startInSeconds : flat[i].startInSeconds + 0.25;
}
const w = flat.map((t) => ({...t, n: norm(t.text)})).filter((t) => t.n.length > 0);
console.log(`[align] whisper flat: ${w.length} parole`);

const officialRaw = script.replace(/\s+/g, ' ').trim().split(/\s+/);
const official = officialRaw.map((raw) => ({raw, n: norm(raw)})).filter((w) => w.n.length > 0);
const N = official.length;
const M = w.length;
console.log(`[align] script ufficiale: ${N}, whisper: ${M}`);

function score(a, b) {
  if (a === b) return 3;
  if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return 1;
  if (a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3)) return 0;
  return -2;
}
const GAP = -1;
const dp = Array.from({length: N + 1}, () => new Int32Array(M + 1));
const bt = Array.from({length: N + 1}, () => new Int8Array(M + 1));
for (let i = 1; i <= N; i++) {
  dp[i][0] = i * GAP;
  bt[i][0] = 1;
}
for (let j = 1; j <= M; j++) {
  dp[0][j] = j * GAP;
  bt[0][j] = 2;
}
for (let i = 1; i <= N; i++) {
  for (let j = 1; j <= M; j++) {
    const diag = dp[i - 1][j - 1] + score(official[i - 1].n, w[j - 1].n);
    const up = dp[i - 1][j] + GAP;
    const left = dp[i][j - 1] + GAP;
    let best = diag, dir = 0;
    if (up > best) { best = up; dir = 1; }
    if (left > best) { best = left; dir = 2; }
    dp[i][j] = best;
    bt[i][j] = dir;
  }
}

const pairs = [];
let i = N, j = M;
while (i > 0 || j > 0) {
  const d = bt[i][j];
  if (i > 0 && j > 0 && d === 0) {
    pairs.push({oi: i - 1, wj: j - 1});
    i--; j--;
  } else if (i > 0 && (j === 0 || d === 1)) {
    pairs.push({oi: i - 1, wj: -1});
    i--;
  } else {
    j--;
  }
}
pairs.reverse();

const out = new Array(N).fill(null);
let matched = 0;
for (const p of pairs) {
  if (p.wj >= 0) {
    const oN = official[p.oi].n;
    const wN = w[p.wj].n;
    const good = oN === wN || (oN.length >= 4 && wN.length >= 4 && oN.slice(0, 4) === wN.slice(0, 4));
    if (good) {
      out[p.oi] = {
        word: official[p.oi].raw,
        start: w[p.wj].startInSeconds,
        end: w[p.wj].endInSeconds,
      };
      matched++;
    }
  }
}

// Riempi i buchi con interpolazione lineare fra ancore
for (let k = 0; k < N; k++) {
  if (out[k]) continue;
  let prev = k - 1;
  while (prev >= 0 && !out[prev]) prev--;
  let next = k + 1;
  while (next < N && !out[next]) next++;
  const prevEnd = prev >= 0 ? out[prev].end : 0;
  const nextStart = next < N ? out[next].start : (w[M - 1]?.endInSeconds ?? prevEnd + 0.4);
  const gapStart = prev + 1;
  const gapEnd = next - 1;
  const n = gapEnd - gapStart + 1;
  for (let q = 0; q < n; q++) {
    const idx = gapStart + q;
    const a = prevEnd + ((nextStart - prevEnd) * q) / n;
    const b = prevEnd + ((nextStart - prevEnd) * (q + 1)) / n;
    out[idx] = {word: official[idx].raw, start: a, end: b};
  }
  k = next - 1;
}

// Sanity check: monotonico, durata minima
for (let idx = 0; idx < out.length; idx++) {
  if (out[idx].end <= out[idx].start) out[idx].end = out[idx].start + 0.08;
  if (idx > 0 && out[idx].start < out[idx - 1].end) {
    out[idx].start = out[idx - 1].end;
    if (out[idx].end < out[idx].start + 0.08) out[idx].end = out[idx].start + 0.08;
  }
}

writeFileSync(WORDS_JSON, JSON.stringify(out, null, 2));
console.log(`[align] match: ${matched}/${N} (${((matched / N) * 100).toFixed(1)}%)`);
console.log(`[align] → src/words.json`);
