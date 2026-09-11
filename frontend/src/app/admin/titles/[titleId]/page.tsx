'use client';

// T076, T078: edit a title's metadata, manage seasons/episodes (for a series), upload
// links per watchable unit, and the publish toggle (guarded server-side by T066's publish rule).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';

interface AdminEpisode {
  id: string;
  number: number;
  name: string;
  description: string;
  published: boolean;
}

interface AdminSeason {
  id: string;
  number: number;
  episodes: AdminEpisode[];
}

interface AdminTitleDetail {
  id: string;
  type: 'MOVIE' | 'SERIES';
  name: string;
  description: string;
  posterUrl: string;
  published: boolean;
  genres: string[];
  seasons: AdminSeason[];
}

export default function AdminTitleDetailPage() {
  const params = useParams<{ titleId: string }>();
  const [title, setTitle] = useState<AdminTitleDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [seasonNumber, setSeasonNumber] = useState('');
  const [episodeForm, setEpisodeForm] = useState<{ seasonId: string; number: string; name: string; description: string }>(
    { seasonId: '', number: '', name: '', description: '' },
  );

  const load = () => {
    apiClient.get<AdminTitleDetail>(`/admin/titles/${params.titleId}`).then(setTitle).catch(() => setMessage('Failed to load title.'));
  };

  useEffect(load, [params.titleId]);

  const togglePublish = async () => {
    if (!title) return;
    setMessage(null);
    try {
      await apiClient.patch(`/admin/titles/${title.id}`, { published: !title.published });
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setMessage('Cannot publish: no ready playable content exists yet for this title.');
      } else {
        setMessage('Could not update publish state.');
      }
    }
  };

  const addSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    await apiClient.post(`/admin/titles/${title.id}/seasons`, { number: Number(seasonNumber) });
    setSeasonNumber('');
    load();
  };

  const addEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiClient.post(`/admin/seasons/${episodeForm.seasonId}/episodes`, {
      number: Number(episodeForm.number),
      name: episodeForm.name,
      description: episodeForm.description,
    });
    setEpisodeForm({ seasonId: '', number: '', name: '', description: '' });
    load();
  };

  if (!title) return <div className="state-message">Loading…</div>;

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>{title.name}</h1>
      <p>{title.type} — {title.published ? 'Published' : 'Draft'}</p>
      <button onClick={togglePublish}>{title.published ? 'Unpublish' : 'Publish'}</button>
      {message && <p role="alert">{message}</p>}

      <section style={{ marginTop: '1rem' }}>
        <h2>Media</h2>
        {title.type === 'MOVIE' ? (
          <p>
            <a href={`/admin/titles/${title.id}/upload?ownerType=TITLE&ownerId=${title.id}`}>
              Manage trailer &amp; full video
            </a>
          </p>
        ) : (
          <p>Upload each episode&apos;s trailer/full video from its own row below.</p>
        )}
      </section>

      {title.type === 'SERIES' && (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>Seasons</h2>
          <form onSubmit={addSeason} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              placeholder="Season number"
              type="number"
              value={seasonNumber}
              onChange={(e) => setSeasonNumber(e.target.value)}
              required
            />
            <button type="submit">Add season</button>
          </form>

          {title.seasons.map((season) => (
            <div key={season.id} style={{ marginBottom: '1.5rem' }}>
              <h3>Season {season.number}</h3>
              <ul>
                {season.episodes.map((episode) => (
                  <li key={episode.id}>
                    {episode.number}. {episode.name} — {episode.published ? 'Published' : 'Draft'} —{' '}
                    <a href={`/admin/titles/${title.id}/upload?ownerType=EPISODE&ownerId=${episode.id}`}>
                      Manage video
                    </a>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  setEpisodeForm({ ...episodeForm, seasonId: season.id });
                  addEpisode(e);
                }}
                style={{ display: 'flex', gap: '0.5rem' }}
              >
                <input
                  placeholder="Ep #"
                  type="number"
                  value={episodeForm.seasonId === season.id ? episodeForm.number : ''}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, seasonId: season.id, number: e.target.value })}
                />
                <input
                  placeholder="Name"
                  value={episodeForm.seasonId === season.id ? episodeForm.name : ''}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, seasonId: season.id, name: e.target.value })}
                />
                <input
                  placeholder="Description"
                  value={episodeForm.seasonId === season.id ? episodeForm.description : ''}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, seasonId: season.id, description: e.target.value })}
                />
                <button type="submit">Add episode</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
