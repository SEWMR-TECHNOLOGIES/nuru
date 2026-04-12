import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/social_service.dart';
import 'community_detail_screen.dart';
import '../../core/l10n/l10n_helper.dart';

class CommunitiesScreen extends StatefulWidget {
  const CommunitiesScreen({super.key});

  @override
  State<CommunitiesScreen> createState() => _CommunitiesScreenState();
}

class _CommunitiesScreenState extends State<CommunitiesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _allCommunities = [];
  List<dynamic> _myCommunities = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      SocialService.getCommunities(),
      SocialService.getMyCommunities(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        if (results[0]['success'] == true) {
          final data = results[0]['data'];
          _allCommunities = data is List ? data : (data is Map ? (data['communities'] ?? []) : []);
        }
        if (results[1]['success'] == true) {
          final data = results[1]['data'];
          _myCommunities = data is List ? data : (data is Map ? (data['communities'] ?? []) : []);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(
        title: context.trw('communities'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: [
            Tab(text: context.trw('discover')),
            Tab(text: '${context.trw('joined')} (${_myCommunities.length})'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded, color: AppColors.primary),
            onPressed: _showCreateDialog,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : TabBarView(
              controller: _tabController,
              children: [
                _communityList(_allCommunities, isDiscover: true),
                _communityList(_myCommunities, isDiscover: false),
              ],
            ),
    );
  }

  Widget _communityList(List<dynamic> communities, {required bool isDiscover}) {
    if (communities.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(28)),
              child: const Icon(Icons.groups_outlined, size: 24, color: AppColors.textHint),
            ),
            const SizedBox(height: 14),
            Text(isDiscover ? context.trw('no_communities_found') : context.trw('not_joined_communities'),
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: communities.length,
        itemBuilder: (_, i) => _communityCard(communities[i], isDiscover: isDiscover),
      ),
    );
  }

  Widget _communityCard(dynamic community, {required bool isDiscover}) {
    final c = community is Map<String, dynamic> ? community : <String, dynamic>{};
    final name = c['name']?.toString() ?? 'Community';
    final description = c['description']?.toString() ?? '';
    final memberCount = c['member_count'] ?? c['members_count'] ?? 0;
    // Web uses 'image' field, backend may also return 'cover_image' - check both
    final cover = c['image']?.toString() ?? c['cover_image']?.toString();
    final id = c['id']?.toString() ?? '';
    final isMember = c['is_member'] == true;
    final myIds = _myCommunities.map((m) => (m is Map ? m['id']?.toString() : '')).toSet();
    final joined = isMember || myIds.contains(id);

    return GestureDetector(
      onTap: () {
        if (id.isNotEmpty) {
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => CommunityDetailScreen(
              communityId: id,
              communityName: name,
              coverImage: cover,
            ),
          ));
        }
      },
      child: Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (cover != null && cover.isNotEmpty)
            CachedNetworkImage(imageUrl: cover, width: double.infinity, height: 120, fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(height: 120, color: AppColors.surfaceVariant))
          else
            Container(
              height: 80,
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary.withOpacity(0.1), AppColors.primary.withOpacity(0.05)],
                ),
              ),
              child: Center(child: Icon(Icons.groups_outlined, size: 32, color: AppColors.primary.withOpacity(0.3))),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.3)),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(description, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary, height: 1.4)),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(Icons.people_outline, size: 14, color: AppColors.textHint),
                    const SizedBox(width: 4),
                    Text('$memberCount ${context.trw('members_count')}', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
                    const Spacer(),
                    GestureDetector(
                      onTap: () async {
                        if (joined) {
                          await SocialService.leaveCommunity(id);
                        } else {
                          await SocialService.joinCommunity(id);
                        }
                        _load();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: joined ? AppColors.surfaceVariant : AppColors.primary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          joined ? context.trw('leave') : context.trw('join'),
                          style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600,
                              color: joined ? AppColors.textSecondary : Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    );
  }

  void _showCreateDialog() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.trw('create_community'), style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: InputDecoration(hintText: 'Community name', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descCtrl,
              maxLines: 3,
              decoration: InputDecoration(hintText: 'Description', border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              await SocialService.createCommunity(name: nameCtrl.text.trim(), description: descCtrl.text.trim());
              _load();
            },
            child: Text(context.trw('create')),
          ),
        ],
      ),
    );
  }
}
