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
import '../../providers/auth_provider.dart';
import '../events/event_detail_screen.dart' show EventDetailScreen;
import '../events/event_public_view_screen.dart';
import '../events/widgets/my_contributions_tab.dart';
import '../search/search_screen.dart';
import '../messages/messages_screen.dart';
import '../profile/profile_screen.dart';
import 'widgets/moment_card.dart';
import 'widgets/post_detail_modal.dart';
import 'widgets/trending_rail.dart';
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

  Future<void> _loadFeed({bool refresh = true, bool resetSession = false}) async {
    if (refresh) {
      if (resetSession) {
        _feedSessionId = DateTime.now().millisecondsSinceEpoch.toString();
      }
      setState(() {
        _feedLoading = true;
        _feedFallbackTried = false;
        _feedPage = 1;
      });
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
        _feedPosts = _dedupePosts(items);
      } else {
        _feedPosts = _dedupePosts([..._feedPosts, ...items]);
      }
      _feedPage = (pagination?['page'] as int?) ?? _feedPage;
      _feedTotalPages = (pagination?['pages'] as int?) ?? 1;
      // Only clear loading once we have content OR fallback has run.
      if (_feedPosts.isNotEmpty) {
        _feedLoading = false;
      }
    });
    if (_feedPosts.isEmpty && refresh && !_feedFallbackTried) {
      _feedFallbackTried = true;
      await _loadTrendingFallback();
      if (mounted) setState(() => _feedLoading = false);
    } else if (_feedPosts.isEmpty && refresh) {
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

  Future<void> _loadEvents() async {
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
    }
  }

  String _notificationsSearch = '';

  Future<void> _loadNotifications({String? search}) async {
    if (search != null) _notificationsSearch = search;
    setState(() => _notificationsLoading = true);
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
    if (data is List) { setState(() => _myServices = data); return; }
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
          onRefresh: _loadAllData,
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
            HomeHeader(
              name: name,
              avatar: avatar,
              unreadNotifications: _unreadNotifications,
              onMenuTap: () => _scaffoldKey.currentState?.openDrawer(),
              onSearchTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const SearchScreen())),
              onNotificationsTap: () => setState(() => _tab = 3),
              onRightPanelTap: () => _scaffoldKey.currentState?.openEndDrawer(),
              onProfileTap: () => setState(() => _tab = 4),
            ),
            Expanded(
              child: IndexedStack(
                index: _tab,
                children: [
                  _feedContent(),
                  _eventsContent(),
                  const MessagesScreen(),
                  HomeNotificationsTab(
                    notifications: _notifications,
                    unreadCount: _unreadNotifications,
                    isLoading: _notificationsLoading,
                    onRefresh: _loadNotifications,
                    onSearch: (q) => _loadNotifications(search: q),
                    onTabChanged: (i) => setState(() => _tab = i),
                  ),
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
          onTabChanged: (i) {
            setState(() => _tab = i);
            if (i == 2) _loadUnreadMessages();
          },
        ),
      ),
    );
  }

  Widget _feedContent() {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification is ScrollEndNotification &&
            notification.metrics.pixels >= notification.metrics.maxScrollExtent - 300 &&
            _feedPage < _feedTotalPages && !_feedLoadingMore) {
          _loadMoreFeed();
        }
        return false;
      },
      child: RefreshIndicator(
        // Pull-to-refresh resets the ranked-feed session so server impression
        // history is cleared and the user gets a freshly-rotated stream.
        onRefresh: () => _loadFeed(refresh: true, resetSession: true),
        color: AppColors.primary,
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          itemCount: _feedPosts.length + 3 + (_feedLoadingMore ? 1 : 0) + (!_feedLoading && _feedFallbackTried && _feedPosts.isEmpty ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == 0) return Padding(padding: const EdgeInsets.only(bottom: 16), child: CreatePostBox(onPostCreated: () => _loadFeed(refresh: true)));
            if (index == 1) return const TrendingRail();
            if (index == 2 && (_feedLoading || (_feedPosts.isEmpty && !_feedFallbackTried))) {
              return Column(children: List.generate(3, (_) => const Padding(padding: EdgeInsets.only(bottom: 16), child: ShimmerCard(height: 220))));
            }
            if (index == 2 && !_feedLoading && _feedFallbackTried && _feedPosts.isEmpty) return const EmptyState(icon: Icons.dynamic_feed_rounded, title: 'No posts yet', subtitle: 'Be the first to share something with the community!');
            if (index == 2) return const SizedBox.shrink();
            final postIndex = index - 3;
            if (postIndex >= _feedPosts.length) return const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))));
            final post = _feedPosts[postIndex];
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
        return RefreshIndicator(
          onRefresh: () async => await _loadEvents(),
          color: AppColors.primary,
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
                        Text('My Events', style: GoogleFonts.plusJakartaSans(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5, height: 1.1)),
                        const SizedBox(height: 4),
                        Text('Plan, manage, and track all your events in one place', style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textTertiary, height: 1.4)),
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
      myEventsCount: _totalEvents,
      onRefresh: _loadAllData,
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
        style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search by title, location…',
          hintStyle: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary),
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
