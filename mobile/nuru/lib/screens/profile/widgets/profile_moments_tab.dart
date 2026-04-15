import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/l10n/l10n_helper.dart';
import '../../../core/widgets/nuru_video_player.dart';
import '../../home/widgets/post_detail_modal.dart';

class ProfileMomentsTab extends StatelessWidget {
  final List<dynamic> moments;
  final bool isLoading;
  final VoidCallback? onRefresh;

  const ProfileMomentsTab({super.key, required this.moments, this.isLoading = false, this.onRefresh});

  static bool _isVideoUrl(String url) {
    final lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.avi') ||
        lower.endsWith('.webm') || lower.endsWith('.mkv') || lower.endsWith('.m4v') ||
        lower.contains('/video') || lower.contains('video/');
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return GridView.builder(
        padding: const EdgeInsets.all(20),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 3, crossAxisSpacing: 3),
        itemCount: 9,
        itemBuilder: (_, __) => Container(decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4))),
      );
    }
    if (moments.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset('assets/icons/camera-icon.svg', width: 32, height: 32,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        const SizedBox(height: 14),
        Text(context.tr('no_moments_yet'), style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text(context.tr('share_first_moment'), style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
      ]));
    }
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3, mainAxisSpacing: 4, crossAxisSpacing: 4,
      ),
      itemCount: moments.length,
      itemBuilder: (context, i) {
        final post = moments[i] is Map ? moments[i] as Map<String, dynamic> : <String, dynamic>{};
        final images = post['images'] as List?;
        final mediaType = post['media_type']?.toString() ?? '';
        String? firstImage;
        bool isVideo = false;
        if (images != null && images.isNotEmpty) {
          final first = images[0];
          if (first is String) {
            firstImage = first;
            isVideo = _isVideoUrl(first);
          } else if (first is Map) {
            firstImage = (first['image_url'] ?? first['url'] ?? '').toString();
            final itemType = (first['media_type'] ?? first['type'] ?? '').toString().toLowerCase();
            isVideo = itemType.contains('video') || (firstImage.isNotEmpty && _isVideoUrl(firstImage));
          }
        }
        if (mediaType.contains('video')) isVideo = true;

        // Extract thumbnail for video moments
        String? thumbnailUrl;
        if (isVideo) {
          thumbnailUrl = post['thumbnail_url']?.toString();
          if (thumbnailUrl != null && thumbnailUrl.isEmpty) thumbnailUrl = null;
          // Also check first image item for thumbnail
          if (thumbnailUrl == null && images != null && images.isNotEmpty) {
            final first = images[0];
            if (first is Map) {
              thumbnailUrl = (first['thumbnail_url'] ?? first['thumbnail'] ?? '').toString();
              if (thumbnailUrl.isEmpty) thumbnailUrl = null;
            }
          }
        }

        return GestureDetector(
          onTap: () => PostDetailModal.show(context, post),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (isVideo)
                  // Use NuruVideoPlayer for video content, matching the feed
                  NuruVideoPlayer(
                    url: firstImage ?? '',
                    thumbnailUrl: thumbnailUrl,
                    height: double.infinity,
                    borderRadius: BorderRadius.circular(8),
                  )
                else if (firstImage != null && firstImage.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: firstImage,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(color: AppColors.surfaceVariant),
                    errorWidget: (_, __, ___) => _placeholder(post),
                  )
                else
                  _placeholder(post),
                // Multi-image indicator
                if (!isVideo && images != null && images.length > 1)
                  Positioned(
                    top: 4, right: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.photo_library_rounded, size: 10, color: Colors.white),
                        const SizedBox(width: 2),
                        Text('${images.length}', style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w600, color: Colors.white)),
                      ]),
                    ),
                  ),
                // Glow/echo count overlay on bottom
                Positioned(
                  left: 0, right: 0, bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter, end: Alignment.topCenter,
                        colors: [Colors.black.withOpacity(0.5), Colors.transparent],
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.start,
                      children: [
                        const Icon(Icons.favorite_rounded, size: 10, color: Colors.white70),
                        const SizedBox(width: 2),
                        Text('${post['glow_count'] ?? 0}', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: Colors.white70, fontWeight: FontWeight.w500)),
                        const SizedBox(width: 6),
                        const Icon(Icons.chat_bubble_rounded, size: 10, color: Colors.white70),
                        const SizedBox(width: 2),
                        Text('${post['comment_count'] ?? post['echo_count'] ?? 0}', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: Colors.white70, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _placeholder(Map<String, dynamic> post) {
    final content = post['content']?.toString() ?? '';
    return Container(
      color: AppColors.surfaceVariant,
      padding: const EdgeInsets.all(8),
      child: Center(child: Text(
        content.isNotEmpty ? content : '📝',
        style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary, height: 1.3),
        maxLines: 4, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
      )),
    );
  }
}
