import {Audio, staticFile, Sequence, useVideoConfig} from 'remotion';
import sfxData from './sfx.json';

type Sfx = {file: string; atSeconds: number; volume?: number};

export const SoundEffects: React.FC = () => {
  const {fps} = useVideoConfig();
  const events = sfxData as Sfx[];
  return (
    <>
      {events.map((e, i) => (
        <Sequence key={i} from={Math.round(e.atSeconds * fps)}>
          <Audio src={staticFile(`sfx/${e.file}`)} volume={e.volume ?? 0.4} />
        </Sequence>
      ))}
    </>
  );
};
