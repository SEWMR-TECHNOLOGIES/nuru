import '../../core/widgets/nuru_refresh_indicator.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/social_service.dart';
import '../home/widgets/moment_card.dart';
import '../home/widgets/post_detail_modal.dart';
import '../../core/l10n/l10n_helper.dart';

class SavedPostsScreen extends StatefulWidget {
  const SavedPostsScreen({super.key});

  @override
  State<SavedPostsScreen> createState() => _SavedPostsScreenState();
}

class _SavedPostsScreenState extends State<SavedPostsScreen> {
  bool _loading = true;
  List<dynamic> _posts = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await SocialService.getSavedPosts();
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

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface, elevation: 0,
        leading: IconButton(
          icon: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 22, height: 22,
            colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Saved Posts', style: _f(size: 18, weight: FontWeight.w700)),
        centerTitle: false,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _posts.isEmpty
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SvgPicture.asset('assets/icons/bookmark-icon.svg', width: 40, height: 40,
                      colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                    const SizedBox(height: 12),
                    Text('No saved posts', style: _f(size: 14, color: AppColors.textTertiary)),
                    const SizedBox(height: 4),
                    Text('Bookmark posts to see them here', style: _f(size: 12, color: AppColors.textHint)),
                  ],
                ))
              : NuruRefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    itemCount: _posts.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 16),
                    itemBuilder: (_, i) {
                      final post = _posts[i] as Map<String, dynamic>;
                      final actualPost = post.containsKey('post') && post['post'] is Map ? post['post'] as Map<String, dynamic> : post;
                      return MomentCard(
                        post: actualPost,
                        onTap: () => PostDetailModal.show(context, actualPost),
                      );
                    },
                  ),
                ),
    );
  }
}
