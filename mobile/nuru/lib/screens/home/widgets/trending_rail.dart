import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/social_service.dart';
import '../../../core/widgets/video_thumbnail_image.dart';
import '../../../providers/auth_provider.dart';
import 'reel_viewer_screen.dart';

/// Horizontal "Trending now" rail surfacing the most recent community **reels**
/// (the same items that power the Reels circles). Tapping opens the reel in
/// the full-screen viewer.
class TrendingRail extends StatefulWidget {
  const TrendingRail({super.key});

  @override
  State<TrendingRail> createState() => _TrendingRailState();
}

List<dynamic> _trendingCache = const [];
bool _trendingHydrated = false;

class _TrendingRailState extends State<TrendingRail> {
  List<dynamic> _moments = _trendingCache;
  bool _loading = !_trendingHydrated;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await SocialService.getTrendingMoments(limit: 12);
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'];
      final list = data is List ? data : (data is Map ? (data['items'] ?? []) : []);
      _trendingCache = list;
      _trendingHydrated = true;
      setState(() {
        _moments = list;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    return (name.isEmpty ? '?' : name[0]).toUpperCase();
  }

  Color _hexOrPrimary(String? hex) {
    if (hex != null && hex.startsWith('#') && hex.length == 7) {
      return Color(int.parse('FF${hex.substring(1)}', radix: 16));
    }
    return AppColors.primary;
  }

  void _openReel(int index) {
    // Wrap each trending moment as a single-author group for the viewer.
    final groups = _moments.map((m) {
      final mm = m is Map ? m : const {};
      final author = mm['author'] is Map ? mm['author'] as Map : const {};
      return {
        'user': {
          'id': author['id'],
          'name': author['name'] ?? 'Community',
          'avatar': author['avatar'],
          'is_self': false,
          'is_verified': author['is_verified'] == true || author['is_identity_verified'] == true,
        },
        'moments': [mm],
        'all_seen': false,
      };
    }).toList();
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ReelViewerScreen(reels: groups, initialAuthorIndex: index),
      fullscreenDialog: true,
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _moments.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
            child: Row(
              children: [
                Container(
                  width: 6, height: 6,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Text('Trending Reels',
                    style: GoogleFonts.inter(
                        fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: 0.2)),
              ],
            ),
          ),
          SizedBox(
            height: 200,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 2),
              itemCount: _moments.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final raw = _moments[i];
                final m = raw is Map<String, dynamic> ? raw : <String, dynamic>{};
                final author = m['author'] is Map ? Map<String, dynamic>.from(m['author']) : <String, dynamic>{};
                final myId = context.read<AuthProvider>().user?['id']?.toString();
                final authorId = author['id']?.toString();
                final isMine = myId != null && authorId != null && myId == authorId;
                final name = isMine ? 'You' : (author['name'] ?? 'Community').toString();
                final avatar = author['avatar']?.toString();
                final type = (m['content_type'] ?? '').toString();
                final media = (m['media_url'] ?? '').toString();
                final thumb = (m['thumbnail_url'] ?? '').toString();
                final caption = (m['caption'] ?? '').toString();
                final bg = _hexOrPrimary(m['background_color']?.toString());
                final isText = type == 'text' || (media.isEmpty && caption.isNotEmpty);
                final isVideo = type == 'video' ||
                    RegExp(r'\.(mp4|mov|webm|avi)(\?|$)', caseSensitive: false).hasMatch(media);

                return GestureDetector(
                  onTap: () => _openReel(i),
                  child: Container(
                    width: 124,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: isText
                              ? Container(
                                  color: bg,
                                  alignment: Alignment.center,
                                  padding: const EdgeInsets.all(10),
                                  child: Text(
                                    caption.isEmpty ? 'Untitled' : caption,
                                    maxLines: 6,
                                    textAlign: TextAlign.center,
                                    overflow: TextOverflow.fade,
                                    style: GoogleFonts.sora(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      height: 1.2,
                                    ),
                                  ),
                                )
                              : isVideo
                                  ? VideoThumbnailImage(
                                      videoUrl: media,
                                      posterUrl: thumb.isNotEmpty ? thumb : null,
                                      showPlayBadge: false,
                                    )
                                  : (media.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: media,
                                          fit: BoxFit.cover,
                                          placeholder: (_, __) => Container(color: AppColors.surfaceVariant),
                                          errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant),
                                        )
                                      : Container(color: AppColors.surfaceVariant)),
                        ),
                        // Bottom gradient
                        const Positioned.fill(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Colors.transparent, Colors.transparent, Color(0xCC000000)],
                                stops: [0.0, 0.55, 1.0],
                              ),
                            ),
                          ),
                        ),
                        if (isVideo)
                          Positioned(
                            top: 8, left: 8,
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.55),
                                shape: BoxShape.circle,
                              ),
                              child: SvgPicture.asset(
                                'assets/icons/play-icon.svg',
                                width: 12, height: 12,
                                colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                              ),
                            ),
                          ),
                        Positioned(
                          left: 8, right: 8, bottom: 8,
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 9,
                                backgroundColor: Colors.white,
                                backgroundImage: (avatar != null && avatar.isNotEmpty) ? NetworkImage(avatar) : null,
                                child: (avatar == null || avatar.isEmpty)
                                    ? Text(_initials(name),
                                        style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.w800, color: AppColors.primary))
                                    : null,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white),
                                ),
                              ),
                              if (author['is_verified'] == true || author['is_identity_verified'] == true) ...[
                                const SizedBox(width: 3),
                                const Icon(Icons.verified_rounded, size: 11, color: Colors.white),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
