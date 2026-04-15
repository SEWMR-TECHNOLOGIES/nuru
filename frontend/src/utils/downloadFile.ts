/**
 * Download a file by fetching it as a blob to avoid cross-origin navigation issues.
 * Falls back to <a target="_blank"> if fetch fails (CORS).
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || getFilenameFromUrl(url);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    // CORS fallback: open in new tab (browser may still download based on content-disposition)
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || getFilenameFromUrl(url);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    return parts[parts.length - 1] || 'download';
  } catch {
    return 'download';
  }
}
