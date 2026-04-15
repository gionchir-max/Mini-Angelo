# tiktok-city

Pipeline end-to-end per generare reel TikTok (1080×1920, ~3 min) a partire da un nome di città o da un argomento. Il progetto compone automaticamente: drone footage da YouTube, voice-over ElevenLabs (script generato da un LLM in stile narrativo), sottotitoli word-by-word allineati con Whisper, musica di sottofondo, SFX e hook banner.

```bash
npm run make -- "Roma"
npm run make -- "la caduta dell'impero romano"
```

Output in `out/<topic>.mp4`.

## API key necessarie

Le chiavi vanno in un file `.env` nella root del progetto (partendo da `.env.example`):

```bash
cp .env.example .env
```

| Variabile | Obbligatoria | Dove prenderla | A cosa serve |
|---|---|---|---|
| `OPENROUTER_API_KEY` | sì | https://openrouter.ai/keys | Generazione script voice-over via DeepSeek (`deepseek/deepseek-v3.2`). Usata anche per suggerire la location di ricerca drone. |
| `OPENROUTER_MODEL` | no | — | Default `deepseek/deepseek-v3.2`. Override se vuoi un altro modello OpenRouter. |
| `ELEVENLABS_API_KEY` | sì | https://elevenlabs.io → Profile → API Keys | TTS del voice-over. Basta il permesso `text_to_speech`. |
| `ELEVENLABS_VOICE_ID` | sì | elevenlabs.io → Voices → clic sulla voce → Copy ID | Voce usata dal TTS (es. `pNInz6obpgDQGcFmaJgB`). |
| `ELEVENLABS_MODEL_ID` | no | — | Default `eleven_multilingual_v2`. |
| `ELEVENLABS_STABILITY` | no | — | Default `0.4`. |
| `ELEVENLABS_SIMILARITY` | no | — | Default `1.0`. |
| `ELEVENLABS_STYLE` | no | — | Default `0.5`. |
| `ELEVENLABS_SPEAKER_BOOST` | no | — | Default `true`. |
| `ELEVENLABS_SPEED` | no | — | Default `1.0`. |
| `ELEVENLABS_OUTPUT_FORMAT` | no | — | Default `mp3_44100_128`. |

Nessun'altra chiave serve: `yt-dlp` (download video + audio), `whisper.cpp` (trascrizione) e `ffmpeg` girano tutti in locale e vengono installati automaticamente come dipendenze npm (`youtube-dl-exec`, `@remotion/install-whisper-cpp`, `ffmpeg-static`).

## Setup

```bash
npm install          # installa Remotion, ffmpeg-static, yt-dlp, Whisper runner
cp .env.example .env # incolla le tue chiavi
```

La prima esecuzione scarica anche il modello Whisper `small` (~480 MB) e il binario Chrome Headless di Remotion. Le run successive riusano la cache.

## Musica di sottofondo

`scripts/music.mjs` usa **sempre** la traccia locale hardcoded:

```
/Volumes/Extreme SSD/Video Claude/Cinematic Epic Music by Infraction [No Copyright Music] Action(mp3j.cc).mp3
```

La traccia viene loopata se più corta del video e normalizzata a `−14 LUFS`. Se vuoi usare un altro file, modifica `SRC_MUSIC` in `scripts/music.mjs`.

## Comandi

```bash
npm run make -- "<topic>"                # pipeline completa
npm run make -- "<topic>" --force        # rigenera anche ciò che è in cache
npm run studio                           # anteprima interattiva Remotion
npm run render                           # solo remotion render (asset già pronti)
```

Step singoli (utili per debug):

```bash
npm run script -- "<topic>"
npm run tts
npm run download -- "<topic>"
npm run download -- "<topic>" --url=https://www.youtube.com/watch?v=XXXXXXXXXXX
npm run prep
npm run transcribe
npm run align
npm run music
npm run sfx
```

## Struttura

```
scripts/
  make.mjs         # orchestratore
  script.mjs       # DeepSeek → voice-over + hook banner
  tts.mjs          # ElevenLabs
  download.mjs     # yt-dlp drone (whitelist + URL override)
  prep.mjs         # silence-remove + loudnorm voiceover
  transcribe.mjs   # Whisper word-level
  align.mjs        # Needleman-Wunsch script ↔ whisper tokens
  music.mjs        # loop + loudnorm traccia fissa
  sfx.mjs          # SFX pack + eventi semantici
src/
  MainVideo.tsx    # composition Remotion 1080×1920
  Subtitles.tsx    # word-by-word, highlight giallo
  TopBanner.tsx    # hook banner primi 10 s
  SoundEffects.tsx
```
