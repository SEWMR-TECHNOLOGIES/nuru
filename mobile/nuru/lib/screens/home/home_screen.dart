import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/api_service.dart';
import '../../core/services/events_service.dart';
import '../../core/services/social_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/services/ticketing_service.dart';
import '../../core/services/user_services_service.dart';
import '../../core/widgets/premium_button.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../events/event_detail_screen.dart' show EventDetailScreen, CreateEventScreen;
import '../events/event_public_view_screen.dart';
import '../settings/settings_screen.dart';
import '../messages/messages_screen.dart';
import '../profile/profile_screen.dart';
import '../search/search_screen.dart';
import '../services/find_services_screen.dart';
import '../services/public_service_screen.dart';
import '../services/my_services_screen.dart';
import '../help/help_screen.dart';
import '../issues/my_issues_screen.dart';
import '../circle/circle_screen.dart';
import '../communities/communities_screen.dart';
import '../cards/nuru_cards_screen.dart';
import '../tickets/browse_tickets_screen.dart';
import '../tickets/my_tickets_screen.dart';
import '../contributors/contributors_screen.dart';
import '../removed/removed_content_screen.dart';
import '../public_profile/public_profile_screen.dart';
import 'widgets/moment_card.dart';
import 'widgets/post_detail_modal.dart';
import 'widgets/create_post_box.dart';
import 'widgets/event_card.dart';
import 'widgets/stats_row.dart';
import 'widgets/pill_tabs.dart';
import 'widgets/shared_widgets.dart';

