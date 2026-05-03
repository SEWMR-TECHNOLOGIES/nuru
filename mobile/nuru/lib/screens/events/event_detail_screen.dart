import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';
import '../../core/services/events_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/report_generator.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import '../photos/my_photo_libraries_screen.dart';
import 'widgets/event_guests_tab.dart';
import 'widgets/event_budget_tab.dart';
import 'widgets/event_checklist_tab.dart';
import 'widgets/event_contributions_tab.dart';
import 'widgets/event_expenses_tab.dart';
import 'widgets/event_rsvp_tab.dart';
import 'widgets/event_checkin_tab.dart';
import 'widgets/event_tickets_tab.dart';
import 'widgets/event_committee_tab.dart';
import 'widgets/event_services_tab.dart';
import 'widgets/event_meetings_tab.dart';
import 'widgets/event_schedule_tab.dart';
import 'create_event_screen.dart';
import 'widgets/share_event_to_feed_sheet.dart';
import 'widgets/venue_map_preview.dart';
import 'report_preview_screen.dart';
import 'budget_assistant_screen.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../core/services/event_groups_service.dart';
import '../event_groups/event_group_workspace_screen.dart';

class EventDetailScreen extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? initialData;
  final String? knownRole;

  const EventDetailScreen({super.key, required this.eventId, this.initialData, this.knownRole});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> with TickerProviderStateMixin {
  static const List<String> _permissionFields = [
    'can_view_guests', 'can_manage_guests', 'can_send_invitations',
    'can_check_in_guests', 'can_view_budget', 'can_manage_budget',
    'can_view_contributions', 'can_manage_contributions', 'can_view_vendors',
    'can_manage_vendors', 'can_approve_bookings', 'can_edit_event',
    'can_manage_committee', 'can_view_expenses', 'can_manage_expenses',
  ];

  TabController? _tabCtrl;
  Map<String, dynamic>? _event;
  Map<String, dynamic>? _permissions;
  bool _loading = true;
  bool _permissionsResolved = false;
  String _permissionSource = 'unresolved';

  Map<String, dynamic> _contributionSummary = {};
  Map<String, dynamic> _budgetSummary = {};
  Map<String, dynamic> _expenseSummary = {};
  int _totalServices = 0;
  int _completedServices = 0;
  String? _currentUserName;

  List<String> _visibleTabs = const ['Overview'];
  static const Set<String> _creatorRoles = {'creator', 'organizer', 'owner'};
  static const Set<String> _committeeRoles = {'committee', 'member'};

  bool _asBool(dynamic value) => value == true || value == 1 || value == '1' || value == 'true';

  String? _roleHint(dynamic value) {
    if (value == null) return null;
    final role = value.toString().trim().toLowerCase();
    return role.isEmpty ? null : role;
  }

  String? _ownerIdFrom(Map<String, dynamic>? data) {
    if (data == null) return null;
    final owner = data['user_id'] ?? data['organizer_id'] ?? data['owner_id'] ?? data['created_by_id'] ?? data['created_by'];
    final id = owner?.toString();
    return (id == null || id.isEmpty) ? null : id;
  }

  void _seedRoleHintsFromNavigation() {
    final knownRoleHint = _roleHint(widget.knownRole);
    final initialRoleHint = _roleHint(widget.initialData?['role'] ?? widget.initialData?['viewer_role'] ?? widget.initialData?['my_role']);
    final creatorHint = _creatorRoles.contains(knownRoleHint) || _creatorRoles.contains(initialRoleHint) || _asBool(widget.initialData?['is_creator']);
    final committeeHint = _committeeRoles.contains(knownRoleHint) || _committeeRoles.contains(initialRoleHint);

    if (creatorHint) {
      _permissions = _creatorPermissions();
      _permissionsResolved = true;
      _permissionSource = 'navigation_creator';
      _rebuildTabs();
      return;
    }
    if (committeeHint) {
      _permissions = _normalizePermissions({'role': 'committee'});
      _permissionsResolved = true;
      _permissionSource = 'navigation_committee';
      _rebuildTabs();
    }
  }

  Map<String, dynamic> _creatorPermissions() {
    final map = <String, dynamic>{'is_creator': true, 'role': 'creator'};
    for (final field in _permissionFields) map[field] = true;
    return map;
  }

  Map<String, dynamic> _normalizePermissions(Map<String, dynamic>? raw) {
    final normalized = <String, dynamic>{'is_creator': false, 'role': null};
    for (final field in _permissionFields) normalized[field] = false;
    if (raw == null) return normalized;

    final role = raw['role']?.toString().toLowerCase();
    final isCreator = _asBool(raw['is_creator']) || role == 'creator' || role == 'organizer' || role == 'owner';
    if (isCreator) return _creatorPermissions();

    normalized['role'] = raw['role'];
    for (final field in _permissionFields) normalized[field] = _asBool(raw[field]);
    return normalized;
  }

  bool get _isCreator => _asBool(_permissions?['is_creator']);
  bool get _hasCommitteePermissions => _permissionFields.any((field) => _asBool(_permissions?[field]));
  bool get _isCommittee {
    final role = _permissions?['role']?.toString().toLowerCase();
    return !_isCreator && ((role != null && role.isNotEmpty && role != 'guest') || _hasCommitteePermissions);
  }
  bool get _hasManagementAccess => _isCreator || _isCommittee;

  List<String> _computeVisibleTabs() {
    if (_permissions == null) return ['overview'];
    if (!_hasManagementAccess) return ['overview'];
    if (_isCreator) return const ['overview', 'checklist', 'budget', 'expenses', 'services', 'committee', 'contributions', 'guests', 'rsvp', 'schedule', 'meetings', 'tickets', 'check_in'];

    final tabs = <String>['overview', 'checklist'];
    if (_asBool(_permissions?['can_view_budget']) || _asBool(_permissions?['can_manage_budget'])) tabs.add('budget');
    if (_asBool(_permissions?['can_view_expenses']) || _asBool(_permissions?['can_manage_expenses'])) tabs.add('expenses');
    tabs.add('services');
    if (_asBool(_permissions?['can_manage_committee'])) tabs.add('committee');
    if (_asBool(_permissions?['can_view_contributions']) || _asBool(_permissions?['can_manage_contributions'])) tabs.add('contributions');
    if (_asBool(_permissions?['can_view_guests']) || _asBool(_permissions?['can_manage_guests'])) tabs.add('guests');
    tabs.addAll(['rsvp', 'schedule', 'meetings', 'tickets']);
    if (_asBool(_permissions?['can_check_in_guests'])) tabs.add('check_in');
    return tabs;
  }

  void _rebuildTabs() {
    final newTabs = _computeVisibleTabs();
    if (_listsEqual(newTabs, _visibleTabs) && _tabCtrl != null && _tabCtrl!.length == newTabs.length) return;
    final previousIndex = _tabCtrl?.index ?? 0;
    _visibleTabs = newTabs;
    _tabCtrl?.dispose();
    _tabCtrl = TabController(length: _visibleTabs.length, vsync: this, initialIndex: previousIndex.clamp(0, _visibleTabs.length - 1));
  }

  bool _listsEqual(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 1, vsync: this);
    _event = widget.initialData;
    _seedRoleHintsFromNavigation();
    _loadEvent();
  }

  @override
  void dispose() {
    _tabCtrl?.dispose();
    super.dispose();
  }

  Future<void> _loadEvent() async {
    // Show loader only if we have nothing on screen yet. With initialData
    // (passed from the events list) we can render the header instantly.
    if (_event == null) setState(() => _loading = true);
    final fallbackErr = {'success': false, 'message': 'Request failed', 'data': null};

    // ── Phase 1: ONE blocking call — essential event payload (with inline permissions) ──
    Map<String, dynamic> eventRes;
    try {
      eventRes = await EventsService.getEventById(widget.eventId);
    } catch (_) {
      eventRes = Map<String, dynamic>.from(fallbackErr);
    }

    if (!mounted) return;

    final eventData = (eventRes['success'] == true && eventRes['data'] is Map)
        ? (eventRes['data'] as Map).cast<String, dynamic>() : null;

    // Inline permissions returned by /user-events/{id}?fields=essential
    final inlinePermissions = (eventData?['permissions'] is Map)
        ? (eventData!['permissions'] as Map).cast<String, dynamic>() : null;

    final knownRoleHint = _roleHint(widget.knownRole);
    final initialRoleHint = _roleHint(widget.initialData?['role'] ?? widget.initialData?['viewer_role'] ?? widget.initialData?['my_role']);
    final eventRoleHint = _roleHint(eventData?['role'] ?? eventData?['viewer_role'] ?? eventData?['my_role']);
    final permissionRoleHint = _roleHint(inlinePermissions?['role']);
    // current_user.id is already cached in AuthProvider — no need for AuthApi.me()
    String? currentUserId;
    try {
      final auth = context.read<AuthProvider>();
      currentUserId = auth.user?['id']?.toString();
      _currentUserName = auth.user?['first_name']?.toString();
    } catch (_) { /* provider unavailable, fine */ }
    final eventOwnerId = _ownerIdFrom(eventData);
    final initialOwnerId = _ownerIdFrom(widget.initialData);
    final ownerMatched = currentUserId != null && currentUserId.isNotEmpty &&
        (eventOwnerId == currentUserId || initialOwnerId == currentUserId);

    final creatorHint = _isCreator || _asBool(widget.initialData?['is_creator']) || _asBool(eventData?['is_creator']) ||
        _asBool(inlinePermissions?['is_creator']) || _creatorRoles.contains(knownRoleHint) || _creatorRoles.contains(initialRoleHint) ||
        _creatorRoles.contains(eventRoleHint) || _creatorRoles.contains(permissionRoleHint) || ownerMatched;

    final committeeHint = _committeeRoles.contains(knownRoleHint) || _committeeRoles.contains(initialRoleHint) ||
        _committeeRoles.contains(eventRoleHint) || _committeeRoles.contains(permissionRoleHint);

    if (creatorHint) {
      _permissions = _creatorPermissions();
      _permissionSource = ownerMatched ? 'owner_match' : 'creator_hint';
    } else if (inlinePermissions != null) {
      _permissions = _normalizePermissions(inlinePermissions);
      _permissionSource = 'inline_permissions';
    } else if (committeeHint) {
      _permissions = _normalizePermissions({'role': 'committee'});
      _permissionSource = 'committee_hint';
    } else {
      _permissions = _normalizePermissions(null);
      _permissionSource = 'fallback_guest';
    }
    _permissionsResolved = true;
    _rebuildTabs();

    setState(() {
      _loading = false;
      if (eventData != null) _event = eventData;
    });

    // ── Phase 2: Fire-and-forget overview summaries ──
    // These hydrate the stat cards on the Overview tab WITHOUT blocking the UI.
    // Each setState is independent so the cards fill in as data arrives.
    _hydrateOverviewSummaries();
  }

  Future<void> _hydrateOverviewSummaries() async {
    final eid = widget.eventId;
    final fallbackErr = {'success': false, 'message': 'Request failed', 'data': null};

    // Run the four summary calls in parallel but don't block the UI on them.
    final futures = await Future.wait([
      EventsService.getContributions(eid).catchError((_) => fallbackErr),
      EventsService.getBudget(eid).catchError((_) => fallbackErr),
      EventsService.getExpenses(eid).catchError((_) => fallbackErr),
      EventsService.getEventServices(eid).catchError((_) => fallbackErr),
    ]);

    if (!mounted) return;

    final contributionSummary = (futures[0]['success'] == true && futures[0]['data'] is Map)
        ? (((futures[0]['data'] as Map)['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{}) : <String, dynamic>{};
    final budgetSummary = (futures[1]['success'] == true && futures[1]['data'] is Map)
        ? (((futures[1]['data'] as Map)['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{}) : <String, dynamic>{};
    final expenseSummary = (futures[2]['success'] == true && futures[2]['data'] is Map)
        ? (((futures[2]['data'] as Map)['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{}) : <String, dynamic>{};
    final servicesData = futures[3]['data'];
    final servicesItems = servicesData is List ? servicesData
        : (servicesData is Map ? ((servicesData['items'] is List) ? servicesData['items'] as List
            : ((servicesData['services'] is List) ? servicesData['services'] as List : <dynamic>[])) : <dynamic>[]);
    final completedServices = servicesItems.where((s) {
      if (s is! Map) return false;
      return s['service_status'] == 'completed' || s['status'] == 'completed';
    }).length;

    setState(() {
      _contributionSummary = contributionSummary;
      _budgetSummary = budgetSummary;
      _expenseSummary = expenseSummary;
      _totalServices = servicesItems.length;
      _completedServices = completedServices;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarContrastEnforced: false,
      ),
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: (_loading && _event == null) || (!_permissionsResolved && _event != null)
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    final e = _event ?? {};
    final title = extractStr(e['title'], fallback: 'Event');
    final cover = e['cover_image']?.toString();
    final status = extractStr(e['status'], fallback: 'draft');
    final location = extractStr(e['location']);
    final venue = extractStr(e['venue']);
    final startDate = extractStr(e['start_date']);
    final startTime = extractStr(e['start_time']);
    final eventType = extractStr(e['event_type']);

    return NestedScrollView(
      headerSliverBuilder: (context, innerBoxIsScrolled) => [
        // Light app bar (matches mockup)
        SliverAppBar(
          pinned: true,
          backgroundColor: AppColors.surface,
          surfaceTintColor: AppColors.surface,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: true,
          systemOverlayStyle: SystemUiOverlayStyle.dark,
          leading: IconButton(
            onPressed: () => Navigator.pop(context),
            icon: SvgPicture.asset('assets/icons/arrow-left-icon.svg', width: 22, height: 22,
                colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
          ),
          title: Text('Manage Event', style: appText(size: 16, weight: FontWeight.w700)),
          actions: [
            IconButton(
              onPressed: _showEventActions,
              icon: const Icon(Icons.more_horiz_rounded, color: AppColors.textPrimary, size: 22),
            ),
          ],
        ),
        // Header card with cover, title, badge, date, location
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(
                  width: 72, height: 72,
                  child: cover != null && cover.isNotEmpty
                      ? Image.network(cover, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.surfaceVariant))
                      : Container(color: AppColors.primarySoft, child: Center(child: SvgPicture.asset('assets/icons/calendar-icon.svg', width: 24, height: 24, colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)))),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: appText(size: 17, weight: FontWeight.w800, letterSpacing: -0.3))),
                  const SizedBox(width: 8),
                  _statusBadge(status),
                ]),
                if (startDate.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    SvgPicture.asset('assets/icons/calendar-icon.svg', width: 12, height: 12,
                        colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                    const SizedBox(width: 5),
                    Flexible(child: Text(_formatDate(startDate) + (startTime.isNotEmpty ? '  •  $startTime' : ''),
                        style: appText(size: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                ],
                if (location.isNotEmpty || venue.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(children: [
                    SvgPicture.asset('assets/icons/location-icon.svg', width: 12, height: 12,
                        colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                    const SizedBox(width: 5),
                    Expanded(child: Text([venue, location].where((s) => s.isNotEmpty).join(', '),
                        style: appText(size: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                ],
              ])),
            ]),
          ),
        ),
        SliverPersistentHeader(
          pinned: true,
          delegate: _TabBarDelegate(
            TabBar(
              controller: _tabCtrl, isScrollable: true, tabAlignment: TabAlignment.start,
              indicatorColor: AppColors.primary, indicatorWeight: 3,
              indicatorSize: TabBarIndicatorSize.label,
              labelColor: AppColors.primary, unselectedLabelColor: AppColors.textTertiary,
              labelStyle: appText(size: 13, weight: FontWeight.w700),
              unselectedLabelStyle: appText(size: 13, weight: FontWeight.w500),
              dividerColor: AppColors.borderLight,
              tabs: _visibleTabs.map((t) => Tab(text: context.trw(t))).toList(),
            ),
          ),
        ),
      ],
      body: TabBarView(
        controller: _tabCtrl,
        children: _visibleTabs.map((tab) => _buildTabContent(tab)).toList(),
      ),
    );
  }

  Widget _buildTabContent(String tab) {
    switch (tab) {
      case 'overview': return _overviewTab();
      case 'checklist': return EventChecklistTab(eventId: widget.eventId, eventTypeId: _event?['event_type_id']?.toString() ?? _event?['event_type']?['id']?.toString());
      case 'budget': return EventBudgetTab(eventId: widget.eventId, permissions: _permissions, eventTitle: extractStr((_event ?? {})['title']), eventBudget: (_event?['budget'] is num) ? (_event!['budget'] as num).toDouble() : double.tryParse((_event?['budget'] ?? '').toString()));
      case 'expenses': return EventExpensesTab(eventId: widget.eventId, permissions: _permissions, eventTitle: extractStr((_event ?? {})['title']), eventBudget: (_event?['budget'] is num) ? (_event!['budget'] as num).toDouble() : double.tryParse((_event?['budget'] ?? '').toString()));
      case 'services': return EventServicesTab(eventId: widget.eventId, permissions: _permissions, eventTypeId: _event?['event_type_id']?.toString() ?? _event?['event_type']?['id']?.toString());
      case 'committee': return EventCommitteeTab(eventId: widget.eventId, permissions: _permissions, eventTitle: extractStr((_event ?? {})['title']));
      case 'contributions': return EventContributionsTab(
        eventId: widget.eventId,
        permissions: _permissions,
        eventTitle: extractStr((_event ?? {})['title']),
        eventBudget: (_event?['budget'] is num) ? (_event!['budget'] as num).toDouble() : double.tryParse((_event?['budget'] ?? '').toString()),
        isCreator: _permissions?['is_creator'] == true,
      );
      case 'guests': return EventGuestsTab(eventId: widget.eventId, permissions: _permissions);
      case 'rsvp': return EventRsvpTab(eventId: widget.eventId);
      case 'schedule': return EventScheduleTab(eventId: widget.eventId);
      case 'meetings': return EventMeetingsTab(eventId: widget.eventId, isCreator: _isCreator, permissions: _permissions, eventName: extractStr((_event ?? {})['title']));
      case 'tickets': return EventTicketsTab(eventId: widget.eventId, permissions: _permissions);
      // workspace tab removed — Group Chat lives on the overview as a CTA card
      case 'check_in': return EventCheckinTab(
        eventId: widget.eventId, permissions: _permissions,
        eventTitle: extractStr((_event ?? {})['title']),
        eventDate: extractStr((_event ?? {})['start_date']),
        eventLocation: extractStr((_event ?? {})['location']),
        guestCount: (_event ?? {})['guest_count'] ?? (_event ?? {})['total_guests'] ?? (_event ?? {})['expected_guests'] ?? 0,
        confirmedCount: (_event ?? {})['confirmed_guest_count'] ?? 0,
      );
      default: return const SizedBox.shrink();
    }
  }

  bool _hasVenueCoordinates() {
    final vc = (_event ?? {})['venue_coordinates'];
    if (vc is! Map) return false;
    final lat = double.tryParse(vc['latitude']?.toString() ?? '');
    final lng = double.tryParse(vc['longitude']?.toString() ?? '');
    return lat != null && lng != null && lat != 0 && lng != 0;
  }

  Widget _overviewTab() {
    final e = _event ?? {};
    final description = extractStr(e['description']);
    final guestCount = e['guest_count'] ?? e['total_guests'] ?? e['expected_guests'] ?? 0;
    final expectedGuests = e['expected_guests'] ?? 0;
    final confirmedGuests = e['confirmed_guest_count'] ?? 0;
    final budget = e['budget'];
    final budgetNum = budget != null ? (budget is num ? budget.toDouble() : double.tryParse(budget.toString()) ?? 0.0) : 0.0;

    final totalPledged = (_contributionSummary['total_pledged'] ?? _contributionSummary['total_amount'] ?? 0).toDouble();
    final totalPaid = (_contributionSummary['total_paid'] ?? _contributionSummary['total_confirmed'] ?? 0).toDouble();
    final pledgedCount = _contributionSummary['pledged_count'] ?? _contributionSummary['confirmed_count'] ?? 0;
    final paidCount = _contributionSummary['paid_count'] ?? 0;
    final unpledged = budgetNum > 0 ? (budgetNum - totalPledged).clamp(0, double.infinity) : 0.0;
    final outstanding = (totalPledged - totalPaid).clamp(0, double.infinity);
    final collectionRate = totalPledged > 0 ? ((totalPaid / totalPledged) * 100).round() : 0;

    return RefreshIndicator(
      onRefresh: _loadEvent, color: AppColors.primary,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        if (_isCreator) ...[
          _EventGroupCta(eventId: widget.eventId),
          const SizedBox(height: 16),
        ],
        _sectionHeader(context.trw('financial_overview')),
        const SizedBox(height: 10),
        _financialCard(label: context.trw('budget_status'), value: budgetNum > 0 ? formatTZS(budgetNum) : context.trw('not_set'), subtitle: context.trw('budget_allocated'),
          iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB), icon: Icons.account_balance_wallet_rounded),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _financialCard(label: context.trw('total_pledged'), value: formatTZS(totalPledged), subtitle: '$pledgedCount ${context.trw('contributors')}',
            iconBg: const Color(0xFFF3E8FF), iconColor: const Color(0xFF9333EA), icon: Icons.people_alt_rounded)),
          if (budgetNum > 0) ...[
            const SizedBox(width: 8),
            Expanded(child: _financialCard(label: context.trw('unpledged'), value: formatTZS(unpledged), subtitle: '${context.trw('budget')} − ${context.trw('pledged')}',
              iconBg: const Color(0xFFFEE2E2), iconColor: const Color(0xFFDC2626), icon: Icons.money_off_rounded)),
          ],
        ]),
        const SizedBox(height: 12),
        _cashInHandCard(totalPaid, paidCount, outstanding, collectionRate),
        const SizedBox(height: 16),
        _sectionHeader(context.trw('event_progress')),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: _progressCard()),
          const SizedBox(width: 8),
          Expanded(child: _financialCard(label: context.trw('guest_overview'), value: '$guestCount', subtitle: '${context.trw('of')} $expectedGuests ${context.trw('expected_guests').toLowerCase()}',
            iconBg: const Color(0xFFDCFCE7), iconColor: const Color(0xFF16A34A), icon: Icons.people_rounded)),
        ]),
        const SizedBox(height: 8),
        _financialCard(label: context.trw('confirmed_guests'), value: '$confirmedGuests', subtitle: context.trw('guests_confirmed_attendance'),
          iconBg: const Color(0xFFDCFCE7), iconColor: const Color(0xFF16A34A), icon: Icons.how_to_reg_rounded),
        if (description.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(context.trw('event_description'), style: appText(size: 10, color: AppColors.textTertiary)),
              const SizedBox(height: 6),
              Text(description, style: appText(size: 14, color: AppColors.textSecondary, height: 1.6)),
            ]),
          ),
        ],
        if (_hasVenueCoordinates()) ...[
          const SizedBox(height: 16),
          VenueMapPreview(
            latitude: double.parse(e['venue_coordinates']['latitude'].toString()),
            longitude: double.parse(e['venue_coordinates']['longitude'].toString()),
            venueName: extractStr(e['venue']).isNotEmpty ? extractStr(e['venue']) : (extractStr(e['location']).isNotEmpty ? extractStr(e['location']) : null),
            address: extractStr(e['venue_address']).isNotEmpty ? extractStr(e['venue_address']) : null,
          ),
        ],
        const SizedBox(height: 20),
      ]),
    );
  }

  Widget _cashInHandCard(double totalPaid, int paidCount, double outstanding, int collectionRate) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.05), borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(context.trw('cash_in_hand'), style: appText(size: 11, color: AppColors.textTertiary)),
            const SizedBox(height: 4),
            Text(formatTZS(totalPaid), style: appText(size: 22, weight: FontWeight.w800, color: AppColors.primary)),
          ])),
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.check_circle_rounded, size: 22, color: AppColors.primary),
          ),
        ]),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            Expanded(child: _cashStat('$paidCount', context.trw('paid_contributors'))),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(child: _cashStat(formatTZS(outstanding), context.trw('outstanding'))),
            Container(width: 1, height: 36, color: AppColors.border),
            Expanded(child: _cashStat('$collectionRate%', context.trw('collection_rate'))),
          ]),
        ),
      ]),
    );
  }

  Widget _progressCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(context.trw('event_progress'), style: appText(size: 11, color: AppColors.textTertiary)),
        const SizedBox(height: 6),
        Text('$_completedServices/$_totalServices ${context.trw('services')}', style: appText(size: 15, weight: FontWeight.w700)),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: _totalServices > 0 ? _completedServices / _totalServices : 0,
            minHeight: 6, backgroundColor: AppColors.border,
            valueColor: const AlwaysStoppedAnimation(AppColors.primary),
          ),
        ),
      ]),
    );
  }

  Widget _sectionHeader(String title) => Text(title, style: appText(size: 15, weight: FontWeight.w700));

  Widget _financialCard({required String label, required String value, required String subtitle, required Color iconBg, required Color iconColor, required IconData icon}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: appText(size: 11, color: AppColors.textTertiary)),
          const SizedBox(height: 4),
          Text(value, style: appText(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(subtitle, style: appText(size: 10, color: AppColors.textTertiary)),
        ])),
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: iconColor),
        ),
      ]),
    );
  }

  Widget _cashStat(String value, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(children: [
        Text(value, style: appText(size: 14, weight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label, style: appText(size: 9, color: AppColors.textTertiary), textAlign: TextAlign.center),
      ]),
    );
  }

  Widget _statusBadge(String status) {
    final isPublished = status == 'published' || status == 'confirmed';
    final isCompleted = status == 'completed';
    final isCancelled = status == 'cancelled';
    Color c = AppColors.textTertiary;
    Color bg = const Color(0xFFF1F5F9);
    if (isPublished) { c = const Color(0xFF15803D); bg = const Color(0xFFDCFCE7); }
    else if (isCompleted) { c = AppColors.blue; bg = const Color(0xFFDBEAFE); }
    else if (isCancelled) { c = AppColors.error; bg = const Color(0xFFFEE2E2); }
    final label = status.isEmpty ? '' : status[0].toUpperCase() + status.substring(1);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (isPublished) Padding(padding: const EdgeInsets.only(right: 3), child: Icon(Icons.check_circle, size: 11, color: c)),
        Text(label, style: appText(size: 10, weight: FontWeight.w700, color: c)),
      ]),
    );
  }

  Widget _statChip(String svgAsset, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border.withOpacity(0.5))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset(svgAsset, width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)),
        const SizedBox(width: 5),
        Flexible(child: Text(text, style: appText(size: 12, color: AppColors.textSecondary, weight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
      ]),
    );
  }

  void _showEventActions() {
    final isCreator = _permissions?['is_creator'] == true;
    final canEdit = _permissions?['can_edit_event'] == true || isCreator;
    final status = extractStr(_event?['status'], fallback: 'draft');
    showModalBottomSheet(
      context: context, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, margin: const EdgeInsets.only(top: 12), decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          if (canEdit) _actionTile(Icons.edit_rounded, context.trw('edit_event_btn'), () { Navigator.pop(ctx); _editEvent(); }),
          if (isCreator) _actionTile(Icons.photo_library_outlined, context.trw('event_photo_libraries'), () {
            Navigator.pop(ctx);
            Navigator.push(context, MaterialPageRoute(builder: (_) => MyPhotoLibrariesScreen(eventId: widget.eventId, title: context.trw('event_photo_libraries'))));
          }),
          if (isCreator && status == 'draft') _actionTile(Icons.publish_rounded, context.trw('publish_event_btn'), () { Navigator.pop(ctx); _changeStatus('published'); }),
          if (isCreator && status == 'published') _actionTile(Icons.cancel_outlined, context.trw('cancel_event'), () { Navigator.pop(ctx); _changeStatus('cancelled'); }),
          _actionTile(Icons.description_rounded, context.trw('event_summary_report'), () { Navigator.pop(ctx); _generateFullReport(); }),
          _actionTile(Icons.auto_awesome_rounded, context.trw('ai_budget_assistant'), () {
            Navigator.pop(ctx);
            Navigator.push(context, MaterialPageRoute(builder: (_) => BudgetAssistantScreen(
              eventType: _event?['event_type_id']?.toString(),
              eventTypeName: extractStr(_event?['event_type']),
              eventTitle: extractStr(_event?['title']),
              location: extractStr(_event?['location']),
              expectedGuests: (_event?['expected_guests'] ?? '').toString(),
              budget: (_event?['budget'] ?? '').toString(),
              firstName: _currentUserName,
              onSaveBudget: (total) {
                final amount = double.tryParse(total);
                if (amount != null) {
                  EventsService.updateEvent(widget.eventId, budget: amount).then((_) => _loadEvent());
                  AppSnackbar.success(context, 'Budget updated to TZS $total');
                }
              },
            )));
          }),
          if (isCreator) _actionTile(Icons.delete_outline_rounded, context.trw('delete_event'), () { Navigator.pop(ctx); _confirmDelete(); }, isDestructive: true),
          _actionTile(Icons.share_rounded, context.trw('share_event'), () {
            Navigator.pop(ctx);
            if (_event != null) {
              ShareEventToFeedSheet.show(context, _event!);
            }
          }),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }

  Widget _actionTile(IconData icon, String label, VoidCallback onTap, {bool isDestructive = false}) {
    return ListTile(
      leading: Icon(icon, color: isDestructive ? AppColors.error : AppColors.textSecondary, size: 22),
      title: Text(label, style: appText(size: 15, weight: FontWeight.w600, color: isDestructive ? AppColors.error : AppColors.textPrimary)),
      onTap: onTap,
    );
  }

  void _editEvent() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => CreateEventScreen(editEvent: _event))).then((result) {
      if (result == true) _loadEvent();
    });
  }

  void _generateFullReport() {
    _showReportFormatPicker(context.trw('event_summary_report'), (format) async {
      AppSnackbar.success(context, context.trw('generating_report'));
      final res = await ReportGenerator.generateEventReport(widget.eventId, format: format, eventData: _event);
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(context, MaterialPageRoute(builder: (_) => ReportPreviewScreen(title: context.trw('event_summary_report'), pdfBytes: res['bytes'] as Uint8List, filePath: res['path'] as String?)));
        } else if (res['path'] != null) {
          AppSnackbar.success(context, context.trw('report_saved'));
        }
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    });
  }

  void _showReportFormatPicker(String title, Future<void> Function(String format) onSelect) {
    showModalBottomSheet(
      context: context, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, margin: const EdgeInsets.only(top: 12), decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Text(title, style: appText(size: 16, weight: FontWeight.w700))),
          const SizedBox(height: 16),
          ListTile(
            leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.picture_as_pdf_rounded, size: 20, color: Color(0xFFDC2626))),
            title: Text(context.trw('pdf_report'), style: appText(size: 14, weight: FontWeight.w600)),
            subtitle: Text(context.trw('preview_and_share'), style: appText(size: 12, color: AppColors.textTertiary)),
            onTap: () { Navigator.pop(ctx); onSelect('pdf'); },
          ),
          ListTile(
            leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.table_chart_rounded, size: 20, color: Color(0xFF16A34A))),
            title: Text(context.trw('excel_report'), style: appText(size: 14, weight: FontWeight.w600)),
            subtitle: Text(context.trw('open_in_spreadsheet'), style: appText(size: 12, color: AppColors.textTertiary)),
            onTap: () { Navigator.pop(ctx); onSelect('xlsx'); },
          ),
          const SizedBox(height: 20),
        ]),
      ),
    );
  }

  Future<void> _changeStatus(String newStatus) async {
    final res = await EventsService.updateEventStatus(widget.eventId, newStatus);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Event ${newStatus == 'published' ? 'published' : 'cancelled'}');
        _loadEvent();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.trw('delete_event_confirm'), style: appText(size: 18, weight: FontWeight.w700)),
        content: Text(context.trw('action_cannot_undone'), style: appText(size: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(context.trw('cancel'), style: appText(size: 14, weight: FontWeight.w600, color: AppColors.textSecondary))),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final res = await EventsService.deleteEvent(widget.eventId);
              if (mounted) {
                if (res['success'] == true) { AppSnackbar.success(context, context.trw('event_deleted')); Navigator.pop(context); }
                else { AppSnackbar.error(context, res['message'] ?? 'Failed'); }
              }
            },
            child: Text(context.trw('delete'), style: appText(size: 14, weight: FontWeight.w700, color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return '${weekdays[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return dateStr;
    }
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  _TabBarDelegate(this.tabBar);
  @override double get minExtent => tabBar.preferredSize.height;
  @override double get maxExtent => tabBar.preferredSize.height;
  @override Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => Container(color: AppColors.surface, child: tabBar);
  @override bool shouldRebuild(covariant _TabBarDelegate oldDelegate) => false;
}

