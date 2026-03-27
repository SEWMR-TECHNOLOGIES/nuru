import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/events_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/report_generator.dart';
import '../../core/widgets/app_snackbar.dart';
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
import '../../core/widgets/agreement_gate.dart';
import 'report_preview_screen.dart';
import 'budget_assistant_screen.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.4, double letterSpacing = 0}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height, letterSpacing: letterSpacing);

String _str(dynamic v, {String fallback = ''}) {
  if (v == null) return fallback;
  if (v is String) return v.isEmpty ? fallback : v;
  if (v is Map) return (v['name'] ?? v['title'] ?? v['label'] ?? v.values.first)?.toString() ?? fallback;
  return v.toString();
}

class EventDetailScreen extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? initialData;
  /// Known role from the event list ('creator', 'committee') — used as fallback if permissions API fails
  final String? knownRole;

  const EventDetailScreen({super.key, required this.eventId, this.initialData, this.knownRole});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> with TickerProviderStateMixin {
  static const List<String> _permissionFields = [
    'can_view_guests',
    'can_manage_guests',
    'can_send_invitations',
    'can_check_in_guests',
    'can_view_budget',
    'can_manage_budget',
    'can_view_contributions',
    'can_manage_contributions',
    'can_view_vendors',
    'can_manage_vendors',
    'can_approve_bookings',
    'can_edit_event',
    'can_manage_committee',
    'can_view_expenses',
    'can_manage_expenses',
  ];

  TabController? _tabCtrl;
  Map<String, dynamic>? _event;
  Map<String, dynamic>? _permissions;
  bool _loading = true;
  bool _permissionsResolved = false;
  String _permissionSource = 'unresolved';

  // Extra data for overview parity with web
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
    final creatorHint =
        _creatorRoles.contains(knownRoleHint) ||
        _creatorRoles.contains(initialRoleHint) ||
        _asBool(widget.initialData?['is_creator']);
    final committeeHint =
        _committeeRoles.contains(knownRoleHint) ||
        _committeeRoles.contains(initialRoleHint);

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
    for (final field in _permissionFields) {
      map[field] = true;
    }
    return map;
  }

  Map<String, dynamic> _normalizePermissions(Map<String, dynamic>? raw) {
    final normalized = <String, dynamic>{'is_creator': false, 'role': null};
    for (final field in _permissionFields) {
      normalized[field] = false;
    }
    if (raw == null) return normalized;

    final role = raw['role']?.toString().toLowerCase();
    final isCreator = _asBool(raw['is_creator']) || role == 'creator' || role == 'organizer' || role == 'owner';
    if (isCreator) return _creatorPermissions();

    normalized['role'] = raw['role'];
    for (final field in _permissionFields) {
      normalized[field] = _asBool(raw[field]);
    }
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
    if (_permissions == null) return ['Overview'];

    // Guests only see Overview — no management tabs
    if (!_hasManagementAccess) return ['Overview'];

    // Creator sees all tabs
    if (_isCreator) return const ['Overview', 'Checklist', 'Budget', 'Expenses', 'Services', 'Committee', 'Contributions', 'Guests', 'RSVP', 'Tickets', 'Check-In'];

    // Committee members see tabs based on their permissions
    final tabs = <String>['Overview'];
    tabs.add('Checklist');
    if (_asBool(_permissions?['can_view_budget']) || _asBool(_permissions?['can_manage_budget'])) tabs.add('Budget');
    if (_asBool(_permissions?['can_view_expenses']) || _asBool(_permissions?['can_manage_expenses'])) tabs.add('Expenses');
    tabs.add('Services');
    if (_asBool(_permissions?['can_manage_committee'])) tabs.add('Committee');
    if (_asBool(_permissions?['can_view_contributions']) || _asBool(_permissions?['can_manage_contributions'])) tabs.add('Contributions');
    if (_asBool(_permissions?['can_view_guests']) || _asBool(_permissions?['can_manage_guests'])) tabs.add('Guests');
    tabs.add('RSVP');
    tabs.add('Tickets');
    if (_asBool(_permissions?['can_check_in_guests'])) tabs.add('Check-In');
    return tabs;
  }

  void _rebuildTabs() {
    final newTabs = _computeVisibleTabs();
    // Only rebuild TabController if tabs actually changed — prevents flicker on refresh
    if (_listsEqual(newTabs, _visibleTabs) && _tabCtrl != null && _tabCtrl!.length == newTabs.length) return;
    final previousIndex = _tabCtrl?.index ?? 0;
    _visibleTabs = newTabs;
    _tabCtrl?.dispose();
    _tabCtrl = TabController(
      length: _visibleTabs.length,
      vsync: this,
      initialIndex: previousIndex.clamp(0, _visibleTabs.length - 1),
    );
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
    setState(() => _loading = true);
    debugPrint('[EventDetail] open event_id=${widget.eventId} knownRole=${widget.knownRole}');

    final fallbackErr = {'success': false, 'message': 'Request failed', 'data': null};

    late List<Map<String, dynamic>> results;
    try {
      results = await Future.wait([
        EventsService.getEventById(widget.eventId).catchError((_) => fallbackErr),
        EventsService.getMyPermissions(widget.eventId).catchError((_) => fallbackErr),
        EventsService.getContributions(widget.eventId).catchError((_) => fallbackErr),
        EventsService.getBudget(widget.eventId).catchError((_) => fallbackErr),
        EventsService.getExpenses(widget.eventId).catchError((_) => fallbackErr),
        EventsService.getEventServices(widget.eventId).catchError((_) => fallbackErr),
        AuthApi.me().catchError((_) => fallbackErr),
      ]);
    } catch (e) {
      debugPrint('[EventDetail] Future.wait failed: $e');
      results = List.filled(7, fallbackErr);
    }

    if (!mounted) return;

    final Map<String, dynamic>? eventData =
        (results[0]['success'] == true && results[0]['data'] is Map)
            ? (results[0]['data'] as Map).cast<String, dynamic>()
            : null;
    final Map<String, dynamic>? apiPermissions =
        (results[1]['success'] == true && results[1]['data'] is Map)
            ? (results[1]['data'] as Map).cast<String, dynamic>()
            : null;
    final Map<String, dynamic>? meData =
        (results[6]['success'] == true && results[6]['data'] is Map)
            ? (results[6]['data'] as Map).cast<String, dynamic>()
            : null;
    _currentUserName = meData?['first_name']?.toString();

    debugPrint('[EventDetail] event response success=${results[0]['success']} role=${eventData?['viewer_role']} is_creator=${eventData?['is_creator']}');
    debugPrint('[EventDetail] permissions response success=${results[1]['success']} data=${results[1]['data']}');

    final knownRoleHint = _roleHint(widget.knownRole);
    final initialRoleHint = _roleHint(widget.initialData?['role'] ?? widget.initialData?['viewer_role'] ?? widget.initialData?['my_role']);
    final eventRoleHint = _roleHint(eventData?['role'] ?? eventData?['viewer_role'] ?? eventData?['my_role']);
    final permissionRoleHint = _roleHint(apiPermissions?['role']);
    final currentUserId = meData?['id']?.toString();
    final eventOwnerId = _ownerIdFrom(eventData);
    final initialOwnerId = _ownerIdFrom(widget.initialData);
    final ownerMatched =
        currentUserId != null &&
        currentUserId.isNotEmpty &&
        (eventOwnerId == currentUserId || initialOwnerId == currentUserId);

    final creatorHint =
        _isCreator ||
        _asBool(widget.initialData?['is_creator']) ||
        _asBool(eventData?['is_creator']) ||
        _asBool(apiPermissions?['is_creator']) ||
        _creatorRoles.contains(knownRoleHint) ||
        _creatorRoles.contains(initialRoleHint) ||
        _creatorRoles.contains(eventRoleHint) ||
        _creatorRoles.contains(permissionRoleHint) ||
        ownerMatched;

    final committeeHint =
        _committeeRoles.contains(knownRoleHint) ||
        _committeeRoles.contains(initialRoleHint) ||
        _committeeRoles.contains(eventRoleHint) ||
        _committeeRoles.contains(permissionRoleHint);

    final contributionSummary = (results[2]['success'] == true && results[2]['data'] is Map)
        ? (((results[2]['data'] as Map)['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{})
        : <String, dynamic>{};
    final budgetSummary = (results[3]['success'] == true && results[3]['data'] is Map)
        ? (((results[3]['data'] as Map)['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{})
        : <String, dynamic>{};
    final expenseSummary = (results[4]['success'] == true && results[4]['data'] is Map)
        ? (((results[4]['data'] as Map)['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{})
        : <String, dynamic>{};
    final servicesData = results[5]['data'];
    final servicesItems = servicesData is List
        ? servicesData
        : (servicesData is Map
            ? ((servicesData['items'] is List)
                ? servicesData['items'] as List
                : ((servicesData['services'] is List) ? servicesData['services'] as List : <dynamic>[]))
            : <dynamic>[]);
    final completedServices = servicesItems.where((s) {
      if (s is! Map) return false;
      return s['service_status'] == 'completed' || s['status'] == 'completed';
    }).length;

    if (creatorHint) {
      _permissions = _creatorPermissions();
      _permissionSource = ownerMatched ? 'owner_match' : 'creator_hint';
    } else if (apiPermissions != null) {
      _permissions = _normalizePermissions(apiPermissions);
      _permissionSource = 'permissions_api';
    } else if (committeeHint) {
      _permissions = _normalizePermissions({'role': 'committee'});
      _permissionSource = 'committee_hint';
    } else {
      _permissions = _normalizePermissions(null);
      _permissionSource = 'fallback_guest';
    }
    _permissionsResolved = true;

    debugPrint(
      '[EventDetail] role_hints known=$knownRoleHint initial=$initialRoleHint event=$eventRoleHint perm=$permissionRoleHint creator_hint=$creatorHint committee_hint=$committeeHint owner_match=$ownerMatched owner_event=$eventOwnerId owner_initial=$initialOwnerId me=$currentUserId',
    );

    _rebuildTabs();
    debugPrint('[EventDetail] resolved role=${_permissions?['role']} is_creator=${_permissions?['is_creator']} source=$_permissionSource tabs=${_visibleTabs.join(', ')}');

    setState(() {
      _loading = false;
      if (eventData != null) _event = eventData;
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
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarContrastEnforced: false,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: (_loading && _event == null) || (!_permissionsResolved && _event != null)
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    final e = _event ?? {};
    final title = _str(e['title'], fallback: 'Event');
    final cover = e['cover_image']?.toString();
    final status = _str(e['status'], fallback: 'draft');
    final location = _str(e['location']);
    final venue = _str(e['venue']);
    final startDate = _str(e['start_date']);
    final description = _str(e['description']);
    final guestCount = e['guest_count'] ?? e['total_guests'] ?? e['expected_guests'] ?? 0;
    final confirmedGuests = e['confirmed_guest_count'] ?? 0;
    final eventType = _str(e['event_type']);

    return NestedScrollView(
      headerSliverBuilder: (context, innerBoxIsScrolled) => [
        SliverAppBar(
          expandedHeight: 220, pinned: true, backgroundColor: AppColors.primary,
          leading: GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
              child: Center(child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 22, height: 22, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn))),
            ),
          ),
          actions: [
            GestureDetector(
              onTap: () => _showEventActions(),
              child: Container(
                margin: const EdgeInsets.all(8), padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.more_horiz_rounded, color: Colors.white, size: 20),
              ),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: cover != null
                ? Image.network(cover, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.primary))
                : Container(color: AppColors.primary),
          ),
        ),
        SliverToBoxAdapter(
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(child: Text(title, style: _f(size: 22, weight: FontWeight.w800, letterSpacing: -0.5))),
                  const SizedBox(width: 8),
                  _statusBadge(status),
                ]),
                if (startDate.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(children: [
                    SvgPicture.asset('assets/icons/calendar-icon.svg', width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                    const SizedBox(width: 6),
                    Flexible(child: Text(_formatDate(startDate), style: _f(size: 13, color: AppColors.textSecondary, height: 1.5))),
                  ]),
                ],
                if (location.isNotEmpty || venue.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(children: [
                    SvgPicture.asset('assets/icons/location-icon.svg', width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                    const SizedBox(width: 6),
                    Expanded(child: Text([venue, location].where((s) => s.isNotEmpty).join(', '), style: _f(size: 13, color: AppColors.textSecondary, height: 1.5), maxLines: 2, overflow: TextOverflow.ellipsis)),
                  ]),
                ],
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(description, style: _f(size: 14, color: AppColors.textSecondary, height: 1.5), maxLines: 3, overflow: TextOverflow.ellipsis),
                ],
                const SizedBox(height: 16),
                Wrap(spacing: 10, runSpacing: 8, children: [
                  _statChip('assets/icons/user-icon.svg', '$guestCount guests'),
                  if (confirmedGuests > 0) _statChip('assets/icons/user-icon.svg', '$confirmedGuests confirmed'),
                  if (eventType.isNotEmpty) _statChip('assets/icons/calendar-icon.svg', eventType),
                ]),
              ],
            ),
          ),
        ),
        SliverPersistentHeader(
          pinned: true,
          delegate: _TabBarDelegate(
            TabBar(
              controller: _tabCtrl, isScrollable: true, tabAlignment: TabAlignment.start,
              indicatorColor: AppColors.primary, indicatorWeight: 2.5,
              labelColor: AppColors.primary, unselectedLabelColor: AppColors.textTertiary,
              labelStyle: _f(size: 13, weight: FontWeight.w700), unselectedLabelStyle: _f(size: 13, weight: FontWeight.w500),
              tabs: _visibleTabs.map((t) => Tab(text: t)).toList(),
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
      case 'Overview': return _overviewTab();
      case 'Checklist': return EventChecklistTab(eventId: widget.eventId, eventTypeId: _event?['event_type_id']?.toString() ?? _event?['event_type']?['id']?.toString());
      case 'Budget': return EventBudgetTab(eventId: widget.eventId, permissions: _permissions);
      case 'Expenses': return EventExpensesTab(eventId: widget.eventId, permissions: _permissions);
      case 'Services': return EventServicesTab(eventId: widget.eventId, permissions: _permissions, eventTypeId: _event?['event_type_id']?.toString() ?? _event?['event_type']?['id']?.toString());
      case 'Committee': return EventCommitteeTab(eventId: widget.eventId, permissions: _permissions, eventTitle: _str((_event ?? {})['title']));
      case 'Contributions': return EventContributionsTab(eventId: widget.eventId, permissions: _permissions);
      case 'Guests': return EventGuestsTab(eventId: widget.eventId, permissions: _permissions);
      case 'RSVP': return EventRsvpTab(eventId: widget.eventId);
      case 'Tickets': return EventTicketsTab(eventId: widget.eventId, permissions: _permissions);
      case 'Check-In': return EventCheckinTab(
        eventId: widget.eventId,
        permissions: _permissions,
        eventTitle: _str((_event ?? {})['title']),
        eventDate: _str((_event ?? {})['start_date']),
        eventLocation: _str((_event ?? {})['location']),
        guestCount: (_event ?? {})['guest_count'] ?? (_event ?? {})['total_guests'] ?? (_event ?? {})['expected_guests'] ?? 0,
        confirmedCount: (_event ?? {})['confirmed_guest_count'] ?? 0,
      );
      default: return const SizedBox.shrink();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERVIEW TAB — matches web version with financial cards, progress, guests
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _overviewTab() {
    final e = _event ?? {};
    final description = _str(e['description']);
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
    final progress = _totalServices > 0 ? ((_completedServices / _totalServices) * 100).round() : 0;

    return RefreshIndicator(
      onRefresh: _loadEvent, color: AppColors.primary,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        // ── Row 1: Financial overview cards (matches web grid) ──
        _sectionHeader('Financial Overview'),
        const SizedBox(height: 10),
        // Budget Status
        _financialCard(
          label: 'Budget Status',
          value: budgetNum > 0 ? _formatAmount(budgetNum) : 'Not set',
          subtitle: 'Budget allocated',
          iconBg: const Color(0xFFDBEAFE),
          iconColor: const Color(0xFF2563EB),
          icon: Icons.account_balance_wallet_rounded,
        ),
        const SizedBox(height: 8),
        // Total Pledged + Unpledged row
        Row(children: [
          Expanded(child: _financialCard(
            label: 'Total Pledged',
            value: _formatAmount(totalPledged),
            subtitle: '$pledgedCount contributor${pledgedCount != 1 ? 's' : ''} pledged',
            iconBg: const Color(0xFFF3E8FF),
            iconColor: const Color(0xFF9333EA),
            icon: Icons.people_alt_rounded,
          )),
          if (budgetNum > 0) ...[
            const SizedBox(width: 8),
            Expanded(child: _financialCard(
              label: 'Unpledged',
              value: _formatAmount(unpledged),
              subtitle: 'Budget − Pledged',
              iconBg: const Color(0xFFFEE2E2),
              iconColor: const Color(0xFFDC2626),
              icon: Icons.money_off_rounded,
            )),
          ],
        ]),

        // ── Row 2: Cash in Hand (matches web primary card) ──
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withOpacity(0.2)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Cash in Hand', style: _f(size: 11, color: AppColors.textTertiary)),
                const SizedBox(height: 4),
                Text(_formatAmount(totalPaid), style: _f(size: 22, weight: FontWeight.w800, color: AppColors.primary)),
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
                Expanded(child: _cashStat('$paidCount', 'Paid contributors')),
                Container(width: 1, height: 36, color: AppColors.border),
                Expanded(child: _cashStat(_formatAmount(outstanding), 'Outstanding')),
                Container(width: 1, height: 36, color: AppColors.border),
                Expanded(child: _cashStat('$collectionRate%', 'Collection rate')),
              ]),
            ),
          ]),
        ),

        // ── Row 3: Event Progress + Guest Overview + Confirmed ──
        const SizedBox(height: 16),
        _sectionHeader('Event Progress'),
        const SizedBox(height: 10),
        Row(children: [
          // Services progress
          Expanded(child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Event Progress', style: _f(size: 11, color: AppColors.textTertiary)),
              const SizedBox(height: 6),
              Text('$_completedServices/$_totalServices Services', style: _f(size: 15, weight: FontWeight.w700)),
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
          )),
          const SizedBox(width: 8),
          // Guest Overview
          Expanded(child: _financialCard(
            label: 'Guest Overview',
            value: '$guestCount',
            subtitle: 'of $expectedGuests expected guests',
            iconBg: const Color(0xFFDCFCE7),
            iconColor: const Color(0xFF16A34A),
            icon: Icons.people_rounded,
          )),
        ]),
        const SizedBox(height: 8),
        _financialCard(
          label: 'Confirmed Guests',
          value: '$confirmedGuests',
          subtitle: 'Guests confirmed attendance',
          iconBg: const Color(0xFFDCFCE7),
          iconColor: const Color(0xFF16A34A),
          icon: Icons.how_to_reg_rounded,
        ),

        // ── Description ──
        if (description.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Event Description', style: _f(size: 10, color: AppColors.textTertiary)),
              const SizedBox(height: 6),
              Text(description, style: _f(size: 14, color: AppColors.textSecondary, height: 1.6)),
            ]),
          ),
        ],

        const SizedBox(height: 20),
      ]),
    );
  }

  Widget _sectionHeader(String title) {
    return Text(title, style: _f(size: 15, weight: FontWeight.w700));
  }

  Widget _financialCard({
    required String label,
    required String value,
    required String subtitle,
    required Color iconBg,
    required Color iconColor,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: _f(size: 11, color: AppColors.textTertiary)),
          const SizedBox(height: 4),
          Text(value, style: _f(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(subtitle, style: _f(size: 10, color: AppColors.textTertiary)),
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
        Text(value, style: _f(size: 14, weight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label, style: _f(size: 9, color: AppColors.textTertiary), textAlign: TextAlign.center),
      ]),
    );
  }







  Widget _statusBadge(String status) {
    final colors = {'draft': AppColors.textTertiary, 'published': AppColors.accent, 'confirmed': AppColors.accent, 'cancelled': AppColors.error, 'completed': AppColors.blue};
    final c = colors[status] ?? AppColors.textTertiary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(status[0].toUpperCase() + status.substring(1), style: _f(size: 11, weight: FontWeight.w700, color: c)),
    );
  }

  Widget _statChip(String svgAsset, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border.withOpacity(0.5))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset(svgAsset, width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)),
        const SizedBox(width: 5),
        Flexible(child: Text(text, style: _f(size: 12, color: AppColors.textSecondary, weight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
      ]),
    );
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return 'TZS 0';
    final num = (amount is String ? double.tryParse(amount) : amount.toDouble()) ?? 0.0;
    return 'TZS ${num.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  void _showEventActions() {
    final isCreator = _permissions?['is_creator'] == true;
    final canEdit = _permissions?['can_edit_event'] == true || isCreator;
    final status = _str(_event?['status'], fallback: 'draft');
    showModalBottomSheet(
      context: context, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, margin: const EdgeInsets.only(top: 12), decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          if (canEdit) _actionTile(Icons.edit_rounded, 'Edit Event', () { Navigator.pop(ctx); _editEvent(); }),
          if (isCreator) _actionTile(Icons.photo_library_outlined, 'Event Photo Libraries', () {
            Navigator.pop(ctx);
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => MyPhotoLibrariesScreen(
                  eventId: widget.eventId,
                  title: 'Event Photo Libraries',
                ),
              ),
            );
          }),
          if (isCreator && status == 'draft') _actionTile(Icons.publish_rounded, 'Publish Event', () { Navigator.pop(ctx); _changeStatus('published'); }),
          if (isCreator && status == 'published') _actionTile(Icons.cancel_outlined, 'Cancel Event', () { Navigator.pop(ctx); _changeStatus('cancelled'); }),
          _actionTile(Icons.description_rounded, 'Event Summary Report', () { Navigator.pop(ctx); _generateFullReport(); }),
          _actionTile(Icons.auto_awesome_rounded, 'AI Budget Assistant', () {
            Navigator.pop(ctx);
            Navigator.push(context, MaterialPageRoute(builder: (_) => BudgetAssistantScreen(
              eventType: _event?['event_type_id']?.toString(),
              eventTypeName: _str(_event?['event_type']),
              eventTitle: _str(_event?['title']),
              location: _str(_event?['location']),
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
          if (isCreator) _actionTile(Icons.delete_outline_rounded, 'Delete Event', () { Navigator.pop(ctx); _confirmDelete(); }, isDestructive: true),
          _actionTile(Icons.share_rounded, 'Share Event', () { Navigator.pop(ctx); }),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }

  Widget _actionTile(IconData icon, String label, VoidCallback onTap, {bool isDestructive = false}) {
    return ListTile(
      leading: Icon(icon, color: isDestructive ? AppColors.error : AppColors.textSecondary, size: 22),
      title: Text(label, style: _f(size: 15, weight: FontWeight.w600, color: isDestructive ? AppColors.error : AppColors.textPrimary)),
      onTap: onTap,
    );
  }

  void _editEvent() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => CreateEventScreen(editEvent: _event))).then((result) {
      if (result == true) _loadEvent();
    });
  }

  void _generateFullReport() {
    _showReportFormatPicker('Event Summary Report', (format) async {
      AppSnackbar.success(context, 'Generating report...');
      final res = await ReportGenerator.generateEventReport(
        widget.eventId, format: format, eventData: _event,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(context, MaterialPageRoute(builder: (_) => ReportPreviewScreen(
            title: 'Event Summary Report', pdfBytes: res['bytes'] as Uint8List, filePath: res['path'] as String?,
          )));
        } else if (res['path'] != null) {
          AppSnackbar.success(context, 'Report saved');
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
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Text(title, style: _f(size: 16, weight: FontWeight.w700))),
          const SizedBox(height: 16),
          ListTile(
            leading: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.picture_as_pdf_rounded, size: 20, color: Color(0xFFDC2626)),
            ),
            title: Text('PDF Report', style: _f(size: 14, weight: FontWeight.w600)),
            subtitle: Text('Preview and share', style: _f(size: 12, color: AppColors.textTertiary)),
            onTap: () { Navigator.pop(ctx); onSelect('pdf'); },
          ),
          ListTile(
            leading: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.table_chart_rounded, size: 20, color: Color(0xFF16A34A)),
            ),
            title: Text('Excel (CSV)', style: _f(size: 14, weight: FontWeight.w600)),
            subtitle: Text('Open in spreadsheet apps', style: _f(size: 12, color: AppColors.textTertiary)),
            onTap: () { Navigator.pop(ctx); onSelect('xlsx'); },
          ),
          const SizedBox(height: 20),
        ]),
      ),
    );
  }

  Widget _reportRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        SizedBox(width: 90, child: Text(label, style: _f(size: 12, color: AppColors.textTertiary))),
        Expanded(child: Text(value, style: _f(size: 12, weight: FontWeight.w600))),
      ]),
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
        title: Text('Delete Event?', style: _f(size: 18, weight: FontWeight.w700)),
        content: Text('This action cannot be undone.', style: _f(size: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Cancel', style: _f(size: 14, weight: FontWeight.w600, color: AppColors.textSecondary))),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final res = await EventsService.deleteEvent(widget.eventId);
              if (mounted) {
                if (res['success'] == true) { AppSnackbar.success(context, 'Event deleted'); Navigator.pop(context); }
                else { AppSnackbar.error(context, res['message'] ?? 'Failed'); }
              }
            },
            child: Text('Delete', style: _f(size: 14, weight: FontWeight.w700, color: AppColors.error)),
          ),
        ],
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      return '${weekdays[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _formatNum(dynamic n) {
    final num val = n is num ? n : (num.tryParse(n.toString()) ?? 0);
    if (val >= 1000000) return '${(val / 1000000).toStringAsFixed(1)}M';
    if (val >= 1000) return '${(val / 1000).toStringAsFixed(0)}K';
    return val.toStringAsFixed(0);
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  _TabBarDelegate(this.tabBar);
  @override double get minExtent => tabBar.preferredSize.height;
  @override double get maxExtent => tabBar.preferredSize.height;
  @override Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => Container(color: const Color(0xFFE8EEF5), child: tabBar);
  @override bool shouldRebuild(covariant _TabBarDelegate oldDelegate) => false;
}





