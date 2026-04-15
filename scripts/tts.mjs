import 'dotenv/config';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'out');
const SRC = path.join(ROOT, 'src');
mkdirSync(OUT, {recursive: true});

const SCRIPT_TXT = path.join(SRC, 'script.txt');
const VOICE_RAW = path.join(OUT, 'voiceover-raw.mp3');

if (!existsSync(SCRIPT_TXT)) {
  console.error('src/script.txt non trovato — esegui prima `npm run script`');
  process.exit(1);
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

if (!API_KEY || !VOICE_ID) {
  console.error('ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID mancanti nel .env');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
const scriptText = readFileSync(SCRIPT_TXT, 'utf8').trim();

if (!FORCE && existsSync(VOICE_RAW) && statSync(VOICE_RAW).size > 10000) {
  const scriptMtime = statSync(SCRIPT_TXT).mtimeMs;
  const voiceMtime = statSync(VOICE_RAW).mtimeMs;
  if (voiceMtime > scriptMtime) {
    console.log('[tts] cache hit — skip (use --force per rigenerare)');
    process.exit(0);
  }
}

const body = {
  text: scriptText,
  model_id: MODEL_ID,
  voice_settings: {
    stability: parseFloat(process.env.ELEVENLABS_STABILITY ?? '0.4'),
    similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY ?? '1.0'),
    style: parseFloat(process.env.ELEVENLABS_STYLE ?? '0.5'),
    use_speaker_boost: (process.env.ELEVENLABS_SPEAKER_BOOST ?? 'true') === 'true',
    speed: parseFloat(process.env.ELEVENLABS_SPEED ?? '1.0'),
  },
};

const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';
console.log(`[tts] ElevenLabs ${MODEL_ID} voice=${VOICE_ID} (${scriptText.length} char)...`);

const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${outputFormat}`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'xi-api-key': API_KEY,
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`ElevenLabs ${res.status}: ${err}`);
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(VOICE_RAW, buf);
console.log(`[tts] → out/voiceover-raw.mp3 (${(buf.length / 1024).toFixed(0)} KB)`);
