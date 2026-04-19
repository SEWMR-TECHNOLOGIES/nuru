import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/expanding_search_action.dart';
import '../../core/services/user_services_service.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../widgets/cancel_booking_dialog.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  // My bookings (as organiser/client)
  List<dynamic> _mine = [];
  Map<String, dynamic> _mineSummary = {};
  bool _mineLoading = true;
  String _mineFilter = 'all';
  String _search = '';

  // Incoming (as vendor)
  List<dynamic> _incoming = [];
  Map<String, dynamic> _incomingSummary = {};
  bool _incomingLoading = true;
  String _incomingFilter = 'pending';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _loadMine();
    _loadIncoming();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _loadMine() async {
    setState(() => _mineLoading = true);
    final res = await UserServicesService.getBookings(status: _mineFilter, search: _search.isNotEmpty ? _search : null);
    if (!mounted) return;
    setState(() {
      _mineLoading = false;
      if (res['success'] == true) {
        final data = res['data'];
        if (data is Map) {
          _mine = (data['bookings'] ?? []) as List;
          _mineSummary = (data['summary'] ?? {}) as Map<String, dynamic>;
        } else if (data is List) {
          _mine = data;
        }
      }
    });
  }

  Future<void> _loadIncoming() async {
    setState(() => _incomingLoading = true);
    final res = await UserServicesService.getIncomingBookings(status: _incomingFilter, search: _search.isNotEmpty ? _search : null);
    if (!mounted) return;
    setState(() {
      _incomingLoading = false;
      if (res['success'] == true) {
        final data = res['data'];
        if (data is Map) {
          _incoming = (data['bookings'] ?? []) as List;
          _incomingSummary = (data['summary'] ?? {}) as Map<String, dynamic>;
        } else if (data is List) {
          _incoming = data;
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(
        title: context.tr('bookings'),
        actions: [
          ExpandingSearchAction(
            value: _search,
            hintText: 'Search bookings…',
            onChanged: (v) { _search = v; _loadMine(); _loadIncoming(); },
          ),
        ],
      ),
      body: Column(
        children: [
          // Pill tabs
          Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
            ),
            child: TabBar(
              controller: _tabs,
              indicator: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1))],
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelColor: AppColors.textPrimary,
              unselectedLabelColor: AppColors.textTertiary,
              labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
              unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w500),
              tabs: const [
                Tab(text: 'My Bookings'),
                Tab(text: 'Incoming'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _MineTab(
                  bookings: _mine,
                  summary: _mineSummary,
                  loading: _mineLoading,
                  filter: _mineFilter,
                  onFilterChanged: (v) { setState(() => _mineFilter = v); _loadMine(); },
                  onRefresh: _loadMine,
                ),
                _IncomingTab(
                  bookings: _incoming,
                  summary: _incomingSummary,
                  loading: _incomingLoading,
                  filter: _incomingFilter,
                  onFilterChanged: (v) { setState(() => _incomingFilter = v); _loadIncoming(); },
                  onRefresh: _loadIncoming,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers shared by both tabs
// ─────────────────────────────────────────────────────────────

const _statusOptions = [
  {'value': 'all', 'label': 'All'},
  {'value': 'pending', 'label': 'Pending'},
  {'value': 'accepted', 'label': 'Accepted'},
  {'value': 'rejected', 'label': 'Rejected'},
  {'value': 'completed', 'label': 'Completed'},
  {'value': 'cancelled', 'label': 'Cancelled'},
];

Color _statusColor(String s) {
  switch (s) {
    case 'accepted':
    case 'confirmed': return AppColors.success;
    case 'pending': return AppColors.warning;
    case 'rejected':
    case 'cancelled': return AppColors.error;
    case 'completed': return AppColors.primary;
    default: return AppColors.textTertiary;
  }
}

Widget _summaryRow(Map<String, dynamic> s) {
  if (s.isEmpty) return const SizedBox.shrink();
  final items = [
    {'label': 'Total', 'count': s['total'] ?? 0, 'color': AppColors.textPrimary},
    {'label': 'Pending', 'count': s['pending'] ?? 0, 'color': AppColors.warning},
    {'label': 'Accepted', 'count': s['accepted'] ?? 0, 'color': AppColors.success},
    {'label': 'Done', 'count': s['completed'] ?? 0, 'color': AppColors.primary},
    {'label': 'Cancelled', 'count': s['cancelled'] ?? s['rejected'] ?? 0, 'color': AppColors.error},
  ];
  return SizedBox(
    height: 70,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (_, i) {
        final it = items[i];
        return Container(
          width: 80,
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('${it['count']}',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18, fontWeight: FontWeight.w700,
                  color: it['color'] as Color,
                ),
              ),
              const SizedBox(height: 2),
              Text('${it['label']}',
                style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary),
              ),
            ],
          ),
        );
      },
    ),
  );
}

Widget _filterChips(String current, ValueChanged<String> onChange) {
  return SizedBox(
    height: 36,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _statusOptions.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (_, i) {
        final opt = _statusOptions[i];
        final selected = current == opt['value'];
        return GestureDetector(
          onTap: () => onChange(opt['value']!),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected ? AppColors.primary : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(opt['label']!,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ),
        );
      },
    ),
  );
}

