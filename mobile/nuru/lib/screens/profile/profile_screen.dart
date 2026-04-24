import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/api_service.dart';
import '../../core/services/events_service.dart';
import '../../core/services/social_service.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../settings/settings_screen.dart';
import '../events/event_detail_screen.dart';
import '../help/help_screen.dart';
import 'follow_list_screen.dart';
import 'widgets/profile_header_section.dart';
import 'widgets/profile_moments_tab.dart';
import 'widgets/profile_events_tab.dart';
import 'widgets/profile_settings_tab.dart';

class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic>? profile;
  final int myEventsCount;
  final VoidCallback? onRefresh;

  const ProfileScreen({super.key, this.profile, this.myEventsCount = 0, this.onRefresh});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _profileData;
  bool _profileLoading = true;
  List<dynamic> _moments = [];
  bool _momentsLoading = true;
  List<dynamic> _events = [];
  bool _eventsLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadProfileDetails().then((_) => _loadMoments());
    _loadEvents();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadMoments() async {
    setState(() => _momentsLoading = true);
    final userId = _profileData?['id']?.toString() ?? '';
    final res = userId.isNotEmpty
        ? await SocialService.getUserPosts(userId, limit: 30)
        : await SocialService.getMyPosts(limit: 30);
    if (mounted) {
      setState(() {
        _momentsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _moments = data is List ? data : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
        }
      });
    }
  }

  Future<void> _loadEvents() async {
    setState(() => _eventsLoading = true);
    final res = await EventsService.getMyEvents(limit: 20);
    if (mounted) {
      setState(() {
        _eventsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          if (data is List) { _events = data; }
          else if (data is Map) {
            final nested = data['data'];
            final extracted = data['events'] ?? data['items'] ?? (nested is Map ? (nested['events'] ?? nested['items']) : nested) ?? [];
            _events = extracted is List ? extracted : [];
          } else { _events = []; }
        }
      });
    }
  }

  Future<void> _loadProfileDetails() async {
    setState(() => _profileLoading = true);
    final meRes = await AuthApi.me();
    Map<String, dynamic>? userData;
    if (meRes['success'] == true && meRes['data'] is Map<String, dynamic>) {
      userData = meRes['data'] as Map<String, dynamic>;
    } else if (meRes['data'] is Map<String, dynamic> && meRes['data']['id'] != null) {
      userData = meRes['data'] as Map<String, dynamic>;
    }
    final profileRes = await EventsService.getProfile();
    if (profileRes['success'] == true && profileRes['data'] is Map<String, dynamic>) {
      userData = {...(userData ?? {}), ...profileRes['data'] as Map<String, dynamic>};
    }
    if (mounted) setState(() { _profileData = userData; _profileLoading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final p = _profileData ?? widget.profile ?? <String, dynamic>{};
    final firstName = p['first_name']?.toString() ?? '';
    final lastName = p['last_name']?.toString() ?? '';
    final fullName = '$firstName $lastName'.trim();
    final username = p['username']?.toString() ?? '';
    final avatar = p['avatar'] as String?;
    final coverImage = p['cover_image'] as String?;
    final bio = p['bio']?.toString() ?? '';
    final location = p['location']?.toString() ?? '';
    final phone = p['phone']?.toString() ?? '';
    final email = p['email']?.toString() ?? '';
    final website = p['website_url']?.toString() ?? p['website']?.toString() ?? '';
    final profileEventCount = (p['event_count'] ?? p['events_count'] ?? p['total_events'] ?? 0) as num;
    final eventCount = _events.isNotEmpty ? _events.length : (profileEventCount > 0 ? profileEventCount.toInt() : widget.myEventsCount);
    final followerCount = p['follower_count'] ?? p['followers_count'] ?? 0;
    final followingCount = p['following_count'] ?? 0;
    final momentsCount = p['post_count'] ?? p['posts_count'] ?? _moments.length;
    final socialLinks = p['social_links'] is Map ? p['social_links'] as Map<String, dynamic> : <String, dynamic>{};
    final userId = p['id']?.toString() ?? '';

    return RefreshIndicator(
      onRefresh: () async {
        widget.onRefresh?.call();
        await Future.wait([_loadProfileDetails(), _loadMoments(), _loadEvents()]);
      },
      color: AppColors.primary,
      // NestedScrollView lets the header (and the pinned TabBar) collapse as
      // the inner tab list scrolls down, AND lets a swipe-down on the inner
      // list reveal the header again. Fixes the "page sticks at the top and
      // I can no longer scroll back down" lockup caused by the previous
      // CustomScrollView + SliverFillRemaining(TabBarView) arrangement.
      child: NestedScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          SliverToBoxAdapter(child: ProfileHeaderSection(
            fullName: fullName,
            username: username,
            avatar: avatar,
            coverImage: coverImage,
            bio: bio,
            location: location,
            phone: phone,
            email: email,
            website: website,
            socialLinks: socialLinks,
            isLoading: _profileLoading,
            momentsCount: momentsCount,
            followerCount: followerCount,
            followingCount: followingCount,
            eventCount: eventCount,
            userId: userId,
            profile: p,
            onEditProfile: () => Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: p, onProfileUpdated: () => widget.onRefresh?.call()),
            )),
            onRefresh: widget.onRefresh,
          )),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Container(
                height: 42,
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 6)]),
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicatorPadding: const EdgeInsets.all(3),
                  dividerHeight: 0,
                  labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w500),
                  labelColor: AppColors.textPrimary,
                  unselectedLabelColor: AppColors.textTertiary,
                  tabs: [Tab(text: context.trw('moments')), Tab(text: context.trw('events')), Tab(text: context.trw('settings'))],
                ),
              ),
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            ProfileMomentsTab(moments: _moments, isLoading: _momentsLoading),
            ProfileEventsTab(events: _events, isLoading: _eventsLoading),
            ProfileSettingsTab(profile: p, onRefresh: widget.onRefresh),
          ],
        ),
      ),
    );
  }
}
