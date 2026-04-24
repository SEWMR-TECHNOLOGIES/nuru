import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/nuru_video_player.dart';
import '../../core/services/social_service.dart';
import '../../core/l10n/l10n_helper.dart';
import '../home/widgets/post_detail_modal.dart';

class MyMomentsScreen extends StatefulWidget {
  final String? userId;
  const MyMomentsScreen({super.key, this.userId});

  @override
  State<MyMomentsScreen> createState() => _MyMomentsScreenState();
}

class _MyMomentsScreenState extends State<MyMomentsScreen> {
  List<dynamic> _posts = [];
  bool _loading = true;
  String? _editingId;
  final _editController = TextEditingController();
  String _editVisibility = 'public';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _editController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await SocialService.getMyPosts(limit: 50);
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _posts = data is List ? data : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
        }
      });
    }
  }

  Future<void> _deletePost(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(context.tr('delete_moment'), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700)),
        content: Text(context.tr('this_action_cannot_be_undone'),
          style: GoogleFonts.plusJakartaSans(color: AppColors.textSecondary, height: 1.5)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('cancel'), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('delete'), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final res = await SocialService.deletePost(id);
    if (res['success'] == true) {
      setState(() => _posts.removeWhere((p) => p['id']?.toString() == id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.tr('moment_deleted')), backgroundColor: AppColors.accent, behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        );
      }
    }
  }

  void _showEditSheet(Map<String, dynamic> post) {
    _editingId = post['id']?.toString();
    _editController.text = post['content']?.toString() ?? '';
    _editVisibility = post['visibility']?.toString() ?? 'public';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Text(context.tr('edit_moment'), style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 16),
              TextField(
                controller: _editController,
                maxLines: 5,
                minLines: 3,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.5),
                decoration: InputDecoration(
                  hintText: "What's on your mind?",
                  hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textHint),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderLight)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                  contentPadding: const EdgeInsets.all(14),
                ),
              ),
              const SizedBox(height: 12),
              // Visibility selector
              Row(
                children: [
                  Text(context.tr('visibility'), style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                  const SizedBox(width: 12),
                  _visibilityChip('public', 'Public', Icons.public_rounded, setSheetState),
                  const SizedBox(width: 8),
                  _visibilityChip('circle', 'Circle', Icons.group_rounded, setSheetState),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: const BorderSide(color: AppColors.borderLight),
                      ),
                      child: Text(context.tr('cancel'), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await _saveEdit();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 0,
                      ),
                      child: Text(context.tr('save_changes'), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _visibilityChip(String value, String label, IconData icon, void Function(void Function()) setSheetState) {
    final selected = _editVisibility == value;
    return GestureDetector(
      onTap: () => setSheetState(() => _editVisibility = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withOpacity(0.1) : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: selected ? AppColors.primary : AppColors.textTertiary),
          const SizedBox(width: 4),
          Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: selected ? AppColors.primary : AppColors.textTertiary)),
        ]),
      ),
    );
  }

  Future<void> _saveEdit() async {
    if (_editingId == null) return;
    final res = await SocialService.updatePost(
      _editingId!,
      content: _editController.text.trim(),
      visibility: _editVisibility,
    );
    if (mounted) {
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.tr('moment_updated')), backgroundColor: AppColors.accent, behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        );
        _load();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Failed to update'), backgroundColor: AppColors.error, behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        );
      }
    }
  }

  Future<void> _toggleVisibility(String id, String currentVisibility) async {
    final newVisibility = currentVisibility == 'circle' ? 'public' : 'circle';
    final res = await SocialService.updatePost(id, visibility: newVisibility);
    if (res['success'] == true && mounted) {
      _load();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Changed to $newVisibility'), backgroundColor: AppColors.accent, behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: context.tr('my_moments')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _posts.isEmpty
                ? ListView(children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                    _emptyState(),
                  ])
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _posts.length,
                    itemBuilder: (context, index) => _postItem(_posts[index]),
                  ),
      ),
    );
  }

  Widget _emptyState() {
    return Column(
      children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(32)),
          child: Center(child: SvgPicture.asset('assets/icons/camera-icon.svg', width: 28, height: 28,
              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
        ),
        const SizedBox(height: 16),
        Text(context.tr('no_moments_yet'), style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text(context.tr('share_first_moment'), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
      ],
    );
  }

  Widget _postItem(dynamic post) {
    final p = post is Map<String, dynamic> ? post : <String, dynamic>{};
    final content = p['content']?.toString() ?? '';
    final images = p['images'] is List ? p['images'] as List : (p['media'] is List ? p['media'] as List : []);
    final createdAt = p['created_at']?.toString() ?? '';
    final glowCount = p['glow_count'] ?? p['likes_count'] ?? 0;
    final commentCount = p['comment_count'] ?? p['comments_count'] ?? 0;
    final visibility = p['visibility']?.toString() ?? 'public';
    final id = p['id']?.toString() ?? '';
    final postMediaType = (p['media_type'] ?? '').toString().toLowerCase();

    return GestureDetector(
      onTap: () => PostDetailModal.show(context, p),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderLight),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: visibility == 'circle' ? AppColors.primary.withOpacity(0.08) : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(visibility == 'circle' ? Icons.group_rounded : Icons.public_rounded, size: 10, color: AppColors.textTertiary),
                    const SizedBox(width: 3),
                    Text(visibility, style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w500, color: AppColors.textTertiary)),
                  ]),
                ),
                const Spacer(),
                if (createdAt.isNotEmpty)
                  Text(SocialService.getTimeAgo(createdAt), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
                const SizedBox(width: 4),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_horiz, size: 18, color: AppColors.textHint),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  onSelected: (v) {
                    if (v == 'delete' && id.isNotEmpty) _deletePost(id);
                    if (v == 'edit') _showEditSheet(p);
                    if (v == 'visibility') _toggleVisibility(id, visibility);
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(value: 'edit', child: Row(children: [
                      const Icon(Icons.edit_rounded, size: 16, color: AppColors.textSecondary),
                      const SizedBox(width: 8),
                      Text(context.tr('edit'), style: GoogleFonts.plusJakartaSans(fontSize: 13)),
                    ])),
                    PopupMenuItem(value: 'visibility', child: Row(children: [
                      Icon(visibility == 'circle' ? Icons.public_rounded : Icons.group_rounded, size: 16, color: AppColors.textSecondary),
                      const SizedBox(width: 8),
                      Text(visibility == 'circle' ? context.tr('make_public') : context.tr('circle_only'), style: GoogleFonts.plusJakartaSans(fontSize: 13)),
                    ])),
                    const PopupMenuDivider(),
                    PopupMenuItem(value: 'delete', child: Row(children: [
                      const Icon(Icons.delete_rounded, size: 16, color: AppColors.error),
                      const SizedBox(width: 8),
                      Text(context.tr('delete'), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.error)),
                    ])),
                  ],
                ),
              ],
            ),
            if (content.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(content, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.5)),
            ],
            if (images.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildMedia(images, postMediaType),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                SvgPicture.asset('assets/icons/heart-icon.svg', width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                const SizedBox(width: 4),
                Text('$glowCount ${context.tr('glows')}', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
                const SizedBox(width: 16),
                SvgPicture.asset('assets/icons/echo-icon.svg', width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                const SizedBox(width: 4),
                Text('$commentCount ${context.tr('echoes')}', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static bool _isVideoUrl(String url) {
    final lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.avi') ||
        lower.endsWith('.webm') || lower.endsWith('.mkv') || lower.endsWith('.m4v') ||
        lower.contains('/video') || lower.contains('video/');
  }

  /// Extract media info (url, thumbnail, isVideo) from image list items
  static Map<String, dynamic> _parseMediaItem(dynamic img) {
    String url = '';
    String? thumbnail;
    bool isVideo = false;
    if (img is String) {
      url = img;
      isVideo = _isVideoUrl(img);
    } else if (img is Map) {
      url = (img['image_url'] ?? img['url'] ?? '').toString();
      thumbnail = (img['thumbnail_url'] ?? img['thumbnail'] ?? '').toString();
      if (thumbnail != null && thumbnail.isEmpty) thumbnail = null;
      final itemType = (img['media_type'] ?? img['type'] ?? '').toString().toLowerCase();
      isVideo = itemType.contains('video') || (url.isNotEmpty && _isVideoUrl(url));
    }
    return {'url': url, 'thumbnail': thumbnail, 'isVideo': isVideo};
  }

  /// Build media section matching the feed's moment_card rendering
  Widget _buildMedia(List images, String postMediaType) {
    final urls = <String>[];
    final types = <String>[];
    for (final img in images) {
      if (img is String) {
        urls.add(img);
        types.add('');
      } else if (img is Map) {
        final url = (img['image_url'] ?? img['url'] ?? '').toString();
        if (url.isNotEmpty) {
          urls.add(url);
          types.add((img['media_type'] ?? img['type'] ?? '').toString());
        }
      }
    }
    if (urls.isEmpty) return const SizedBox.shrink();

    bool checkIsVideo(int i) {
      if (postMediaType.contains('video')) return true;
      if (i < types.length && types[i].contains('video')) return true;
      return _isVideoUrl(urls[i]);
    }

    if (urls.length == 1) {
      if (checkIsVideo(0)) {
        return NuruVideoPlayer(url: urls[0], height: 220, borderRadius: BorderRadius.circular(12));
      }
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 360),
          child: CachedNetworkImage(
            imageUrl: urls[0], width: double.infinity, fit: BoxFit.contain,
            placeholder: (_, __) => Container(height: 200, color: AppColors.surfaceVariant),
            errorWidget: (_, __, ___) => Container(height: 200, color: AppColors.surfaceVariant,
              child: const Center(child: Icon(Icons.broken_image_rounded, color: AppColors.textHint))),
          ),
        ),
      );
    }

    return SizedBox(
      height: 140,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: urls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          if (checkIsVideo(i)) {
            return SizedBox(width: 200, child: NuruVideoPlayer(url: urls[i], height: 140, borderRadius: BorderRadius.circular(12)));
          }
          return ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: urls[i], width: 160, height: 140, fit: BoxFit.cover,
              placeholder: (_, __) => Container(width: 160, height: 140, color: AppColors.surfaceVariant),
              errorWidget: (_, __, ___) => Container(width: 160, height: 140, color: AppColors.surfaceVariant,
                child: const Center(child: Icon(Icons.broken_image_rounded, color: AppColors.textHint))),
            ),
          );
        },
      ),
    );
  }
}
