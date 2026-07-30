import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Relay — Quick, secure file & code sharing';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(ellipse at 30% 20%, #1a1035 0%, #0a0a0a 55%), radial-gradient(ellipse at 75% 80%, #0d1f2d 0%, #0a0a0a 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            background: 'linear-gradient(135deg, #eef1f6 0%, #7ef4cb 100%)',
            transform: 'rotate(45deg)',
            borderRadius: 18,
            marginBottom: 44,
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', fontSize: 88, fontWeight: 700, color: '#eef1f6', letterSpacing: -2 }}>
          Relay
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#b5bcc9', marginTop: 18 }}>
          Quick, secure file &amp; code sharing
        </div>
      </div>
    ),
    { ...size }
  );
}
