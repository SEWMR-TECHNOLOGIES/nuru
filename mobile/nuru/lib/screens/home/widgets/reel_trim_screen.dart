import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_trimmer/video_trimmer.dart';
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
  final Trimmer _trimmer = Trimmer();
  double _start = 0.0;
  double _end = 0.0;
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
      await _trimmer.loadVideo(videoFile: widget.source);
      if (!mounted) return;
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not load video: $e')),
      );
      Navigator.of(context).pop();
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    await _trimmer.saveTrimmedVideo(
      startValue: _start,
      endValue: _end,
      onSave: (String? outputPath) {
        if (!mounted) return;
        setState(() => _saving = false);
        if (outputPath != null) {
          Navigator.of(context).pop(File(outputPath));
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to trim video')),
          );
        }
      },
    );
  }

  @override
  void dispose() {
    _trimmer.dispose();
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
                      onTap: () async {
                        final ok = await _trimmer.videoPlaybackControl(
                          startValue: _start,
                          endValue: _end,
                        );
                        setState(() => _playing = ok);
                      },
                      child: Center(child: VideoViewer(trimmer: _trimmer)),
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
                        Center(
                          child: TrimViewer(
                            trimmer: _trimmer,
                            viewerHeight: 56,
                            viewerWidth: MediaQuery.of(context).size.width - 32,
                            maxVideoLength: Duration(
                                seconds: widget.maxDurationSeconds.toInt()),
                            editorProperties: TrimEditorProperties(
                              borderPaintColor: AppColors.primary,
                              scrubberPaintColor: AppColors.primary,
                              circlePaintColor: AppColors.primary,
                            ),
                            onChangeStart: (v) => _start = v,
                            onChangeEnd: (v) => _end = v,
                            onChangePlaybackState: (v) =>
                                setState(() => _playing = v),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Icon(
                          _playing
                              ? Icons.pause_circle_filled_rounded
                              : Icons.play_circle_fill_rounded,
                          color: Colors.white,
                          size: 36,
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
