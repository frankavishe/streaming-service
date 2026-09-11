'use client';

// T076: admin title list + create form (FR-015, FR-019).

import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

interface AdminTitle {
  id: string;
  type: 'MOVIE' | 'SERIES';
  name: string;
  posterUrl: string;
  published: boolean;
  genres: string[];
}

export default function AdminTitlesPage() {
  const [titles, setTitles] = useState<AdminTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'MOVIE' as 'MOVIE' | 'SERIES',
    name: '',
    description: '',
    posterUrl: '',
    genres: '',
  });

  const loadTitles = () => {
    apiClient
      .get<AdminTitle[]>('/admin/titles')
      .then(setTitles)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setError('Admin access required.');
        } else {
          setError('Could not load titles.');
        }
      });
  };

  useEffect(loadTitles, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiClient.post('/admin/titles', {
        type: form.type,
        name: form.name,
        description: form.description,
        posterUrl: form.posterUrl,
        genres: form.genres.split(',').map((g) => g.trim()).filter(Boolean),
      });
      setForm({ type: 'MOVIE', name: '', description: '', posterUrl: '', genres: '' });
      loadTitles();
    } catch {
      setError('Could not create the title. Check the fields and try again.');
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>Admin — Titles</h1>
      {error && <p role="alert">{error}</p>}

      <form onSubmit={submit} style={{ display: 'grid', gap: '0.5rem', maxWidth: 480, marginBottom: '2rem' }}>
        <h2>New title</h2>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'MOVIE' | 'SERIES' })}>
          <option value="MOVIE">Movie</option>
          <option value="SERIES">Series</option>
        </select>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <input
          placeholder="Poster URL"
          value={form.posterUrl}
          onChange={(e) => setForm({ ...form, posterUrl: e.target.value })}
          required
        />
        <input
          placeholder="Genres (comma separated)"
          value={form.genres}
          onChange={(e) => setForm({ ...form, genres: e.target.value })}
        />
        <button type="submit">Create</button>
      </form>

      <h2>All titles</h2>
      {!titles ? (
        <p>Loading…</p>
      ) : titles.length === 0 ? (
        <p>No titles yet.</p>
      ) : (
        <ul>
          {titles.map((title) => (
            <li key={title.id}>
              <a href={`/admin/titles/${title.id}`}>{title.name}</a> — {title.type} —{' '}
              {title.published ? 'Published' : 'Draft'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
