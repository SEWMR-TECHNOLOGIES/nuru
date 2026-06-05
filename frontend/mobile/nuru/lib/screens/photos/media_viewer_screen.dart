import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:video_player/video_player.dart';
import '../../core/theme/text_styles.dart';
import '../../core/services/media_transfer_manager.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/video_thumbnail_image.dart';

/// Full-screen viewer for a photo (pinch-to-zoom) or video (with controls).
class MediaViewerScreen extends StatefulWidget {
  final List<Map<String, dynamic>> media;
  final int initialIndex;
  final String? libraryId;

  const MediaViewerScreen({super.key, required this.media, this.initialIndex = 0, this.libraryId});

  @override
  State<MediaViewerScreen> createState() => _MediaViewerScreenState();
}

class _MediaViewerScreenState extends State<MediaViewerScreen> {
  late PageController _controller;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _controller = PageController(initialPage: _index);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.media.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) {
              final m = widget.media[i];
              final url = m['url']?.toString() ?? '';
              final isVideo = m['media_type'] == 'video';
              if (isVideo && url.isNotEmpty) {
                return _VideoPlayerView(url: url, key: ValueKey('video-$i-$url'));
              }
              return InteractiveViewer(
                minScale: 1, maxScale: 5,
                child: Center(
                  child: url.isNotEmpty
                      ? Image.network(url, fit: BoxFit.contain,
                          loadingBuilder: (_, c, p) => p == null ? c :
                            const Center(child: CircularProgressIndicator(color: Colors.white)),
                          errorBuilder: (_, __, ___) =>
                            const Icon(Icons.broken_image_outlined, size: 64, color: Colors.white54))
                      : const Icon(Icons.image_outlined, size: 64, color: Colors.white54),
                ),
              );
            },
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
              child: Row(children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: SvgPicture.asset('assets/icons/arrow-left-icon.svg', width: 22, height: 22,
                    colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                ),
                const Spacer(),
                Text('${_index + 1} of ${widget.media.length}',
                  style: appText(size: 13, weight: FontWeight.w600, color: Colors.white)),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () {
                    final m = widget.media[_index];
                    final url = m['url']?.toString() ?? '';
                    if (url.isEmpty || widget.libraryId == null) return;
                    MediaTransferManager.instance.queueDownload(
                      libraryId: widget.libraryId!,
                      url: url,
                      filename: m['original_name']?.toString(),
                      mediaType: m['media_type']?.toString(),
                    );
                    AppSnackbar.success(context, 'Download started');
                  },
                  icon: SvgPicture.asset('assets/icons/download-icon.svg', width: 22, height: 22,
                    colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                ),
              ]),
            ),
          ),
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: SafeArea(
              top: false,
              child: Container(
                height: 64,
                color: Colors.black.withOpacity(0.5),
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  itemCount: widget.media.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 6),
                  itemBuilder: (_, i) {
                    final m = widget.media[i];
                    final url = m['url']?.toString() ?? '';
                    final isVideo = m['media_type'] == 'video';
                    final active = i == _index;
                    return GestureDetector(
                      onTap: () => _controller.animateToPage(i,
                          duration: const Duration(milliseconds: 250), curve: Curves.easeOut),
                      child: Container(
                        width: 48, height: 48,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: active ? Colors.white : Colors.transparent, width: 2),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: url.isEmpty
                              ? Container(color: Colors.white12)
                              : (isVideo
                                  ? VideoThumbnailImage(videoUrl: url, fit: BoxFit.cover, width: 48, height: 48, showPlayBadge: false)
                                  : Image.network(url, fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(color: Colors.white12))),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _VideoPlayerView extends StatefulWidget {
  final String url;
  const _VideoPlayerView({super.key, required this.url});

  @override
  State<_VideoPlayerView> createState() => _VideoPlayerViewState();
}

class _VideoPlayerViewState extends State<_VideoPlayerView> {
  VideoPlayerController? _vc;
  bool _ready = false;
  bool _error = false;
  bool _showControls = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      _vc = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      await _vc!.initialize();
      if (!mounted) return;
      _vc!.addListener(_onTick);
      setState(() => _ready = true);
      _vc!.play();
    } catch (_) {
      if (mounted) setState(() => _error = true);
    }
  }

  void _onTick() { if (mounted) setState(() {}); }

  @override
  void dispose() {
    _vc?.removeListener(_onTick);
    _vc?.dispose();
    super.dispose();
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final h = d.inHours;
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    if (_error) {
      return const Center(
        child: Icon(Icons.error_outline, size: 48, color: Colors.white54),
      );
    }
    if (!_ready || _vc == null) {
      return const Center(child: CircularProgressIndicator(color: Colors.white));
    }
    final v = _vc!;
    final pos = v.value.position;
    final dur = v.value.duration;
    return GestureDetector(
      onTap: () => setState(() => _showControls = !_showControls),
      child: Center(
        child: Stack(alignment: Alignment.center, children: [
          AspectRatio(
            aspectRatio: v.value.aspectRatio == 0 ? 16/9 : v.value.aspectRatio,
            child: VideoPlayer(v),
          ),
          if (_showControls) ...[
            // Center play/pause
            GestureDetector(
              onTap: () {
                setState(() => v.value.isPlaying ? v.pause() : v.play());
              },
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.55),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  v.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: Colors.white, size: 40,
                ),
              ),
            ),
            // Bottom control bar
            Positioned(
              left: 0, right: 0, bottom: 70,
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 12),
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.55),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  VideoProgressIndicator(v, allowScrubbing: true,
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    colors: const VideoProgressColors(
                      playedColor: Colors.white,
                      bufferedColor: Colors.white24,
                      backgroundColor: Colors.white12,
                    )),
                  const SizedBox(height: 6),
                  Row(children: [
                    GestureDetector(
                      onTap: () {
                        setState(() => v.value.isPlaying ? v.pause() : v.play());
                      },
                      child: Icon(
                        v.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: Colors.white, size: 22,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text('${_fmt(pos)} / ${_fmt(dur)}',
                      style: appText(size: 11, weight: FontWeight.w600, color: Colors.white)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () async {
                        final newVol = v.value.volume > 0 ? 0.0 : 1.0;
                        await v.setVolume(newVol);
                        if (mounted) setState(() {});
                      },
                      child: Icon(
                        v.value.volume > 0 ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                        color: Colors.white, size: 20,
                      ),
                    ),
                  ]),
                ]),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
