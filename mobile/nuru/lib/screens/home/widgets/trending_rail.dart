import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/social_service.dart';
import 'post_detail_modal.dart';

/// Horizontal "Trending now" rail mirroring the web workspace concept of
/// surfacing currently-popular community moments above the main feed.
///
/// Pulls from `/posts/public/trending` (already exposed by SocialService) and
/// caches the first response in memory so the rail does not flicker on tab
/// switches. The rail self-hides when there is nothing trending so it never
/// occupies space for an empty state.
class TrendingRail extends StatefulWidget {
  const TrendingRail({super.key});

  @override
  State<TrendingRail> createState() => _TrendingRailState();
}

List<dynamic> _trendingCache = const [];
bool _trendingHydrated = false;

class _TrendingRailState extends State<TrendingRail> {
  List<dynamic> _posts = _trendingCache;
  bool _loading = !_trendingHydrated;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await SocialService.getTrending(limit: 12);
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'];
      final list = data is List ? data : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
      _trendingCache = list;
      _trendingHydrated = true;
      setState(() {
        _posts = list;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  String? _firstImage(Map<String, dynamic> post) {
    final imgs = post['images'];
    if (imgs is List && imgs.isNotEmpty) {
      final first = imgs.first;
      if (first is String) return first;
      if (first is Map) return (first['url'] ?? first['thumbnail_url'])?.toString();
    }
    return null;
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    return (name.isEmpty ? '?' : name[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _posts.isEmpty) return const SizedBox.shrink();

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
                Text('Trending now',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: 0.2)),
              ],
            ),
          ),
          SizedBox(
            height: 168,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 2),
              itemCount: _posts.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) {
                final raw = _posts[i];
                final post = raw is Map<String, dynamic> ? raw : <String, dynamic>{};
                final image = _firstImage(post);
                final author = post['author'] is Map ? Map<String, dynamic>.from(post['author']) : <String, dynamic>{};
                final name = (author['name'] ?? '${author['first_name'] ?? ''} ${author['last_name'] ?? ''}').toString().trim();
                final avatar = author['avatar']?.toString();
                final glow = post['glow_count'] ?? 0;
                final echo = post['comment_count'] ?? 0;

                return GestureDetector(
                  onTap: () => PostDetailModal.show(context, post),
                  child: Container(
                    width: 132,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: image != null
                              ? CachedNetworkImage(
                                  imageUrl: image,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(color: AppColors.surfaceVariant),
                                  errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant),
                                )
                              : Container(
                                  color: AppColors.primarySoft,
                                  alignment: Alignment.center,
                                  child: Padding(
                                    padding: const EdgeInsets.all(10),
                                    child: Text(
                                      (post['content'] ?? '').toString(),
                                      maxLines: 5,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ),
                        ),
                        // Bottom gradient + meta
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Colors.transparent, Colors.transparent, Color(0xCC000000)],
                                stops: [0.0, 0.55, 1.0],
                              ),
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
                                    ? Text(_initials(name.isEmpty ? '?' : name),
                                        style: GoogleFonts.plusJakartaSans(fontSize: 8, fontWeight: FontWeight.w800, color: AppColors.primary))
                                    : null,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  name.isEmpty ? 'Community' : name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Top-right counters
                        Positioned(
                          top: 6, right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.4),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              const Icon(Icons.favorite_rounded, size: 9, color: Colors.white),
                              const SizedBox(width: 3),
                              Text('$glow',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w700)),
                              const SizedBox(width: 6),
                              const Icon(Icons.mode_comment_rounded, size: 9, color: Colors.white),
                              const SizedBox(width: 3),
                              Text('$echo',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w700)),
                            ]),
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
