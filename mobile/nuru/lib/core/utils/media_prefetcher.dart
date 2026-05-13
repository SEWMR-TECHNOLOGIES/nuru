import 'package:flutter/widgets.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'prefetch_helper.dart';

/// Warms image and video caches for upcoming feed items so they appear
/// instantly when the user scrolls to them.
class MediaPrefetcher {
  MediaPrefetcher._();

  /// Extracts media URLs from a feed post map (handles both strings and
  /// `{image_url|url, media_type}` shapes used across endpoints).
  static List<({String url, bool isVideo})> extractMedia(dynamic post) {
    final out = <({String url, bool isVideo})>[];
    if (post is! Map) return out;
    final raw = post['images'] ?? post['media'] ?? const [];
    if (raw is! List) return out;
    for (final m in raw) {
      String url = '';
      bool isVideo = false;
      if (m is String) {
        url = m;
      } else if (m is Map) {
        url = (m['image_url'] ?? m['url'] ?? '').toString();
        final t = (m['media_type'] ?? m['type'] ?? '').toString().toLowerCase();
        isVideo = t == 'video';
      }
      if (url.isEmpty) continue;
      if (!isVideo) {
        final lower = url.toLowerCase();
        isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
      }
      out.add((url: url, isVideo: isVideo));
    }
    final video = (post['video_url'] ?? '').toString();
    final thumb = (post['video_thumbnail_url'] ?? '').toString();
    if (video.isNotEmpty) out.add((url: video, isVideo: true));
    if (thumb.isNotEmpty) out.add((url: thumb, isVideo: false));
    final avatar = post['author'] is Map ? (post['author']['avatar'] ?? '').toString() : '';
    if (avatar.isNotEmpty) out.add((url: avatar, isVideo: false));
    return out;
  }

  /// Prefetch the next [lookahead] feed items. Image bytes are warmed via
  /// Flutter's image cache; video files are downloaded into the shared
  /// cache so playback opens from disk instead of refetching the network.
  static void prefetchUpcoming(
    BuildContext context,
    List<dynamic> posts,
    int currentIndex, {
    int lookahead = 5,
  }) {
    if (!PrefetchHelper.allowed) return;
    final end = (currentIndex + lookahead).clamp(0, posts.length);
    for (int i = currentIndex; i < end; i++) {
      final post = posts[i];
      final id = (post is Map ? (post['id'] ?? post['post_id']) : null)?.toString();
      if (id == null || id.isEmpty) continue;
      PrefetchHelper.prefetch('post:$id', () async {
        final media = extractMedia(post);
        for (final m in media) {
          if (m.isVideo) {
            // Warm disk cache so the player opens instantly without refetch.
            try {
              await DefaultCacheManager().downloadFile(m.url);
            } catch (_) {}
          } else {
            try {
              if (context.mounted) {
                await precacheImage(CachedNetworkImageProvider(m.url), context);
              }
            } catch (_) {}
          }
        }
      });
    }
  }
}
