#!/bin/sh
# T079: creates the bucket StorageService reads/writes (S3_BUCKET), so a clean
# `docker compose up` doesn't 404 on the first upload. Run as a one-shot job against the
# already-running minio service (see the `minio-bootstrap` entry in docker-compose.yml).
set -e

MC_HOST_local="http://${MINIO_ROOT_USER:-minioadmin}:${MINIO_ROOT_PASSWORD:-minioadmin}@minio:9000"
export MC_HOST_local

until mc ls local >/dev/null 2>&1; do
  echo "Waiting for MinIO..."
  sleep 2
done

BUCKET="${S3_BUCKET:-streaming-media}"
if mc ls "local/${BUCKET}" >/dev/null 2>&1; then
  echo "Bucket ${BUCKET} already exists."
else
  mc mb "local/${BUCKET}"
  echo "Created bucket ${BUCKET}."
fi
