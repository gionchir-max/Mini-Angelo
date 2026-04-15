import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {YTDLP} from './_ytdlp.mjs';

const ROOT = path.resolve('.');
const PUBLIC_SFX = path.join(ROOT, 'public', 'sfx');
const CACHE = path.join(ROOT, 'cache', 'sfx');
const WORDS_JSON = path.join(ROOT, 'src', 'words.json');
const SFX_JSON = path.join(ROOT, 'src', 'sfx.json');

mkdirSync(PUBLIC_SFX, {recursive: true});
mkdirSync(CACHE, {recursive: true});

// Effetti da avere sempre disponibili nel pack
const EFFECTS = [
  {name: 'whoosh', query: 'whoosh transition sound effect free download'},
  {name: 'pop', query: 'pop sound effect free download'},
  {name: 'ding', query: 'ding notification sound effect free download'},
  {name: 'impact', query: 'impact cinematic sound effect free download'},
  {name: 'boom', query: 'boom bass drop sound effect free download'},
];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve({out, err}) : reject(new Error(`${cmd} exit ${code}: ${err}`))));
  });
}

async function ensureEffect(effect) {
  const finalFile = path.join(PUBLIC_SFX, `${effect.name}.mp3`);
  if (existsSync(finalFile)) return;

  const cacheRaw = path.join(CACHE, `${effect.name}.raw.mp3`);
  const cacheNorm = path.join(CACHE, `${effect.name}.mp3`);

  if (!existsSync(cacheNorm)) {
    if (!existsSync(cacheRaw)) {
      console.log(`[sfx] scarico "${effect.name}"...`);
      // Scarica solo primi 10s dell'audio, bestaudio
      await run(YTDLP, [
        `ytsearch1:${effect.query}`,
        '-x', '--audio-format', 'mp3', '--audio-quality', '5',
        '--download-sections', '*0-10',
        '-o', cacheRaw.replace(/\.mp3$/, '.%(ext)s'),
        '--no-warnings', '--quiet',
      ]);
    }
    if (!existsSync(cacheRaw)) throw new Error(`Scaricamento SFX ${effect.name} fallito`);
    // Normalizza + taglia a 4s max
    await run(ffmpegPath, [
      '-y',
      '-i', cacheRaw,
      '-t', '4',
      '-af', 'loudnorm=I=-20:TP=-2:LRA=11',
      '-ar', '48000',
      '-ac', '2',
      cacheNorm,
    ]);
  }
  copyFileSync(cacheNorm, finalFile);
}

function generateEvents(words, bannerSec = 10) {
  const events = [];
  // Apertura: impact + whoosh
  events.push({file: 'impact.mp3', atSeconds: 0.0, volume: 0.5});
  events.push({file: 'whoosh.mp3', atSeconds: 0.15, volume: 0.4});
  // Ding a fine hook banner
  events.push({file: 'ding.mp3', atSeconds: 0.3, volume: 0.35});

  if (!Array.isArray(words) || words.length === 0) return events;

  // Whoosh su gap lunghi (cambio frase)
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= 0.55) {
      events.push({file: 'whoosh.mp3', atSeconds: words[i].start - 0.1, volume: 0.32});
    }
  }

  // Impact su parole-hook euristiche
  const HOOK_KEYWORDS = new Set([
    'ma', 'eppure', 'attenzione', 'incredibile', 'pero', 'però',
    'aspetta', 'bello', 'peggio', 'nessuno', 'tutto', 'mai',
  ]);
  for (const w of words) {
    const norm = w.word.toLowerCase().replace(/[^a-zà-ú]/g, '');
    if (HOOK_KEYWORDS.has(norm)) {
      events.push({file: 'pop.mp3', atSeconds: w.start, volume: 0.35});
    }
  }

  // De-duplica eventi troppo vicini (< 0.25s l'uno dall'altro per stesso file)
  events.sort((a, b) => a.atSeconds - b.atSeconds);
  const filtered = [];
  const lastByFile = new Map();
  for (const e of events) {
    const last = lastByFile.get(e.file);
    if (last !== undefined && e.atSeconds - last < 0.6) continue;
    lastByFile.set(e.file, e.atSeconds);
    filtered.push(e);
  }
  return filtered;
}

async function main() {
  console.log('[sfx] verifico pacchetto effetti...');
  for (const effect of EFFECTS) {
    try {
      await ensureEffect(effect);
    } catch (e) {
      console.warn(`[sfx] skip ${effect.name}: ${e.message}`);
    }
  }

  let words = [];
  if (existsSync(WORDS_JSON)) {
    try {
      words = JSON.parse(readFileSync(WORDS_JSON, 'utf8'));
    } catch {}
  }

  const events = generateEvents(words);
  writeFileSync(SFX_JSON, JSON.stringify(events, null, 2));
  console.log(`[sfx] → ${events.length} eventi → src/sfx.json`);
}

main().catch((e) => {
  console.error('[sfx]', e.message);
  process.exit(1);
});
