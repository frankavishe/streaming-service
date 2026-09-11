'use client';

// T077: upload flow for one watchable unit (a Title if MOVIE, or an Episode) — request an
// upload target, PUT the raw file directly to the signed URL, call complete-upload, then poll
// processing status until READY/FAILED (FR-016, FR-017, FR-018).

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type ProcessingStatus = 'PENDING' | 'READY' | 'FAILED';
type Kind = 'TRAILER' | 'FULL';

function UploadRow({ ownerType, ownerId, kind }: { ownerType: 'TITLE' | 'EPISODE'; ownerId: string; kind: Kind }) {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const poll = useCallback((id: string) => {
    const interval = setInterval(async () => {
      const res = await apiClient.get<{ processingStatus: ProcessingStatus; failureReason?: string }>(
        `/admin/media-assets/${id}`,
      );
      setStatus(res.processingStatus);
      if (res.processingStatus !== 'PENDING') {
        if (res.failureReason) setFailureReason(res.failureReason);
        clearInterval(interval);
      }
    }, 3000);
  }, []);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const registered = await apiClient.post<{ assetId: string; uploadUrl: string }>('/admin/media-assets', {
        ownerType,
        ownerId,
        kind,
      });
      setAssetId(registered.assetId);

      await fetch(registered.uploadUrl, { method: 'PUT', body: file });

      await apiClient.post(`/admin/media-assets/${registered.assetId}/complete-upload`);
      setStatus('PENDING');
      poll(registered.assetId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '0.75rem 0', borderTop: '1px solid #3332' }}>
      <h3>{kind === 'TRAILER' ? 'Trailer' : 'Full video'}</h3>
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button disabled={!file || busy} onClick={upload}>
        Upload
      </button>
      {assetId && status && <p>Status: {status}</p>}
      {failureReason && <p role="alert">Failed: {failureReason}</p>}
    </div>
  );
}

export default function AdminUploadPage() {
  const searchParams = useSearchParams();
  const ownerType = (searchParams.get('ownerType') as 'TITLE' | 'EPISODE') ?? 'TITLE';
  const ownerId = searchParams.get('ownerId') ?? '';

  if (!ownerId) {
    return <div className="state-message">Missing ownerId.</div>;
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>Upload media</h1>
      <UploadRow ownerType={ownerType} ownerId={ownerId} kind="TRAILER" />
      <UploadRow ownerType={ownerType} ownerId={ownerId} kind="FULL" />
    </div>
  );
}
