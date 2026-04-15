import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

function findBin() {
  try {
    const pkgPath = require.resolve('youtube-dl-exec/package.json');
    const dir = path.dirname(pkgPath);
    const candidates = [
      path.join(dir, 'bin', 'yt-dlp'),
      path.join(dir, 'bin', 'yt-dlp.exe'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  } catch {}
  return 'yt-dlp';
}

export const YTDLP = findBin();