Widget _skeletonList() {
  return ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: 4,
    separatorBuilder: (_, __) => const SizedBox(height: 12),
    itemBuilder: (_, __) => Container(
      height: 120,
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
      ),
    ),
  );
}

Widget _emptyState(String title, String subtitle) {
  return ListView(
    children: [
      const SizedBox(height: 100),
      Center(
        child: Column(
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(32)),
              child: const Center(child: Icon(Icons.calendar_today_outlined, size: 28, color: AppColors.textHint)),
            ),
            const SizedBox(height: 16),
            Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            Text(subtitle, style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
          ],
        ),
      ),
    ],
  );
}

// ─────────────────────────────────────────────────────────────
// MY BOOKINGS TAB (organiser/client)
// ─────────────────────────────────────────────────────────────

class _MineTab extends StatelessWidget {
  final List<dynamic> bookings;
  final Map<String, dynamic> summary;
  final bool loading;
  final String filter;
  final ValueChanged<String> onFilterChanged;
  final Future<void> Function() onRefresh;

  const _MineTab({
    required this.bookings, required this.summary, required this.loading,
    required this.filter, required this.onFilterChanged, required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return _skeletonList();
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const SizedBox(height: 8),
          _summaryRow(summary),
          const SizedBox(height: 8),
          _filterChips(filter, onFilterChanged),
          const SizedBox(height: 12),
          if (bookings.isEmpty)
            SizedBox(
              height: 400,
              child: _emptyState('No bookings yet', 'Browse services and make your first booking'),
            )
          else
            ...bookings.map((b) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: _BookingCard(
                booking: b is Map<String, dynamic> ? b : <String, dynamic>{},
                isVendor: false,
                onAfterAction: onRefresh,
              ),
            )),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// INCOMING TAB (vendor)
// ─────────────────────────────────────────────────────────────

class _IncomingTab extends StatelessWidget {
  final List<dynamic> bookings;
  final Map<String, dynamic> summary;
  final bool loading;
  final String filter;
  final ValueChanged<String> onFilterChanged;
  final Future<void> Function() onRefresh;

  const _IncomingTab({
    required this.bookings, required this.summary, required this.loading,
    required this.filter, required this.onFilterChanged, required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) return _skeletonList();
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const SizedBox(height: 8),
          _summaryRow(summary),
          const SizedBox(height: 8),
          _filterChips(filter, onFilterChanged),
          const SizedBox(height: 12),
          if (bookings.isEmpty)
            SizedBox(
              height: 400,
              child: _emptyState('No requests yet', 'Booking requests for your services will show here'),
            )
          else
            ...bookings.map((b) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: _BookingCard(
                booking: b is Map<String, dynamic> ? b : <String, dynamic>{},
                isVendor: true,
                onAfterAction: onRefresh,
              ),
            )),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// BOOKING CARD (premium)
// ─────────────────────────────────────────────────────────────

class _BookingCard extends StatelessWidget {
  final Map<String, dynamic> booking;
  final bool isVendor;
  final Future<void> Function() onAfterAction;

  const _BookingCard({required this.booking, required this.isVendor, required this.onAfterAction});

  @override
  Widget build(BuildContext context) {
    final serviceName = booking['service']?['title']?.toString()
        ?? booking['service_name']?.toString() ?? 'Service';
    final eventName = booking['event_name']?.toString() ?? booking['event']?['name']?.toString() ?? '';
    final status = booking['status']?.toString() ?? 'pending';
    final date = booking['event_date']?.toString() ?? booking['created_at']?.toString() ?? '';
    final clientName = booking['client']?['name']?.toString() ?? booking['client_name']?.toString() ?? '';
    final providerName = booking['provider']?['name']?.toString() ?? '';
    final amount = booking['quoted_price'] ?? booking['final_price'] ?? booking['total_amount'] ?? booking['amount'];
    final id = booking['id']?.toString() ?? '';

    final statusColor = _statusColor(status);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(serviceName,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary, height: 1.3,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Text(status.toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10, fontWeight: FontWeight.w700,
                    color: statusColor, letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (eventName.isNotEmpty) _infoRow(Icons.event_outlined, eventName),
          if (isVendor && clientName.isNotEmpty) _infoRow(Icons.person_outline, clientName),
          if (!isVendor && providerName.isNotEmpty) _infoRow(Icons.storefront_outlined, providerName),
          if (date.isNotEmpty) _infoRow(Icons.access_time, date.contains('T') ? date.split('T').first : date),
          if (amount != null) ...[
            const SizedBox(height: 8),
            Text('TZS $amount',
              style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary),
            ),
          ],
          // Actions
          if (isVendor && status == 'pending') ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _btn('Accept', AppColors.primary, Colors.white, () => _showRespond(context, 'accepted'))),
                const SizedBox(width: 8),
                Expanded(child: _btn('Decline', AppColors.surfaceVariant, AppColors.textSecondary, () => _showRespond(context, 'rejected'))),
              ],
            ),
          ],
          if (!isVendor && (status == 'pending' || status == 'accepted')) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: _btn('Cancel booking', AppColors.surfaceVariant, AppColors.error, () async {
                if (id.isEmpty) return;
                final cancelled = await showCancelBookingDialog(context, bookingId: id, cancellingParty: 'organiser');
                if (cancelled) await onAfterAction();
              }),
            ),
          ],
        ],
      ),
    );
  }

  Widget _btn(String label, Color bg, Color fg, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Center(child: Text(label,
          style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: fg),
        )),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(children: [
        Icon(icon, size: 14, color: AppColors.textHint),
        const SizedBox(width: 6),
        Expanded(child: Text(text,
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary, height: 1.4),
        )),
      ]),
    );
  }

  void _showRespond(BuildContext context, String status) {
    final id = booking['id']?.toString() ?? '';
    if (id.isEmpty) return;
    final messageCtrl = TextEditingController(
      text: status == 'accepted' ? 'Thanks for your request — happy to take it on.' : 'Thanks for reaching out — unfortunately I can\'t take this one.',
    );
    final priceCtrl = TextEditingController();
    final depositCtrl = TextEditingController();
    final reasonCtrl = TextEditingController();
    bool submitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(status == 'accepted' ? 'Accept booking' : 'Decline booking',
            style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (status == 'accepted') ...[
                  TextField(
                    controller: priceCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Quoted price (TZS)'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: depositCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Deposit required (TZS)'),
                  ),
                  const SizedBox(height: 8),
                ],
                if (status == 'rejected') ...[
                  TextField(
                    controller: reasonCtrl,
                    decoration: const InputDecoration(labelText: 'Reason'),
                  ),
                  const SizedBox(height: 8),
                ],
                TextField(
                  controller: messageCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Message to client'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(ctx),
              child: Text('Cancel', style: GoogleFonts.plusJakartaSans(color: AppColors.textTertiary)),
            ),
            ElevatedButton(
              onPressed: submitting ? null : () async {
                setS(() => submitting = true);
                final res = await UserServicesService.respondToBooking(
                  id,
                  status: status,
                  message: messageCtrl.text.trim(),
                  quotedPrice: double.tryParse(priceCtrl.text.trim()),
                  depositRequired: double.tryParse(depositCtrl.text.trim()),
                  reason: reasonCtrl.text.trim(),
                );
                setS(() => submitting = false);
                if (!ctx.mounted) return;
                if (res['success'] == true) {
                  Navigator.pop(ctx);
                  await onAfterAction();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(status == 'accepted' ? 'Booking accepted' : 'Booking declined')),
                  );
                } else {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(content: Text(res['message']?.toString() ?? 'Failed to respond')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: status == 'accepted' ? AppColors.primary : AppColors.error,
                foregroundColor: Colors.white,
              ),
              child: Text(submitting ? 'Sending…' : (status == 'accepted' ? 'Accept' : 'Decline')),
            ),
          ],
        ),
      ),
    );
  }
}
