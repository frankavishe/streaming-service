// T040: catalog browse page. No auth required — this is the storefront (FR-001).

// This page fetches live catalog data server-side on every request; it must never be
// statically prerendered at build time (the backend isn't reachable during `docker build`).
export const dynamic = 'force-dynamic';

// Server-side rendering runs inside the frontend container, which must reach the API by its
// Docker network hostname (API_INTERNAL_BASE_URL), not the browser-facing localhost URL that
// NEXT_PUBLIC_API_BASE_URL holds — those are two different networks.
const API_BASE_URL =
  process.env.API_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

interface CatalogItem {
  id: string;
  type: 'MOVIE' | 'SERIES';
  name: string;
  posterUrl: string;
  genres: string[];
}

async function getTitles(): Promise<CatalogItem[]> {
  const res = await fetch(`${API_BASE_URL}/catalog/titles?pageSize=48`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

export default async function CatalogPage() {
  const titles = await getTitles();

  if (titles.length === 0) {
    return (
      <div className="state-message">
        <h1>Welcome to StreamCo</h1>
        <p>No titles are published yet — check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ padding: '1.5rem 1.5rem 0' }}>Browse</h1>
      <div className="catalog-grid">
        {titles.map((title) => (
          <a key={title.id} className="poster-card" href={`/titles/${title.id}`}>
            <img src={title.posterUrl} alt={title.name} />
            <p>{title.name}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
