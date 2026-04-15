import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {WORDS} from './words';
import {loadFont} from '@remotion/google-fonts/OpenSans';

const {fontFamily} = loadFont('normal', {weights: ['800']});

const MAX_WORDS_PER_CHUNK = 6;
const MIN_CHUNK_SECONDS = 0.9;
const MAX_CHUNK_SECONDS = 2.8;

type Chunk = {words: typeof WORDS; start: number; end: number};

function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  let current: typeof WORDS = [];
  let chunkStart = WORDS[0]?.start ?? 0;

  const flush = (end: number) => {
    if (current.length > 0) {
      chunks.push({words: current, start: chunkStart, end});
      current = [];
    }
  };

  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i];
    if (current.length === 0) {
      chunkStart = w.start;
    }
    current.push(w);
    const elapsed = w.end - chunkStart;
    const nextWord = WORDS[i + 1];
    const gap = nextWord ? nextWord.start - w.end : 0;
    const endsSentence = /[.!?]$/.test(w.word);
    const reachedMax = current.length >= MAX_WORDS_PER_CHUNK;
    const longEnough = elapsed >= MIN_CHUNK_SECONDS;
    const bigGap = gap > 0.35;

    if (
      (endsSentence && longEnough) ||
      reachedMax ||
      elapsed >= MAX_CHUNK_SECONDS ||
      (bigGap && current.length >= 2)
    ) {
      flush(w.end + Math.min(gap, 0.25));
    }
  }
  flush(WORDS[WORDS.length - 1]?.end ?? 0);

  for (let i = 0; i < chunks.length - 1; i++) {
    const next = chunks[i + 1];
    chunks[i].end = Math.max(chunks[i].end, next.start - 0.02);
  }
  return chunks;
}

const CHUNKS = buildChunks();

export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const active = CHUNKS.find((c) => t >= c.start - 0.05 && t <= c.end + 0.05);
  if (!active) return null;

  const sinceStart = t - active.start;
  const untilEnd = active.end - t;
  const enter = Math.max(0, Math.min(1, sinceStart / 0.15));
  const exit = Math.max(0, Math.min(1, untilEnd / 0.15));
  const appear = Math.min(enter, exit);
  const scale = 0.9 + appear * 0.1;
  const opacity = appear;

  const words = active.words;
  const lines: (typeof words)[] = [];
  if (words.length <= 3) {
    lines.push(words);
  } else {
    const mid = Math.ceil(words.length / 2);
    lines.push(words.slice(0, mid));
    lines.push(words.slice(mid));
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: 0,
          right: 0,
          transform: `translateY(-50%) scale(${scale})`,
          opacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 60px',
          fontFamily,
          fontWeight: 800,
          fontSize: 48,
          lineHeight: 1.1,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '-0.005em',
        }}
      >
        {lines.map((line, li) => (
          <div
            key={li}
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: '18px',
              marginBottom: 6,
            }}
          >
            {line.map((w, wi) => {
              const isActive = t >= w.start && t <= w.end + 0.02;
              const wasSpoken = t > w.end + 0.02;
              const color = isActive ? '#FFD700' : '#FFFFFF';
              const cleanWord = w.word.replace(/[«»"]/g, '').toUpperCase();
              return (
                <span
                  key={`${li}-${wi}`}
                  style={{
                    color,
                    display: 'inline-block',
                    WebkitTextStroke: '4px #000',
                    paintOrder: 'stroke fill',
                    textShadow: isActive
                      ? '0 4px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,215,0,0.9), 0 8px 22px rgba(0,0,0,0.7)'
                      : '0 4px 0 rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.65)',
                    filter: wasSpoken ? 'brightness(0.96)' : 'none',
                  }}
                >
                  {cleanWord}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
