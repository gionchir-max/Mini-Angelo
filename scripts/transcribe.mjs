import {installWhisperCpp, transcribe, downloadWhisperModel, convertToCaptions} from '@remotion/install-whisper-cpp';
import {writeFileSync, copyFileSync, mkdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const WHISPER_DIR = path.resolve('whisper.cpp');
const MODEL = 'small';
const AUDIO = path.resolve('public/voiceover.mp3');
const WAV = path.resolve('public/voiceover.wav');
const WHISPER_BAK = path.resolve('src/captions.whisper.bak.json');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${err}`))));
  });
}

async function main() {
  if (!existsSync(AUDIO)) {
    console.error('[transcribe] public/voiceover.mp3 mancante — esegui prima `npm run prep`');
    process.exit(1);
  }

  console.log('[transcribe] installo whisper.cpp...');
  await installWhisperCpp({to: WHISPER_DIR, version: '1.5.5'});

  console.log(`[transcribe] modello ${MODEL}...`);
  await downloadWhisperModel({folder: WHISPER_DIR, model: MODEL});

  console.log('[transcribe] converto audio → 16kHz mono WAV...');
  await run(ffmpegPath, ['-y', '-i', AUDIO, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', WAV]);

  console.log('[transcribe] whisper...');
  const {transcription} = await transcribe({
    inputPath: WAV,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: '1.5.5',
    model: MODEL,
    tokenLevelTimestamps: true,
    language: 'it',
    splitOnWord: true,
  });

  const {captions} = convertToCaptions({
    transcription,
    combineTokensWithinMilliseconds: 200,
  });

  mkdirSync(path.resolve('src'), {recursive: true});
  writeFileSync(WHISPER_BAK, JSON.stringify(captions, null, 2));
  console.log(`[transcribe] → ${captions.length} token → src/captions.whisper.bak.json`);
  const preview = captions.slice(0, 12).map((c) => c.text).join(' ');
  console.log(`[transcribe] preview: ${preview}`);
}

main().catch((e) => {
  console.error('[transcribe]', e.message);
  process.exit(1);
});
