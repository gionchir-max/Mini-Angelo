import {Composition} from 'remotion';
import {MainVideo} from './MainVideo';
import meta from './meta.json';

const FPS = 30;
const TAIL_SECONDS = 1;
const durationInFrames = Math.max(
  60,
  Math.ceil((meta.voiceoverDuration + TAIL_SECONDS) * FPS),
);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={durationInFrames}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
};
