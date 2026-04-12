import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/photo_libraries_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/theme/text_styles.dart';
import '../../core/l10n/l10n_helper.dart';

/// Photo Library Screen — view, upload, and share event photos
class PhotoLibraryScreen extends StatefulWidget {
  final String libraryId;
  final String? libraryName;
  const PhotoLibraryScreen({super.key, required this.libraryId, this.libraryName});

  @override
  State<PhotoLibraryScreen> createState() => _PhotoLibraryScreenState();
}

class _PhotoLibraryScreenState extends State<PhotoLibraryScreen> {
  Map<String, dynamic>? _library;
  List<dynamic> _photos = [];
  bool _loading = true;
  bool _uploading = false;
  bool _updatingPrivacy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await PhotoLibrariesService.getLibrary(widget.libraryId);
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          _library = res['data'];
          _photos = _library?['photos'] ?? [];
        }
      });
    }
  }

  Future<void> _uploadPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, imageQuality: 85);
    if (picked == null) return;

    setState(() => _uploading = true);
    final res = await PhotoLibrariesService.uploadPhoto(widget.libraryId, picked.path);
    setState(() => _uploading = false);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Photo uploaded');
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Upload failed');
      }
    }
  }

  Future<void> _deletePhoto(String photoId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Delete Photo?', style: appText(size: 18, weight: FontWeight.w700)),
        content: Text('This cannot be undone.', style: appText(size: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: appText(size: 14, weight: FontWeight.w600, color: AppColors.textSecondary))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text('Delete', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.error))),
        ],
      ),
    );
    if (confirm != true) return;
    final res = await PhotoLibrariesService.deletePhoto(widget.libraryId, photoId);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Photo deleted');
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Delete failed');
      }
    }
  }

  void _shareLibrary() {
    final privacy = (_library?['privacy']?.toString() ?? 'event_creator_only').toLowerCase();
    if (privacy != 'public') {
      AppSnackbar.error(context, 'This library is private. Switch to Public to share link.');
      return;
    }
    final shareUrl = _library?['share_url'] ?? '';
    if (shareUrl.isNotEmpty) {
      Share.share('Check out this photo library: $shareUrl');
    }
  }

  Future<void> _updatePrivacy(String privacy) async {
    if (_updatingPrivacy) return;
    setState(() => _updatingPrivacy = true);
    final res = await PhotoLibrariesService.updateLibrary(widget.libraryId, privacy: privacy);
    if (!mounted) return;
    setState(() => _updatingPrivacy = false);
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Library visibility updated');
      _load();
    } else {
      AppSnackbar.error(context, res['message']?.toString() ?? 'Unable to update visibility');
    }
  }

  void _openShareOptions() {
    final privacy = (_library?['privacy']?.toString() ?? 'event_creator_only').toLowerCase();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 14),
            Text('Share & Visibility', style: appText(size: 17, weight: FontWeight.w700)),
            const SizedBox(height: 10),
            ListTile(
              tileColor: AppColors.surfaceVariant,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              leading: const Icon(Icons.public_rounded, color: AppColors.success),
              title: Text('Public', style: appText(size: 14, weight: FontWeight.w600)),
              subtitle: Text('Anyone with the link can view this library', style: appText(size: 11, color: AppColors.textTertiary)),
              trailing: privacy == 'public' ? const Icon(Icons.check_circle, color: AppColors.success, size: 18) : null,
              onTap: () async {
                Navigator.pop(ctx);
                if (privacy != 'public') {
                  await _updatePrivacy('public');
                }
              },
            ),
            const SizedBox(height: 8),
            ListTile(
              tileColor: AppColors.surfaceVariant,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              leading: const Icon(Icons.lock_outline_rounded, color: AppColors.textSecondary),
              title: Text('Private', style: appText(size: 14, weight: FontWeight.w600)),
              subtitle: Text('Only service owner and event organizer can view', style: appText(size: 11, color: AppColors.textTertiary)),
              trailing: privacy != 'public' ? const Icon(Icons.check_circle, color: AppColors.primary, size: 18) : null,
              onTap: () async {
                Navigator.pop(ctx);
                if (privacy == 'public') {
                  await _updatePrivacy('event_creator_only');
                }
              },
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _updatingPrivacy ? null : () {
                  Navigator.pop(ctx);
                  _shareLibrary();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.share_rounded, size: 18),
                label: Text('Share link', style: appText(size: 13, weight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.libraryName ?? _library?['name'] ?? 'Photo Library';
    final photoCount = _library?['photo_count'] ?? _photos.length;
    final storageUsed = _library?['storage_used_percent'] ?? 0;
    final storageUsedMb = _toDouble(_library?['total_size_mb']) > 0
        ? _toDouble(_library?['total_size_mb'])
        : (_toDouble(_library?['total_size_bytes']) / (1024 * 1024));
    final storageLimitMb = _toDouble(_library?['storage_limit_mb']) > 0 ? _toDouble(_library?['storage_limit_mb']) : 200;
    final privacy = (_library?['privacy']?.toString() ?? 'event_creator_only').toLowerCase();
    final isOwner = _library?['is_owner'] == true;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: Column(children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.7), borderRadius: BorderRadius.circular(12)),
                    child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 20, height: 20,
                      colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: appText(size: 18, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Row(children: [
                    Text('$photoCount photos', style: appText(size: 11, color: AppColors.textTertiary)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: privacy == 'public' ? AppColors.success.withOpacity(0.12) : AppColors.textHint.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        privacy == 'public' ? 'Public' : 'Private',
                        style: appText(size: 10, weight: FontWeight.w700, color: privacy == 'public' ? AppColors.success : AppColors.textSecondary),
                      ),
                    ),
                  ]),
                  Text(
                    '${storageUsed}% used · ${storageUsedMb.toStringAsFixed(1)}MB / ${storageLimitMb.toStringAsFixed(0)}MB',
                    style: appText(size: 10, color: AppColors.textHint),
                  ),
                ])),
                GestureDetector(
                  onTap: _openShareOptions,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.7), borderRadius: BorderRadius.circular(12)),
                    child: SvgPicture.asset('assets/icons/share-icon.svg', width: 18, height: 18,
                      colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)),
                  ),
                ),
              ]),
            ),

            // Content
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : _photos.isEmpty
                      ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                          SvgPicture.asset('assets/icons/camera-icon.svg', width: 48, height: 48,
                            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                          const SizedBox(height: 16),
                          Text('No photos yet', style: appText(size: 16, weight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text('Upload your first photo', style: appText(size: 13, color: AppColors.textTertiary)),
                        ]))
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: AppColors.primary,
                          child: GridView.builder(
                            padding: const EdgeInsets.all(16),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3, mainAxisSpacing: 4, crossAxisSpacing: 4,
                            ),
                            itemCount: _photos.length,
                            itemBuilder: (_, i) {
                              final photo = _photos[i] is Map<String, dynamic> ? _photos[i] as Map<String, dynamic> : <String, dynamic>{};
                              final url = photo['url']?.toString() ?? '';
                              final id = photo['id']?.toString() ?? '';
                              return GestureDetector(
                                onTap: () => _showPhotoDetail(photo),
                                onLongPress: isOwner ? () => _deletePhoto(id) : null,
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: url.isNotEmpty
                                      ? Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(
                                          color: AppColors.surfaceVariant,
                                          child: const Icon(Icons.broken_image_rounded, color: AppColors.textHint)))
                                      : Container(color: AppColors.surfaceVariant),
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ]),
        ),
        floatingActionButton: isOwner
            ? FloatingActionButton(
                onPressed: _uploading ? null : _uploadPhoto,
                backgroundColor: AppColors.primary,
                child: _uploading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.add_a_photo_rounded, color: Colors.white),
              )
            : null,
      ),
    );
  }

  double _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  void _showPhotoDetail(Map<String, dynamic> photo) {
    final url = photo['url']?.toString() ?? '';
    final caption = photo['caption']?.toString() ?? '';
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(20),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (url.isNotEmpty)
              Image.network(url, fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Container(height: 200, color: AppColors.surfaceVariant)),
            if (caption.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                color: AppColors.surface,
                child: Text(caption, style: appText(size: 13, color: AppColors.textSecondary)),
              ),
          ]),
        ),
      ),
    );
  }
}
