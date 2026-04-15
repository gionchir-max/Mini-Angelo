import ffmpegPath from 'ffmpeg-static';
import {path as ffprobePath} from '@ffprobe-installer/ffprobe';
import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, unlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'out');
mkdirSync(PUBLIC, {recursive: true});

const VOICE_RAW = path.join(OUT, 'voiceover-raw.mp3');
const VOICE_CLEAN = path.join(PUBLIC, 'voiceover.mp3');
const BG_MP4 = path.join(PUBLIC, 'bg.mp4');
const META_JSON = path.join(ROOT, 'src', 'meta.json');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve({out, err}) : reject(new Error(`${cmd} exit ${code}: ${err}`))));
  });
}

async function probeDuration(file) {
  const {out} = await run(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return parseFloat(out.trim());
}

async function main() {
  if (!existsSync(VOICE_RAW)) {
    console.error(`[prep] ${VOICE_RAW} non trovato — esegui prima \`npm run tts\``);
    process.exit(1);
  }

  console.log('[prep] rimuovo silenzi > 0.2s dal voiceover...');
  if (existsSync(VOICE_CLEAN)) unlinkSync(VOICE_CLEAN);
  await run(ffmpegPath, [
    '-y',
    '-i', VOICE_RAW,
    '-af',
    'silenceremove=stop_periods=-1:stop_duration=0.2:stop_threshold=-35dB:start_periods=1:start_duration=0.05:start_threshold=-35dB,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar', '48000',
    '-ac', '2',
    VOICE_CLEAN,
  ]);

  const origDur = await probeDuration(VOICE_RAW);
  const cleanDur = await probeDuration(VOICE_CLEAN);
  console.log(`[prep] voiceover: ${origDur.toFixed(2)}s → ${cleanDur.toFixed(2)}s (−${(origDur - cleanDur).toFixed(2)}s)`);

  let videoDur = 0;
  if (existsSync(BG_MP4)) {
    videoDur = await probeDuration(BG_MP4);
    console.log(`[prep] bg.mp4: ${videoDur.toFixed(2)}s`);
  } else {
    console.log('[prep] bg.mp4 non presente (verrà generato da `download` in base alla durata del voiceover)');
  }

  const meta = {
    voiceoverDuration: cleanDur,
    videoDuration: videoDur,
    fps: 30,
  };
  writeFileSync(META_JSON, JSON.stringify(meta, null, 2));
  console.log(`[prep] → src/meta.json`);
}

main().catch((e) => {
  console.error('[prep]', e.message);
  process.exit(1);
});