/// Main workspace — clean, minimal, premium
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  // Data
  bool _loading = true;
  Map<String, dynamic>? _profile;
  List<dynamic> _feedPosts = [];
  bool _feedLoading = true;
  bool _feedLoadingMore = false;
  int _feedPage = 1;
  int _feedTotalPages = 1;
  List<dynamic> _myEvents = [];
  List<dynamic> _invitedEvents = [];
  List<dynamic> _committeeEvents = [];
  List<dynamic> _notifications = [];
  int _unreadNotifications = 0;
  bool _notificationsLoading = true;
  List<dynamic> _followSuggestions = [];
  int _unreadMessages = 0;
  List<dynamic> _upcomingTickets = [];
  List<dynamic> _ticketedEvents = [];
  List<dynamic> _myServices = [];

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _loading = true);
    await Future.wait([
      _loadProfile(),
      _loadFeed(),
      _loadEvents(),
      _loadNotifications(),
      _loadFollowSuggestions(),
      _loadUnreadMessages(),
      _loadUpcomingTickets(),
      _loadTicketedEvents(),
      _loadMyServices(),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadProfile() async {
    // Use /auth/me first (same as web useCurrentUser), then merge /users/profile
    final meRes = await AuthApi.me();
    Map<String, dynamic>? userData;
    if (meRes['success'] == true && meRes['data'] is Map<String, dynamic>) {
      userData = meRes['data'] as Map<String, dynamic>;
    } else if (meRes['data'] is Map<String, dynamic> && meRes['data']['id'] != null) {
      userData = meRes['data'] as Map<String, dynamic>;
    }

    // Also fetch /users/profile for additional fields (avatar, bio, etc.)
    final profileRes = await EventsService.getProfile();
    if (profileRes['success'] == true && profileRes['data'] is Map<String, dynamic>) {
      final profileData = profileRes['data'] as Map<String, dynamic>;
      userData = {...(userData ?? {}), ...profileData};
    }

    if (mounted && userData != null) {
      setState(() => _profile = userData);
    }
  }

  Future<void> _loadFeed({bool refresh = true}) async {
    if (refresh)
      setState(() {
        _feedLoading = true;
        _feedPage = 1;
      });
    final res = await SocialService.getFeed(page: _feedPage, limit: 15);
    if (mounted) {
      setState(() {
        _feedLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          final items = data is Map
              ? (data['items'] ?? data['posts'] ?? [])
              : (data is List ? data : []);
          if (refresh) {
            _feedPosts = items is List ? items : [];
          } else {
            _feedPosts = [..._feedPosts, ...(items is List ? items : [])];
          }
          final pagination = data is Map ? data['pagination'] : null;
          _feedPage = pagination?['page'] ?? _feedPage;
          _feedTotalPages = pagination?['pages'] ?? 1;
        }
        if (_feedPosts.isEmpty && refresh) _loadTrendingFallback();
      });
    }
  }

  Future<void> _loadTrendingFallback() async {
    final res = await SocialService.getExplore(limit: 15);
    if (mounted && res['success'] == true) {
      final data = res['data'];
      final items = data is List
          ? data
          : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
      setState(() => _feedPosts = items is List ? items : []);
    }
  }

  Future<void> _loadMoreFeed() async {
    if (_feedLoadingMore || _feedPage >= _feedTotalPages) return;
    setState(() => _feedLoadingMore = true);
    _feedPage++;
    final res = await SocialService.getFeed(page: _feedPage, limit: 15);
    if (mounted) {
      setState(() {
        _feedLoadingMore = false;
        if (res['success'] == true) {
          final data = res['data'];
          final items = data is Map
              ? (data['items'] ?? data['posts'] ?? [])
              : (data is List ? data : []);
          _feedPosts = [..._feedPosts, ...(items is List ? items : [])];
          final pagination = data is Map ? data['pagination'] : null;
          _feedTotalPages = pagination?['pages'] ?? _feedTotalPages;
        }
      });
    }
  }

  Future<void> _loadEvents() async {
    final results = await Future.wait([
      EventsService.getMyEvents(limit: 20),
      EventsService.getInvitedEvents(limit: 20),
      EventsService.getCommitteeEvents(limit: 20),
    ]);
    if (mounted) {
      setState(() {
        _myEvents = _extractEvents(results[0]);
        _invitedEvents = _extractEvents(results[1]);
        _committeeEvents = _extractEvents(results[2]);
      });
    }
  }

  Future<void> _loadNotifications() async {
    setState(() => _notificationsLoading = true);
    final res = await SocialService.getNotifications(limit: 30);
    if (mounted) {
      setState(() {
        _notificationsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _notifications = data is Map
              ? (data['notifications'] ?? [])
              : (data is List ? data : []);
          _unreadNotifications = data is Map ? (data['unread_count'] ?? 0) : 0;
        }
      });
    }
  }

  Future<void> _loadFollowSuggestions() async {
    final res = await SocialService.getFollowSuggestions(limit: 5);
    if (mounted && res['success'] == true) {
      final data = res['data'];
      setState(() => _followSuggestions = data is List ? data : []);
    }
  }

  Future<void> _loadUnreadMessages() async {
    final count = await MessagesService.getUnreadCount();
    if (mounted) setState(() => _unreadMessages = count);
  }

  Future<void> _loadUpcomingTickets() async {
    final res = await TicketingService.getMyUpcomingTickets();
    if (mounted && res['success'] == true) {
      final data = res['data'];
      setState(() => _upcomingTickets = data is List ? data : (data is Map ? (data['tickets'] ?? []) : []));
    }
  }

  Future<void> _loadTicketedEvents() async {
    final res = await TicketingService.getTicketedEvents(limit: 5);
    if (mounted && res['success'] == true) {
      final data = res['data'];
      setState(() => _ticketedEvents = data is List ? data : (data is Map ? (data['events'] ?? []) : []));
    }
  }

  Future<void> _loadMyServices() async {
    final res = await UserServicesService.getServiceProviders(limit: 20);
    if (!mounted) return;
    final data = res['data'] ?? res;
    if (data is List) {
      setState(() => _myServices = data);
      return;
    }
    if (data is Map) {
      final nested = data['data'];
      final services = data['services'] ?? data['items'] ?? (nested is Map ? (nested['services'] ?? nested['items']) : nested);
      setState(() => _myServices = services is List ? services : []);
      return;
    }
    setState(() => _myServices = []);
  }

  List<dynamic> _extractEvents(Map<String, dynamic> res) {
    if (res['success'] != true) return [];
    final data = res['data'];
    if (data is List) return data;
    if (data is Map) return data['events'] ?? [];
    return [];
  }

  int get _totalEvents => _myEvents.length;
  int get _upcomingEvents => _myEvents.where((e) {
    final s = e['status']?.toString() ?? '';
    if (s == 'cancelled' || s == 'draft') return false;
    final d = e['start_date'] ?? '';
    if (d.isEmpty) return true;
    try {
      return DateTime.parse(d).isAfter(DateTime.now());
    } catch (_) {
      return false;
    }
  }).length;

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarIconBrightness: Brightness.dark,
        systemNavigationBarContrastEnforced: false,
      ),
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: AppColors.surface,
        extendBody: true,
        extendBodyBehindAppBar: true,
        drawer: _buildLeftDrawer(),
        endDrawer: _buildRightDrawer(),
        body: Column(
          children: [
            _buildHeader(topPadding),
            Expanded(
              child: IndexedStack(
                index: _tab,
                children: [
                  _feedContent(),
                  _eventsContent(),
                  const MessagesScreen(),
                  _notificationsContent(),
                  _profileContent(),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: _buildBottomNav(bottomPadding),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER — extends behind status bar
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildHeader(double topPadding) {
    final auth = context.watch<AuthProvider>();
    final name = _profile?['first_name'] ?? auth.userName ?? '';
    final avatar = (_profile?['avatar'] as String?) ?? auth.userAvatar;

    return Container(
      padding: EdgeInsets.only(
        top: topPadding + 8,
        left: 16,
        right: 16,
        bottom: 12,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: const Border(
          bottom: BorderSide(color: AppColors.borderLight, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          _headerIconButton(
            svgAsset: 'assets/icons/menu-icon.svg',
            onTap: () => _scaffoldKey.currentState?.openDrawer(),
          ),
          const SizedBox(width: 12),

          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.asset(
              'assets/images/nuru-logo-square.png',
              width: 72,
              height: 72,
              errorBuilder: (_, __, ___) => Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Text(
                    'N',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),

          const Spacer(),

          _headerIconButton(
            svgAsset: 'assets/icons/search-icon.svg',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SearchScreen()),
            ),
          ),
          const SizedBox(width: 6),

          _headerIconButton(
            svgAsset: 'assets/icons/bell-icon.svg',
            onTap: () => setState(() => _tab = 3),
            badge: _unreadNotifications,
          ),
          const SizedBox(width: 6),

          _headerIconButton(
            svgAsset: 'assets/icons/panel-right-icon.svg',
            onTap: () => _scaffoldKey.currentState?.openEndDrawer(),
          ),
          const SizedBox(width: 10),

          GestureDetector(
            onTap: () => setState(() => _tab = 4),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border, width: 1.5),
              ),
              child: ClipOval(
                child: SizedBox(
                  width: 32,
                  height: 32,
                  child: avatar != null && avatar.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: avatar,
                          width: 32,
                          height: 32,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _avatarFallback(name),
                        )
                      : _avatarFallback(name),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _headerIconButton({
    required String svgAsset,
    required VoidCallback onTap,
    int badge = 0,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Center(
              child: SvgPicture.asset(
                svgAsset,
                width: 20,
                height: 20,
                colorFilter: const ColorFilter.mode(
                  AppColors.textSecondary,
                  BlendMode.srcIn,
                ),
              ),
            ),
          ),
          if (badge > 0)
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: AppColors.secondary,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.surface, width: 2),
                ),
                child: Center(
                  child: Text(
                    badge > 9 ? '9+' : '$badge',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1.0,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.textSecondary,
            height: 1.0,
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM NAV — extends behind nav bar
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildBottomNav(double bottomPadding) {
    final items = [
      _NavItem('assets/icons/home-icon.svg', 'Home'),
      _NavItem('assets/icons/calendar-icon.svg', 'Events'),
      _NavItem('assets/icons/chat-icon.svg', 'Messages'),
      _NavItem('assets/icons/bell-icon.svg', 'Alerts'),
      _NavItem('assets/icons/user-profile-icon.svg', 'Profile'),
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(
          top: BorderSide(color: AppColors.borderLight, width: 0.5),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.only(
          top: 8,
          bottom: bottomPadding + 6,
          left: 8,
          right: 8,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: items.asMap().entries.map((entry) {
            final i = entry.key;
            final item = entry.value;
            final isActive = i == _tab;
            final badge = i == 2
                ? _unreadMessages
                : (i == 3 ? _unreadNotifications : 0);

            return GestureDetector(
              onTap: () {
                setState(() => _tab = i);
                if (i == 2) _loadUnreadMessages();
              },
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (item.svgAsset != null)
                          SvgPicture.asset(
                            item.svgAsset!,
                            width: 22,
                            height: 22,
                            colorFilter: ColorFilter.mode(
                              isActive ? AppColors.primary : AppColors.textHint,
                              BlendMode.srcIn,
                            ),
                          ),
                        const SizedBox(height: 4),
                        Text(
                          item.label,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 9,
                            fontWeight: isActive
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: isActive
                                ? AppColors.primary
                                : AppColors.textHint,
                            height: 1.0,
                          ),
                        ),
                      ],
                    ),
                    if (badge > 0)
                      Positioned(
                        top: -4,
                        right: -8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.secondary,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: AppColors.surface,
                              width: 1.5,
                            ),
                          ),
                          child: Text(
                            badge > 9 ? '9+' : '$badge',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 8,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              height: 1.0,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEFT DRAWER
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildLeftDrawer() {
    final auth = context.watch<AuthProvider>();
    final name = _profile?['first_name'] ?? auth.userName ?? '';
    final lastName = _profile?['last_name'] ?? '';
    final fullName = '$name $lastName'.trim();
    final username = _profile?['username'] ?? '';
    final avatar = (_profile?['avatar'] as String?) ?? auth.userAvatar;

    return Drawer(
      width: 290,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Column(
        children: [
          // Profile header with status bar padding
          Container(
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 16,
              left: 20,
              right: 20,
              bottom: 16,
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.border, width: 1.5),
                  ),
                  child: ClipOval(
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: avatar != null && avatar.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: avatar,
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) =>
                                  _avatarFallback(fullName),
                            )
                          : _avatarFallback(fullName),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fullName.isNotEmpty ? fullName : 'Welcome',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                          height: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (username.isNotEmpty)
                        Text(
                          '@$username',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: AppColors.textTertiary,
                            height: 1.3,
                          ),
                        ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: SvgPicture.asset(
                    'assets/icons/close-icon.svg',
                    width: 20,
                    height: 20,
                    colorFilter: const ColorFilter.mode(
                      AppColors.textHint,
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(color: AppColors.borderLight, height: 1),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _drawerSection('Main'),
                _modernDrawerItem(
                  'assets/icons/home-icon.svg',
                  'Home',
                  isActive: _tab == 0,
                  onTap: () => _selectTab(0),
                ),
                _modernDrawerItem(
                  'assets/icons/calendar-icon.svg',
                  'My Events',
                  isActive: _tab == 1,
                  onTap: () => _selectTab(1),
                ),
                _modernDrawerItem(
                  'assets/icons/chat-icon.svg',
                  'Messages',
                  isActive: _tab == 2,
                  onTap: () => _selectTab(2),
                  badge: _unreadMessages,
                ),
                _modernDrawerItem(
                  'assets/icons/bell-icon.svg',
                  'Notifications',
                  isActive: _tab == 3,
                  onTap: () => _selectTab(3),
                  badge: _unreadNotifications,
                ),

                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CreateEventScreen(),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.add_rounded,
                            size: 18,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Create Event',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                _drawerSection('Discover'),
                _modernDrawerItem(
                  'assets/icons/ticket-icon.svg',
                  'Browse Tickets',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const BrowseTicketsScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/search-icon.svg',
                  'Find Services',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const FindServicesScreen()));
                  },
                ),

                _drawerSection('Your Space'),
                _modernDrawerItem(
                  'assets/icons/settings-icon.svg',
                  'My Services',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const MyServicesScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/card-icon.svg',
                  'Nuru Pass',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const NuruCardsScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/circle-icon.svg',
                  'My Circle',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const CircleScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/contributors-icon.svg',
                  'Contributors',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ContributorsScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/communities-icon.svg',
                  'Communities',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const CommunitiesScreen()));
                  },
                ),

                _drawerSection('Support'),
                _modernDrawerItem(
                  'assets/icons/issue-icon.svg',
                  'My Issues',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const MyIssuesScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/close-icon.svg',
                  'Removed Content',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const RemovedContentScreen()));
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/help-icon.svg',
                  'Help',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const HelpScreen()),
                    );
                  },
                ),
                _modernDrawerItem(
                  'assets/icons/settings-icon.svg',
                  'Settings',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SettingsScreen(
                          profile: _profile,
                          onProfileUpdated: _loadAllData,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          const Divider(color: AppColors.borderLight, height: 1),
          Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 14,
              bottom: 8,
            ),
            child: GestureDetector(
              onTap: () => _selectTab(4),
              child: Row(
                children: [
                  SvgPicture.asset(
                    'assets/icons/user-profile-icon.svg',
                    width: 18,
                    height: 18,
                    colorFilter: const ColorFilter.mode(
                      AppColors.textSecondary,
                      BlendMode.srcIn,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Your Profile',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                        height: 1.2,
                      ),
                    ),
                  ),
                  SvgPicture.asset(
                    'assets/icons/chevron-right-icon.svg',
                    width: 18,
                    height: 18,
                    colorFilter: const ColorFilter.mode(
                      AppColors.textHint,
                      BlendMode.srcIn,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Sign Out button
          Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 4,
              bottom: MediaQuery.of(context).padding.bottom + 14,
            ),
            child: GestureDetector(
              onTap: () async {
                Navigator.pop(context);
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    title: Text('Sign Out', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
                    content: Text('Are you sure you want to sign out?', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textSecondary)),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textTertiary))),
                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text('Sign Out', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.error))),
                    ],
                  ),
                );
                if (confirmed == true && context.mounted) {
                  final auth = context.read<AuthProvider>();
                  await auth.signOut();
                  if (context.mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (_) => false,
                    );
                  }
                }
              },
              child: Row(
                children: [
                  SvgPicture.asset(
                    'assets/icons/logout-icon.svg',
                    width: 18,
                    height: 18,
                    colorFilter: const ColorFilter.mode(
                      AppColors.error,
                      BlendMode.srcIn,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Sign Out',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.error,
                        height: 1.2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _drawerSection(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
      child: Text(
        title,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: AppColors.textHint,
          letterSpacing: 1.2,
          height: 1.0,
        ),
      ),
    );
  }

  Widget _modernDrawerItem(
    String svgAsset,
    String label, {
    bool isActive = false,
    VoidCallback? onTap,
    int badge = 0,
  }) {
    return GestureDetector(
      onTap:
          onTap ??
          () {
            Navigator.pop(context);
          },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primarySoft : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            SvgPicture.asset(
              svgAsset,
              width: 20,
              height: 20,
              colorFilter: ColorFilter.mode(
                isActive ? AppColors.primary : AppColors.textSecondary,
                BlendMode.srcIn,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                  color: isActive ? AppColors.primary : AppColors.textPrimary,
                  height: 1.3,
                ),
              ),
            ),
            if (badge > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.secondary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$badge',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    height: 1.0,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _modernDrawerItemIcon(
    IconData icon,
    String label, {
    bool isActive = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap:
          onTap ??
          () {
            Navigator.pop(context);
          },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primarySoft : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 20,
              color: isActive ? AppColors.primary : AppColors.textSecondary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                  color: isActive ? AppColors.primary : AppColors.textPrimary,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _selectTab(int index) {
    setState(() => _tab = index);
    Navigator.pop(context);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RIGHT DRAWER
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildRightDrawer() {
    final upcomingEvents = _mergeUpcomingEvents();

    return Drawer(
      width: 300,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          bottomLeft: Radius.circular(20),
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 16,
              left: 20,
              right: 16,
              bottom: 16,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Quick View',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                      height: 1.2,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: SvgPicture.asset(
                    'assets/icons/close-icon.svg',
                    width: 20,
                    height: 20,
                    colorFilter: const ColorFilter.mode(
                      AppColors.textHint,
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: AppColors.borderLight, height: 1),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (upcomingEvents.isNotEmpty) ...[
                  Row(
                    children: [
                      SvgPicture.asset(
                        'assets/icons/calendar-icon.svg',
                        width: 16,
                        height: 16,
                        colorFilter: const ColorFilter.mode(
                          AppColors.textPrimary,
                          BlendMode.srcIn,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Upcoming Events',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            height: 1.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ...upcomingEvents.take(6).map((item) {
                    final e = item['event'] as Map<String, dynamic>;
                    final role = item['role'] as String;
                    final title = e['title'] ?? e['name'] ?? 'Untitled';
                    final date = e['start_date'] ?? '';
                    final cover = e['cover_image'] as String?;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => role == 'guest'
                                  ? EventPublicViewScreen(eventId: e['id'].toString(), initialData: e)
                                  : EventDetailScreen(eventId: e['id'].toString(), initialData: e, knownRole: role),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: AppColors.borderLight,
                              width: 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceVariant,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: cover != null
                                    ? Image.network(
                                        cover,
                                        width: 44,
                                        height: 44,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => Center(
                                          child: SvgPicture.asset(
                                            'assets/icons/calendar-icon.svg',
                                            width: 18,
                                            height: 18,
                                            colorFilter: const ColorFilter.mode(
                                              AppColors.textHint,
                                              BlendMode.srcIn,
                                            ),
                                          ),
                                        ),
                                      )
                                    : Center(
                                        child: SvgPicture.asset(
                                          'assets/icons/calendar-icon.svg',
                                          width: 18,
                                          height: 18,
                                          colorFilter: const ColorFilter.mode(
                                            AppColors.textHint,
                                            BlendMode.srcIn,
                                          ),
                                        ),
                                      ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      title.toString(),
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textPrimary,
                                        height: 1.3,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      _formatDateShort(date.toString()),
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        color: AppColors.textTertiary,
                                        height: 1.2,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceVariant,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  role.toString(),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.textTertiary,
                                    height: 1.0,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ],

                // ── My Tickets Section ──
                if (_upcomingTickets.isNotEmpty) ...[
                  Row(
                    children: [
                      SvgPicture.asset('assets/icons/ticket-icon.svg', width: 16, height: 16,
                        colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('My Tickets', style: GoogleFonts.plusJakartaSans(
                          fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2)),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const MyTicketsScreen()));
                        },
                        child: Text('View all', style: GoogleFonts.plusJakartaSans(
                          fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ..._upcomingTickets.take(3).map((ticket) {
                    final t = ticket is Map<String, dynamic> ? ticket : <String, dynamic>{};
                    final event = t['event'] is Map<String, dynamic> ? t['event'] as Map<String, dynamic> : t;
                    final eventName = event['name']?.toString() ?? t['event_name']?.toString() ?? 'Event';
                    final coverImage = event['cover_image']?.toString() ?? '';
                    final startDate = event['start_date']?.toString() ?? '';
                    final startTime = event['start_time']?.toString() ?? '';
                    final ticketCode = t['ticket_code']?.toString() ?? '';
                    final status = t['status']?.toString() ?? 'pending';
                    final quantity = t['quantity'] ?? 1;
                    DateTime? d;
                    try { d = DateTime.parse(startDate); } catch (_) {}
                    final isToday = d != null && d.year == DateTime.now().year && d.month == DateTime.now().month && d.day == DateTime.now().day;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          final eventId = event['id']?.toString();
                          if (eventId != null && eventId.isNotEmpty) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => EventPublicViewScreen(eventId: eventId)));
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                          child: Row(
                            children: [
                              // Thumbnail with today indicator
                              Stack(
                                children: [
                                  Container(
                                    width: 44, height: 44,
                                    decoration: BoxDecoration(
                                      color: AppColors.surfaceVariant,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    child: coverImage.isNotEmpty
                                        ? CachedNetworkImage(imageUrl: coverImage, fit: BoxFit.cover, width: 44, height: 44,
                                            errorWidget: (_, __, ___) => Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 18, height: 18,
                                              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))))
                                        : Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 18, height: 18,
                                            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
                                  ),
                                  if (isToday)
                                    Positioned(top: 0, right: 0,
                                      child: Container(width: 10, height: 10,
                                        decoration: BoxDecoration(color: AppColors.success, shape: BoxShape.circle,
                                          border: Border.all(color: AppColors.surface, width: 2)))),
                                ],
                              ),
                              const SizedBox(width: 10),
                              // Info
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(child: Text(eventName, maxLines: 1, overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary))),
                                        // Print button (matches web sidebar)
                                        GestureDetector(
                                          onTap: () {
                                            Navigator.pop(context);
                                            Navigator.push(context, MaterialPageRoute(builder: (_) => const MyTicketsScreen()));
                                          },
                                          child: Padding(
                                            padding: const EdgeInsets.all(4),
                                            child: SvgPicture.asset('assets/icons/print-icon.svg', width: 14, height: 14,
                                              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Row(children: [
                                      Text(
                                        isToday ? 'Today' : (d != null ? _formatDateShort(startDate) : 'Date TBD'),
                                        style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary)),
                                      if (startTime.isNotEmpty && startTime.length >= 5) ...[
                                        Text(' · ${startTime.substring(0, 5)}',
                                          style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary)),
                                      ],
                                    ]),
                                    const SizedBox(height: 4),
                                    // Ticket code + status + quantity badges
                                    Wrap(
                                      spacing: 4,
                                      runSpacing: 2,
                                      children: [
                                        if (ticketCode.isNotEmpty)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                            decoration: BoxDecoration(
                                              border: Border.all(color: AppColors.borderLight),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(ticketCode, style: GoogleFonts.jetBrainsMono(
                                              fontSize: 9, fontWeight: FontWeight.w500, color: AppColors.textPrimary, letterSpacing: 0.5)),
                                          ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceVariant,
                                            border: Border.all(color: AppColors.borderLight),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(status, style: GoogleFonts.plusJakartaSans(
                                            fontSize: 9, color: AppColors.textTertiary)),
                                        ),
                                        if (quantity > 1)
                                          Text('×$quantity', style: GoogleFonts.plusJakartaSans(
                                            fontSize: 9, color: AppColors.textTertiary)),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ],

                // ── Ticketed Events Section ──
                if (_ticketedEvents.isNotEmpty) ...[
                  Row(
                    children: [
                      SvgPicture.asset('assets/icons/ticket-icon.svg', width: 16, height: 16,
                        colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('Events with Tickets', style: GoogleFonts.plusJakartaSans(
                          fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2)),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const BrowseTicketsScreen()));
                        },
                        child: Text('View all', style: GoogleFonts.plusJakartaSans(
                          fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ..._ticketedEvents.take(5).map((event) {
                    final e = event is Map<String, dynamic> ? event : <String, dynamic>{};
                    final coverImage = e['cover_image']?.toString() ?? '';
                    final eventName = e['name']?.toString() ?? e['title']?.toString() ?? 'Event';
                    final startDate = e['start_date']?.toString() ?? '';
                    final minPrice = e['min_price'];
                    final soldOut = (e['total_available'] ?? 0) <= 0;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: GestureDetector(
                        onTap: () {
                          Navigator.pop(context);
                          final eventId = e['id']?.toString();
                          if (eventId != null && eventId.isNotEmpty) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => EventPublicViewScreen(eventId: eventId)));
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.borderLight, width: 1),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceVariant,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: coverImage.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: coverImage,
                                        fit: BoxFit.cover,
                                        errorWidget: (_, __, ___) => Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 18, height: 18,
                                          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
                                      )
                                    : Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 18, height: 18,
                                        colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(eventName, style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.3),
                                      maxLines: 1, overflow: TextOverflow.ellipsis),
                                    if (startDate.isNotEmpty) ...[
                                      const SizedBox(height: 2),
                                      Text(_formatDateShort(startDate), style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10, color: AppColors.textTertiary, height: 1.2)),
                                    ],
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        if (minPrice != null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppColors.surfaceVariant,
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: Text('From ${_formatCompactMoney(minPrice)}', style: GoogleFonts.plusJakartaSans(
                                              fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                                          ),
                                        if (soldOut) ...[
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: AppColors.error.withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: Text('Sold Out', style: GoogleFonts.plusJakartaSans(
                                              fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.error)),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ],

                // ── Service Providers Section ──
                if (_myServices.isNotEmpty) ...[
                  Row(children: [
                    const Icon(Icons.work_outline_rounded, size: 16, color: AppColors.textPrimary),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Service Providers', style: GoogleFonts.plusJakartaSans(
                      fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2))),
                  ]),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: _myServices.take(4).map((service) {
                      final s = service is Map<String, dynamic> ? service : <String, dynamic>{};
                      final title = s['title']?.toString() ?? s['name']?.toString() ?? 'Service';
                      final initials = title.split(' ').map((w) => w.isNotEmpty ? w[0] : '').join('').toUpperCase();
                      final imgUrl = _extractServiceImage(s);
                      return GestureDetector(
                        onTap: () {
                          final svcId = s['id']?.toString();
                          Navigator.pop(context);
                          if (svcId != null && svcId.isNotEmpty) {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => PublicServiceScreen(serviceId: svcId)));
                          }
                        },
                        child: SizedBox(
                          width: 110,
                          child: Column(children: [
                            Container(
                              width: 56, height: 56,
                              decoration: BoxDecoration(
                                color: AppColors.surfaceVariant,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: imgUrl != null
                                  ? Image.network(imgUrl, width: 56, height: 56, fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Center(child: Text(initials,
                                          style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary))))
                                  : Center(child: Text(initials,
                                      style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary))),
                            ),
                            const SizedBox(height: 6),
                            Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                              textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis),
                          ]),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                ],

                if (_followSuggestions.isNotEmpty) ...[
                  Row(
                    children: [
                      const Icon(
                        Icons.people_outline_rounded,
                        size: 16,
                        color: AppColors.textPrimary,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Suggested for You',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            height: 1.2,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ..._followSuggestions.map((user) {
                    final firstName = user['first_name'] ?? '';
                    final lastName = user['last_name'] ?? '';
                    final fullName = '$firstName $lastName'.trim();
                    final username = user['username'] ?? '';
                    final avatar = user['avatar'] as String?;
                    final isVerified = user['is_identity_verified'] == true;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.borderLight,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: avatar != null
                                  ? CachedNetworkImage(
                                      imageUrl: avatar,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) =>
                                          _smallAvatar(fullName),
                                    )
                                  : _smallAvatar(fullName),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          fullName,
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textPrimary,
                                            height: 1.3,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      // Verification badge removed
                                    ],
                                  ),
                                  if (username.isNotEmpty)
                                    Text(
                                      '@$username',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        color: AppColors.textTertiary,
                                        height: 1.2,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            GestureDetector(
                              onTap: () async {
                                final id = user['id']?.toString() ?? '';
                                if (id.isEmpty) return;
                                await SocialService.followUser(id);
                                setState(() => _followSuggestions.remove(user));
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Follow',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                    height: 1.0,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],

                if (upcomingEvents.isEmpty && _followSuggestions.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Column(
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceVariant,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(
                              Icons.dashboard_outlined,
                              size: 24,
                              color: AppColors.textHint,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'All caught up!',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Nothing here yet',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 12,
                              color: AppColors.textTertiary,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _smallAvatar(String name) {
    return Container(
      width: 38,
      height: 38,
      color: AppColors.surfaceMuted,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textSecondary,
            height: 1.0,
          ),
        ),
      ),
    );
  }

  String? _extractServiceImage(Map<String, dynamic> s) {
    final primary = s['primary_image'];
    if (primary is Map) return primary['thumbnail_url']?.toString() ?? primary['url']?.toString();
    if (primary is String && primary.isNotEmpty) return primary;
    final images = s['images'];
    if (images is List && images.isNotEmpty) {
      final first = images.first;
      if (first is Map) return first['thumbnail_url']?.toString() ?? first['url']?.toString();
      if (first is String) return first;
    }
    return s['cover_image']?.toString() ?? s['image_url']?.toString();
  }

  // FEED TAB
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _feedContent() {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification &&
            notification.metrics.pixels >=
                notification.metrics.maxScrollExtent - 300 &&
            _feedPage < _feedTotalPages &&
            !_feedLoadingMore) {
          _loadMoreFeed();
        }
        return false;
      },
      child: RefreshIndicator(
        onRefresh: () => _loadFeed(refresh: true),
        color: AppColors.primary,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          itemCount:
              _feedPosts.length +
              2 +
              (_feedLoadingMore ? 1 : 0) +
              (!_feedLoading && _feedPosts.isEmpty ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: CreatePostBox(
                  onPostCreated: () => _loadFeed(refresh: true),
                ),
              );
            }

            if (index == 1 && _feedLoading) {
              return Column(
                children: List.generate(
                  3,
                  (_) => const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: ShimmerCard(height: 220),
                  ),
                ),
              );
            }

            if (index == 1 && !_feedLoading && _feedPosts.isEmpty) {
              return const EmptyState(
                icon: Icons.dynamic_feed_rounded,
                title: 'No posts yet',
                subtitle: 'Be the first to share something with the community!',
              );
            }

            if (index == 1) return const SizedBox.shrink();

            final postIndex = index - 2;
            if (postIndex >= _feedPosts.length) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              );
            }

            final post = _feedPosts[postIndex];
            final postMap = post is Map<String, dynamic>
                ? post
                : <String, dynamic>{};
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: MomentCard(
                post: postMap,
                onTap: () => PostDetailModal.show(context, postMap),
              ),
            );
          },
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTS TAB
  // ═══════════════════════════════════════════════════════════════════════════
  int _eventsSubTab = 0;

  Widget _eventsContent() {
    return StatefulBuilder(
      builder: (context, setLocalState) {
        final events = _eventsSubTab == 0
            ? _myEvents
            : _eventsSubTab == 1
            ? _invitedEvents
            : _committeeEvents;

        return RefreshIndicator(
          onRefresh: () async {
            await _loadEvents();
          },
          color: AppColors.primary,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 100),
            children: [
              Text(
                'Events',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.5,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Manage all your events',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  color: AppColors.textTertiary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),

              StatsRow(
                items: [
                  StatItem('Total', '$_totalEvents'),
                  StatItem('Upcoming', '$_upcomingEvents'),
                  StatItem('Invited', '${_invitedEvents.length}'),
                  StatItem('Committee', '${_committeeEvents.length}'),
                ],
              ),
              const SizedBox(height: 16),

              PillTabs(
                tabs: const ['My Events', 'Invited', 'Committee'],
                selected: _eventsSubTab,
                onChanged: (i) => setLocalState(() => _eventsSubTab = i),
              ),
              const SizedBox(height: 16),

              if (_loading)
                ...List.generate(
                  3,
                  (_) => const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: ShimmerCard(),
                  ),
                )
              else if (events.isEmpty)
                EmptyState(
                  icon: _eventsSubTab == 0
                      ? Icons.calendar_month_outlined
                      : _eventsSubTab == 1
                      ? Icons.mail_outline_rounded
                      : Icons.groups_outlined,
                  title: _eventsSubTab == 0
                      ? 'No events yet'
                      : _eventsSubTab == 1
                      ? 'No invitations'
                      : 'No committee events',
                  subtitle: _eventsSubTab == 0
                      ? 'Create your first event'
                      : _eventsSubTab == 1
                      ? 'No invitations yet'
                      : 'Not on any committees',
                  action: _eventsSubTab == 0
                      ? SizedBox(
                          width: 180,
                          child: PremiumButton(
                            label: 'Create Event',
                            icon: Icons.add_rounded,
                            onPressed: () {},
                            height: 44,
                          ),
                        )
                      : null,
                )
              else
                ...events.map(
                  (e) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: EventCard(
                      event: e,
                      role: _eventsSubTab == 0
                          ? 'creator'
                          : _eventsSubTab == 1
                          ? 'guest'
                          : 'committee',
                      onTap: () {
                        final role = _eventsSubTab == 0 ? 'creator' : _eventsSubTab == 1 ? 'guest' : 'committee';
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => role == 'guest'
                                ? EventPublicViewScreen(eventId: e['id']?.toString() ?? '', initialData: e)
                                : EventDetailScreen(eventId: e['id']?.toString() ?? '', initialData: e, knownRole: role),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS TAB — Premium design matching web Notifications.tsx
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _notificationsContent() {
    return RefreshIndicator(
      onRefresh: _loadNotifications,
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
        children: [
          // Header with mark all read
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Notifications',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.5,
                        height: 1.1,
                      ),
                    ),
                    if (_unreadNotifications > 0) ...[
                      const SizedBox(height: 4),
                      Text(
                        '$_unreadNotifications unread',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          color: AppColors.textTertiary,
                          height: 1.2,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (_notifications.isNotEmpty)
                GestureDetector(
                  onTap: () async {
                    await SocialService.markAllNotificationsRead();
                    _loadNotifications();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Mark all read',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                        height: 1.2,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),

          if (_notificationsLoading)
            ...List.generate(
              5,
              (_) => const Padding(
                padding: EdgeInsets.only(bottom: 10),
                child: ShimmerCard(height: 72),
              ),
            )
          else if (_notifications.isEmpty)
            _buildNotificationsEmpty()
          else
            ..._notifications.map((n) {
              final data = n is Map<String, dynamic> ? n : <String, dynamic>{};
              return _notificationItemPremium(data);
            }),
        ],
      ),
    );
  }

  Widget _buildNotificationsEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(32),
            ),
            child: Center(
              child: SvgPicture.asset(
                'assets/icons/bell-icon.svg',
                width: 28,
                height: 28,
                colorFilter: const ColorFilter.mode(
                  AppColors.textTertiary,
                  BlendMode.srcIn,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'No notifications yet',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "We'll notify you when something happens",
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              color: AppColors.textTertiary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _notificationIconBadge(String type) {
    switch (type) {
      case 'glow':
        return const Text('❤️', style: TextStyle(fontSize: 11));
      case 'comment':
      case 'echo':
        return const Icon(
          Icons.chat_bubble_outline_rounded,
          size: 12,
          color: Colors.blue,
        );
      case 'follow':
        return const Icon(
          Icons.person_add_outlined,
          size: 12,
          color: Colors.green,
        );
      case 'circle_add':
      case 'circle_request':
      case 'circle_accepted':
        return const Icon(Icons.group_outlined, size: 12, color: Colors.green);
      case 'event_invite':
      case 'committee_invite':
      case 'rsvp_received':
        return SvgPicture.asset(
          'assets/icons/calendar-icon.svg',
          width: 12,
          height: 12,
          colorFilter: const ColorFilter.mode(
            AppColors.primary,
            BlendMode.srcIn,
          ),
        );
      case 'booking_request':
      case 'booking_accepted':
      case 'booking_rejected':
        return const Icon(
          Icons.work_outline_rounded,
          size: 12,
          color: Colors.orange,
        );
      case 'contribution_received':
        return const Icon(
          Icons.check_circle_outline_rounded,
          size: 12,
          color: Colors.green,
        );
      case 'content_removed':
      case 'post_removed':
      case 'moment_removed':
        return const Icon(
          Icons.warning_amber_rounded,
          size: 12,
          color: Colors.red,
        );
      case 'identity_verified':
      case 'kyc_approved':
        return const Icon(
          Icons.verified_user_outlined,
          size: 12,
          color: Colors.green,
        );
      case 'password_changed':
      case 'password_reset':
        return const Icon(
          Icons.lock_outline_rounded,
          size: 12,
          color: AppColors.primary,
        );
      default:
        return SvgPicture.asset(
          'assets/icons/bell-icon.svg',
          width: 12,
          height: 12,
          colorFilter: const ColorFilter.mode(
            AppColors.textSecondary,
            BlendMode.srcIn,
          ),
        );
    }
  }

  void _navigateForNotification(Map<String, dynamic> data) {
    final type = data['type']?.toString() ?? '';
    final refId = data['reference_id']?.toString() ?? data['event_id']?.toString() ?? data['post_id']?.toString() ?? '';
    final actorId = (data['actor'] is Map ? data['actor']['id'] : null)?.toString();
    final roleHintRaw = (data['role'] ?? data['viewer_role'] ?? data['my_role'])?.toString().toLowerCase();
    final knownRole = roleHintRaw == 'creator' || roleHintRaw == 'organizer' || roleHintRaw == 'owner'
        ? 'creator'
        : (roleHintRaw == 'committee' || roleHintRaw == 'member' ? 'committee' : null);

    if (refId.isEmpty && actorId == null) return;

    if (['event_invite'].contains(type) && refId.isNotEmpty) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => EventPublicViewScreen(eventId: refId)));
    } else if (['committee_invite', 'rsvp_received', 'event_update'].contains(type) && refId.isNotEmpty) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => EventDetailScreen(eventId: refId, knownRole: knownRole)));
    } else if (['follow', 'circle_add', 'circle_request', 'circle_accepted'].contains(type) && actorId != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => PublicProfileScreen(userId: actorId)));
    } else if (['glow', 'comment', 'echo', 'mention'].contains(type)) {
      if (refId.isNotEmpty) {
        setState(() => _tab = 0);
      }
    } else if (['booking_request', 'booking_accepted', 'booking_rejected'].contains(type)) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const MyServicesScreen()));
    } else if (['content_removed', 'post_removed', 'moment_removed'].contains(type)) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const RemovedContentScreen()));
    } else if (actorId != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => PublicProfileScreen(userId: actorId)));
    }
  }

  bool _isSystemNotification(Map<String, dynamic> data) {
    final actor = data['actor'];
    if (actor == null) return true;
    if (actor is Map && actor['is_system'] == true) return true;
    return false;
  }

  String _getActorInitials(Map<String, dynamic>? actor) {
    if (actor == null) return 'N';
    final f = (actor['first_name'] ?? '').toString();
    final l = (actor['last_name'] ?? '').toString();
    final initials = '${f.isNotEmpty ? f[0] : ''}${l.isNotEmpty ? l[0] : ''}'
        .toUpperCase();
    return initials.isNotEmpty ? initials : 'N';
  }

  String _getActorName(Map<String, dynamic>? actor) {
    if (actor == null) return 'Nuru';
    final f = actor['first_name']?.toString() ?? '';
    final l = actor['last_name']?.toString() ?? '';
    final full = '$f $l'.trim();
    return full.isNotEmpty ? full : actor['name']?.toString() ?? 'Nuru';
  }

  Widget _notificationItemPremium(Map<String, dynamic> data) {
    final message = (data['message'] ?? data['text'] ?? '').toString();
    final isRead = data['is_read'] == true || data['read'] == true;
    final createdAt = data['created_at']?.toString() ?? '';
    final type = data['type']?.toString() ?? '';
    final actor = data['actor'] is Map<String, dynamic>
        ? data['actor'] as Map<String, dynamic>
        : null;
    final isSystem = _isSystemNotification(data);
    final actorAvatar = actor?['avatar']?.toString();

    return GestureDetector(
      onTap: () async {
        final id = data['id']?.toString();
        if (id != null && !isRead) await SocialService.markNotificationRead(id);
        if (mounted) _loadNotifications();
        // Navigate to the relevant page based on notification type
        _navigateForNotification(data);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 2),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isRead ? Colors.transparent : AppColors.primarySoft,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Avatar with icon badge overlay
            SizedBox(
              width: 44,
              height: 44,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  if (isSystem)
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primary.withOpacity(0.2),
                          width: 1,
                        ),
                      ),
                      child: Center(
                        child: SvgPicture.asset(
                          'assets/icons/bell-icon.svg',
                          width: 20,
                          height: 20,
                          colorFilter: const ColorFilter.mode(
                            AppColors.primary,
                            BlendMode.srcIn,
                          ),
                        ),
                      ),
                    )
                  else
                    Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.surfaceVariant,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: actorAvatar != null && actorAvatar.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: actorAvatar,
                              fit: BoxFit.cover,
                              width: 40,
                              height: 40,
                              errorWidget: (_, __, ___) => Center(
                                child: Text(
                                  _getActorInitials(actor),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textTertiary,
                                  ),
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                _getActorInitials(actor),
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textTertiary,
                                ),
                              ),
                            ),
                    ),
                  // Icon badge
                  Positioned(
                    bottom: -2,
                    right: -2,
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.borderLight,
                          width: 1,
                        ),
                      ),
                      child: Center(child: _notificationIconBadge(type)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: isSystem ? 'Nuru ' : '${_getActorName(actor)} ',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            height: 1.45,
                          ),
                        ),
                        TextSpan(
                          text: message,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (createdAt.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      SocialService.getTimeAgo(createdAt),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: AppColors.textTertiary,
                        height: 1.2,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Unread dot
            if (!isRead) ...[
              const SizedBox(width: 8),
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6),
                decoration: BoxDecoration(
                  color: AppColors.secondary,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE TAB — delegated to ProfileScreen
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _profileContent() {
    return ProfileScreen(
      profile: _profile,
      myEventsCount: _myEvents.length,
      onRefresh: () => _loadProfile(),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  List<Map<String, dynamic>> _mergeUpcomingEvents() {
    final map = <String, Map<String, dynamic>>{};
    final now = DateTime.now();

    for (final e in _myEvents) {
      final id = e['id']?.toString() ?? '';
      if (id.isEmpty) continue;
      map[id] = {'event': e, 'role': 'creator'};
    }
    for (final e in _committeeEvents) {
      final id = e['id']?.toString() ?? '';
      if (id.isEmpty || map.containsKey(id)) continue;
      map[id] = {'event': e, 'role': 'committee'};
    }
    for (final e in _invitedEvents) {
      final id = e['id']?.toString() ?? '';
      if (id.isEmpty || map.containsKey(id)) continue;
      final rsvp = (e['rsvp_status'] ?? '').toString().toLowerCase();
      if (['declined', 'rejected', 'not_attending'].contains(rsvp)) continue;
      map[id] = {'event': e, 'role': 'guest'};
    }

    return map.values.where((item) {
      final e = item['event'] as Map<String, dynamic>;
      final status = (e['status'] ?? '').toString().toLowerCase();
      if (status == 'cancelled') return false;
      final dateStr = e['start_date']?.toString() ?? '';
      if (dateStr.isEmpty) return true;
      try {
        return DateTime.parse(
          dateStr,
        ).isAfter(now.subtract(const Duration(days: 1)));
      } catch (_) {
        return true;
      }
    }).toList()..sort((a, b) {
      final da = (a['event'] as Map)['start_date']?.toString() ?? '';
      final db = (b['event'] as Map)['start_date']?.toString() ?? '';
      if (da.isEmpty) return 1;
      if (db.isEmpty) return -1;
      return da.compareTo(db);
    });
  }

  String _formatDateShort(String dateStr) {
    if (dateStr.isEmpty) return 'Date TBD';
    try {
      final d = DateTime.parse(dateStr);
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return '${weekdays[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}';
    } catch (_) {
      return dateStr;
    }
  }

  Widget _buildCountdownChip(String text, {bool isPast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: isPast ? AppColors.surfaceVariant : AppColors.primarySoft,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text, style: GoogleFonts.plusJakartaSans(
        fontSize: 9, fontWeight: FontWeight.w600,
        color: isPast ? AppColors.textTertiary : AppColors.primary,
      )),
    );
  }

  Widget _ticketSidebarPlaceholder() {
    return Container(
      width: double.infinity,
      height: 100,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primarySoft, AppColors.surfaceVariant],
        ),
      ),
      child: Center(
        child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 24, height: 24,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
      ),
    );
  }

  String _monthAbbr(int month) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months[month - 1];
  }

  bool _isPastDate(String dateStr) {
    try {
      final eventDate = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final target = DateTime(eventDate.year, eventDate.month, eventDate.day);
      return target.isBefore(today);
    } catch (_) {
      return false;
    }
  }

  String _getCountdownLabel(String dateStr) {
    try {
      final eventDate = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final target = DateTime(eventDate.year, eventDate.month, eventDate.day);
      final diffDays = target.difference(today).inDays;
      if (diffDays == 0) return 'Today!';
      if (diffDays == 1) return 'Tomorrow';
      if (diffDays == -1) return 'Yesterday';
      if (diffDays < 0) return 'Event passed';
      if (diffDays <= 7) return '$diffDays day${diffDays != 1 ? 's' : ''} left';
      if (diffDays <= 30) {
        final weeks = (diffDays / 7).round();
        return '$weeks week${weeks != 1 ? 's' : ''} left';
      }
      final months = (diffDays / 30).round();
      return '$months month${months != 1 ? 's' : ''} left';
    } catch (_) {
      return 'Date TBD';
    }
  }

  String _formatCompactMoney(dynamic amount) {
    if (amount == null) return 'TZS 0';
    final n = amount is int ? amount : (amount is double ? amount.toInt() : int.tryParse(amount.toString()) ?? 0);
    if (n >= 1000000) return 'TZS ${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return 'TZS ${(n / 1000).toStringAsFixed(0)}K';
    return 'TZS ${n.toString()}';
  }
}

class _NavItem {
  final String? svgAsset;
  final String label;
  const _NavItem(this.svgAsset, this.label);
}
