import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_thumbnail/video_thumbnail.dart' as vt;
import 'package:flutter_svg/flutter_svg.dart';
import '../theme/app_colors.dart';

/// Renders a thumbnail for a remote video URL.
///
/// - Uses [posterUrl] when provided (instant).
/// - Otherwise generates a JPG from the first frame via `video_thumbnail`,
///   caches it on disk so subsequent renders are instant.
class VideoThumbnailImage extends StatefulWidget {
  final String videoUrl;
  final String? posterUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final bool showPlayBadge;

  const VideoThumbnailImage({
    super.key,
    required this.videoUrl,
    this.posterUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.showPlayBadge = true,
  });

  @override
  State<VideoThumbnailImage> createState() => _VideoThumbnailImageState();
}

class _VideoThumbnailImageState extends State<VideoThumbnailImage> {
  static final Map<String, String> _cache = {};
  String? _localPath;

  @override
  void initState() {
    super.initState();
    if ((widget.posterUrl == null || widget.posterUrl!.isEmpty)) {
      _generate();
    }
  }

  Future<void> _generate() async {
    final cached = _cache[widget.videoUrl];
    if (cached != null && File(cached).existsSync()) {
      if (mounted) setState(() => _localPath = cached);
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
      final path = await vt.VideoThumbnail.thumbnailFile(
        video: widget.videoUrl,
        thumbnailPath: dir.path,
        imageFormat: vt.ImageFormat.JPEG,
        maxWidth: 480,
        quality: 70,
      );
      if (path != null) {
        _cache[widget.videoUrl] = path;
        if (mounted) setState(() => _localPath = path);
      }
    } catch (_) {/* ignore */}
  }

  @override
  Widget build(BuildContext context) {
    Widget image;
    if (widget.posterUrl != null && widget.posterUrl!.isNotEmpty) {
      image = CachedNetworkImage(
        imageUrl: widget.posterUrl!,
        fit: widget.fit, width: widget.width, height: widget.height,
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        placeholderFadeInDuration: Duration.zero,
        placeholder: (_, __) => Container(color: AppColors.surfaceVariant),
        errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant),
      );
    } else if (_localPath != null) {
      image = Image.file(File(_localPath!), fit: widget.fit, width: widget.width, height: widget.height);
    } else {
      image = Container(color: Colors.black, width: widget.width, height: widget.height);
    }
    if (!widget.showPlayBadge) return image;
    return Stack(fit: StackFit.expand, children: [
      image,
      Container(color: Colors.black.withOpacity(0.12)),
      Center(
        child: SvgPicture.asset(
          'assets/icons/play-icon.svg',
          width: 28, height: 28,
          colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
        ),
      ),
    ]);
  }
}
