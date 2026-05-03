import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/api_service.dart';
import '../../core/services/events_service.dart';
import '../../core/services/social_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/services/ticketing_service.dart';
import '../../core/services/user_services_service.dart';
import '../../core/widgets/premium_button.dart';
import '../../core/widgets/nuru_refresh.dart';
import '../../providers/auth_provider.dart';
import '../events/event_detail_screen.dart' show EventDetailScreen;
import '../events/event_public_view_screen.dart';
import '../events/widgets/my_contributions_tab.dart';
import '../search/search_screen.dart';
import '../tickets/my_tickets_screen.dart';
import '../profile/profile_screen.dart';
import 'widgets/moment_card.dart';
import 'widgets/post_detail_modal.dart';
import 'widgets/trending_rail.dart';
import 'widgets/reels_rail.dart';
import 'widgets/reel_composer_screen.dart';
import 'widgets/reel_viewer_screen.dart';
import 'widgets/reel_group_card.dart';
import 'widgets/create_post_box.dart';
import 'widgets/event_card.dart';
import 'widgets/stats_row.dart';
import 'widgets/pill_tabs.dart';
import 'widgets/shared_widgets.dart';
import 'widgets/home_header.dart';
import 'widgets/home_bottom_nav.dart';
import 'widgets/home_left_drawer.dart';
import 'widgets/home_right_drawer.dart';
import 'widgets/home_notifications_tab.dart';
import '../../core/services/moments_service.dart';
import '../../core/utils/home_cache.dart';
import '../../core/l10n/l10n_helper.dart';
import '../onboarding/country_confirm_sheet.dart';
import '../migration/migration_welcome_sheet.dart';
import '../../providers/migration_provider.dart';
import '../events/create_event_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  bool _loading = true;
  bool _showCreatePost = false; // Hidden by default — toggled via pill above feed
  Map<String, dynamic>? _profile;
  List<dynamic> _feedPosts = [];
  bool _feedLoading = true;
  bool _feedFallbackTried = false;
  bool _feedLoadingMore = false;
  int _feedPage = 1;
  int _feedTotalPages = 1;
  // Session id for ranked feed — clearing it resets server impression history.
  String _feedSessionId = DateTime.now().millisecondsSinceEpoch.toString();
  int _feedRequestId = 0;
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
  int _eventsSubTab = 0;
  String _eventsSearch = '';
  Timer? _eventsSearchDebounce;

  // Feed pill tabs: 0 All, 1 Moments, 2 Events, 3 Reels
  int _feedTab = 0;
  List<dynamic> _reels = [];
  bool _reelsLoading = true;

  @override
  void initState() {
    super.initState();
    // Seed from cache so re-entering Home is instant; refresh in background.
    if (HomeCache.feedPosts != null && HomeCache.feedPosts!.isNotEmpty) {
      _feedPosts = List<dynamic>.from(HomeCache.feedPosts!);
      _feedPage = HomeCache.feedPage;
      _feedTotalPages = HomeCache.feedTotalPages;
      _feedLoading = false;
    }
    if (HomeCache.reels != null) {
      _reels = List<dynamic>.from(HomeCache.reels!);
      _reelsLoading = false;
    }
    if (HomeCache.profile != null) _profile = HomeCache.profile;
    if (HomeCache.myEvents != null) _myEvents = List<dynamic>.from(HomeCache.myEvents!);
    if (HomeCache.invitedEvents != null) _invitedEvents = List<dynamic>.from(HomeCache.invitedEvents!);
    if (HomeCache.committeeEvents != null) _committeeEvents = List<dynamic>.from(HomeCache.committeeEvents!);
    if (HomeCache.notifications != null) {
      _notifications = List<dynamic>.from(HomeCache.notifications!);
      _unreadNotifications = HomeCache.unreadNotifications;
      _notificationsLoading = false;
    }
    if (HomeCache.followSuggestions != null) _followSuggestions = List<dynamic>.from(HomeCache.followSuggestions!);
    _unreadMessages = HomeCache.unreadMessages;
    if (HomeCache.upcomingTickets != null) _upcomingTickets = List<dynamic>.from(HomeCache.upcomingTickets!);
    if (HomeCache.ticketedEvents != null) _ticketedEvents = List<dynamic>.from(HomeCache.ticketedEvents!);
    if (HomeCache.myServices != null) _myServices = List<dynamic>.from(HomeCache.myServices!);

    // Once Home has loaded for this session, never show the full-page
    // skeleton again on re-entry — refresh silently in the background like
    // WhatsApp/feed apps do.
    final silent = HomeCache.hasLoadedOnce ||
        (HomeCache.feedPosts != null && HomeCache.feedPosts!.isNotEmpty);
    if (silent) _loading = false;
    _loadAllData(silent: silent);
  }

  Future<void> _loadAllData({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    await Future.wait([
      _loadProfile(),
      _loadFeed(silent: silent),
      _loadEvents(),
      _loadNotifications(silent: silent),
      _loadFollowSuggestions(),
      _loadUnreadMessages(),
      _loadUpcomingTickets(),
      _loadTicketedEvents(),
      _loadMyServices(),
      _loadReels(silent: silent),
    ]);
    if (mounted && !silent) setState(() => _loading = false);
    HomeCache.hasLoadedOnce = true;
  }

  Future<void> _loadReels({bool silent = false}) async {
    if (mounted && !silent) setState(() => _reelsLoading = true);
    final res = await MomentsService.getFeed();
    if (!mounted) return;
    final data = res['data'];
    setState(() {
      _reels = data is List ? data : const [];
      _reelsLoading = false;
    });
    HomeCache.reels = _reels;
  }

  Future<void> _loadProfile() async {
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
    if (mounted && userData != null) {
      setState(() => _profile = userData);
      HomeCache.profile = userData;
      _maybePromptCountry(userData);
      _loadMigrationStatus(userData);
    }
  }

  bool _countryPrompted = false;
  bool _migrationPrompted = false;

  void _maybePromptCountry(Map<String, dynamic> user) {
    if (_countryPrompted) return;
    final cc = (user['country_code'] ?? user['country'])?.toString();
    if (cc != null && cc.isNotEmpty) return;
    _countryPrompted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) showCountryConfirmSheet(context);
    });
  }

  Future<void> _loadMigrationStatus(Map<String, dynamic> user) async {
    final id = user['id']?.toString();
    if (id == null) return;
    final mig = context.read<MigrationProvider>();
    await mig.load(id);
    if (!mounted || _migrationPrompted) return;
    if (await mig.shouldShowWelcome()) {
      _migrationPrompted = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        // If country isn't set yet, the country sheet takes priority.
        final cc = (user['country_code'] ?? user['country'])?.toString();
        if (cc == null || cc.isEmpty) return;
        showMigrationWelcomeSheet(context);
      });
    }
  }

  Future<void> _loadFeed({bool refresh = true, bool resetSession = false, bool silent = false}) async {
    if (refresh) {
      if (resetSession) {
        _feedSessionId = DateTime.now().millisecondsSinceEpoch.toString();
      }
      if (!silent) {
        setState(() {
          _feedLoading = true;
          _feedFallbackTried = false;
          _feedPage = 1;
        });
      } else {
        _feedFallbackTried = false;
        _feedPage = 1;
      }
    }
    final reqId = ++_feedRequestId;
    final res = await SocialService.getFeed(page: _feedPage, limit: 15, sessionId: _feedSessionId);
    if (!mounted || reqId != _feedRequestId) return;
    List<dynamic> items = const [];
    Map? pagination;
    if (res['success'] == true) {
      final data = res['data'];
      final raw = data is Map ? (data['items'] ?? data['posts'] ?? []) : (data is List ? data : []);
      items = raw is List ? raw : const [];
      pagination = data is Map ? (data['pagination'] as Map?) : null;
    }
    setState(() {
      if (refresh) {
        // During a silent refresh, never wipe existing posts if the new
        // fetch returned empty (transient/network glitch). Keeps content
        // visible while we silently retry.
        if (silent && items.isEmpty && _feedPosts.isNotEmpty) {
          // keep existing
        } else {
          _feedPosts = _dedupePosts(items);
        }
      } else {
        _feedPosts = _dedupePosts([..._feedPosts, ...items]);
      }
      _feedPage = (pagination?['page'] as int?) ?? _feedPage;
      _feedTotalPages = (pagination?['pages'] as int?) ?? 1;
      if (_feedPosts.isNotEmpty) {
        _feedLoading = false;
      }
    });
    HomeCache.feedPosts = _feedPosts;
    HomeCache.feedPage = _feedPage;
    HomeCache.feedTotalPages = _feedTotalPages;
    if (_feedPosts.isEmpty && refresh && !_feedFallbackTried && !silent) {
      _feedFallbackTried = true;
      await _loadTrendingFallback();
      if (mounted) setState(() => _feedLoading = false);
    } else if (_feedPosts.isEmpty && refresh && !silent) {
      if (mounted) setState(() => _feedLoading = false);
    }
  }

  List<dynamic> _dedupePosts(List<dynamic> posts) {
    final seen = <String>{};
    final out = <dynamic>[];
    for (final p in posts) {
      final id = (p is Map ? (p['id'] ?? p['post_id']) : null)?.toString();
      if (id == null || id.isEmpty) { out.add(p); continue; }
      if (seen.add(id)) out.add(p);
    }
    return out;
  }

  Future<void> _loadTrendingFallback() async {
    final res = await SocialService.getExplore(limit: 15);
    if (mounted && res['success'] == true) {
      final data = res['data'];
      final items = data is List ? data : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
      setState(() => _feedPosts = _dedupePosts(items is List ? items : const []));
    }
  }

  Future<void> _loadMoreFeed() async {
    if (_feedLoadingMore || _feedPage >= _feedTotalPages) return;
    setState(() => _feedLoadingMore = true);
    _feedPage++;
    final res = await SocialService.getFeed(page: _feedPage, limit: 15, sessionId: _feedSessionId);
    if (mounted) {
      setState(() {
        _feedLoadingMore = false;
        if (res['success'] == true) {
          final data = res['data'];
          final items = data is Map ? (data['items'] ?? data['posts'] ?? []) : (data is List ? data : []);
          _feedPosts = _dedupePosts([..._feedPosts, ...(items is List ? items : const [])]);
          final pagination = data is Map ? data['pagination'] : null;
          _feedTotalPages = pagination?['pages'] ?? _feedTotalPages;
        }
      });
    }
  }

  Future<void> _loadEvents({bool silent = false}) async {
    final s = _eventsSearch.trim().isEmpty ? null : _eventsSearch.trim();
    final results = await Future.wait([
      EventsService.getMyEvents(limit: 20, search: s),
      EventsService.getInvitedEvents(limit: 20),
      EventsService.getCommitteeEvents(limit: 20),
    ]);
    if (mounted) {
      setState(() {
        _myEvents = _extractEvents(results[0]);
        _invitedEvents = _extractEvents(results[1]);
        _committeeEvents = _extractEvents(results[2]);
      });
      HomeCache.myEvents = _myEvents;
      HomeCache.invitedEvents = _invitedEvents;
      HomeCache.committeeEvents = _committeeEvents;
    }
  }

  String _notificationsSearch = '';

  Future<void> _loadNotifications({String? search, bool silent = false}) async {
    if (search != null) _notificationsSearch = search;
    final hasCache = _notifications.isNotEmpty;
    if (!silent && !hasCache) setState(() => _notificationsLoading = true);
    final res = await SocialService.getNotifications(
      limit: 30,
      search: _notificationsSearch.isNotEmpty ? _notificationsSearch : null,
    );
    if (mounted) {
      setState(() {
        _notificationsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _notifications = data is Map ? (data['notifications'] ?? []) : (data is List ? data : []);
          _unreadNotifications = data is Map ? (data['unread_count'] ?? 0) : 0;
          HomeCache.notifications = _notifications;
          HomeCache.unreadNotifications = _unreadNotifications;
        }
      });
    }
  }

  Future<void> _loadFollowSuggestions() async {
    final res = await SocialService.getFollowSuggestions(limit: 5);
    if (mounted && res['success'] == true) {
      final data = res['data'];
      setState(() => _followSuggestions = data is List ? data : []);
      HomeCache.followSuggestions = _followSuggestions;
    }
  }

  Future<void> _loadUnreadMessages() async {
    final count = await MessagesService.getUnreadCount();
    if (mounted) setState(() => _unreadMessages = count);
    HomeCache.unreadMessages = count;
  }

  Future<void> _loadUpcomingTickets() async {
    final res = await TicketingService.getMyUpcomingTickets();
    if (mounted && res['success'] == true) {
      final data = res['data'];
      setState(() => _upcomingTickets = data is List ? data : (data is Map ? (data['tickets'] ?? []) : []));
      HomeCache.upcomingTickets = _upcomingTickets;
    }
  }

  Future<void> _loadTicketedEvents() async {
    final res = await TicketingService.getTicketedEvents(limit: 5);
    if (mounted && res['success'] == true) {
      final data = res['data'];
      setState(() => _ticketedEvents = data is List ? data : (data is Map ? (data['events'] ?? []) : []));
      HomeCache.ticketedEvents = _ticketedEvents;
    }
  }

  Future<void> _loadMyServices() async {
    final res = await UserServicesService.getServiceProviders(limit: 20);
    if (!mounted) return;
    final data = res['data'] ?? res;
    if (data is List) {
      setState(() => _myServices = data);
      HomeCache.myServices = _myServices;
      return;
    }
    if (data is Map) {
      final nested = data['data'];
      final services = data['services'] ?? data['items'] ?? (nested is Map ? (nested['services'] ?? nested['items']) : nested);
      setState(() => _myServices = services is List ? services : []);
      HomeCache.myServices = _myServices;
      return;
    }
    setState(() => _myServices = []);
    HomeCache.myServices = _myServices;
  }

  List<dynamic> _extractEvents(Map<String, dynamic> res) {
    if (res['success'] != true) return [];
    final data = res['data'];
    if (data is List) return data;
    if (data is Map) return data['events'] ?? [];
    return [];
  }

  // ── Premium 4-bucket KPI counts (matches web My Events) ──
  bool _isCancelledOrDraft(dynamic e) {
    final s = (e is Map ? e['status']?.toString() : '') ?? '';
    return s == 'cancelled' || s == 'draft';
  }

  DateTime? _eventStart(dynamic e) {
    final d = (e is Map ? e['start_date']?.toString() : '') ?? '';
    if (d.isEmpty) return null;
    try { return DateTime.parse(d); } catch (_) { return null; }
  }

  int get _kpiUpcoming => _myEvents.where((e) {
    if (_isCancelledOrDraft(e)) return false;
    final d = _eventStart(e);
    return d == null || d.isAfter(DateTime.now());
  }).length;

  int get _kpiThisMonth => _myEvents.where((e) {
    if (_isCancelledOrDraft(e)) return false;
    final d = _eventStart(e);
    final now = DateTime.now();
    return d != null && d.year == now.year && d.month == now.month;
  }).length;

  int get _kpiDrafts => _myEvents.where((e) =>
      (e is Map ? e['status']?.toString() : '') == 'draft').length;

  int get _kpiPast => _myEvents.where((e) {
    if (_isCancelledOrDraft(e)) return false;
    final d = _eventStart(e);
    return d != null && d.isBefore(DateTime.now());
  }).length;

  int get _kpiCompleted => _myEvents.where((e) {
    final status = (e is Map ? e['status']?.toString() : '') ?? '';
    if (status == 'completed') return true;
    if (_isCancelledOrDraft(e)) return false;
    final d = _eventStart(e);
    return d != null && d.isBefore(DateTime.now());
  }).length;

  int get _kpiTotalGuests => _myEvents.fold<int>(0, (sum, e) {
    if (e is! Map) return sum;
    final raw = e['expected_guests'] ?? e['guest_count'] ?? 0;
    if (raw is num) return sum + raw.toInt();
    return sum + (int.tryParse(raw.toString()) ?? 0);
  });

  // Backward-compat (used by ProfileScreen)
  int get _totalEvents => _myEvents.length;
  int get _upcomingEvents => _kpiUpcoming;



  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final name = _profile?['first_name'] ?? auth.userName ?? '';
    final avatar = (_profile?['avatar'] as String?) ?? auth.userAvatar;

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
        drawer: HomeLeftDrawer(
          currentTab: _tab,
          unreadMessages: _unreadMessages,
          unreadNotifications: _unreadNotifications,
          profile: _profile,
          onTabSelected: (i) => setState(() => _tab = i),
          onRefresh: () => _loadAllData(silent: true),
        ),
        endDrawer: HomeRightDrawer(
          myEvents: _myEvents,
          invitedEvents: _invitedEvents,
          committeeEvents: _committeeEvents,
          upcomingTickets: _upcomingTickets,
          ticketedEvents: _ticketedEvents,
          myServices: _myServices,
          followSuggestions: _followSuggestions,
          onFollowChanged: () => setState(() => _loadFollowSuggestions()),
        ),
        body: Column(
          children: [
            // Global header is only shown on tabs that need it (Home, Events).
            // Tickets (3) and Profile (4) own their headers per design.
            if (_tab == 0 || _tab == 1)
              HomeHeader(
                name: name,
                avatar: avatar,
                unreadNotifications: _unreadNotifications,
                onMenuTap: () => _scaffoldKey.currentState?.openDrawer(),
                onSearchTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SearchScreen())),
                onNotificationsTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => Scaffold(
                      backgroundColor: AppColors.surface,
                      body: HomeNotificationsTab(
                        notifications: _notifications,
                        unreadCount: _unreadNotifications,
                        isLoading: _notificationsLoading,
                        onRefresh: () => _loadNotifications(silent: true),
                        onSearch: (q) => _loadNotifications(search: q),
                        onTabChanged: (i) {
                          Navigator.pop(context);
                          setState(() => _tab = i);
                        },
                      ),
                    ),
                  ),
                ).then((_) => _loadNotifications()),
                onRightPanelTap: () => _scaffoldKey.currentState?.openEndDrawer(),
                onProfileTap: () => setState(() => _tab = 4),
              ),
            Expanded(
              child: IndexedStack(
                index: _tab,
                children: [
                  _feedContent(),
                  _eventsContent(),
                  // Index 2 is reserved for the center "+" create action.
                  const SizedBox.shrink(),
                  const MyTicketsScreen(),
                  _profileContent(),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: HomeBottomNav(
          currentTab: _tab,
          unreadMessages: _unreadMessages,
          unreadNotifications: _unreadNotifications,
          onCreateTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CreateEventScreen()),
            );
          },
          onTabChanged: (i) {
            // Center "+" is handled by onCreateTap; ignore stray index 2 taps.
            if (i == 2) return;
            setState(() => _tab = i);
          },
        ),
      ),
    );
  }

  List<dynamic> get _filteredFeed {
    bool isEventShare(dynamic p) {
      if (p is! Map) return false;
      final pt = (p['post_type'] ?? p['type'] ?? '').toString();
      return pt == 'event_share' || p['shared_event'] != null;
    }
    bool isReel(dynamic p) {
      if (p is! Map) return false;
      final pt = (p['post_type'] ?? p['type'] ?? '').toString();
      return pt == 'reel' || pt == 'moment_share' || p['moment'] != null || p['moment_id'] != null;
    }
    bool isMoment(dynamic p) {
      // Plain user posts/feeds — exclude event-shares & reels
      if (p is! Map) return false;
      if (isEventShare(p) || isReel(p)) return false;
      return true;
    }
    if (_feedTab == 1) return _feedPosts.where(isMoment).toList();
    if (_feedTab == 2) return _feedPosts.where(isEventShare).toList();
    if (_feedTab == 3) return _feedPosts.where(isReel).toList();
    // All tab: hide individual reel posts (they're already grouped in the rail above).
    return _feedPosts.where((p) => !isReel(p)).toList();
  }

  void _openReelViewer(int authorIndex) {
    if (authorIndex < 0 || authorIndex >= _reels.length) return;
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => ReelViewerScreen(
        reels: _reels,
        initialAuthorIndex: authorIndex,
      ),
    )).then((_) => _loadReels());
  }

  void _openCreateReel() async {
    final created = await Navigator.of(context).push<bool>(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => const ReelComposerScreen(),
    ));
    if (created == true) {
      await _loadReels();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Your reel is live for 24 hours')),
        );
      }
    }
  }

  Widget _feedContent() {
    final isReelsTab = _feedTab == 3;
    final filtered = isReelsTab ? const <dynamic>[] : _filteredFeed;
    final reelGroups = isReelsTab ? _reels : const <dynamic>[];
    final listLen = isReelsTab ? reelGroups.length : filtered.length;
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification &&
            notification.metrics.pixels >= notification.metrics.maxScrollExtent - 300 &&
            _feedPage < _feedTotalPages && !_feedLoadingMore && !isReelsTab) {
          _loadMoreFeed();
        }
        return false;
      },
      child: NuruRefresh(
        onRefresh: () async {
          await Future.wait([
            _loadFeed(refresh: true, resetSession: true, silent: true),
            _loadReels(silent: true),
          ]);
        },
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          itemCount: listLen + 4 + (_feedLoadingMore && !isReelsTab ? 1 : 0) + (!_feedLoading && _feedFallbackTried && listLen == 0 ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ReelsRail(
                  reels: _reels,
                  loading: false,
                  myAvatar: (_profile?['avatar'] as String?),
                  onCreateTap: _openCreateReel,
                  onAuthorTap: _openReelViewer,
                  onShareMomentTap: () => setState(() => _showCreatePost = !_showCreatePost),
                  shareMomentExpanded: _showCreatePost,
                ),
              );
            }
            if (index == 1) {
              if (!_showCreatePost) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: CreatePostBox(onPostCreated: () {
                  setState(() => _showCreatePost = false);
                  _loadFeed(refresh: true);
                }),
              );
            }
            if (index == 2) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: PillTabs(
                  tabs: const ['All', 'Moments', 'Events', 'Reels'],
                  selected: _feedTab,
                  onChanged: (i) => setState(() => _feedTab = i),
                ),
              );
            }
            if (index == 3) return _feedTab == 3 ? const TrendingRail() : const SizedBox.shrink();
            if (index == 4 && (_feedLoading || (listLen == 0 && !_feedFallbackTried && _feedTab == 0))) {
              return Column(children: List.generate(3, (_) => const Padding(padding: EdgeInsets.only(bottom: 16), child: ShimmerCard(height: 220))));
            }
            if (index == 4 && listLen == 0) {
              return EmptyState(
                icon: _feedTab == 3 ? Icons.auto_awesome_rounded : Icons.dynamic_feed_rounded,
                title: _feedTab == 1
                    ? 'No moments yet'
                    : _feedTab == 2
                        ? 'No event posts'
                        : _feedTab == 3
                            ? 'No reels in your circle'
                            : 'No posts yet',
                subtitle: _feedTab == 0
                    ? 'Be the first to share something with the community!'
                    : 'Check back soon or follow more people to see updates here.',
              );
            }
            final itemIndex = index - 4;
            if (itemIndex >= listLen) {
              return const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))));
            }
            if (isReelsTab) {
              final group = reelGroups[itemIndex];
              if (group is! Map) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ReelGroupCard(
                  group: group,
                  onOpen: (_) => _openReelViewer(itemIndex),
                ),
              );
            }
            final post = filtered[itemIndex];
            final postMap = post is Map<String, dynamic> ? post : <String, dynamic>{};
            return Padding(padding: const EdgeInsets.only(bottom: 16), child: MomentCard(post: postMap, onTap: () => PostDetailModal.show(context, postMap)));
          },
        ),
      ),
    );
  }

  Widget _eventsContent() {
    return StatefulBuilder(
      builder: (context, setLocalState) {
        final rawEvents = _eventsSubTab == 0 ? _myEvents : _eventsSubTab == 1 ? _invitedEvents : _committeeEvents;
        // Mirror web: no date-range filter, just full list (search is server-side).
        final events = rawEvents;
        final showStats = !_loading && _myEvents.isNotEmpty;
        return NuruRefresh(
          onRefresh: () async => await _loadEvents(silent: true),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 100),
            children: [
              // ── Header (title + New Event) ──
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('My Events', style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5, height: 1.1)),
                        const SizedBox(height: 4),
                        Text('Plan, manage, and track all your events in one place', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textTertiary, height: 1.4)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 132,
                    child: PremiumButton(
                      label: 'New Event',
                      icon: Icons.add_rounded,
                      onPressed: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateEventScreen()));
                      },
                      height: 44,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Stats row (only when there are events) ──
              if (showStats) ...[
                StatsRow(items: [
                  StatItem('Total Events', '$_totalEvents'),
                  StatItem('Upcoming', '$_kpiUpcoming'),
                  StatItem('Completed', '$_kpiCompleted'),
                  StatItem('Total Guests', '$_kpiTotalGuests'),
                ]),
                const SizedBox(height: 16),
              ],

              // ── Tabs ──
              PillTabs(tabs: const ['My Events', 'Invited', 'Committee', 'My Contributions'], selected: _eventsSubTab, onChanged: (i) => setLocalState(() => _eventsSubTab = i)),
              const SizedBox(height: 16),

              // ── Search (right-aligned, premium pill) — only on My Events tab ──
              if (_eventsSubTab == 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Flexible(child: _eventsSearchBar(setLocalState)),
                  ],
                ),
                const SizedBox(height: 14),
              ],

              if (_eventsSubTab == 3)
                const MyContributionsTab()
              else if (_loading) ...List.generate(3, (_) => const Padding(padding: EdgeInsets.only(bottom: 16), child: ShimmerCard()))
              else if (events.isEmpty)
                EmptyState(
                  icon: _eventsSubTab == 0 ? Icons.calendar_month_outlined : _eventsSubTab == 1 ? Icons.mail_outline_rounded : Icons.groups_outlined,
                  title: _eventsSubTab == 0
                      ? (_eventsSearch.isNotEmpty ? 'No matches' : 'No Events Yet')
                      : _eventsSubTab == 1 ? 'No invitations' : 'No committee events',
                  subtitle: _eventsSubTab == 0
                      ? (_eventsSearch.isNotEmpty
                          ? 'Nothing matched "$_eventsSearch". Try a different keyword.'
                          : 'Create your first event to start planning, managing guests, and tracking contributions.')
                      : _eventsSubTab == 1 ? 'No invitations yet' : 'Not on any committees',
                  action: _eventsSubTab == 0 && _eventsSearch.isEmpty
                      ? SizedBox(width: 200, child: PremiumButton(label: 'Create Your First Event', icon: Icons.add_rounded, onPressed: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateEventScreen()));
                        }, height: 44))
                      : null,
                )
              else ...events.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: EventCard(
                  event: e,
                  role: _eventsSubTab == 0 ? 'creator' : _eventsSubTab == 1 ? 'guest' : 'committee',
                  onTap: () {
                    final role = _eventsSubTab == 0 ? 'creator' : _eventsSubTab == 1 ? 'guest' : 'committee';
                    Navigator.push(context, MaterialPageRoute(
                      builder: (_) => role == 'guest'
                          ? EventPublicViewScreen(eventId: e['id']?.toString() ?? '', initialData: e)
                          : EventDetailScreen(eventId: e['id']?.toString() ?? '', initialData: e, knownRole: role),
                    ));
                  },
                ),
              )),
            ],
          ),
        );
      },
    );
  }

  Widget _profileContent() {
    return ProfileScreen(
      profile: _profile,
      myEventsCount: _myEvents.length,
      ticketsCount: _upcomingTickets.length,
      onRefresh: () => _loadAllData(silent: true),
    );
  }

  Widget _eventsSearchBar(StateSetter setLocalState) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: TextField(
        controller: TextEditingController(text: _eventsSearch)
          ..selection = TextSelection.collapsed(offset: _eventsSearch.length),
        onChanged: (v) {
          _eventsSearchDebounce?.cancel();
          _eventsSearchDebounce = Timer(const Duration(milliseconds: 350), () {
            setState(() => _eventsSearch = v);
            _loadEvents();
          });
        },
        style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search by title, location…',
          hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary),
          prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppColors.textTertiary),
          suffixIcon: _eventsSearch.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textTertiary),
                  onPressed: () {
                    _eventsSearchDebounce?.cancel();
                    setState(() => _eventsSearch = '');
                    _loadEvents();
                  },
                  splashRadius: 18,
                ),
          filled: true,
          fillColor: AppColors.surface,
          contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide(color: AppColors.borderLight, width: 1)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide(color: AppColors.borderLight, width: 1)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide(color: AppColors.primary, width: 1.5)),
        ),
      ),
    );
  }

}
