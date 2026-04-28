import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/expanding_search_action.dart';
import '../../core/services/ticketing_service.dart';
import '../../core/l10n/l10n_helper.dart';
import '../migration/migration_banner.dart';
import 'widgets/my_ticket_payments_tab.dart';


class MyTicketsScreen extends StatefulWidget {
  const MyTicketsScreen({super.key});

  @override
  State<MyTicketsScreen> createState() => _MyTicketsScreenState();
}

class _MyTicketsScreenState extends State<MyTicketsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 2, vsync: this);
  List<dynamic> _tickets = [];
  List<dynamic> _upcomingTickets = [];
  bool _loading = true;
  int _page = 1;
  Map<String, dynamic>? _pagination;
  String _search = '';

  static const _statusStyles = <String, Color>{
    'confirmed': AppColors.blue,
    'approved': AppColors.success,
    'pending': AppColors.warning,
    'rejected': AppColors.error,
    'cancelled': AppColors.textTertiary,
  };

  static const _cacheKey = 'cache_my_tickets_v1';
  static const _cacheUpcomingKey = 'cache_my_tickets_upcoming_v1';

  @override
  void initState() {
    super.initState();
    _hydrateFromCache().then((_) => _load());
  }

  Future<void> _hydrateFromCache() async {
    try {
      final sp = await SharedPreferences.getInstance();
      final raw = sp.getString(_cacheKey);
      final upRaw = sp.getString(_cacheUpcomingKey);
      if (!mounted) return;
      setState(() {
        if (raw != null) {
          final decoded = jsonDecode(raw);
          if (decoded is List) _tickets = decoded;
        }
        if (upRaw != null) {
          final decoded = jsonDecode(upRaw);
          if (decoded is List) _upcomingTickets = decoded;
        }
        if (_tickets.isNotEmpty || _upcomingTickets.isNotEmpty) _loading = false;
      });
    } catch (_) {/* ignore cache errors */}
  }

  Future<void> _persistCache() async {
    try {
      final sp = await SharedPreferences.getInstance();
      await sp.setString(_cacheKey, jsonEncode(_tickets));
      await sp.setString(_cacheUpcomingKey, jsonEncode(_upcomingTickets));
    } catch (_) {/* ignore */}
  }

  Future<void> _load() async {
    if (_tickets.isEmpty && _upcomingTickets.isEmpty) {
      setState(() => _loading = true);
    }
    final results = await Future.wait([
      TicketingService.getMyTickets(page: _page, search: _search.isNotEmpty ? _search : null),
      TicketingService.getMyUpcomingTickets(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        final res = results[0];
        if (res['success'] == true) {
          final data = res['data'];
          _tickets = data is Map ? (data['tickets'] ?? []) : (data is List ? data : []);
          if (data is Map && data['pagination'] != null) {
            _pagination = data['pagination'] is Map<String, dynamic> ? data['pagination'] : null;
          }
        }
        final upRes = results[1];
        if (upRes['success'] == true) {
          final upData = upRes['data'];
          _upcomingTickets = upData is Map ? (upData['tickets'] ?? []) : (upData is List ? upData : []);
        }
      });
      _persistCache();
    }
  }

  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(
        title: context.tr('my_tickets'),
        actions: [
          ExpandingSearchAction(
            value: _search,
            hintText: 'Search tickets…',
            onChanged: (v) { _search = v; _page = 1; _load(); },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 2.5,
          labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700),
          tabs: const [
            Tab(text: 'Tickets'),
            Tab(text: 'Payments'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _ticketsTab(),
          const MyTicketPaymentsTab(),
        ],
      ),
    );
  }

  Widget _ticketsTab() {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _loading
          ? _buildLoadingSkeleton()
          : _tickets.isEmpty && _upcomingTickets.isEmpty
              ? ListView(children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.15),
                  _emptyState(),
                ])
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const MigrationBanner(surface: MigrationSurface.tickets, margin: EdgeInsets.only(bottom: 12)),
                    if (_upcomingTickets.isNotEmpty) ...[
                      Text('UPCOMING EVENTS', style: GoogleFonts.inter(
                        fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 1.2)),
                      const SizedBox(height: 10),
                      ..._upcomingTickets.take(3).map((t) => _upcomingSidebarCard(t)),
                      const SizedBox(height: 20),
                    ],
                    Text('ALL TICKETS', style: GoogleFonts.inter(
                      fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 1.2)),
                    const SizedBox(height: 10),
                    if (_tickets.isEmpty)
                      _emptyState()
                    else
                      ..._tickets.map((t) => _ticketCard(t)),
                    if (_pagination != null && (_pagination!['total_pages'] ?? 1) > 1)
                      _buildPagination(),
                  ],
                ),
    );
  }


  Widget _buildLoadingSkeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Upcoming skeleton
        Text('UPCOMING EVENTS', style: GoogleFonts.inter(
          fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        ...List.generate(2, (_) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 170,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
        )),
        const SizedBox(height: 20),
        Text('ALL TICKETS', style: GoogleFonts.inter(
          fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        ...List.generate(4, (_) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 100,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
        )),
      ],
    );
  }

  Widget _emptyState() {
    return Column(
      children: [
        const SizedBox(height: 32),
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(32)),
          child: Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 28, height: 28,
              colorFilter: ColorFilter.mode(AppColors.textHint.withOpacity(0.3), BlendMode.srcIn))),
        ),
        const SizedBox(height: 16),
        Text('No tickets yet', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text('Browse events and purchase tickets to see them here',
            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: () => Navigator.pushNamed(context, '/tickets'),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.borderLight),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text('Browse Tickets', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
          ),
        ),
      ],
    );
  }

  /// Upcoming event sidebar card — matches web MyTickets right sidebar exactly:
  /// Cover image (or gradient placeholder) with date overlay badge,
  /// then event name, location with pin icon, and countdown
  Widget _upcomingSidebarCard(dynamic ticket) {
    final t = ticket is Map<String, dynamic> ? ticket : <String, dynamic>{};
    final event = t['event'] is Map<String, dynamic> ? t['event'] as Map<String, dynamic> : t;
    final eventName = event['name']?.toString() ?? event['title']?.toString() ?? t['ticket_class_name']?.toString() ?? 'Event';
    final coverImage = event['cover_image']?.toString() ?? '';
    final location = event['location']?.toString() ?? '';
    final startDate = event['start_date']?.toString() ?? '';
    DateTime? d;
    try { d = DateTime.parse(startDate); } catch (_) {}
    final countdown = _getCountdown(startDate);

    return GestureDetector(
      onTap: () {
        final eventId = event['id']?.toString() ?? '';
        if (eventId.isNotEmpty) Navigator.pushNamed(context, '/event/$eventId');
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cover image with date overlay (matches web exactly)
            Stack(
              children: [
                if (coverImage.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: coverImage, width: double.infinity, height: 100, fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _imagePlaceholder(100),
                  )
                else
                  _imagePlaceholder(100),
                // Date overlay badge top-left (matches web)
                if (d != null)
                  Positioned(
                    top: 8, left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.surface.withOpacity(0.92),
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 4)],
                      ),
                      child: Column(
                        children: [
                          Text('${d.day}', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.primary, height: 1)),
                          const SizedBox(height: 1),
                          Text(_monthAbbr(d.month).toUpperCase(), style: GoogleFonts.inter(fontSize: 7, fontWeight: FontWeight.w700, color: AppColors.primary, letterSpacing: 0.5)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            // Info section (matches web CardContent)
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(eventName, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  if (location.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Row(children: [
                      SvgPicture.asset('assets/icons/location-icon.svg', width: 10, height: 10,
                          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                      const SizedBox(width: 4),
                      Expanded(child: Text(location, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary))),
                    ]),
                  ],
                  // Countdown (matches web CountdownClock compact)
                  if (countdown != null) ...[
                    const SizedBox(height: 6),
                    _countdownChip(countdown),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Ticket card — matches web ticket-shaped card exactly:
  /// Perforated circles, dashed separator, date stub left, event info right, print button
  Widget _ticketCard(dynamic ticket) {
    final t = ticket is Map<String, dynamic> ? ticket : <String, dynamic>{};
    final event = t['event'] is Map<String, dynamic> ? t['event'] as Map<String, dynamic> : <String, dynamic>{};
    final eventName = event['name']?.toString() ?? t['event_name']?.toString() ?? t['ticket_class_name']?.toString() ?? 'Event';
    final location = event['location']?.toString() ?? '';
    final startDate = event['start_date']?.toString() ?? '';
    final ticketCode = t['ticket_code']?.toString() ?? '';
    final ticketClassName = t['ticket_class_name']?.toString() ?? '';
    final status = t['status']?.toString() ?? 'pending';
    final quantity = t['quantity'] ?? 1;
    final totalAmount = t['total_amount'] ?? 0;
    final checkedIn = t['checked_in'] == true;

    DateTime? d;
    try { d = DateTime.parse(startDate); } catch (_) {}
    final countdown = _getCountdown(startDate);
    final statusColor = _statusStyles[status] ?? AppColors.textTertiary;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Perforated circles (matches web)
          Positioned(left: 68, top: -8,
            child: Container(width: 16, height: 16, decoration: BoxDecoration(
              color: AppColors.surface, shape: BoxShape.circle,
              border: Border.all(color: AppColors.borderLight),
            )),
          ),
          Positioned(left: 68, bottom: -8,
            child: Container(width: 16, height: 16, decoration: BoxDecoration(
              color: AppColors.surface, shape: BoxShape.circle,
              border: Border.all(color: AppColors.borderLight),
            )),
          ),
          // Dashed separator line (matches web)
          Positioned(left: 76, top: 8, bottom: 8,
            child: CustomPaint(
              size: const Size(1, double.infinity),
              painter: _DashedLinePainter(color: AppColors.borderLight.withOpacity(0.6)),
            ),
          ),
          // Content row
          IntrinsicHeight(
            child: Row(
              children: [
                // Date stub (matches web 80px left stub)
                SizedBox(
                  width: 76,
                  child: d != null
                      ? Container(
                          decoration: BoxDecoration(
                            color: countdown != null && countdown['isPast'] == true
                                ? AppColors.surfaceVariant.withOpacity(0.3)
                                : AppColors.primarySoft,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(height: 12),
                              Text('${d.day}', style: GoogleFonts.inter(
                                fontSize: 22, fontWeight: FontWeight.w800, height: 1,
                                color: countdown != null && countdown['isPast'] == true ? AppColors.textTertiary : AppColors.primary,
                              )),
                              const SizedBox(height: 2),
                              Text(_monthAbbr(d.month).toUpperCase(), style: GoogleFonts.inter(
                                fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5,
                                color: countdown != null && countdown['isPast'] == true ? AppColors.textTertiary : AppColors.primary,
                              )),
                              const SizedBox(height: 2),
                              Text('${d.year}', style: GoogleFonts.inter(fontSize: 9, color: AppColors.textTertiary)),
                              const SizedBox(height: 12),
                            ],
                          ),
                        )
                      : Container(
                          decoration: BoxDecoration(color: AppColors.surfaceVariant.withOpacity(0.3)),
                          child: Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 22, height: 22,
                              colorFilter: ColorFilter.mode(AppColors.textHint.withOpacity(0.4), BlendMode.srcIn))),
                        ),
                ),
                // Main ticket body (matches web)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title + status badge (matches web)
                        Row(
                          children: [
                            Expanded(child: Text(eventName, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary))),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(status, style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w600, color: statusColor)),
                            ),
                          ],
                        ),
                        // Location (matches web)
                        if (location.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Row(children: [
                            SvgPicture.asset('assets/icons/location-icon.svg', width: 11, height: 11,
                                colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                            const SizedBox(width: 4),
                            Expanded(child: Text(location, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary))),
                          ]),
                        ],
                        const SizedBox(height: 6),
                        // Ticket code + class + quantity (matches web badges row)
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            if (ticketCode.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  border: Border.all(color: AppColors.borderLight),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(ticketCode, style: GoogleFonts.sourceCodePro(fontSize: 9, color: AppColors.textTertiary, letterSpacing: 0.5)),
                              ),
                            if (ticketClassName.isNotEmpty)
                              Text(ticketClassName, style: GoogleFonts.inter(fontSize: 9, color: AppColors.textTertiary)),
                            if (quantity is int && quantity > 1)
                              Text('×$quantity', style: GoogleFonts.inter(fontSize: 9, color: AppColors.textTertiary)),
                            Text('TZS ${_formatAmount(totalAmount)}',
                                style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                          ],
                        ),
                        // Checked in badge
                        if (checkedIn) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(6)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.check_circle, size: 10, color: AppColors.success),
                                const SizedBox(width: 3),
                                Text('Checked In', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.success)),
                              ],
                            ),
                          ),
                        ],
                        // Countdown (matches web CountdownClock compact)
                        if (countdown != null) ...[
                          const SizedBox(height: 6),
                          _countdownChip(countdown),
                        ],
                      ],
                    ),
                  ),
                ),
                // Print button strip (matches web right border print button)
                GestureDetector(
                  onTap: () => _showPrintableTicket(t),
                  child: Container(
                    width: 40,
                    decoration: BoxDecoration(
                      border: Border(left: BorderSide(color: AppColors.borderLight.withOpacity(0.6), style: BorderStyle.solid)),
                    ),
                    child: Center(
                      child: SvgPicture.asset('assets/icons/print-icon.svg', width: 16, height: 16,
                        colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
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

  /// Shows a printable ticket bottom sheet matching web's PrintableTicket dialog
  void _showPrintableTicket(Map<String, dynamic> ticket) {
    final event = ticket['event'] is Map<String, dynamic> ? ticket['event'] as Map<String, dynamic> : <String, dynamic>{};
    final ticketCode = ticket['ticket_code']?.toString() ?? '';
    final eventName = event['name']?.toString() ?? ticket['event_name']?.toString() ?? 'Event';
    final ticketClass = ticket['ticket_class_name']?.toString() ?? '';
    final startDate = event['start_date']?.toString() ?? '';
    final startTime = event['start_time']?.toString() ?? '';
    final location = event['location']?.toString() ?? '';
    final buyerName = ticket['buyer_name']?.toString() ?? '';
    final status = ticket['status']?.toString() ?? 'pending';
    final totalAmount = ticket['total_amount'];
    final quantity = ticket['quantity'] ?? 1;
    final currency = ticket['currency']?.toString() ?? 'TZS';

    String formatDate(String dateStr) {
      try {
        final d = DateTime.parse(dateStr);
        const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return '${weekdays[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
      } catch (_) { return dateStr; }
    }

    Color statusBgColor(String s) {
      switch (s) {
        case 'confirmed': return const Color(0xFFECFDF5);
        case 'approved': return const Color(0xFFEFF6FF);
        default: return const Color(0xFFFFFBEB);
      }
    }
    Color statusFgColor(String s) {
      switch (s) {
        case 'confirmed': return const Color(0xFF065F46);
        case 'approved': return const Color(0xFF1E40AF);
        default: return const Color(0xFF92400E);
      }
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 10),
                width: 36, height: 4,
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
              ),
              // Gradient header (matches web)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                    colors: [Color(0xFF1a1a2e), Color(0xFF16213e), Color(0xFF0f3460)],
                  ),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(eventName, style: GoogleFonts.inter(
                      fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white, height: 1.3)),
                    if (ticketClass.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(ticketClass.toUpperCase(), style: GoogleFonts.inter(
                        fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFFC9A96E), letterSpacing: 3)),
                    ],
                  ],
                ),
              ),
              // Dashed divider with perforated circles
              Stack(
                children: [
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    height: 2,
                    child: CustomPaint(
                      size: const Size(double.infinity, 2),
                      painter: _HorizontalDashedPainter(color: Colors.grey.shade300),
                    ),
                  ),
                  Positioned(left: 0, top: -11,
                    child: Container(width: 24, height: 24, decoration: const BoxDecoration(color: Color(0xFFF5F5F5), shape: BoxShape.circle))),
                  Positioned(right: 0, top: -11,
                    child: Container(width: 24, height: 24, decoration: const BoxDecoration(color: Color(0xFFF5F5F5), shape: BoxShape.circle))),
                ],
              ),
              // Body: details + QR code
              Padding(
                padding: const EdgeInsets.fromLTRB(28, 20, 28, 16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Details column
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (startDate.isNotEmpty) ...[
                            Text('DATE', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w500, color: Colors.grey, letterSpacing: 2)),
                            const SizedBox(height: 3),
                            Text(formatDate(startDate), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF1a1a1a))),
                            const SizedBox(height: 14),
                          ],
                          if (startTime.isNotEmpty && startTime.length >= 5) ...[
                            Text('TIME', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w500, color: Colors.grey, letterSpacing: 2)),
                            const SizedBox(height: 3),
                            Text(startTime.substring(0, 5), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF1a1a1a))),
                            const SizedBox(height: 14),
                          ],
                          if (location.isNotEmpty) ...[
                            Text('VENUE', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w500, color: Colors.grey, letterSpacing: 2)),
                            const SizedBox(height: 3),
                            Text(location, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF1a1a1a))),
                            const SizedBox(height: 14),
                          ],
                          if (buyerName.isNotEmpty) ...[
                            Text('ATTENDEE', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w500, color: Colors.grey, letterSpacing: 2)),
                            const SizedBox(height: 3),
                            Text(buyerName, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF1a1a1a))),
                            const SizedBox(height: 14),
                          ],
                          if (quantity > 1) ...[
                            Text('QUANTITY', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w500, color: Colors.grey, letterSpacing: 2)),
                            const SizedBox(height: 3),
                            Text('$quantity tickets', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF1a1a1a))),
                          ],
                        ],
                      ),
                    ),
                    // QR code column
                    Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: QrImageView(
                            data: 'https://nuru.tz/ticket/$ticketCode',
                            version: QrVersions.auto,
                            size: 90,
                            errorCorrectionLevel: QrErrorCorrectLevel.H,
                            embeddedImage: const AssetImage('assets/images/nuru-logo-square.png'),
                            embeddedImageStyle: const QrEmbeddedImageStyle(size: Size(18, 18)),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(ticketCode, style: GoogleFonts.spaceMono(fontSize: 11, color: Colors.grey, letterSpacing: 2)),
                      ],
                    ),
                  ],
                ),
              ),
              // Footer: status + amount
              Container(
                padding: const EdgeInsets.fromLTRB(28, 14, 28, 28),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  border: Border(top: BorderSide(color: Colors.grey.shade200)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusBgColor(status),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Text(status.toUpperCase(), style: GoogleFonts.inter(
                        fontSize: 10, fontWeight: FontWeight.w600, color: statusFgColor(status), letterSpacing: 1)),
                    ),
                    const SizedBox(width: 12),
                    if (totalAmount != null)
                      Text('$currency ${_formatAmount(totalAmount)}', style: GoogleFonts.inter(
                        fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF1a1a1a))),
                    const Spacer(),
                    // Nuru branding
                    Text('nuru', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.grey.shade400)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _imagePlaceholder(double height) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [AppColors.primarySoft, AppColors.surfaceVariant],
        ),
      ),
      child: Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 24, height: 24,
          colorFilter: ColorFilter.mode(AppColors.textHint.withOpacity(0.3), BlendMode.srcIn))),
    );
  }

  Widget _countdownChip(Map<String, dynamic> countdown) {
    final isPast = countdown['isPast'] == true;
    final text = countdown['text'] as String;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: isPast ? AppColors.surfaceVariant : AppColors.primarySoft,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text, style: GoogleFonts.inter(
        fontSize: 9, fontWeight: FontWeight.w600,
        color: isPast ? AppColors.textTertiary : AppColors.primary,
      )),
    );
  }

  Widget _buildPagination() {
    final totalPages = _pagination!['total_pages'] ?? 1;
    final hasPrev = _pagination!['has_previous'] == true;
    final hasNext = _pagination!['has_next'] == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _paginationButton(Icons.chevron_left, hasPrev, () { _page--; _load(); }),
          const SizedBox(width: 12),
          Text('Page $_page of $totalPages', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary)),
          const SizedBox(width: 12),
          _paginationButton(Icons.chevron_right, hasNext, () { _page++; _load(); }),
        ],
      ),
    );
  }

  Widget _paginationButton(IconData icon, bool enabled, VoidCallback onTap) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 34, height: 34,
        decoration: BoxDecoration(
          border: Border.all(color: enabled ? AppColors.borderLight : AppColors.surfaceVariant),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 18, color: enabled ? AppColors.textPrimary : AppColors.textHint),
      ),
    );
  }

  Map<String, dynamic>? _getCountdown(String dateStr) {
    if (dateStr.isEmpty) return null;
    try {
      final eventDate = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final target = DateTime(eventDate.year, eventDate.month, eventDate.day);
      final diffDays = target.difference(today).inDays;

      if (diffDays == 0) return {'text': 'Today!', 'isPast': false};
      if (diffDays == 1) return {'text': 'Tomorrow', 'isPast': false};
      if (diffDays == -1) return {'text': 'Yesterday', 'isPast': true};
      if (diffDays < 0) return {'text': 'Event passed', 'isPast': true};
      if (diffDays <= 7) return {'text': '$diffDays day${diffDays != 1 ? 's' : ''} left', 'isPast': false};
      if (diffDays <= 30) {
        final weeks = (diffDays / 7).round();
        return {'text': '$weeks week${weeks != 1 ? 's' : ''} left', 'isPast': false};
      }
      final months = (diffDays / 30).round();
      return {'text': '$months month${months != 1 ? 's' : ''} left', 'isPast': false};
    } catch (_) {
      return null;
    }
  }

  String _monthAbbr(int month) {
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[month - 1];
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return '0';
    final n = amount is int ? amount : (amount is double ? amount : num.tryParse(amount.toString()) ?? 0);
    return n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }
}

/// Paints a vertical dashed line
class _DashedLinePainter extends CustomPainter {
  final Color color;
  _DashedLinePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..strokeWidth = 1;
    double y = 4;
    while (y < size.height - 4) {
      canvas.drawLine(Offset(0, y), Offset(0, y + 4), paint);
      y += 8;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Paints a horizontal dashed line (for ticket divider)
class _HorizontalDashedPainter extends CustomPainter {
  final Color color;
  _HorizontalDashedPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..strokeWidth = 2;
    double x = 0;
    while (x < size.width) {
      canvas.drawLine(Offset(x, 0), Offset(x + 5, 0), paint);
      x += 10;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
