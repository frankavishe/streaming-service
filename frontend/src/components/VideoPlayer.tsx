'use client';

// T032: plays an HLS (.m3u8) manifest URL. Safari supports HLS natively via <video>; every
// other engine needs hls.js. research.md decision 8.

import { useEffect, useRef } from 'react';

export interface VideoPlayerProps {
  src: string | null;
  poster?: string;
  autoPlay?: boolean;
  onError?: (message: string) => void;
}

export function VideoPlayer({ src, poster, autoPlay = false, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: import('hls.js').default | undefined;

    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (canPlayNativeHls) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          onError?.('HLS playback is not supported in this browser.');
          return;
        }
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            onError?.('Playback failed. Please try again.');
          }
        });
      });
    }

    return () => {
      hls?.destroy();
    };
  }, [src, onError]);

  if (!src) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      controls
      autoPlay={autoPlay}
      poster={poster}
      style={{ width: '100%', maxWidth: '100%', aspectRatio: '16 / 9', background: '#000' }}
    />
  );
}
