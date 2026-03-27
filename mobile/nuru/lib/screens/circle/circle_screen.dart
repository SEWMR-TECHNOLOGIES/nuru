import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/social_service.dart';

class CircleScreen extends StatefulWidget {
  const CircleScreen({super.key});

  @override
  State<CircleScreen> createState() => _CircleScreenState();
}

class _CircleScreenState extends State<CircleScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _circles = [];
  List<dynamic> _requests = [];
  bool _loading = true;
  bool _requestsLoading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
      SocialService.getCircles(),
      SocialService.getCircleRequests(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        if (results[0]['success'] == true) {
          final data = results[0]['data'];
          _circles = data is List ? data : (data is Map ? (data['circles'] ?? []) : []);
        }
        _requestsLoading = false;
        if (results[1]['success'] == true) {
          final data = results[1]['data'];
          _requests = data is List ? data : (data is Map ? (data['requests'] ?? []) : []);
        }
      });
    }
  }

  List<dynamic> get _members {
    if (_circles.isEmpty) return [];
    final circle = _circles[0] is Map ? _circles[0] : {};
    final members = circle['members'];
    if (members is! List) return [];
    if (_search.isEmpty) return members;
    return members.where((m) {
      final name = '${m['first_name'] ?? ''} ${m['last_name'] ?? ''}'.toLowerCase();
      return name.contains(_search.toLowerCase());
    }).toList();
  }

  Future<void> _removeMember(String memberId) async {
    if (_circles.isEmpty) return;
    final circleId = _circles[0]['id']?.toString() ?? '';
    if (circleId.isEmpty) return;
    final res = await SocialService.removeCircleMember(circleId, memberId);
    if (res['success'] == true) _load();
  }

  Future<void> _acceptRequest(String requestId) async {
    await SocialService.acceptCircleRequest(requestId);
    _load();
  }

  Future<void> _rejectRequest(String requestId) async {
    await SocialService.rejectCircleRequest(requestId);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(
        title: 'My Circle',
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: [
            Tab(text: 'Members (${_members.length})'),
            Tab(text: 'Requests (${_requests.length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : TabBarView(
              controller: _tabController,
              children: [_membersTab(), _requestsTab()],
            ),
    );
  }

  Widget _membersTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Container(
            height: 44,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              style: GoogleFonts.plusJakartaSans(fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search members...',
                hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textHint),
                prefixIcon: Padding(
                  padding: const EdgeInsets.all(12),
                  child: SvgPicture.asset('assets/icons/search-icon.svg', width: 18, height: 18,
                      colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),
        Expanded(
          child: _members.isEmpty
              ? Center(child: Text('No members in your circle', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textTertiary)))
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _members.length,
                    itemBuilder: (_, i) => _memberItem(_members[i]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _memberItem(dynamic member) {
    final m = member is Map<String, dynamic> ? member : <String, dynamic>{};
    final name = '${m['first_name'] ?? ''} ${m['last_name'] ?? ''}'.trim();
    final username = m['username']?.toString() ?? '';
    final avatar = m['avatar']?.toString();
    final id = m['id']?.toString() ?? m['user_id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
            clipBehavior: Clip.antiAlias,
            child: avatar != null && avatar.isNotEmpty
                ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, width: 44, height: 44,
                    errorWidget: (_, __, ___) => _initials(name))
                : _initials(name),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name.isNotEmpty ? name : 'Unknown', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                if (username.isNotEmpty)
                  Text('@$username', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _removeMember(id),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(8)),
              child: Text('Remove', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.error)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _requestsTab() {
    if (_requests.isEmpty) {
      return Center(child: Text('No pending requests', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textTertiary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _requests.length,
      itemBuilder: (_, i) {
        final r = _requests[i] is Map<String, dynamic> ? _requests[i] as Map<String, dynamic> : <String, dynamic>{};
        final sender = r['sender'] is Map ? r['sender'] as Map<String, dynamic> : <String, dynamic>{};
        final name = '${sender['first_name'] ?? ''} ${sender['last_name'] ?? ''}'.trim();
        final avatar = sender['avatar']?.toString();
        final reqId = r['id']?.toString() ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.borderLight)),
          child: Row(
            children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
                clipBehavior: Clip.antiAlias,
                child: avatar != null && avatar.isNotEmpty
                    ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, width: 44, height: 44, errorWidget: (_, __, ___) => _initials(name))
                    : _initials(name),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(name.isNotEmpty ? name : 'Unknown', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary))),
              GestureDetector(
                onTap: () => _acceptRequest(reqId),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                  child: Text('Accept', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white)),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () => _rejectRequest(reqId),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(8)),
                  child: Text('Decline', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _initials(String name) {
    return Center(child: Text(
      name.isNotEmpty ? name[0].toUpperCase() : '?',
      style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textTertiary),
    ));
  }
}
