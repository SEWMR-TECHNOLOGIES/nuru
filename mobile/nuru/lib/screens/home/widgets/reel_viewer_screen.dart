import 'dart:io';
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';
import '../../../core/services/moments_service.dart';
import '../../../core/theme/app_colors.dart';

/// Full-screen reels viewer. Tap left/right to navigate, swipe down to close.
/// Auto-advances after 5s for text/image. Marks each moment as seen.
class ReelViewerScreen extends StatefulWidget {
  /// All grouped reels from the home feed.
  final List<dynamic> reels;
  final int initialAuthorIndex;
  const ReelViewerScreen({
    super.key,
    required this.reels,
    required this.initialAuthorIndex,
  });

  @override
  State<ReelViewerScreen> createState() => _ReelViewerScreenState();
}

class _ReelViewerScreenState extends State<ReelViewerScreen>
    with SingleTickerProviderStateMixin {
  late int _authorIdx;
  int _momentIdx = 0;
  VideoPlayerController? _vc;
  late final AnimationController _progress;
  static const _defaultDuration = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();
    _authorIdx = widget.initialAuthorIndex;
    _progress = AnimationController(vsync: this, duration: _defaultDuration)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed) _next();
      });
    _start();
  }

  @override
  void dispose() {
    _progress.dispose();
    _vc?.dispose();
    super.dispose();
  }

  Map get _author => (widget.reels[_authorIdx] as Map);
  List get _moments => (_author['moments'] as List? ?? const []);
  Map get _moment => _moments[_momentIdx] as Map;

  Future<void> _start() async {
    _progress.stop();
    _progress.value = 0;
    _vc?.dispose();
    _vc = null;
    if (mounted) setState(() {});
    final id = _moment['id']?.toString();
    if (id != null) MomentsService.markSeen(id);

    final type = _moment['content_type']?.toString() ?? 'image';
    final url = _moment['media_url']?.toString() ?? '';
    if (type == 'video' && url.isNotEmpty) {
      try {
        final file = await DefaultCacheManager().getSingleFile(url);
        if (!mounted) return;
        final c = VideoPlayerController.file(File(file.path));
        _vc = c;
        await c.initialize();
        if (!mounted || _vc != c) return;
        c.setLooping(false);
        c.play();
        _progress.duration = c.value.duration > Duration.zero
            ? c.value.duration
            : _defaultDuration;
        _progress.forward(from: 0);
        setState(() {});
      } catch (_) {
        _progress.duration = _defaultDuration;
        _progress.forward(from: 0);
      }
    } else {
      _progress.duration = _defaultDuration;
      _progress.forward(from: 0);
    }
  }

  void _next() {
    if (_momentIdx < _moments.length - 1) {
      setState(() => _momentIdx++);
      _start();
    } else if (_authorIdx < widget.reels.length - 1) {
      setState(() {
        _authorIdx++;
        _momentIdx = 0;
      });
      _start();
    } else {
      Navigator.of(context).pop();
    }
  }

  void _prev() {
    if (_momentIdx > 0) {
      setState(() => _momentIdx--);
      _start();
    } else if (_authorIdx > 0) {
      setState(() {
        _authorIdx--;
        _momentIdx = (widget.reels[_authorIdx] as Map)['moments'].length - 1;
      });
      _start();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = (_author['user'] as Map? ?? const {});
    final m = _moment;
    final type = m['content_type']?.toString() ?? 'image';
    final mediaUrl = m['media_url']?.toString() ?? '';
    final caption = m['content']?.toString() ?? m['caption']?.toString() ?? '';

    String? bg;
    String? imageUrl;
    if (type == 'text') {
      // Backend stores text bg as "text:#RRGGBB"
      if (mediaUrl.startsWith('text:')) {
        bg = mediaUrl.substring(5);
      } else {
        bg = m['background_color']?.toString();
      }
    } else {
      imageUrl = mediaUrl;
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onVerticalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 200) Navigator.of(context).pop();
        },
        onTapUp: (d) {
          final w = MediaQuery.of(context).size.width;
          if (d.globalPosition.dx < w / 3) {
            _prev();
          } else {
            _next();
          }
        },
        child: Stack(
          children: [
            Positioned.fill(child: _canvas(type, bg, imageUrl, caption)),
            // Progress bars
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 12,
              right: 12,
              child: Column(
                children: [
                  Row(
                    children: List.generate(_moments.length, (i) {
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: Container(
                              height: 2.5,
                              color: Colors.white24,
                              alignment: Alignment.centerLeft,
                              child: i < _momentIdx
                                  ? Container(color: Colors.white)
                                  : i == _momentIdx
                                      ? AnimatedBuilder(
                                          animation: _progress,
                                          builder: (_, __) => FractionallySizedBox(
                                            widthFactor: _progress.value.clamp(0.0, 1.0),
                                            child: Container(color: Colors.white),
                                          ),
                                        )
                                      : const SizedBox.shrink(),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _Avatar(name: user['name']?.toString() ?? '', url: user['avatar']?.toString()),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: Text(
                                user['is_self'] == true
                                    ? 'My Reel'
                                    : (user['name']?.toString() ?? 'Unknown'),
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            // Show verified badge for any verified author,
                            // including the current user viewing their own reel.
                            if (user['is_verified'] == true || user['is_identity_verified'] == true) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.verified_rounded, size: 15, color: AppColors.primary),
                            ],
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 38,
                          height: 38,
                          alignment: Alignment.center,
                          child: SvgPicture.asset(
                            'assets/icons/close-icon.svg',
                            width: 18,
                            height: 18,
                            colorFilter: const ColorFilter.mode(
                                Colors.white, BlendMode.srcIn),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Premium caption block for media moments
            if (type != 'text' && caption.isNotEmpty)
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _CaptionBlock(caption: caption),
              ),
          ],
        ),
      ),
    );
  }

  Widget _canvas(String type, String? bg, String? imageUrl, String caption) {
    if (type == 'text') {
      Color color = AppColors.primary;
      if (bg != null && bg.startsWith('#') && bg.length == 7) {
        color = Color(int.parse('FF${bg.substring(1)}', radix: 16));
      }
      final l =
          (0.299 * color.red + 0.587 * color.green + 0.114 * color.blue) / 255;
      final fg = l > 0.65 ? const Color(0xFF111111) : Colors.white;
      return Container(
        color: color,
        padding: const EdgeInsets.all(28),
        alignment: Alignment.center,
        child: Text(
          caption,
          textAlign: TextAlign.center,
          style: GoogleFonts.sora(
            color: fg,
            fontSize: 28,
            fontWeight: FontWeight.w700,
            height: 1.4,
          ),
        ),
      );
    }
    if (type == 'video') {
      final c = _vc;
      if (c != null && c.value.isInitialized) {
        return Container(
          color: Colors.black,
          alignment: Alignment.center,
          child: AspectRatio(
            aspectRatio: c.value.aspectRatio,
            child: VideoPlayer(c),
          ),
        );
      }
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: const SizedBox(
          width: 36,
          height: 36,
          child: CircularProgressIndicator(
              strokeWidth: 2.5, color: Colors.white70),
        ),
      );
    }
    if (imageUrl != null && imageUrl.isNotEmpty) {
      // Show full image (BoxFit.contain) over a blurred copy of itself so
      // portrait/landscape photos are never cropped or zoomed.
      return Stack(
        fit: StackFit.expand,
        children: [
          // Blurred backdrop to fill the dead space around the contained image.
          CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            placeholder: (_, __) => Container(color: Colors.black),
            errorWidget: (_, __, ___) => Container(color: Colors.black),
          ),
          BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 28, sigmaY: 28),
            child: Container(color: Colors.black.withOpacity(0.55)),
          ),
          Center(
            child: CachedNetworkImage(
              imageUrl: imageUrl,
              fit: BoxFit.contain,
              width: double.infinity,
              height: double.infinity,
              placeholder: (_, __) => const SizedBox.shrink(),
              errorWidget: (_, __, ___) => const Center(
                child: Icon(Icons.broken_image_outlined,
                    color: Colors.white54, size: 48),
              ),
            ),
          ),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}

/// Premium caption block shown at the bottom of media reels. Includes a
/// gradient scrim, expandable text, and a subtle glass background so the
/// caption is always legible regardless of the underlying media.
class _CaptionBlock extends StatefulWidget {
  final String caption;
  const _CaptionBlock({required this.caption});

  @override
  State<_CaptionBlock> createState() => _CaptionBlockState();
}

class _CaptionBlockState extends State<_CaptionBlock> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final isLong = widget.caption.length > 110;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: isLong ? () => setState(() => _expanded = !_expanded) : null,
      child: Container(
        padding: EdgeInsets.fromLTRB(
            18, 28, 18, 28 + MediaQuery.of(context).padding.bottom),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.transparent,
              Colors.black.withOpacity(0.55),
              Colors.black.withOpacity(0.85),
            ],
            stops: const [0.0, 0.45, 1.0],
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              alignment: Alignment.topLeft,
              child: Text(
                widget.caption,
                maxLines: _expanded ? 12 : 3,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 14.5,
                  height: 1.45,
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.1,
                ),
              ),
            ),
            if (isLong) ...[
              const SizedBox(height: 6),
              Text(
                _expanded ? 'Tap to collapse' : 'Tap to read more',
                style: GoogleFonts.inter(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: Colors.white70,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? url;
  const _Avatar({required this.name, this.url});
  @override
  Widget build(BuildContext context) {
    const size = 44.0;
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white12,
      ),
      clipBehavior: Clip.antiAlias,
      child: (url != null && url!.isNotEmpty)
          ? CachedNetworkImage(
              imageUrl: url!,
              fit: BoxFit.cover,
              width: size,
              height: size,
              placeholder: (_, __) => Container(color: Colors.white12),
              errorWidget: (_, __, ___) => Container(
                color: Colors.white12,
                alignment: Alignment.center,
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: GoogleFonts.sora(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
            )
          : Container(
              alignment: Alignment.center,
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: GoogleFonts.sora(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
                ),
      ),
    );
  }
}
