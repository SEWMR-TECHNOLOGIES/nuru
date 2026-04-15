<?php
/**
 * delete-file.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts a public storage URL (or a relative storage path) via POST and
 * physically unlinks (deletes) that file from the server's storage directory.
 *
 * POST parameters:
 *   file_url  – The full public URL of the file to delete
 *               e.g. https://data.sewmrtechnologies.com/storage/nuru/photo-libraries/abc/photo.jpg
 *
 * Response JSON:
 *   { "success": true,  "message": "File deleted successfully" }
 *   { "success": false, "message": "<reason>" }
 *
 * Security measures:
 *   • Only files under $baseDir are deletable (no directory traversal)
 *   • Relative path characters are validated against a whitelist
 *   • The file must exist and be a regular file before unlinking
 */

header('Content-Type: application/json');

// ─── Config ──────────────────────────────────────────────────────────────────
// Physical root of the storage folder on this server
$baseDir = realpath(__DIR__ . '/storage') . '/';

// The public path prefix that maps to $baseDir
// Adjust if your web-root prefix differs
$storagePublicPrefix = '/storage/';

// ─── Validate input ───────────────────────────────────────────────────────────
if (empty($_POST['file_url'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'file_url is required']);
    exit;
}

$fileUrl = trim($_POST['file_url']);

// ─── Extract relative path from URL ──────────────────────────────────────────
// Works for full URLs (https://…/storage/nuru/…) and bare relative paths
$parsedPath = parse_url($fileUrl, PHP_URL_PATH);
if ($parsedPath === null || $parsedPath === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid file_url']);
    exit;
}

// Strip the /storage/ prefix to get the path relative to $baseDir
$pos = strpos($parsedPath, $storagePublicPrefix);
if ($pos === false) {
    // Maybe caller passed only the relative path without /storage/ prefix
    $relativePath = ltrim($parsedPath, '/');
} else {
    $relativePath = substr($parsedPath, $pos + strlen($storagePublicPrefix));
}

// ─── Security: whitelist allowed characters ───────────────────────────────────
if (
    strpos($relativePath, '..') !== false
    || preg_match('/[^a-zA-Z0-9\/._\-]/', $relativePath)
    || trim($relativePath) === ''
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid or unsafe file path']);
    exit;
}

// ─── Resolve absolute path & verify it's inside baseDir ──────────────────────
$absolutePath = $baseDir . $relativePath;
$realAbsolute = realpath($absolutePath);

if ($realAbsolute === false) {
    // File doesn't exist — treat as already deleted (idempotent)
    echo json_encode(['success' => true, 'message' => 'File not found (already deleted or never existed)']);
    exit;
}

// Ensure the resolved path is still under $baseDir (prevents symlink escapes)
if (strpos($realAbsolute, $baseDir) !== 0) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied: path outside storage']);
    exit;
}

if (!is_file($realAbsolute)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Target is not a regular file']);
    exit;
}

// ─── Unlink ──────────────────────────────────────────────────────────────────
if (@unlink($realAbsolute)) {
    echo json_encode(['success' => true, 'message' => 'File deleted successfully']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to delete file (permission error or file locked)']);
}
?>