// ═══════════════════════════════════════════════════════════════════════════
// CREATE / EDIT EVENT SCREEN — fetches event types from API
// ═══════════════════════════════════════════════════════════════════════════
class CreateEventScreen extends StatefulWidget {
  final Map<String, dynamic>? editEvent;
  const CreateEventScreen({super.key, this.editEvent});

  @override
  State<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends State<CreateEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _venueCtrl = TextEditingController();
  final _expectedGuestsCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController();
  final _dressCodeCtrl = TextEditingController();
  final _specialInstructionsCtrl = TextEditingController();
  String? _eventTypeId;
  String _visibility = 'private';
  DateTime? _startDate;
  DateTime? _endDate;
  TimeOfDay? _startTime;
  bool _sellsTickets = false;
  bool _isPublic = false;
  bool _saving = false;
  String? _imagePath;

  // Map location state
  double? _venueLatitude;
  double? _venueLongitude;
  String? _venueAddress;

  List<Map<String, dynamic>> _apiEventTypes = [];
  bool _typesLoading = true;

  bool get _isEdit => widget.editEvent != null;

  @override
  void initState() {
    super.initState();
    _loadEventTypes();
    if (_isEdit) {
      final e = widget.editEvent!;
      _titleCtrl.text = _str(e['title']);
      _descCtrl.text = _str(e['description']);
      _locationCtrl.text = _str(e['location']);
      _venueCtrl.text = _str(e['venue']);
      _dressCodeCtrl.text = _str(e['dress_code']);
      _specialInstructionsCtrl.text = _str(e['special_instructions']);
      if (e['expected_guests'] != null) _expectedGuestsCtrl.text = '${e['expected_guests']}';
      if (e['budget'] != null) _budgetCtrl.text = '${e['budget']}';
      final rawType = e['event_type'];
      if (rawType is Map) {
        _eventTypeId = rawType['id']?.toString();
      } else if (rawType is String) {
        _eventTypeId = rawType;
      }
      _eventTypeId ??= e['event_type_id']?.toString();
      _visibility = _str(e['visibility'], fallback: 'private');
      _isPublic = e['is_public'] == true;
      _sellsTickets = e['sells_tickets'] == true;
      if (e['start_date'] != null) {
        try {
          _startDate = DateTime.parse(e['start_date'].toString());
          _startTime = TimeOfDay.fromDateTime(_startDate!);
        } catch (_) {}
      }
      if (e['end_date'] != null) try { _endDate = DateTime.parse(e['end_date'].toString()); } catch (_) {}
      // Load venue coordinates
      final vc = e['venue_coordinates'];
      if (vc is Map) {
        _venueLatitude = double.tryParse(vc['latitude']?.toString() ?? '');
        _venueLongitude = double.tryParse(vc['longitude']?.toString() ?? '');
      }
      _venueAddress = e['venue_address']?.toString();
    } else {
      // New event — check organiser agreement
      _checkAgreement();
    }
  }

