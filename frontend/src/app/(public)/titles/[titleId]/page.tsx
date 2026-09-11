'use client';

// T041-T042: title detail page — metadata, seasons/episodes for a series, trailer playback for
// anyone, and a "play full" action that prompts login/subscribe instead of playing on 401/403.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { VideoPlayer } from '@/components/VideoPlayer';

interface MediaRef {
  assetId: string;
  ready: boolean;
}

interface EpisodeShape {
  id: string;
  number: number;
  name: string;
  description: string;
  trailer: MediaRef | null;
  fullAvailable: boolean;
}

interface SeasonShape {
  id: string;
  number: number;
  episodes: EpisodeShape[];
}

type TitleShape =
  | {
      id: string;
      type: 'MOVIE';
      name: string;
      description: string;
      posterUrl: string;
      genres: string[];
      trailer: MediaRef | null;
      fullAvailable: boolean;
    }
  | {
      id: string;
      type: 'SERIES';
      name: string;
      description: string;
      posterUrl: string;
      genres: string[];
      seasons: SeasonShape[];
    };

function PlayControls({ trailer, fullAvailable }: { trailer: MediaRef | null; fullAvailable: boolean }) {
  const router = useRouter();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playTrailer = useCallback(async () => {
    if (!trailer || !trailer.ready) return;
    setError(null);
    try {
      const res = await apiClient.get<{ url: string }>(`/media/${trailer.assetId}/trailer-url`, {
        skipAuth: true,
      });
      setPlaybackUrl(res.url);
    } catch {
      setError('Trailer is unavailable right now.');
    }
  }, [trailer]);

  const playFull = useCallback(async (assetId: string) => {
    setError(null);
    try {
      const res = await apiClient.get<{ url: string }>(`/media/${assetId}/playback-url`);
      setPlaybackUrl(res.url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push('/login');
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        router.push('/subscribe');
        return;
      }
      setError('Playback is unavailable right now.');
    }
  }, [router]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
        {trailer?.ready && <button onClick={playTrailer}>Play trailer</button>}
        {fullAvailable && trailer && (
          <button onClick={() => playFull(trailer.assetId)}>Play full</button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <VideoPlayer src={playbackUrl} autoPlay onError={setError} />
    </div>
  );
}

export default function TitleDetailPage() {
  const params = useParams<{ titleId: string }>();
  const [title, setTitle] = useState<TitleShape | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    apiClient
      .get<TitleShape>(`/catalog/titles/${params.titleId}`, { skipAuth: true })
      .then(setTitle)
      .catch(() => setNotFound(true));
  }, [params.titleId]);

  if (notFound) {
    return <div className="state-message">This title could not be found.</div>;
  }
  if (!title) {
    return <div className="state-message">Loading…</div>;
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>{title.name}</h1>
      <p>{title.genres.join(', ')}</p>
      <p>{title.description}</p>

      {title.type === 'MOVIE' ? (
        <PlayControls trailer={title.trailer} fullAvailable={title.fullAvailable} />
      ) : (
        <div>
          {title.seasons.map((season) => (
            <section key={season.id} style={{ marginTop: '1.5rem' }}>
              <h2>Season {season.number}</h2>
              {season.episodes.map((episode) => (
                <div key={episode.id} style={{ padding: '0.75rem 0', borderTop: '1px solid #3332' }}>
                  <h3>
                    {episode.number}. {episode.name}
                  </h3>
                  <p>{episode.description}</p>
                  <PlayControls trailer={episode.trailer} fullAvailable={episode.fullAvailable} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
