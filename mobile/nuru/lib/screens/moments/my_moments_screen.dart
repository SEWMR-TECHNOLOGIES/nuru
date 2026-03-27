import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/social_service.dart';

class MyMomentsScreen extends StatefulWidget {
  final String? userId;
  const MyMomentsScreen({super.key, this.userId});

  @override
  State<MyMomentsScreen> createState() => _MyMomentsScreenState();
}

class _MyMomentsScreenState extends State<MyMomentsScreen> {
  List<dynamic> _posts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
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
    final res = await SocialService.deletePost(id);
    if (res['success'] == true) {
      setState(() => _posts.removeWhere((p) => p['id']?.toString() == id));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Post deleted')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: 'My Moments'),
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
        Text('No moments yet', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text('Share your first moment with the community', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
      ],
    );
  }

  Widget _postItem(dynamic post) {
    final p = post is Map<String, dynamic> ? post : <String, dynamic>{};
    final content = p['content']?.toString() ?? '';
    final images = p['images'] is List ? p['images'] as List : [];
    final createdAt = p['created_at']?.toString() ?? '';
    final glowCount = p['glow_count'] ?? p['likes_count'] ?? 0;
    final commentCount = p['comment_count'] ?? p['comments_count'] ?? 0;
    final visibility = p['visibility']?.toString() ?? 'public';
    final id = p['id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(6)),
                child: Text(visibility, style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w500, color: AppColors.textTertiary)),
              ),
              const Spacer(),
              if (createdAt.isNotEmpty)
                Text(SocialService.getTimeAgo(createdAt), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
              const SizedBox(width: 8),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_horiz, size: 18, color: AppColors.textHint),
                onSelected: (v) {
                  if (v == 'delete' && id.isNotEmpty) _deletePost(id);
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'delete', child: Text('Delete')),
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
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: CachedNetworkImage(
                imageUrl: images[0] is Map ? (images[0]['url'] ?? '') : images[0].toString(),
                width: double.infinity, height: 200, fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(height: 200, color: AppColors.surfaceVariant),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              SvgPicture.asset('assets/icons/heart-icon.svg', width: 16, height: 16,
                  colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
              const SizedBox(width: 4),
              Text('$glowCount', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
              const SizedBox(width: 16),
              SvgPicture.asset('assets/icons/chat-icon.svg', width: 16, height: 16,
                  colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
              const SizedBox(width: 4),
              Text('$commentCount', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
            ],
          ),
        ],
      ),
    );
  }
}