/// Premium CTA card on the Event Overview tab. Shows "Open Group Chat" when
/// a group already exists, otherwise "Create Group Chat".
class _EventGroupCta extends StatefulWidget {
  final String eventId;
  const _EventGroupCta({required this.eventId});
  @override
  State<_EventGroupCta> createState() => _EventGroupCtaState();
}

class _EventGroupCtaState extends State<_EventGroupCta> {
  bool _loading = true;
  bool _busy = false;
  Map<String, dynamic>? _group;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final res = await EventGroupsService.getForEvent(widget.eventId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _group = (res['success'] == true && res['data'] is Map<String, dynamic>)
          ? res['data'] as Map<String, dynamic> : null;
    });
  }

  Future<void> _createOrOpen() async {
    if (_busy) return;
    setState(() => _busy = true);
    final res = await EventGroupsService.openOrCreateForEvent(widget.eventId);
    if (!mounted) return;
    setState(() => _busy = false);
    final id = res['data']?['id']?.toString();
    if (id != null) {
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => EventGroupWorkspaceScreen(groupId: id),
      )).then((_) => _refresh());
    } else {
      AppSnackbar.error(context, res['message']?.toString() ?? 'Could not create group');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    final hasGroup = _group != null;
    final memberCount = (_group?['member_count'] ?? 0) as int;
    final unread = (_group?['unread_count'] ?? 0) as int;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary.withOpacity(0.12), AppColors.primary.withOpacity(0.04)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.25)),
      ),
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.18), borderRadius: BorderRadius.circular(12)),
          child: Icon(Icons.chat_bubble_rounded, color: AppColors.primary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(hasGroup ? 'Group Chat' : 'Create the Group Chat',
            style: appText(size: 14, weight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 2),
          Text(hasGroup
              ? '$memberCount members${unread > 0 ? " · $unread unread" : ""}'
              : 'Private chat for your organizer team, committee and contributors — with a live contribution scoreboard.',
            style: appText(size: 11, color: AppColors.textSecondary, height: 1.4)),
        ])),
        const SizedBox(width: 8),
        ElevatedButton(
          onPressed: _busy ? null : _createOrOpen,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary, foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10), elevation: 0,
          ),
          child: _busy
              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text(hasGroup ? 'Open' : 'Create',
                  style: appText(size: 12, weight: FontWeight.w700, color: Colors.white)),
        ),
      ]),
    );
  }
}


