import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

export const TopBanner: React.FC<{text: string; durationInFrames: number}> = ({
  text,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  if (frame > durationInFrames) return null;

  const exitStart = durationInFrames - 12;
  const opacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 360,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          color: 'black',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 82,
          lineHeight: 1.05,
          letterSpacing: -1,
          textTransform: 'uppercase',
          padding: '32px 44px',
          maxWidth: 940,
          textAlign: 'center',
          boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
          opacity,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
