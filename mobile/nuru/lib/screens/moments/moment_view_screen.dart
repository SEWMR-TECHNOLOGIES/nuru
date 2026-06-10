/// Standalone moment viewer for /moment/:id deep links.
///
/// Renders the full visual payload of a moment:
///   • Single image or video → cinematic full-screen viewer
///   • Multi-image gallery → swipeable PageView with counter
///   • Shared event (post_type == 'event_share') → branded event card
///     with cover image, title, date, location and a CTA into the
///     public event page
///   • Text-only fallback only when no media or event exists
///
/// The single-moment endpoint may require auth; if a 401 is returned, we
/// present a clean "sign in to view" state instead of bouncing to home.
/// Deleted / expired / private content yields a clear, friendly state.
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/utils/share_helpers.dart';
import '../../core/services/api_base.dart';
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/date_formatters.dart';
import '../../core/widgets/nuru_logo.dart';
import '../../core/widgets/event_cover_image.dart';
import '../../core/utils/mobile_cache.dart';
import '../auth/login_screen.dart';
import '../events/event_public_view_screen.dart';

class MomentViewScreen extends StatefulWidget {
  final String momentId;
  const MomentViewScreen({super.key, required this.momentId});

  @override
  State<MomentViewScreen> createState() => _MomentViewScreenState();
}

class _MomentViewScreenState extends State<MomentViewScreen> {
  bool _loading = true;
  bool _needsAuth = false;
  String? _error;
  Map<String, dynamic>? _moment;
  int _galleryIndex = 0;

  String get _cacheKey => 'cached_moment_${widget.momentId}';

  @override
  void initState() {
    super.initState();
    _hydrateFromCache();
    _load();
  }

  Future<void> _hydrateFromCache() async {
    final cached = await MobileCache.readJson(_cacheKey);
    if (cached is Map && mounted && _moment == null) {
      setState(() {
        _moment = Map<String, dynamic>.from(cached);
        _loading = false;
      });
    }
  }

