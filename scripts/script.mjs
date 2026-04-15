import 'dotenv/config';
import {writeFileSync, mkdirSync, readFileSync, existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'out');
const SRC = path.join(ROOT, 'src');
mkdirSync(OUT, {recursive: true});
mkdirSync(SRC, {recursive: true});

const SCRIPT_TXT = path.join(SRC, 'script.txt');
const BANNER_JSON = path.join(SRC, 'banner.json');
const SCRIPT_META = path.join(OUT, 'script.meta.json');

const topic = process.argv.slice(2).join(' ').trim();
if (!topic) {
  console.error('Usage: node scripts/script.mjs "<topic o città>"');
  process.exit(1);
}

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v3.2';
if (!API_KEY) {
  console.error('OPENROUTER_API_KEY mancante nel .env');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
if (!FORCE && existsSync(SCRIPT_TXT) && existsSync(BANNER_JSON) && existsSync(SCRIPT_META)) {
  const meta = JSON.parse(readFileSync(SCRIPT_META, 'utf8'));
  if (meta.topic === topic) {
    console.log(`[script] cache hit per "${topic}" — skip (use --force per rigenerare)`);
    process.exit(0);
  }
}

const SYSTEM = `Sei uno sceneggiatore italiano specializzato in contenuti virali TikTok in stile narrativo Alessandro Barbero. Il tuo compito: scrivere voice-over di ~3 minuti (circa 450-500 parole, 150 wpm) che massimizzino watch-time, commenti e condivisioni.

REGOLE FERREE:
1. Il PRIMO SECONDO deve essere un pugno: domanda provocatoria, affermazione shock, rivelazione scomoda. La maggior parte degli utenti abbandona nei primi 2 secondi — devi trattenerli.
2. Ogni 25-35 secondi devi "resettare" la curiosità con un nuovo hook ("ma aspetta, c'è di peggio...", "quello che nessuno ti dice però è che...", "e qui viene il bello...").
3. Stile Barbero: ritmo narrativo, aneddoti concreti, dettagli sensoriali, citazioni immaginate, pause drammatiche implicite (frasi brevi + frasi lunghe che alternano).
4. Tono DIVISIVO: devi fare discutere. Prendi posizione scomoda, ribalta miti comuni, sfida luoghi comuni. Niente neutralità.
5. Emozioni forti: indignazione, stupore, orgoglio, paura, sdegno. Nessun tono tiepido.
6. Chiusura che inviti al commento esplicitamente ("E tu cosa ne pensi? Dillo nei commenti", "Salva questo video prima che lo tolgano", "Tagga chi deve saperlo").
7. NON usare emoji. NON usare asterischi o markdown. NON dire "oggi vi parlo di". Entra in medias res.
8. Italiano fluido, parlato, adatto a essere letto ad alta voce. Niente virgolette direzionate (sempre " o '). Niente trattini lunghi (—).
9. Il testo deve essere una singola stringa continua, con punteggiatura normale.

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa shape:
{
  "banner": "FRASE HOOK IN MAIUSCOLO MAX 6 PAROLE SU 2 RIGHE",
  "script": "testo voice over continuo di 450-500 parole..."
}
Nessun testo fuori dal JSON. Il campo "banner" deve essere una frase-amo d'apertura che verrà mostrata in sovrimpressione nei primi 10 secondi — deve essere diversa dalla prima frase dello script e deve incuriosire a prescindere.`;

const USER = `Argomento / città: ${topic}

Scrivi il voice-over secondo le regole. Ricorda: primi 2 secondi sono tutto. Hook ogni 30 secondi. Divisivo. Chiusura con call to action ai commenti.`;

async function callOpenRouter() {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tiktok-city.local',
      'X-Title': 'tiktok-city',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.9,
      response_format: {type: 'json_object'},
      messages: [
        {role: 'system', content: SYSTEM},
        {role: 'user', content: USER},
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Nessun contenuto restituito da OpenRouter');
  return content;
}

function extractJson(content) {
  try {
    return JSON.parse(content);
  } catch {}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Impossibile estrarre JSON dalla risposta');
}

console.log(`[script] genero voice-over per "${topic}" con ${MODEL}...`);
const raw = await callOpenRouter();
const parsed = extractJson(raw);

if (!parsed.script || !parsed.banner) {
  console.error('Risposta malformata:', parsed);
  process.exit(1);
}

const scriptText = parsed.script
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/[\u2013\u2014]/g, '-')
  .trim();

const bannerText = parsed.banner
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .trim()
  .toUpperCase();

writeFileSync(SCRIPT_TXT, scriptText + '\n');
writeFileSync(BANNER_JSON, JSON.stringify({text: bannerText}, null, 2));
writeFileSync(
  SCRIPT_META,
  JSON.stringify({topic, model: MODEL, words: scriptText.split(/\s+/).length}, null, 2),
);

const wc = scriptText.split(/\s+/).length;
console.log(`[script] OK — ${wc} parole (~${(wc / 150 * 60).toFixed(0)}s a 150wpm)`);
console.log(`[script] banner: "${bannerText}"`);
console.log(`[script] → src/script.txt, src/banner.json`);
