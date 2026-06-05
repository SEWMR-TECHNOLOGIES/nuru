import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_colors.dart';

/// WhatsApp-style 30s video trimmer.
///
/// Returns a [File] with the trimmed clip on success, or `null` if the user
/// cancels. The selection window is capped at [maxDurationSeconds].
class ReelTrimScreen extends StatefulWidget {
  final File source;
  final double maxDurationSeconds;

  const ReelTrimScreen({
    super.key,
    required this.source,
    this.maxDurationSeconds = 30.0,
  });

  @override
  State<ReelTrimScreen> createState() => _ReelTrimScreenState();
}

class _ReelTrimScreenState extends State<ReelTrimScreen> {
  static const MethodChannel _nativeTrimmerChannel =
      MethodChannel('flutter_native_video_trimmer');
  VideoPlayerController? _controller;
  double _start = 0.0;
  double _end = 0.0;
  double _duration = 0.0;
  bool _playing = false;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final controller = VideoPlayerController.file(widget.source);
      await Future.wait([
        _nativeTrimmerChannel.invokeMethod<void>(
          'loadVideo',
          {'path': widget.source.path},
        ),
        controller.initialize(),
      ]);
      if (!mounted) return;
      controller.addListener(_syncPlaybackWindow);
      final durationSeconds = controller.value.duration.inMilliseconds / 1000;
      setState(() {
        _controller = controller;
        _duration = durationSeconds;
        _start = 0;
        _end = durationSeconds < widget.maxDurationSeconds
            ? durationSeconds
            : widget.maxDurationSeconds;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not load video: $e')),
      );
      Navigator.of(context).pop();
    }
  }

  void _syncPlaybackWindow() {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    final position = controller.value.position.inMilliseconds / 1000;
    final isPlaying = controller.value.isPlaying;

    if (isPlaying && position >= _end) {
      controller.pause();
      controller.seekTo(Duration(milliseconds: (_start * 1000).round()));
    }

    if (mounted && _playing != isPlaying) {
      setState(() => _playing = isPlaying);
    }
  }

  Future<void> _togglePlayback() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      final position = controller.value.position.inMilliseconds / 1000;
      if (position < _start || position >= _end) {
        await controller.seekTo(Duration(milliseconds: (_start * 1000).round()));
      }
      await controller.play();
    }
  }

  void _updateRange(RangeValues values) {
    final maxWindow = widget.maxDurationSeconds;
    double start = values.start;
    double end = values.end;

    if (end - start > maxWindow) {
      final startMoved = (start - _start).abs() > (end - _end).abs();
      if (startMoved) {
        end = (start + maxWindow).clamp(0.0, _duration).toDouble();
      } else {
        start = (end - maxWindow).clamp(0.0, _duration).toDouble();
      }
    }

    setState(() {
      _start = start;
      _end = end;
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final outputPath = await _nativeTrimmerChannel.invokeMethod<String>(
        'trimVideo',
        {
          'startTimeMs': (_start * 1000).round(),
          'endTimeMs': (_end * 1000).round(),
          'includeAudio': true,
        },
      );
      if (!mounted) return;
      setState(() => _saving = false);
      if (outputPath != null) {
        Navigator.of(context).pop(File(outputPath));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to trim video')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to trim video: $e')),
      );
    }
  }

  @override
  void dispose() {
    _controller?.removeListener(_syncPlaybackWindow);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text('Trim video',
            style: GoogleFonts.sora(
                color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
        actions: [
          TextButton(
            onPressed: _loading || _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.primary),
                  )
                : Text('Save',
                    style: GoogleFonts.sora(
                        color: AppColors.primary,
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _togglePlayback,
                      child: Center(
                        child: _controller == null
                            ? const SizedBox.shrink()
                            : AspectRatio(
                                aspectRatio: _controller!.value.aspectRatio,
                                child: VideoPlayer(_controller!),
                              ),
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    color: Colors.black,
                    child: Column(
                      children: [
                        Text(
                          'Select up to ${widget.maxDurationSeconds.toInt()} seconds',
                          style: GoogleFonts.inter(
                              color: Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 12),
                        RangeSlider(
                          values: RangeValues(_start, _end),
                          min: 0,
                          max: _duration <= 0 ? 1 : _duration,
                          activeColor: AppColors.primary,
                          inactiveColor: Colors.white24,
                          labels: RangeLabels(
                            '${_start.toStringAsFixed(1)}s',
                            '${_end.toStringAsFixed(1)}s',
                          ),
                          onChanged: _saving ? null : _updateRange,
                        ),
                        Text(
                          '${(_end - _start).toStringAsFixed(1)}s selected',
                          style: GoogleFonts.inter(
                              color: Colors.white54,
                              fontSize: 11,
                              fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 10),
                        IconButton(
                          onPressed: _togglePlayback,
                          icon: Icon(
                            _playing
                                ? Icons.pause_circle_filled_rounded
                                : Icons.play_circle_fill_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