  Future<void> _checkAgreement() async {
    await Future.delayed(const Duration(milliseconds: 300)); // Let screen render
    if (!mounted) return;
    final accepted = await AgreementGate.checkAndPrompt(context, 'organiser_agreement');
    if (!accepted && mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _loadEventTypes() async {
    final res = await EventsService.getEventTypes();
    if (mounted) {
      setState(() {
        _typesLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          if (data is List) {
            _apiEventTypes = data.map((e) => e is Map<String, dynamic> ? e : <String, dynamic>{}).toList();
          }
        }
        if (_apiEventTypes.isEmpty) {
          _apiEventTypes = [
            {'id': 'wedding', 'name': 'Wedding'},
            {'id': 'birthday', 'name': 'Birthday'},
            {'id': 'corporate', 'name': 'Corporate'},
            {'id': 'graduation', 'name': 'Graduation'},
            {'id': 'funeral', 'name': 'Funeral'},
            {'id': 'baby_shower', 'name': 'Baby Shower'},
            {'id': 'anniversary', 'name': 'Anniversary'},
            {'id': 'conference', 'name': 'Conference'},
            {'id': 'other', 'name': 'Other'},
          ];
        }
        _eventTypeId ??= _apiEventTypes.first['id']?.toString();
      });
    }
  }

  Future<void> _openMapPicker() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => _MapPickerScreen(
        initialLatitude: _venueLatitude,
        initialLongitude: _venueLongitude,
      )),
    );
    if (result != null && mounted) {
      setState(() {
        _venueLatitude = result['latitude'] as double?;
        _venueLongitude = result['longitude'] as double?;
        _venueAddress = result['address'] as String?;
        if (_locationCtrl.text.trim().isEmpty && _venueAddress != null) {
          _locationCtrl.text = _venueAddress!;
        }
      });
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, imageQuality: 85);
    if (picked != null && mounted) {
      setState(() => _imagePath = picked.path);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _venueCtrl.dispose();
    _expectedGuestsCtrl.dispose();
    _budgetCtrl.dispose();
    _dressCodeCtrl.dispose();
    _specialInstructionsCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    final expectedGuests = int.tryParse(_expectedGuestsCtrl.text.replaceAll(RegExp(r'[^0-9]'), ''));
    final budget = double.tryParse(_budgetCtrl.text.replaceAll(RegExp(r'[^0-9.]'), ''));

    // Build start_date with time
    String? startDateStr;
    if (_startDate != null) {
      if (_startTime != null) {
        final combined = DateTime(_startDate!.year, _startDate!.month, _startDate!.day, _startTime!.hour, _startTime!.minute);
        startDateStr = combined.toIso8601String();
      } else {
        startDateStr = _startDate!.toIso8601String();
      }
    }

    // Build time string for backend (HH:mm)
    String? timeStr;
    if (_startTime != null) {
      timeStr = '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
    }

    Map<String, dynamic> res;
    if (_isEdit) {
      res = await EventsService.updateEvent(
        widget.editEvent!['id'].toString(),
        title: _titleCtrl.text.trim(),
        description: _descCtrl.text.trim(),
        eventTypeId: _eventTypeId,
        location: _locationCtrl.text.trim(),
        venue: _venueCtrl.text.trim(),
        visibility: _visibility,
        startDate: startDateStr,
        endDate: _endDate?.toIso8601String(),
        expectedGuests: expectedGuests,
        budget: budget,
        sellsTickets: _sellsTickets,
        isPublic: _isPublic,
        dressCode: _dressCodeCtrl.text.trim().isEmpty ? null : _dressCodeCtrl.text.trim(),
        specialInstructions: _specialInstructionsCtrl.text.trim().isEmpty ? null : _specialInstructionsCtrl.text.trim(),
        time: timeStr,
        imagePath: _imagePath,
        venueLatitude: _venueLatitude,
        venueLongitude: _venueLongitude,
        venueAddress: _venueAddress,
      );
    } else {
      res = await EventsService.createEvent(
        title: _titleCtrl.text.trim(),
        eventType: _eventTypeId ?? 'other',
        description: _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        location: _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
        venue: _venueCtrl.text.trim().isEmpty ? null : _venueCtrl.text.trim(),
        visibility: _visibility,
        startDate: startDateStr,
        endDate: _endDate?.toIso8601String(),
        expectedGuests: expectedGuests,
        budget: budget,
        sellsTickets: _sellsTickets,
        isPublic: _isPublic,
        dressCode: _dressCodeCtrl.text.trim().isEmpty ? null : _dressCodeCtrl.text.trim(),
        specialInstructions: _specialInstructionsCtrl.text.trim().isEmpty ? null : _specialInstructionsCtrl.text.trim(),
        time: timeStr,
        imagePath: _imagePath,
        venueLatitude: _venueLatitude,
        venueLongitude: _venueLongitude,
        venueAddress: _venueAddress,
      );
    }

    setState(() => _saving = false);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, _isEdit ? 'Event updated' : 'Event created');
        if (!_isEdit && res['data'] != null) {
          Navigator.pushReplacement(context, MaterialPageRoute(
            builder: (_) => EventDetailScreen(eventId: res['data']['id'].toString(), initialData: res['data'], knownRole: 'creator'),
          ));
        } else {
          Navigator.pop(context, true);
        }
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark, systemNavigationBarColor: Colors.transparent, systemNavigationBarContrastEnforced: false),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.7), borderRadius: BorderRadius.circular(12)),
                    child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 20, height: 20, colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Text(_isEdit ? 'Edit Event' : 'Create Event', style: _f(size: 18, weight: FontWeight.w700))),
              ]),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(children: [
                    // ── Event Details Card ──
                    _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Event Type'),
                      _typesLoading
                          ? const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
                          : _eventTypeGrid(),
                      const SizedBox(height: 16),
                      _label('Event Title'),
                      _input(_titleCtrl, 'Give your event a name', validator: (v) => v == null || v.isEmpty ? 'Required' : v.length > 100 ? 'Max 100 characters' : null),
                      const SizedBox(height: 16),
                      _label('Location'),
                      _input(_locationCtrl, 'Event venue or address'),
                      const SizedBox(height: 12),
                      // Map location picker button
                      GestureDetector(
                        onTap: _openMapPicker,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color: _venueLatitude != null ? AppColors.primary.withOpacity(0.06) : const Color(0xFFF5F7FA),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: _venueLatitude != null ? AppColors.primary.withOpacity(0.3) : AppColors.border, width: 1),
                          ),
                          child: Row(children: [
                            Icon(Icons.map_outlined, size: 18, color: _venueLatitude != null ? AppColors.primary : AppColors.textTertiary),
                            const SizedBox(width: 10),
                            Expanded(child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _venueLatitude != null ? 'Location pinned on map' : 'Pick location on map',
                                  style: _f(size: 14, color: _venueLatitude != null ? AppColors.primary : AppColors.textHint, weight: _venueLatitude != null ? FontWeight.w600 : FontWeight.w400),
                                ),
                                if (_venueAddress != null && _venueAddress!.isNotEmpty)
                                  Text(_venueAddress!, style: _f(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                            )),
                            if (_venueLatitude != null)
                              GestureDetector(
                                onTap: () => setState(() { _venueLatitude = null; _venueLongitude = null; _venueAddress = null; }),
                                child: Icon(Icons.close, size: 16, color: AppColors.textTertiary),
                              ),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _label('Venue Name'),
                      _input(_venueCtrl, 'Venue name (optional)'),
                      const SizedBox(height: 16),
                      _label('Description'),
                      _input(_descCtrl, 'Describe your event', maxLines: 4),
                    ])),
                    const SizedBox(height: 16),

                    // ── Date & Time Card ──
                    _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Date & Time'),
                      _datePicker('Start Date', _startDate, (d) => setState(() => _startDate = d)),
                      const SizedBox(height: 12),
                      _timePicker('Start Time', _startTime, (t) => setState(() => _startTime = t)),
                      const SizedBox(height: 12),
                      _datePicker('End Date (optional)', _endDate, (d) => setState(() => _endDate = d)),
                    ])),
                    const SizedBox(height: 16),

                    // ── Guests & Budget Card ──
                    _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Expected Guests'),
                      _input(_expectedGuestsCtrl, 'e.g., 50', keyboardType: TextInputType.number),
                      const SizedBox(height: 16),
                      _label('Estimated Budget (TZS)'),
                      _input(_budgetCtrl, 'e.g., 5,000,000', keyboardType: TextInputType.number),
                    ])),
                    const SizedBox(height: 16),

                    // ── Cover Image Card ──
                    _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Cover Image'),
                      GestureDetector(
                        onTap: _pickImage,
                        child: Container(
                          width: double.infinity,
                          height: _imagePath != null ? 180 : 120,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F7FA),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.border, width: 1, style: BorderStyle.solid),
                            image: _imagePath != null
                                ? DecorationImage(image: FileImage(File(_imagePath!)), fit: BoxFit.cover)
                                : null,
                          ),
                          child: _imagePath == null
                              ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  Icon(Icons.cloud_upload_outlined, size: 32, color: AppColors.textHint),
                                  const SizedBox(height: 8),
                                  Text('Tap to upload image', style: _f(size: 13, color: AppColors.textHint)),
                                  Text('PNG, JPG (max 5MB)', style: _f(size: 11, color: AppColors.textHint)),
                                ])
                              : Align(
                                  alignment: Alignment.topRight,
                                  child: GestureDetector(
                                    onTap: () => setState(() => _imagePath = null),
                                    child: Container(
                                      margin: const EdgeInsets.all(8),
                                      padding: const EdgeInsets.all(6),
                                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
                                      child: const Icon(Icons.close, size: 16, color: Colors.white),
                                    ),
                                  ),
                                ),
                        ),
                      ),
                    ])),
                    const SizedBox(height: 16),

                    // ── Ticketing & Visibility Card ──
                    _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Visibility'),
                      Row(children: ['private', 'public'].map((v) => Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() {
                            _visibility = v;
                            if (v == 'public') _isPublic = true;
                            if (v == 'private') _isPublic = false;
                          }),
                          child: Container(
                            margin: EdgeInsets.only(right: v == 'private' ? 8 : 0, left: v == 'public' ? 8 : 0),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: _visibility == v ? AppColors.primary.withOpacity(0.08) : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: _visibility == v ? AppColors.primary : AppColors.border, width: _visibility == v ? 1.5 : 1),
                            ),
                            child: Center(child: Text(v[0].toUpperCase() + v.substring(1), style: _f(size: 14, weight: _visibility == v ? FontWeight.w700 : FontWeight.w500, color: _visibility == v ? AppColors.primary : AppColors.textSecondary))),
                          ),
                        ),
                      )).toList()),
                      const SizedBox(height: 16),
                      _toggleRow('Enable Ticketing', 'Allow selling tickets for this event', _sellsTickets, (v) => setState(() => _sellsTickets = v)),
                    ])),
                    const SizedBox(height: 16),

                    // ── Optional Details Card ──
                    _card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Additional Details (optional)'),
                      _input(_dressCodeCtrl, 'Dress code (e.g., Black Tie)'),
                      const SizedBox(height: 12),
                      _input(_specialInstructionsCtrl, 'Special instructions for guests', maxLines: 3),
                    ])),
                    const SizedBox(height: 28),

                    SizedBox(
                      width: double.infinity, height: 54,
                      child: ElevatedButton(
                        onPressed: _saving ? null : _save,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, disabledBackgroundColor: AppColors.primary.withOpacity(0.5), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                        child: _saving
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text(_isEdit ? 'Save Changes' : 'Create Event', style: _f(size: 16, weight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
    width: double.infinity, padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border.withOpacity(0.5), width: 0.7)),
    child: child,
  );

  Widget _label(String text) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(text, style: _f(size: 13, weight: FontWeight.w700, color: AppColors.textSecondary)));

  Widget _input(TextEditingController ctrl, String hint, {String? Function(String?)? validator, int maxLines = 1, TextInputType? keyboardType}) {
    return TextFormField(
      controller: ctrl, maxLines: maxLines, validator: validator, keyboardType: keyboardType,
      style: _f(size: 15, weight: FontWeight.w500),
      decoration: InputDecoration(
        hintText: hint, hintStyle: _f(size: 14, color: AppColors.textHint),
        filled: true, fillColor: const Color(0xFFF5F7FA),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  Widget _eventTypeGrid() {
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: _apiEventTypes.map((t) {
        final id = t['id']?.toString() ?? '';
        final name = _str(t['name'], fallback: id);
        final selected = _eventTypeId == id;
        return GestureDetector(
          onTap: () => setState(() => _eventTypeId = id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: selected ? AppColors.primary.withOpacity(0.1) : const Color(0xFFF5F7FA),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: selected ? 1.5 : 1),
            ),
            child: Text(name, style: _f(size: 13, weight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? AppColors.primary : AppColors.textSecondary)),
          ),
        );
      }).toList(),
    );
  }

  Widget _toggleRow(String title, String subtitle, bool value, ValueChanged<bool> onChanged) {
    return Row(
      children: [
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: _f(size: 14, weight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 2),
            Text(subtitle, style: _f(size: 11, color: AppColors.textTertiary)),
          ],
        )),
        Switch.adaptive(
          value: value, onChanged: onChanged,
          activeColor: AppColors.primary,
        ),
      ],
    );
  }

  Widget _datePicker(String label, DateTime? value, ValueChanged<DateTime> onPick) {
    return GestureDetector(
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime.now().subtract(const Duration(days: 30)),
          lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
          builder: (ctx, child) => Theme(
            data: Theme.of(ctx).copyWith(
              colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: Colors.white, surface: Colors.white),
            ),
            child: child!,
          ),
        );
        if (date != null && mounted) onPick(date);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          SvgPicture.asset('assets/icons/calendar-icon.svg', width: 16, height: 16, colorFilter: ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
          const SizedBox(width: 10),
          Expanded(child: Text(value != null ? _formatDate(value) : label, style: _f(size: 14, color: value != null ? AppColors.textPrimary : AppColors.textHint, weight: value != null ? FontWeight.w500 : FontWeight.w400))),
        ]),
      ),
    );
  }

  Widget _timePicker(String label, TimeOfDay? value, ValueChanged<TimeOfDay> onPick) {
    return GestureDetector(
      onTap: () async {
        final time = await showTimePicker(
          context: context,
          initialTime: value ?? TimeOfDay.now(),
          initialEntryMode: TimePickerEntryMode.input,
          builder: (ctx, child) => Theme(
            data: Theme.of(ctx).copyWith(
              colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: Colors.white, surface: Colors.white),
              timePickerTheme: TimePickerThemeData(
                backgroundColor: Colors.white,
                hourMinuteShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                dayPeriodShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
            ),
            child: MediaQuery(data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: false), child: child!),
          ),
        );
        if (time != null && mounted) onPick(time);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          SvgPicture.asset('assets/icons/clock-icon.svg', width: 16, height: 16, colorFilter: ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
          const SizedBox(width: 10),
          Expanded(child: Text(value != null ? value.format(context) : label, style: _f(size: 14, color: value != null ? AppColors.textPrimary : AppColors.textHint, weight: value != null ? FontWeight.w500 : FontWeight.w400))),
        ]),
      ),
    );
  }

  String _formatDate(DateTime d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAP PICKER SCREEN — OpenStreetMap-based location picker
// ═══════════════════════════════════════════════════════════════════════════
class _MapPickerScreen extends StatefulWidget {
  final double? initialLatitude;
  final double? initialLongitude;
  const _MapPickerScreen({this.initialLatitude, this.initialLongitude});

  @override
  State<_MapPickerScreen> createState() => _MapPickerScreenState();
}

class _MapPickerScreenState extends State<_MapPickerScreen> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  bool _searching = false;
  double? _selectedLat;
  double? _selectedLng;
  String? _selectedAddress;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _selectedLat = widget.initialLatitude;
    _selectedLng = widget.initialLongitude;
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    if (query.trim().length < 3) return;
    setState(() => _searching = true);
    try {
      final uri = Uri.parse('https://nominatim.openstreetmap.org/search?q=${Uri.encodeComponent(query)}&format=json&limit=5&addressdetails=1');
      final res = await http.get(uri, headers: {'User-Agent': 'NuruApp/1.0'});
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List;
        setState(() => _searchResults = data.map((e) => e as Map<String, dynamic>).toList());
      }
    } catch (_) {}
    setState(() => _searching = false);
  }

  Future<void> _useCurrentLocation() async {
    setState(() => _loading = true);
    try {
      // Use geolocator-like approach — for simplicity, use a default or prompt
      // This is a simplified version; in production you'd use geolocator package
      // For now, show a message that location services are needed
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Search for your location using the search bar above')),
        );
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  void _selectResult(Map<String, dynamic> result) {
    setState(() {
      _selectedLat = double.tryParse(result['lat']?.toString() ?? '');
      _selectedLng = double.tryParse(result['lon']?.toString() ?? '');
      _selectedAddress = result['display_name']?.toString();
      _searchResults = [];
      _searchCtrl.text = _selectedAddress ?? '';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE8EEF5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Pick Location', style: _f(size: 18, weight: FontWeight.w700)),
        actions: [
          if (_selectedLat != null)
            TextButton(
              onPressed: () => Navigator.pop(context, {
                'latitude': _selectedLat,
                'longitude': _selectedLng,
                'address': _selectedAddress,
              }),
              child: Text('Confirm', style: _f(size: 14, weight: FontWeight.w700, color: AppColors.primary)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: TextField(
              controller: _searchCtrl,
              style: _f(size: 15, weight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: 'Search for a place or address...',
                hintStyle: _f(size: 14, color: AppColors.textHint),
                filled: true, fillColor: const Color(0xFFF5F7FA),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                prefixIcon: const Icon(Icons.search, color: AppColors.textTertiary),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () { _searchCtrl.clear(); setState(() => _searchResults = []); })
                    : null,
              ),
              onChanged: (v) {
                if (v.length >= 3) _search(v);
              },
              onSubmitted: _search,
            ),
          ),

          // Search results or selected location
          Expanded(
            child: _searchResults.isNotEmpty
                ? ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _searchResults.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final r = _searchResults[i];
                      return GestureDetector(
                        onTap: () => _selectResult(r),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.borderLight),
                          ),
                          child: Row(children: [
                            Container(
                              width: 40, height: 40,
                              decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
                              child: const Center(child: Icon(Icons.location_on, color: AppColors.primary, size: 20)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(
                              r['display_name']?.toString() ?? '',
                              style: _f(size: 13, color: AppColors.textPrimary),
                              maxLines: 2, overflow: TextOverflow.ellipsis,
                            )),
                          ]),
                        ),
                      );
                    },
                  )
                : _selectedLat != null
                    ? Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                            width: 80, height: 80,
                            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), shape: BoxShape.circle),
                            child: const Center(child: Icon(Icons.location_on, color: AppColors.primary, size: 40)),
                          ),
                          const SizedBox(height: 16),
                          Text('Location Selected', style: _f(size: 18, weight: FontWeight.w700)),
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 40),
                            child: Text(
                              _selectedAddress ?? '${_selectedLat!.toStringAsFixed(4)}, ${_selectedLng!.toStringAsFixed(4)}',
                              style: _f(size: 13, color: AppColors.textSecondary),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            onPressed: () => Navigator.pop(context, {
                              'latitude': _selectedLat,
                              'longitude': _selectedLng,
                              'address': _selectedAddress,
                            }),
                            icon: const Icon(Icons.check, size: 18),
                            label: Text('Use This Location', style: _f(size: 14, weight: FontWeight.w600, color: Colors.white)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ]),
                      )
                    : Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.map_outlined, size: 64, color: AppColors.textHint.withOpacity(0.4)),
                          const SizedBox(height: 16),
                          Text('Search for a location', style: _f(size: 16, weight: FontWeight.w600, color: AppColors.textSecondary)),
                          const SizedBox(height: 6),
                          Text('Type an address or place name above', style: _f(size: 13, color: AppColors.textTertiary)),
                        ]),
                      ),
          ),
        ],
      ),
    );
  }
}
