/// Heuristics for handling user avatar URLs. The backend sometimes returns a
/// default Nuru-logo placeholder image when a user has not uploaded their own
/// avatar. Such images do not fit a circular avatar well (the logo has a wide
/// aspect ratio and lots of internal whitespace), so we treat them as "no
/// avatar" and let callers render initials instead.
bool isPlaceholderAvatarUrl(String? url) {
  if (url == null) return true;
  final u = url.trim().toLowerCase();
  if (u.isEmpty) return true;
  // Common default/placeholder patterns coming from the backend or CDN.
  const markers = [
    'nuru-logo',
    'nuru_logo',
    'nurulogo',
    'default-avatar',
    'default_avatar',
    'defaultavatar',
    'placeholder',
    '/logo.',
    '/logo-',
    '/default.',
  ];
  for (final m in markers) {
    if (u.contains(m)) return true;
  }
  return false;
}

/// Returns the avatar URL if it's a real user-provided image, or null if it's
/// missing/empty/placeholder. Use this to decide between rendering the image
/// and rendering initials.
String? effectiveAvatarUrl(String? url) =>
    isPlaceholderAvatarUrl(url) ? null : url!.trim();
