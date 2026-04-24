import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';
import '../theme/app_colors.dart';
import '../../core/l10n/l10n_helper.dart';

/// Real video player widget with actual playback using video_player package.
class NuruVideoPlayer extends StatefulWidget {
  final String url;
  final String? thumbnailUrl;
  final double? height;
  final bool autoPlay;
  final bool showControls;
  final BorderRadius? borderRadius;

  const NuruVideoPlayer({
    super.key,
    required this.url,
    this.thumbnailUrl,
    this.height,
    this.autoPlay = false,
    this.showControls = true,
    this.borderRadius,
  });

  @override
  State<NuruVideoPlayer> createState() => _NuruVideoPlayerState();
}

class _NuruVideoPlayerState extends State<NuruVideoPlayer> {
  late VideoPlayerController _controller;
  bool _initialized = false;
  bool _showControls = true;
  bool _hasError = false;
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..initialize().then((_) {
        if (mounted) {
          setState(() => _initialized = true);
          if (widget.autoPlay) {
            _controller.play();
            _startHideTimer();
          }
        }
      }).catchError((e) {
        if (mounted) setState(() => _hasError = true);
      });

    _controller.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _togglePlay() {
    if (_controller.value.isPlaying) {
      _controller.pause();
      setState(() => _showControls = true);
    } else {
      _controller.play();
      _startHideTimer();
    }
  }

  void _toggleMute() {
    _controller.setVolume(_controller.value.volume > 0 ? 0 : 1);
  }

  void _startHideTimer() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && _controller.value.isPlaying) {
        setState(() => _showControls = false);
      }
    });
  }

  void _onTap() {
    setState(() => _showControls = !_showControls);
    if (_showControls) _startHideTimer();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? BorderRadius.circular(14);
    final isPlaying = _controller.value.isPlaying;
    final isMuted = _controller.value.volume == 0;
    final duration = _controller.value.duration;
    final position = _controller.value.position;
    final progress = duration.inMilliseconds > 0
        ? position.inMilliseconds / duration.inMilliseconds
        : 0.0;

    return ClipRRect(
      borderRadius: radius,
      child: Container(
        height: widget.height ?? 240,
        width: double.infinity,
        color: AppColors.surfaceDark,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Video or thumbnail
            if (_initialized)
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: _controller.value.size.width,
                  height: _controller.value.size.height,
                  child: VideoPlayer(_controller),
                ),
              )
            else if (widget.thumbnailUrl != null)
              Image.network(widget.thumbnailUrl!, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _videoPlaceholder())
            else
              _videoPlaceholder(),

            // Error state
            if (_hasError)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline_rounded, size: 32, color: Colors.white.withOpacity(0.6)),
                    const SizedBox(height: 8),
                    Text('Unable to play video', style: GoogleFonts.inter(fontSize: 12, color: Colors.white60)),
                  ],
                ),
              ),

            // Loading
            if (!_initialized && !_hasError)
              Center(
                child: SizedBox(
                  width: 32, height: 32,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white.withOpacity(0.7),
                  ),
                ),
              ),

            // Tap area
            GestureDetector(
              onTap: _initialized ? _onTap : null,
              behavior: HitTestBehavior.opaque,
              child: Container(color: Colors.transparent),
            ),

            // Play button overlay (when paused & initialized)
            if (_initialized && !isPlaying)
              GestureDetector(
                onTap: _togglePlay,
                child: Container(
                  color: Colors.black.withOpacity(0.2),
                  child: Center(
                    child: SvgPicture.asset('assets/icons/play-icon.svg', width: 48, height: 48,
                      colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                  ),
                ),
              ),

            // Duration badge
            if (_initialized && !isPlaying)
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _formatDuration(duration),
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white.withOpacity(0.9)),
                  ),
                ),
              ),

            // Controls bar
            if (_showControls && widget.showControls && _initialized && isPlaying)
              Positioned(
                bottom: 0, left: 0, right: 0,
                child: _buildControlsBar(progress, position, duration, isMuted),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsBar(double progress, Duration position, Duration duration, bool isMuted) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.black.withOpacity(0.6)],
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Progress bar
          GestureDetector(
            onHorizontalDragUpdate: (details) {
              final box = context.findRenderObject() as RenderBox?;
              if (box == null) return;
              final width = box.size.width - 24;
              final dx = details.localPosition.dx.clamp(0, width);
              final percent = dx / width;
              _controller.seekTo(duration * percent);
            },
            onTapDown: (details) {
              final box = context.findRenderObject() as RenderBox?;
              if (box == null) return;
              final width = box.size.width - 24;
              final dx = details.localPosition.dx.clamp(0.0, width);
              final percent = dx / width;
              _controller.seekTo(duration * percent);
            },
            child: Container(
              height: 3,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(2),
              ),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: progress.clamp(0.0, 1.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ),
          Row(
            children: [
              _controlButton(
                icon: _controller.value.isPlaying ? Icons.pause_rounded : null,
                svgAsset: _controller.value.isPlaying ? null : 'assets/icons/play-icon.svg',
                onTap: _togglePlay,
              ),
              const SizedBox(width: 10),
              _controlButton(
                icon: isMuted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                onTap: _toggleMute,
                size: 18,
              ),
              const SizedBox(width: 8),
              Text(
                '${_formatDuration(position)} / ${_formatDuration(duration)}',
                style: GoogleFonts.inter(fontSize: 11, color: Colors.white60),
              ),
              const Spacer(),
              _controlButton(
                icon: Icons.fullscreen_rounded,
                onTap: () {},
                size: 20,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _controlButton({IconData? icon, String? svgAsset, required VoidCallback onTap, double size = 20}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(6),
        ),
        child: svgAsset != null
            ? SvgPicture.asset(svgAsset, width: size, height: size,
                colorFilter: ColorFilter.mode(Colors.white.withOpacity(0.9), BlendMode.srcIn))
            : Icon(icon, size: size, color: Colors.white.withOpacity(0.9)),
      ),
    );
  }

  Widget _videoPlaceholder() {
    return Container(
      color: AppColors.surfaceDark,
      child: Center(
        child: Icon(Icons.videocam_rounded, size: 36, color: Colors.white.withOpacity(0.12)),
      ),
    );
  }
}
