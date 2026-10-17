// Food-photo storage via S3 presigned URLs.
//
// The Lambda lives in an isolated VPC subnet and can't reach S3 over the
// network, but *generating* a presigned URL is pure local signing — no network
// call — so the Lambda hands out short-lived URLs and the client does the
// actual upload/download straight to S3 over the public internet.
import { API_BASE } from '@/api/client';

const PHOTO_URL = `${API_BASE}/photo`;

// Ask the Lambda for a presigned PUT URL to upload a new food photo.
// Returns { uploadUrl, key } or null on failure.
export async function getPhotoUploadUrl(
  userId: string
): Promise<{ uploadUrl: string; key: string } | null> {
  try {
    const res = await fetch(PHOTO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'photoUploadUrl', userId }),
    });
    if (!res.ok) {
      console.log('getPhotoUploadUrl: status', res.status);
      return null;
    }
    const data = await res.json();
    return data.uploadUrl && data.key ? { uploadUrl: data.uploadUrl, key: data.key } : null;
  } catch (e) {
    console.log('getPhotoUploadUrl failed:', e);
    return null;
  }
}

// Ask the Lambda for a presigned GET URL to display a saved food photo.
// Returns the URL or null on failure.
export async function getPhotoViewUrl(userId: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(PHOTO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'photoGetUrl', userId, key }),
    });
    if (!res.ok) {
      console.log('getPhotoViewUrl: status', res.status);
      return null;
    }
    const data = await res.json();
    return data.url ?? null;
  } catch (e) {
    console.log('getPhotoViewUrl failed:', e);
    return null;
  }
}

// Upload image bytes to a presigned PUT URL. The Content-Type MUST match what
// the Lambda signed (image/jpeg). Returns true on success.
export async function uploadToPresignedUrl(uploadUrl: string, blob: Blob): Promise<boolean> {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
    if (!res.ok) console.log('uploadToPresignedUrl: status', res.status);
    return res.ok;
  } catch (e) {
    console.log('uploadToPresignedUrl failed:', e);
    return false;
  }
}

// Build a JPEG Blob from a base64 string (no data: prefix). Used on web, where
// we already have base64 from the canvas resize. atob is available in both the
// browser and Hermes (Expo SDK 54).
export function base64ToJpegBlob(base64: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}
