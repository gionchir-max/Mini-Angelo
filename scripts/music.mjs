import {spawn} from 'node:child_process';
import {mkdirSync, existsSync, readFileSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import {path as ffprobePath} from '@ffprobe-installer/ffprobe';

const ROOT = path.resolve('.');
const PUBLIC = path.join(ROOT, 'public');
mkdirSync(PUBLIC, {recursive: true});

const MUSIC_OUT = path.join(PUBLIC, 'music.mp3');
const META_JSON = path.join(ROOT, 'src', 'meta.json');

// Traccia fissa: sempre questa.
const SRC_MUSIC =
  '/Volumes/Extreme SSD/Video Claude/Cinematic Epic Music by Infraction [No Copyright Music] Action(mp3j.cc).mp3';

// Loudness target: -14 LUFS come richiesto dall'utente.
const TARGET_LUFS = -14;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) =>
      code === 0 ? resolve({out, err}) : reject(new Error(`${cmd} exit ${code}: ${err}`)),
    );
  });
}

async function probeDuration(file) {
  const {out} = await run(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    file,
  ]);
  return parseFloat(out.trim());
}

async function main() {
  if (!existsSync(SRC_MUSIC)) {
    throw new Error(`Sorgente musicale non trovata: ${SRC_MUSIC}`);
  }

  // Durata target: voiceoverDuration + 2s di coda (come il video)
  let targetDuration = 180;
  if (existsSync(META_JSON)) {
    try {
      const meta = JSON.parse(readFileSync(META_JSON, 'utf8'));
      if (meta.voiceoverDuration && meta.voiceoverDuration > 0) {
        targetDuration = Math.ceil(meta.voiceoverDuration + 2);
      }
    } catch {}
  }

  const srcDuration = await probeDuration(SRC_MUSIC);
  console.log(
    `[music] sorgente: ${srcDuration.toFixed(1)}s, target: ${targetDuration}s${
      srcDuration < targetDuration ? ' (loop necessario)' : ''
    }`,
  );

  if (existsSync(MUSIC_OUT)) unlinkSync(MUSIC_OUT);

  // Se la traccia è più corta del target, stream_loop -1 la ripete all'infinito;
  // il flag -t limita l'output alla durata richiesta.
  const needLoop = srcDuration < targetDuration;
  const args = ['-y'];
  if (needLoop) args.push('-stream_loop', '-1');
  args.push(
    '-i', SRC_MUSIC,
    '-t', String(targetDuration),
    '-af', `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11`,
    '-ar', '48000',
    '-ac', '2',
    '-b:a', '192k',
    MUSIC_OUT,
  );

  console.log(`[music] normalizzo a ${TARGET_LUFS} LUFS e scrivo ${targetDuration}s...`);
  await run(ffmpegPath, args);

  const outDur = await probeDuration(MUSIC_OUT);
  console.log(`[music] → public/music.mp3 (${outDur.toFixed(1)}s @ ${TARGET_LUFS} LUFS)`);
}

main().catch((e) => {
  console.error('[music]', e.message);
  process.exit(1);
});
