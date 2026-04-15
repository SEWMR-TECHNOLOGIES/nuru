import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/user_services_service.dart';
import '../../core/services/social_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../messages/messages_screen.dart';
import '../../core/l10n/l10n_helper.dart';

class PublicProfileScreen extends StatefulWidget {
  final String userId;
  final String? username;
  const PublicProfileScreen({super.key, required this.userId, this.username});

  @override
  State<PublicProfileScreen> createState() => _PublicProfileScreenState();
}

class _PublicProfileScreenState extends State<PublicProfileScreen> {
  Map<String, dynamic>? _profile;
  List<dynamic> _posts = [];
  bool _loading = true;
  bool _isFollowing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await UserServicesService.getUserProfile(widget.userId);
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          _profile = res['data'] is Map<String, dynamic> ? res['data'] : null;
          _isFollowing = _profile?['is_following'] == true;
        }
      });
    }
    // Load posts
    final postsRes = await SocialService.getUserPosts(widget.userId);
    if (mounted && postsRes['success'] == true) {
      final data = postsRes['data'];
      setState(() {
        _posts = data is List ? data : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = '${_profile?['first_name'] ?? ''} ${_profile?['last_name'] ?? ''}'.trim();
    final username = _profile?['username']?.toString() ?? widget.username ?? '';
    final avatar = _profile?['avatar']?.toString();
    final bio = _profile?['bio']?.toString() ?? '';
    final followersCount = _profile?['followers_count'] ?? 0;
    final followingCount = _profile?['following_count'] ?? 0;
    final postsCount = _profile?['posts_count'] ?? _posts.length;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: name.isNotEmpty ? name : '@$username'),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Profile header
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 80, height: 80,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant,
                              border: Border.all(color: AppColors.border, width: 2)),
                          clipBehavior: Clip.antiAlias,
                          child: avatar != null && avatar.isNotEmpty
                              ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, width: 80, height: 80,
                                  errorWidget: (_, __, ___) => _initials(name))
                              : _initials(name),
                        ),
                        const SizedBox(height: 12),
                        Text(name.isNotEmpty ? name : 'Unknown', style: GoogleFonts.plusJakartaSans(
                            fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        if (username.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text('@$username', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textTertiary)),
                        ],
                        if (bio.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(bio, textAlign: TextAlign.center, style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, color: AppColors.textSecondary, height: 1.5)),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Stats row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _statItem('$postsCount', 'Posts'),
                      _statItem('$followersCount', 'Followers'),
                      _statItem('$followingCount', 'Following'),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Follow button
                  GestureDetector(
                    onTap: () async {
                      if (_isFollowing) {
                        await SocialService.unfollowUser(widget.userId);
                      } else {
                        await SocialService.followUser(widget.userId);
                      }
                      setState(() => _isFollowing = !_isFollowing);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: _isFollowing ? AppColors.surfaceVariant : AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          _isFollowing ? 'Following' : 'Follow',
                          style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600,
                              color: _isFollowing ? AppColors.textSecondary : Colors.white),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Message button
                  GestureDetector(
                    onTap: () async {
                      final res = await MessagesService.startConversation(
                        recipientId: widget.userId,
                        message: 'Hello!',
                      );
                      if (!mounted) return;
                      if (res['success'] == true && res['data'] != null) {
                        final convId = res['data']['id']?.toString();
                        if (convId != null) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChatDetailScreen(
                                conversationId: convId,
                                name: name.isNotEmpty ? name : '@$username',
                                avatar: avatar,
                              ),
                            ),
                          );
                        }
                      } else {
                        AppSnackbar.error(
                          context,
                          res['message']?.toString() ?? 'Failed to start conversation',
                        );
                      }
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceVariant,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.chat_bubble_outline_rounded, size: 16, color: AppColors.textSecondary),
                            const SizedBox(width: 8),
                            Text(
                              'Message',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Posts
                  Text('Posts', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  const SizedBox(height: 12),

                  if (_posts.isEmpty)
                    Center(child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Text('No posts yet', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textTertiary)),
                    ))
                  else
                    ..._posts.map((p) {
                      final post = p is Map<String, dynamic> ? p : <String, dynamic>{};
                      final content = post['content']?.toString() ?? '';
                      final images = post['images'] is List ? post['images'] as List : [];
                      final createdAt = post['created_at']?.toString() ?? '';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.borderLight),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (content.isNotEmpty)
                              Text(content, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.5)),
                            if (images.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: CachedNetworkImage(
                                  imageUrl: images[0] is Map ? (images[0]['url'] ?? '') : images[0].toString(),
                                  width: double.infinity, height: 180, fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => Container(height: 180, color: AppColors.surfaceVariant),
                                ),
                              ),
                            ],
                            if (createdAt.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(SocialService.getTimeAgo(createdAt), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
                            ],
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _statItem(String value, String label) {
    return Column(
      children: [
        Text(value, style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 2),
        Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
      ],
    );
  }

  Widget _initials(String name) {
    return Center(child: Text(
      name.isNotEmpty ? name[0].toUpperCase() : '?',
      style: GoogleFonts.plusJakartaSans(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textTertiary),
    ));
  }
}
