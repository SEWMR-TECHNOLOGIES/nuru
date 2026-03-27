import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/social_service.dart';

class CommunityDetailScreen extends StatefulWidget {
  final String communityId;
  final String communityName;
  final String? coverImage;

  const CommunityDetailScreen({
    super.key,
    required this.communityId,
    required this.communityName,
    this.coverImage,
  });

  @override
  State<CommunityDetailScreen> createState() => _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends State<CommunityDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _community;
  List<dynamic> _posts = [];
  List<dynamic> _members = [];
  bool _loading = true;
  bool _postsLoading = true;
  bool _membersLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      SocialService.getCommunityDetail(widget.communityId),
      _loadPosts(),
      _loadMembers(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        if (results[0]['success'] == true) {
          final data = results[0]['data'];
          _community = data is Map<String, dynamic> ? data : (data is Map ? data['community'] as Map<String, dynamic>? : null);
        }
      });
    }
  }

  Future<Map<String, dynamic>> _loadPosts() async {
    setState(() => _postsLoading = true);
    final res = await SocialService.getCommunityPosts(widget.communityId);
    if (mounted) {
      setState(() {
        _postsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _posts = data is List ? data : (data is Map ? (data['posts'] ?? []) : []);
        }
      });
    }
    return res;
  }

  Future<Map<String, dynamic>> _loadMembers() async {
    setState(() => _membersLoading = true);
    final res = await SocialService.getCommunityMembers(widget.communityId);
    if (mounted) {
      setState(() {
        _membersLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _members = data is List ? data : (data is Map ? (data['members'] ?? []) : []);
        }
      });
    }
    return res;
  }

  @override
  Widget build(BuildContext context) {
    final c = _community ?? <String, dynamic>{};
    final name = c['name']?.toString() ?? widget.communityName;
    final description = c['description']?.toString() ?? '';
    final memberCount = c['member_count'] ?? c['members_count'] ?? _members.length;
    // Web uses 'image' field, backend may also return 'cover_image' - check both
    final cover = c['image']?.toString() ?? c['cover_image']?.toString() ?? widget.coverImage;
    final isMember = c['is_member'] == true;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: NestedScrollView(
        headerSliverBuilder: (_, __) => [
          SliverAppBar(
            expandedHeight: cover != null && cover.isNotEmpty ? 180 : 100,
            pinned: true,
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            leading: IconButton(
              icon: SvgPicture.asset(
                'assets/icons/chevron-left-icon.svg',
                width: 22,
                height: 22,
                colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
              ),
              onPressed: () => Navigator.pop(context),
            ),
            title: Text(name, style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700)),
            flexibleSpace: cover != null && cover.isNotEmpty
                ? FlexibleSpaceBar(
                    background: CachedNetworkImage(
                      imageUrl: cover,
                      fit: BoxFit.cover,
                      color: Colors.black.withOpacity(0.3),
                      colorBlendMode: BlendMode.darken,
                      errorWidget: (_, __, ___) => Container(color: AppColors.primary),
                    ),
                  )
                : null,
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (description.isNotEmpty) ...[
                      Text(description, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textSecondary, height: 1.5)),
                      const SizedBox(height: 12),
                    ],
                    Row(children: [
                      const Icon(Icons.people_outline, size: 16, color: AppColors.textHint),
                      const SizedBox(width: 6),
                      Text('$memberCount members', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
                      const Spacer(),
                      if (!_loading)
                        GestureDetector(
                          onTap: () async {
                            if (isMember) {
                              await SocialService.leaveCommunity(widget.communityId);
                            } else {
                              await SocialService.joinCommunity(widget.communityId);
                            }
                            _load();
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                            decoration: BoxDecoration(
                              color: isMember ? AppColors.surfaceVariant : AppColors.primary,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              isMember ? 'Leave' : 'Join',
                              style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600,
                                  color: isMember ? AppColors.textSecondary : Colors.white),
                            ),
                          ),
                        ),
                    ]),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: TabBar(
              controller: _tabController,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.textTertiary,
              indicatorColor: AppColors.primary,
              labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
              tabs: [
                Tab(text: 'Posts (${_posts.length})'),
                Tab(text: 'Members (${_members.length})'),
                const Tab(text: 'About'),
              ],
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _postsTab(),
            _membersTab(),
            _aboutTab(c),
          ],
        ),
      ),
    );
  }

  Widget _postsTab() {
    if (_postsLoading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    if (_posts.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.forum_outlined, size: 32, color: AppColors.textHint),
        const SizedBox(height: 12),
        Text('No posts yet', style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text('Be the first to post in this community', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
      ]));
    }
    return RefreshIndicator(
      onRefresh: () => _loadPosts(),
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _posts.length,
        itemBuilder: (_, i) => _postCard(_posts[i]),
      ),
    );
  }

  Widget _postCard(dynamic post) {
    final p = post is Map<String, dynamic> ? post : <String, dynamic>{};
    final authorName = '${p['author']?['first_name'] ?? p['user']?['first_name'] ?? ''} ${p['author']?['last_name'] ?? p['user']?['last_name'] ?? ''}'.trim();
    final avatar = p['author']?['avatar']?.toString() ?? p['user']?['avatar']?.toString();
    final content = p['content']?.toString() ?? '';
    final createdAt = p['created_at']?.toString() ?? '';
    final glowCount = p['glow_count'] ?? p['likes_count'] ?? 0;
    final commentCount = p['comment_count'] ?? p['comments_count'] ?? 0;
    final images = p['images'] is List ? p['images'] as List : [];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
              clipBehavior: Clip.antiAlias,
              child: avatar != null && avatar.isNotEmpty
                  ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, width: 36, height: 36,
                      errorWidget: (_, __, ___) => _initials(authorName))
                  : _initials(authorName),
            ),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(authorName.isNotEmpty ? authorName : 'Member', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              if (createdAt.isNotEmpty)
                Text(SocialService.getTimeAgo(createdAt), style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textHint)),
            ])),
          ]),
          if (content.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(content, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.5)),
          ],
          if (images.isNotEmpty) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: CachedNetworkImage(
                imageUrl: images.first is Map ? (images.first['url'] ?? '') : images.first.toString(),
                width: double.infinity,
                height: 180,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.favorite_outline, size: 16, color: AppColors.textHint),
            const SizedBox(width: 4),
            Text('$glowCount', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
            const SizedBox(width: 16),
            const Icon(Icons.chat_bubble_outline, size: 16, color: AppColors.textHint),
            const SizedBox(width: 4),
            Text('$commentCount', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
          ]),
        ],
      ),
    );
  }

  Widget _membersTab() {
    if (_membersLoading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    if (_members.isEmpty) {
      return Center(child: Text('No members', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textTertiary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _members.length,
      itemBuilder: (_, i) {
        final m = _members[i] is Map<String, dynamic> ? _members[i] as Map<String, dynamic> : <String, dynamic>{};
        final name = '${m['first_name'] ?? ''} ${m['last_name'] ?? ''}'.trim();
        final username = m['username']?.toString() ?? '';
        final avatar = m['avatar']?.toString();

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
              clipBehavior: Clip.antiAlias,
              child: avatar != null && avatar.isNotEmpty
                  ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, width: 40, height: 40,
                      errorWidget: (_, __, ___) => _initials(name))
                  : _initials(name),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name.isNotEmpty ? name : 'Unknown', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              if (username.isNotEmpty)
                Text('@$username', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
            ])),
          ]),
        );
      },
    );
  }

  Widget _aboutTab(Map<String, dynamic> c) {
    final description = c['description']?.toString() ?? 'No description';
    final createdAt = c['created_at']?.toString() ?? '';
    final creator = c['creator'] is Map ? c['creator'] as Map<String, dynamic> : null;
    final creatorName = creator != null ? '${creator['first_name'] ?? ''} ${creator['last_name'] ?? ''}'.trim() : '';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _aboutRow('Description', description),
        if (creatorName.isNotEmpty) _aboutRow('Created by', creatorName),
        if (createdAt.isNotEmpty) _aboutRow('Created', createdAt.contains('T') ? createdAt.split('T').first : createdAt),
      ],
    );
  }

  Widget _aboutRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textHint, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        Text(value, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.5)),
      ]),
    );
  }

  Widget _initials(String name) {
    return Center(child: Text(
      name.isNotEmpty ? name[0].toUpperCase() : '?',
      style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary),
    ));
  }
}