  Future<void> _load() async {
    debugPrint('[MomentView] loading id=${widget.momentId}');
    if (_moment == null) {
      setState(() {
        _loading = true;
        _error = null;
        _needsAuth = false;
      });
    }
    final token = await SecureTokenStorage.getToken();
    final hasToken = token != null && token.isNotEmpty;
    final res = await ApiBase.get('/moments/${widget.momentId}', auth: hasToken);
    debugPrint('[MomentView] response success=${res['success']} auth=$hasToken');
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true && res['data'] is Map) {
        _moment = Map<String, dynamic>.from(res['data'] as Map);
        MobileCache.writeJson(_cacheKey, _moment);
      } else if (_moment == null) {
        final msg = (res['message'] ?? '').toString().toLowerCase();
        _needsAuth = !hasToken || msg.contains('unauthor') || msg.contains('not authenticated');
        _error = (res['message'] ?? 'Moment not available').toString();
      }
    });
  }

  void _share() {
    Share.share('https://nuru.tz/moment/${widget.momentId}',
        subject: 'Moment on Nuru', sharePositionOrigin: sharePositionOrigin(context));
  }

  // ── Helpers ────────────────────────────────────────────────
  List<Map<String, String>> _collectMedia() {
    final m = _moment;
    if (m == null) return const [];
    final out = <Map<String, String>>[];
    void add(String url, [String type = '']) {
      if (url.isEmpty) return;
      if (out.any((e) => e['url'] == url)) return;
      out.add({'url': url, 'type': type});
    }

    // Single canonical fields
    add((m['media_url'] ?? '').toString(), (m['media_type'] ?? '').toString());
    add((m['url'] ?? '').toString());
    add((m['file_url'] ?? '').toString());

    // Lists (images / media / gallery)
    for (final key in const ['images', 'media', 'gallery', 'photos']) {
      final v = m[key];
      if (v is List) {
        for (final item in v) {
          if (item is String) {
            add(item);
          } else if (item is Map) {
            add((item['image_url'] ?? item['url'] ?? item['file_url'] ?? '').toString(),
                (item['media_type'] ?? item['type'] ?? '').toString());
          }
        }
      }
    }
    return out;
  }

  Map<String, dynamic>? get _sharedEvent {
    final m = _moment;
    if (m == null) return null;
    final se = m['shared_event'] ?? m['event'];
    if (se is Map) return Map<String, dynamic>.from(se);
    return null;
  }

  bool get _isEventShare =>
      (_moment?['post_type']?.toString() == 'event_share') && _sharedEvent != null;

  @override
  Widget build(BuildContext context) {
    final hasEventShare = _isEventShare;
    return Scaffold(
      backgroundColor: hasEventShare ? AppColors.background : Colors.black,
      extendBodyBehindAppBar: !hasEventShare,
      appBar: AppBar(
        backgroundColor: hasEventShare ? AppColors.background : Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: hasEventShare ? AppColors.textPrimary : Colors.white),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: hasEventShare
            ? Text('Shared Event',
                style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary))
            : null,
        actions: [
          if (_moment != null)
            IconButton(
              icon: Icon(Icons.ios_share,
                  color: hasEventShare ? AppColors.textPrimary : Colors.white),
              onPressed: _share,
            ),
        ],
      ),
      body: _build(),
    );
  }

  Widget _build() {
    if (_loading && _moment == null) return const _MomentSkeleton();
    if (_moment == null) {
      return _MomentEmpty(
        needsAuth: _needsAuth,
        message: _error ?? 'Moment not available',
        onRetry: _load,
      );
    }
    if (_isEventShare) return _buildEventShare();
    return _buildMediaMoment();
  }

  // ── Media (image / gallery / video thumbnail) ──────────────
  Widget _buildMediaMoment() {
    final m = _moment!;
    final media = _collectMedia();
    final caption = (m['caption'] ?? m['content'] ?? m['text'] ?? '').toString();
    final author = (m['user'] is Map ? m['user'] as Map : (m['author'] is Map ? m['author'] as Map : const {}));
    final authorName = ((author['name'] ?? '').toString().isNotEmpty
            ? author['name'].toString()
            : ('${author['first_name'] ?? ''} ${author['last_name'] ?? ''}').trim())
        .trim();
    final avatar = (author['avatar'] ?? author['avatar_url'] ?? '').toString();
    final createdAt = (m['created_at'] ?? '').toString();

    return Stack(fit: StackFit.expand, children: [
      if (media.isEmpty)
        Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Text(
              caption.isNotEmpty ? caption : 'No media',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 16, height: 1.5),
            ),
          ),
        )
      else if (media.length == 1)
        Center(
          child: InteractiveViewer(
            child: _MediaTile(url: media.first['url']!, type: media.first['type'] ?? ''),
          ),
        )
      else
        PageView.builder(
          itemCount: media.length,
          onPageChanged: (i) => setState(() => _galleryIndex = i),
          itemBuilder: (_, i) => Center(
            child: InteractiveViewer(
              child: _MediaTile(url: media[i]['url']!, type: media[i]['type'] ?? ''),
            ),
          ),
        ),

      // Gallery counter
      if (media.length > 1)
        Positioned(
          top: 60,
          right: 20,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text('${_galleryIndex + 1} / ${media.length}',
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ),

      // Bottom gradient + author / caption overlay
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 60, 20, 36),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black87],
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: Colors.white24,
                backgroundImage: avatar.isNotEmpty ? CachedNetworkImageProvider(avatar) : null,
                child: avatar.isEmpty
                    ? Text(authorName.isNotEmpty ? authorName[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(authorName.isEmpty ? 'Nuru user' : authorName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                  if (createdAt.isNotEmpty)
                    Text(getTimeAgo(createdAt),
                        style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ]),
              ),
            ]),
            if (caption.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                caption,
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14.5,
                    height: 1.45,
                    fontWeight: FontWeight.w500),
              ),
            ],
          ]),
        ),
      ),
    ]);
  }

  // ── Shared event share card ────────────────────────────────
  Widget _buildEventShare() {
    final event = _sharedEvent!;
    final m = _moment!;
    final eventTitle = (event['title'] ?? event['name'] ?? 'Event').toString();
    final eventDesc = (event['description'] ?? '').toString();
    final eventDate = (event['start_date'] ?? '').toString();
    final eventLocation = (event['location'] ?? '').toString();
    final eventType = (event['event_type'] ?? '').toString();
    final caption = (m['caption'] ?? m['content'] ?? m['text'] ?? '').toString();

    // Pull all images for the event (cover + gallery)
    final List<String> eventImages = [];
    final cover = (event['cover_image'] ?? event['cover_image_url'])?.toString();
    if (cover != null && cover.isNotEmpty) eventImages.add(cover);
    final raw = event['images'] ?? event['gallery'] ?? [];
    if (raw is List) {
      for (final item in raw) {
        final url = item is String
            ? item
            : (item is Map ? (item['image_url'] ?? item['url'] ?? '').toString() : '');
        if (url.isNotEmpty && !eventImages.contains(url)) eventImages.add(url);
      }
    }

    final eventId = event['id']?.toString();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (caption.isNotEmpty) ...[
            Text(caption,
                style: GoogleFonts.inter(
                    fontSize: 14, color: AppColors.textPrimary, height: 1.5)),
            const SizedBox(height: 12),
          ],
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderLight),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Hero / gallery
                SizedBox(
                  height: 220,
                  width: double.infinity,
                  child: eventImages.length > 1
                      ? PageView.builder(
                          itemCount: eventImages.length,
                          itemBuilder: (_, i) => CachedNetworkImage(
                            imageUrl: eventImages[i],
                            fit: BoxFit.cover,
                            placeholder: (_, __) =>
                                Container(color: AppColors.surfaceVariant),
                            errorWidget: (_, __, ___) => EventCoverImage(event: event),
                          ),
                        )
                      : EventCoverImage(event: event, fit: BoxFit.cover),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (eventType.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(6)),
                          child: Text(eventType,
                              style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white)),
                        ),
                      Text(eventTitle,
                          style: GoogleFonts.inter(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              height: 1.3)),
                      if (eventDate.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Row(children: [
                          const Icon(Icons.calendar_today_rounded,
                              size: 14, color: AppColors.textTertiary),
                          const SizedBox(width: 6),
                          Text(_formatDate(eventDate),
                              style: GoogleFonts.inter(
                                  fontSize: 13, color: AppColors.textTertiary)),
                        ]),
                      ],
                      if (eventLocation.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(children: [
                          const Icon(Icons.place_outlined,
                              size: 14, color: AppColors.textTertiary),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(eventLocation,
                                style: GoogleFonts.inter(
                                    fontSize: 13, color: AppColors.textTertiary),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis),
                          ),
                        ]),
                      ],
                      if (eventDesc.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(eventDesc,
                            style: GoogleFonts.inter(
                                fontSize: 14,
                                color: AppColors.textSecondary,
                                height: 1.5)),
                      ],
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: eventId == null || eventId.isEmpty
                              ? null
                              : () => Navigator.of(context).push(MaterialPageRoute(
                                  builder: (_) => EventPublicViewScreen(
                                      eventId: eventId, initialData: event))),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('View Event'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (eventImages.length > 1) ...[
            const SizedBox(height: 16),
            Text('Gallery',
                style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            SizedBox(
              height: 84,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: eventImages.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(
                    imageUrl: eventImages[i],
                    width: 84,
                    height: 84,
                    fit: BoxFit.cover,
                    placeholder: (_, __) =>
                        Container(width: 84, height: 84, color: AppColors.surfaceVariant),
                    errorWidget: (_, __, ___) =>
                        Container(width: 84, height: 84, color: AppColors.surfaceVariant),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(String s) {
    try {
      final d = DateTime.parse(s);
      const months = [
        'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
      ];
      return '${d.day} ${months[d.month - 1]} ${d.year}';
    } catch (_) {
      return s;
    }
  }
}

class _MediaTile extends StatelessWidget {
  final String url;
  final String type;
  const _MediaTile({required this.url, required this.type});

  @override
  Widget build(BuildContext context) {
    final isVideo = type.contains('video') || url.endsWith('.mp4') || url.endsWith('.mov');
    if (isVideo) {
      // Show a poster + play badge; full player handled elsewhere in feed
      return Stack(alignment: Alignment.center, children: [
        CachedNetworkImage(
          imageUrl: url,
          fit: BoxFit.contain,
          errorWidget: (_, __, ___) =>
              Container(color: Colors.black, child: const SizedBox.shrink()),
        ),
        const Icon(Icons.play_circle_fill, size: 64, color: Colors.white70),
      ]);
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      placeholder: (_, __) => const Center(
        child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
      ),
      errorWidget: (_, __, ___) => const Center(
        child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
      ),
    );
  }
}

class _MomentSkeleton extends StatelessWidget {
  const _MomentSkeleton();
  @override
  Widget build(BuildContext context) {
    return Stack(fit: StackFit.expand, children: [
      Container(color: Colors.black),
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 60, 20, 36),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(width: 120, height: 12, color: Colors.white24),
                  const SizedBox(height: 6),
                  Container(width: 80, height: 10, color: Colors.white12),
                ]),
              ),
            ]),
            const SizedBox(height: 16),
            Container(width: double.infinity, height: 14, color: Colors.white24),
            const SizedBox(height: 6),
            Container(width: 220, height: 14, color: Colors.white12),
          ]),
        ),
      ),
    ]);
  }
}

class _MomentEmpty extends StatelessWidget {
  final bool needsAuth;
  final String message;
  final VoidCallback onRetry;
  const _MomentEmpty({required this.needsAuth, required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const NuruLogo(size: 40),
        const SizedBox(height: 22),
        Text(needsAuth ? 'Sign in to view this moment' : 'Moment not available',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white)),
        const SizedBox(height: 10),
        Text(needsAuth ? 'This moment is shared with the creator’s circle.' : message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, height: 1.5)),
        const SizedBox(height: 24),
        if (needsAuth)
          FilledButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
            child: const Text('Sign in'),
          )
        else
          FilledButton(
            onPressed: onRetry,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
            child: const Text('Try again'),
          ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.of(context).maybePop(),
          child: const Text('Go back', style: TextStyle(color: Colors.white70)),
        ),
      ]),
    );
  }
}
