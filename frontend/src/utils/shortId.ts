/**
 * Encode a UUID into a URL-friendly short string (22 chars base64url).
 * e.g. "550e8400-e29b-41d4-a716-446655440000" → "VQ6EAOKbQdSnFkRmVUQAAA"
 */
export function encodeId(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  // Convert to base64url
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a short base64url string back to a UUID.
 * e.g. "VQ6EAOKbQdSnFkRmVUQAAA" → "550e8400-e29b-41d4-a716-446655440000"
 */
export function decodeId(short: string): string {
  const base64 = short.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const hex = Array.from(binary, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Check if a string is a short encoded ID (base64url, ~22 chars) vs a UUID.
 */
export function isShortId(id: string): boolean {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
}
