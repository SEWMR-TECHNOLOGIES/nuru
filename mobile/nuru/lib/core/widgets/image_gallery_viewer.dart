import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'nuru_video_player.dart';

/// Fullscreen, swipeable, pinch-zoom gallery for images and videos.
///
/// Use [open] from any tap handler to push it as a modal route.
class ImageGalleryViewer extends StatefulWidget {
  final List<String> urls;
  final List<String> mediaTypes;
  final int initialIndex;

  const ImageGalleryViewer({
    super.key,
    required this.urls,
    this.mediaTypes = const [],
    this.initialIndex = 0,
  });

  static Future<void> open(
    BuildContext context, {
    required List<String> urls,
    List<String> mediaTypes = const [],
    int initialIndex = 0,
  }) {
    if (urls.isEmpty) return Future.value();
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        transitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, __, ___) => ImageGalleryViewer(
          urls: urls,
          mediaTypes: mediaTypes,
          initialIndex: initialIndex,
        ),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    );
  }

  @override
  State<ImageGalleryViewer> createState() => _ImageGalleryViewerState();
}

class _ImageGalleryViewerState extends State<ImageGalleryViewer> {
  late final PageController _ctrl =
      PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  bool _isVideoAt(int i) {
    final url = widget.urls[i];
    final type = i < widget.mediaTypes.length ? widget.mediaTypes[i] : '';
    return type.contains('video') ||
        url.endsWith('.mp4') ||
        url.endsWith('.mov') ||
        url.endsWith('.webm');
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _ctrl,
            itemCount: widget.urls.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) {
              if (_isVideoAt(i)) {
                return Center(
                  child: NuruVideoPlayer(
                    url: widget.urls[i],
                    autoPlay: true,
                    showControls: true,
                  ),
                );
              }
              return InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: widget.urls[i],
                    fit: BoxFit.contain,
                    placeholder: (_, __) => const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    ),
                    errorWidget: (_, __, ___) => const Icon(
                      Icons.broken_image_rounded,
                      color: Colors.white54,
                      size: 48,
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.close_rounded,
                          color: Colors.white, size: 26),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    const Spacer(),
                    if (widget.urls.length > 1)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.45),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          '${_index + 1} / ${widget.urls.length}',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    const SizedBox(width: 8),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
