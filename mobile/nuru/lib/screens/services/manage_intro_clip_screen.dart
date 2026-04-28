import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/services/api_service.dart';
import '../../core/l10n/l10n_helper.dart';

/// Manage intro clip (video/audio) for a service
class ManageIntroClipScreen extends StatefulWidget {
  final String serviceId;
  final String serviceName;
  const ManageIntroClipScreen({super.key, required this.serviceId, required this.serviceName});

  @override
  State<ManageIntroClipScreen> createState() => _ManageIntroClipScreenState();
}

class _ManageIntroClipScreenState extends State<ManageIntroClipScreen> {
  List<dynamic> _media = [];
  bool _loading = true;
  bool _uploading = false;

  static String get _baseUrl => ApiService.baseUrl;

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color);

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {'Content-Type': 'application/json', 'Accept': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
  }

  Future<Map<String, String>> _authOnlyHeaders() async {
    final token = await SecureTokenStorage.getToken();
    return {'Accept': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
  }

  @override
  void initState() {
    super.initState();
    _loadMedia();
  }

  Future<void> _loadMedia() async {
    setState(() => _loading = true);
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-services/${widget.serviceId}/intro-media'), headers: await _headers());
      if (res.statusCode == 200 && mounted) {
        final data = jsonDecode(res.body);
        final media = data is Map ? (data['data'] ?? data['intro_media'] ?? []) : (data is List ? data : []);
        setState(() { _media = media is List ? media : []; _loading = false; });
      } else {
        if (mounted) setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _uploadClip() async {
    final picker = ImagePicker();
    final picked = await picker.pickVideo(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _uploading = true);
    try {
      final uri = Uri.parse('$_baseUrl/user-services/${widget.serviceId}/intro-media');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.fields['media_type'] = 'video';
      request.files.add(await http.MultipartFile.fromPath('media', picked.path));
      final streamedRes = await request.send();
      if (streamedRes.statusCode >= 200 && streamedRes.statusCode < 300) {
        if (mounted) AppSnackbar.success(context, 'Intro clip uploaded');
        _loadMedia();
      } else {
        if (mounted) AppSnackbar.error(context, 'Failed to upload clip');
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to upload clip');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _deleteClip(String mediaId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-services/${widget.serviceId}/intro-media/$mediaId'), headers: await _headers());
      if (res.statusCode >= 200 && res.statusCode < 300 && mounted) {
        AppSnackbar.success(context, 'Clip removed');
        _loadMedia();
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to remove clip');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F3F8),
      appBar: NuruSubPageAppBar(title: '${widget.serviceName} · Intro Clip'),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Info box
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    SvgPicture.asset('assets/icons/video-icon.svg', width: 20, height: 20, colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                    const SizedBox(width: 10),
                    Expanded(child: Text('Upload a short video or audio clip to introduce your service to potential clients.', style: _f(size: 12, color: AppColors.primary))),
                  ]),
                ),
                const SizedBox(height: 20),

                // Existing clips
                if (_media.isNotEmpty)
                  ..._media.map((m) {
                    final mediaId = m is Map ? m['id']?.toString() ?? '' : '';
                    final mediaType = m is Map ? (m['media_type']?.toString() ?? 'video') : 'video';
                    final mediaUrl = m is Map ? (m['media_url']?.toString() ?? '') : '';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: Row(children: [
                        Container(
                          width: 48, height: 48,
                          decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
                          child: Center(child: SvgPicture.asset('assets/icons/video-icon.svg', width: 22, height: 22,
                            colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))),
                        ),
                        const SizedBox(width: 14),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(mediaType == 'video' ? 'Video Clip' : 'Audio Clip', style: _f(size: 14, weight: FontWeight.w600)),
                          if (mediaUrl.isNotEmpty)
                            Text(mediaUrl.split('/').last, style: _f(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ])),
                        GestureDetector(
                          onTap: () => _deleteClip(mediaId),
                          child: Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(color: AppColors.error.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.error),
                          ),
                        ),
                      ]),
                    );
                  }),

                // Upload button
                GestureDetector(
                  onTap: _uploading ? null : _uploadClip,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      if (_uploading)
                        const CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)
                      else ...[
                        Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
                          child: Center(child: SvgPicture.asset('assets/icons/video-icon.svg', width: 28, height: 28,
                            colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))),
                        ),
                        const SizedBox(height: 12),
                        Text('Upload Intro Clip', style: _f(size: 14, weight: FontWeight.w700, color: AppColors.primary)),
                        const SizedBox(height: 4),
                        Text('Video or audio file', style: _f(size: 12, color: AppColors.textTertiary)),
                      ],
                    ]),
                  ),
                ),
              ],
            ),
    );
  }
}
