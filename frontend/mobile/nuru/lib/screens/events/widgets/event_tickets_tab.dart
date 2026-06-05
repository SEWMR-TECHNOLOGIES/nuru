import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/utils/money_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/ticketing_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';

/// Event Tickets Tab — manage ticket classes and view sales (organizer view)
/// Matches web EventTicketManagement.tsx
class EventTicketsTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  const EventTicketsTab({super.key, required this.eventId, this.permissions});

  @override
  State<EventTicketsTab> createState() => _EventTicketsTabState();
}

class _EventTicketsTabState extends State<EventTicketsTab> {
  bool _loading = true;
  List<dynamic> _ticketClasses = [];
  List<dynamic> _soldTickets = [];
  String _approvalStatus = 'pending';
  String? _rejectionReason;
  String? _removedReason;
  int _selectedView = 0; // 0 = classes, 1 = sold

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      TicketingService.getMyTicketClasses(widget.eventId),
      TicketingService.getEventTickets(widget.eventId),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        if (results[0]['success'] == true) {
          final data = results[0]['data'];
          if (data is Map) {
            _ticketClasses = data['ticket_classes'] ?? [];
            _approvalStatus = data['ticket_approval_status']?.toString() ?? 'pending';
            _rejectionReason = data['ticket_rejection_reason']?.toString();
            _removedReason = data['ticket_removed_reason']?.toString();
          } else if (data is List) {
            _ticketClasses = data;
          }
        }
        if (results[1]['success'] == true) {
          final data = results[1]['data'];
          _soldTickets = data is List ? data : (data is Map ? (data['tickets'] ?? []) : []);
        }
      });
    }
  }

  int _asInt(dynamic value) => value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
  double _asDouble(dynamic v) => v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0.0;
  int get _totalSold => _ticketClasses.fold<int>(0, (sum, tc) => sum + _asInt(tc is Map ? tc['sold'] : 0));
  int get _totalQuantity => _ticketClasses.fold<int>(0, (sum, tc) => sum + _asInt(tc is Map ? tc['quantity'] : 0));
  double get _totalRevenue {
    // Prefer summing actual sold ticket orders (only paid/approved/confirmed counts)
    double fromOrders = 0;
    for (final t in _soldTickets) {
      if (t is! Map) continue;
      final status = (t['status'] ?? '').toString().toLowerCase();
      if (status == 'cancelled' || status == 'refunded' || status == 'rejected') continue;
      final amount = _asDouble(t['total_amount'] ?? t['amount'] ?? t['total'] ?? t['paid_amount']);
      if (amount > 0) { fromOrders += amount; continue; }
      // Fallback: unit price * quantity
      final qty = _asInt(t['quantity'] ?? 1);
      final unit = _asDouble(t['unit_price'] ?? t['price'] ?? t['ticket_price']);
      fromOrders += unit * qty;
    }
    if (fromOrders > 0) return fromOrders;
    // Final fallback: sum of (price * sold) across ticket classes
    return _ticketClasses.fold<double>(0, (s, tc) {
      if (tc is! Map) return s;
      return s + _asDouble(tc['price']) * _asInt(tc['sold']);
    });
  }

  void _showAddTicketClass() {
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 20),
          Text('New Ticket Class', style: appText(size: 18, weight: FontWeight.w700)),
          const SizedBox(height: 16),
          _inputField('Name', nameCtrl, 'e.g. VIP, Regular, Early Bird'),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _inputField('Price (TZS)', priceCtrl, '0', keyboard: TextInputType.number)),
            const SizedBox(width: 12),
            Expanded(child: _inputField('Quantity', qtyCtrl, '100', keyboard: TextInputType.number)),
          ]),
          const SizedBox(height: 12),
          _inputField('Description', descCtrl, 'Optional description', maxLines: 2),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity, height: 48,
            child: ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                final res = await TicketingService.createTicketClass(widget.eventId, {
                  'name': nameCtrl.text.trim(),
                  'price': double.tryParse(priceCtrl.text.trim()) ?? 0,
                  'quantity': int.tryParse(qtyCtrl.text.trim()) ?? 100,
                  if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
                });
                if (mounted) {
                  if (res['success'] == true) { AppSnackbar.success(context, 'Ticket class created'); _load(); }
                  else AppSnackbar.error(context, res['message'] ?? 'Failed');
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)), elevation: 0,
              ),
              child: Text('Create', style: appText(size: 15, weight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _inputField(String label, TextEditingController ctrl, String hint, {TextInputType? keyboard, int maxLines = 1}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: appText(size: 11, weight: FontWeight.w600, color: AppColors.textTertiary)),
      const SizedBox(height: 4),
      TextField(
        controller: ctrl,
        keyboardType: keyboard,
        maxLines: maxLines,
        style: appText(size: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: appText(size: 14, color: AppColors.textHint),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border, width: 1)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border, width: 1)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    ]);
  }

  void _updateTicketStatus(String ticketId, String status) async {
    final res = await TicketingService.updateTicketStatus(ticketId, status);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Ticket $status');
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to update');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    final progress = _totalQuantity > 0 ? (_totalSold / _totalQuantity).clamp(0.0, 1.0) : 0.0;

    return Column(children: [
      Expanded(child: NuruRefreshIndicator(
        onRefresh: _load, color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
          children: [
            // Approval status banner
            _approvalBanner(),
            if (_approvalStatus.isNotEmpty) const SizedBox(height: 14),

            // 4 KPI tiles row — Classes, Sold, Orders, Revenue
            Row(children: [
              Expanded(child: _kpiCard(
                iconName: 'ticket',
                iconBg: const Color(0xFFEDE9FE), iconColor: const Color(0xFF7C3AED),
                value: '${_ticketClasses.length}', label: 'Classes',
              )),
              const SizedBox(width: 10),
              Expanded(child: _kpiCard(
                iconName: 'users',
                iconBg: const Color(0xFFFEF3C7), iconColor: AppColors.primary,
                value: '$_totalSold / $_totalQuantity', label: 'Sold', valueSize: 14,
              )),
              const SizedBox(width: 10),
              Expanded(child: _kpiCard(
                iconName: 'bag',
                iconBg: const Color(0xFFDBEAFE), iconColor: const Color(0xFF2563EB),
                value: '${_soldTickets.length}', label: 'Orders',
              )),
              const SizedBox(width: 10),
              Expanded(child: _kpiCard(
                iconName: 'trending-up',
                iconBg: const Color(0xFFDCFCE7), iconColor: const Color(0xFF16A34A),
                value: _shortMoney(_totalRevenue), label: 'Revenue', valueSize: 13,
              )),
            ]),
            const SizedBox(height: 16),

            // Segmented control: Ticket Classes / Orders (gold active pill in white container)
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(999),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
              ),
              child: Row(children: [
                _segTab('ticket', 'Ticket Classes', 0),
                _segTab('bag', 'Orders (${_soldTickets.length})', 1),
              ]),
            ),
            const SizedBox(height: 18),

            // Section header row
            if (_selectedView == 0)
              Row(children: [
                Expanded(child: Text('${_ticketClasses.length} Ticket Classes',
                  style: appText(size: 14, weight: FontWeight.w800, color: AppColors.textPrimary))),
                GestureDetector(
                  onTap: _showAddTicketClass,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const AppIcon('plus', size: 14, color: Colors.white),
                      const SizedBox(width: 5),
                      Text('Add Class', style: appText(size: 12, weight: FontWeight.w700, color: Colors.white)),
                    ]),
                  ),
                ),
              ]),
            if (_selectedView == 0) const SizedBox(height: 12),

            _selectedView == 0 ? _classesView() : _soldView(),

            const SizedBox(height: 18),
            // Trust footer
            Row(children: [
              Container(
                width: 28, height: 28,
                decoration: BoxDecoration(color: const Color(0xFFDCFCE7), shape: BoxShape.circle),
                child: const AppIcon('shield', size: 14, color: Color(0xFF16A34A)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('All ticket sales are secure and protected.',
                  style: appText(size: 11, color: AppColors.textSecondary, weight: FontWeight.w600)),
                Text("You're all set!",
                  style: appText(size: 11, color: AppColors.textTertiary)),
              ])),
            ]),
          ],
        ),
      )),
    ]);
  }

  String _shortMoney(double v) {
    final cur = getActiveCurrency();
    if (v >= 1000000) return '$cur ${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '$cur ${(v / 1000).toStringAsFixed(0)}K';
    return '$cur ${v.toStringAsFixed(0)}';
  }

  Widget _kpiCard({required String iconName, required Color iconBg, required Color iconColor, required String value, required String label, double valueSize = 18}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)),
          child: Center(child: AppIcon(iconName, size: 17, color: iconColor)),
        ),
        const SizedBox(height: 10),
        FittedBox(fit: BoxFit.scaleDown,
          child: Text(value, style: appText(size: valueSize, weight: FontWeight.w800, color: AppColors.textPrimary))),
        const SizedBox(height: 2),
        Text(label, style: appText(size: 10, color: AppColors.textTertiary, weight: FontWeight.w500)),
      ]),
    );
  }

  Widget _segTab(String iconName, String label, int index) {
    final active = _selectedView == index;
    return Expanded(child: GestureDetector(
      onTap: () => setState(() => _selectedView = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          AppIcon(iconName, size: 14, color: active ? Colors.white : AppColors.textTertiary),
          const SizedBox(width: 6),
          Text(label, style: appText(
            size: 12, weight: FontWeight.w700,
            color: active ? Colors.white : AppColors.textTertiary,
          )),
        ]),
      ),
    ));
  }

  Widget _approvalBanner() {
    if (_approvalStatus == 'approved') {
      return _bannerShell(
        iconName: 'verified', color: AppColors.success,
        title: 'Approved', message: 'Your tickets are live and visible on the public tickets page.',
      );
    } else if (_approvalStatus == 'pending') {
      return _bannerShell(
        iconName: 'clock', color: AppColors.warning,
        title: 'Pending Approval', message: 'Your ticketed event is under review. Tickets will be visible once approved.',
      );
    } else if (_approvalStatus == 'rejected') {
      return _bannerShell(
        iconName: 'warning', color: AppColors.error,
        title: 'Rejected', message: _rejectionReason ?? 'Your ticketed event was not approved.',
      );
    } else if (_approvalStatus == 'removed') {
      return _bannerShell(
        iconName: 'warning', color: AppColors.textTertiary,
        title: 'Removed', message: _removedReason ?? 'Your ticketed event has been removed.',
      );
    }
    return const SizedBox.shrink();
  }

  Widget _bannerShell({required String iconName, required Color color, required String title, required String message}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
          child: AppIcon(iconName, size: 16, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: appText(size: 13, weight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(message, style: appText(size: 11, color: AppColors.textSecondary, height: 1.4)),
        ])),
      ]),
    );
  }

  Widget _classesView() {
    if (_ticketClasses.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(20)),
            child: Center(child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 28, height: 28,
              colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))),
          ),
          const SizedBox(height: 16),
          Text('No ticket classes yet', style: appText(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Tap Add Class to create your first ticket', style: appText(size: 12, color: AppColors.textTertiary)),
        ]),
      );
    }

    return Column(children: _ticketClasses.map((rawTc) {
      final tc = rawTc is Map<String, dynamic> ? rawTc : <String, dynamic>{};
      final name = tc['name']?.toString() ?? 'Ticket';
      final price = tc['price'];
      final qty = _asInt(tc['quantity']);
      final sold = _asInt(tc['sold']);
      final status = tc['status']?.toString() ?? 'available';
      final available = qty - sold;
      final progress = qty > 0 ? sold / qty : 0.0;
      final lower = name.toLowerCase();
      final isVip = lower.contains('vip') || lower.contains('premium');
      final tagline = isVip ? 'Premium Access' : 'General Admission';
      final isAvailable = status == 'available' && available > 0;

      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(children: [
            Container(
              decoration: BoxDecoration(
                color: isVip ? const Color(0xFF0E0E0E) : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: isVip ? null : Border.all(color: AppColors.borderLight),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(isVip ? 0.2 : 0.04), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isVip ? Colors.black : const Color(0xFFEDE9FE),
                      border: isVip ? Border.all(color: const Color(0xFFD4AF37), width: 2) : null,
                    ),
                    child: Center(child: isVip
                      ? const AppIcon('crown', size: 32, color: Color(0xFFE8C46A))
                      : SvgPicture.asset('assets/icons/ticket-icon.svg', width: 32, height: 32,
                          colorFilter: const ColorFilter.mode(Color(0xFF7C3AED), BlendMode.srcIn))),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(child: Text(name,
                        style: appText(size: 20, weight: FontWeight.w800,
                          color: isVip ? Colors.white : AppColors.textPrimary),
                        maxLines: 1, overflow: TextOverflow.ellipsis)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isAvailable
                            ? const Color(0xFF16A34A).withOpacity(isVip ? 0.15 : 0.12)
                            : (isVip ? Colors.white.withOpacity(0.08) : const Color(0xFFF3F4F6)),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: isAvailable
                            ? const Color(0xFF16A34A).withOpacity(0.45)
                            : Colors.transparent),
                        ),
                        child: Text(isAvailable ? 'available' : status,
                          style: appText(size: 10, weight: FontWeight.w700,
                            color: isAvailable
                              ? const Color(0xFF16A34A)
                              : (isVip ? Colors.white.withOpacity(0.6) : AppColors.textTertiary))),
                      ),
                    ]),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isVip ? const Color(0xFFD4AF37).withOpacity(0.18) : const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(tagline,
                        style: appText(size: 11, weight: FontWeight.w700,
                          color: isVip ? const Color(0xFFE8C46A) : AppColors.primaryDark)),
                    ),
                  ])),
                ]),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: _colStat('Price',
                    price != null && _asInt(price) > 0 ? _fmtPrice(price) : 'FREE',
                    isVip: isVip, accent: true)),
                  Container(width: 1, height: 36,
                    color: isVip ? Colors.white.withOpacity(0.1) : AppColors.divider),
                  Expanded(child: _colStat('Sold', '$sold / $qty', isVip: isVip)),
                  Container(width: 1, height: 36,
                    color: isVip ? Colors.white.withOpacity(0.1) : AppColors.divider),
                  Expanded(child: _colStat('Available', '$available', isVip: isVip)),
                ]),
                const SizedBox(height: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: progress, minHeight: 6,
                    backgroundColor: isVip ? Colors.white.withOpacity(0.1) : const Color(0xFFF3F4F6),
                    valueColor: AlwaysStoppedAnimation(isVip ? const Color(0xFFD4AF37) : AppColors.primary),
                  ),
                ),
                const SizedBox(height: 6),
                Text('${(progress * 100).toStringAsFixed(0)}% sold',
                  style: appText(size: 11,
                    color: isVip ? const Color(0xFFE8C46A) : AppColors.textTertiary,
                    weight: FontWeight.w600)),
              ]),
            ),
            if (isVip)
              Positioned(top: 0, left: 0,
                child: CustomPaint(
                  size: const Size(70, 70),
                  painter: _CornerRibbonPainter(),
                ),
              ),
          ]),
        ),
      );
    }).toList());
  }

  Widget _colStat(String label, String value, {bool isVip = false, bool accent = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Text(label,
          style: appText(size: 10,
            color: isVip ? Colors.white.withOpacity(0.55) : AppColors.textTertiary,
            weight: FontWeight.w500)),
        const SizedBox(height: 4),
        FittedBox(fit: BoxFit.scaleDown,
          child: Text(value,
            style: appText(size: 14, weight: FontWeight.w800,
              color: accent
                ? (isVip ? const Color(0xFFE8C46A) : AppColors.primary)
                : (isVip ? Colors.white : AppColors.textPrimary)))),
      ]),
    );
  }

  Widget _soldView() {
    if (_soldTickets.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 48),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(20)),
            child: const AppIcon('card', size: 26, color: AppColors.textHint),
          ),
          const SizedBox(height: 16),
          Text('No ticket orders yet', style: appText(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('Orders will appear as guests purchase tickets', style: appText(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
        ]),
      );
    }

    return Column(children: _soldTickets.map((rawT) {
      final t = rawT is Map<String, dynamic> ? rawT : <String, dynamic>{};
      final buyerName = t['buyer_name']?.toString() ?? 'Unknown';
      final className = t['ticket_class_name']?.toString() ?? t['ticket_class']?.toString() ?? '';
      final code = t['ticket_code']?.toString() ?? '';
      final qty = t['quantity'] ?? 1;
      final totalAmount = t['total_amount'];
      final status = t['status']?.toString() ?? 'pending';
      final checkedIn = t['checked_in'] == true;
      final ticketId = t['id']?.toString() ?? '';
      final initial = buyerName.isNotEmpty ? buyerName[0].toUpperCase() : '?';

      return Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: checkedIn ? const Color(0xFF16A34A).withOpacity(0.3) : AppColors.borderLight),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                    colors: checkedIn
                      ? [const Color(0xFF16A34A), const Color(0xFF15803D)]
                      : [AppColors.primary, AppColors.primary.withOpacity(0.7)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(child: checkedIn
                  ? const AppIcon('double-check', size: 20, color: Colors.white)
                  : Text(initial, style: appText(size: 16, weight: FontWeight.w800, color: Colors.white))),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(buyerName, style: appText(size: 14, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: _statusColor(status).withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
                    child: Text(status.toUpperCase(), style: appText(size: 9, weight: FontWeight.w800, letterSpacing: 0.5, color: _statusColor(status))),
                  ),
                ]),
                const SizedBox(height: 4),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  if (className.isNotEmpty) _chip(className, AppColors.primarySoft, AppColors.primary),
                  if (code.isNotEmpty) _chip('#$code', AppColors.surfaceVariant, AppColors.textSecondary),
                  _chip('Qty $qty', AppColors.surfaceVariant, AppColors.textSecondary),
                ]),
                if (totalAmount != null) ...[
                  const SizedBox(height: 6),
                  Text(_fmtPrice(totalAmount), style: appText(size: 14, weight: FontWeight.w800, color: AppColors.primary)),
                ],
              ])),
            ]),
            if (status != 'cancelled' && (status != 'approved' || status != 'rejected')) ...[
              const SizedBox(height: 10),
              Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                if (status != 'approved')
                  _actionBtn('Approve', AppColors.success, () => _updateTicketStatus(ticketId, 'approved')),
                if (status != 'rejected') ...[
                  const SizedBox(width: 6),
                  _actionBtn('Reject', AppColors.error, () => _updateTicketStatus(ticketId, 'rejected')),
                ],
              ]),
            ],
          ]),
        ),
      );
    }).toList());
  }

  Widget _chip(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: appText(size: 10, weight: FontWeight.w600, color: fg)),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Text(label, style: appText(size: 11, weight: FontWeight.w700, color: color)),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'confirmed': case 'approved': return const Color(0xFF16A34A);
      case 'pending': return const Color(0xFFCA8A04);
      case 'rejected': case 'cancelled': return AppColors.error;
      default: return AppColors.textTertiary;
    }
  }

  String _formatNum(dynamic n) {
    final num val = n is num ? n : (num.tryParse(n.toString()) ?? 0);
    return val.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  String _fmtPrice(dynamic p) {
    if (p == null) return '—';
    final n = (p is num) ? p.toInt() : (int.tryParse(p.toString().replaceAll(RegExp(r'[^\d]'), '')) ?? 0);
    if (n == 0) return '—';
    return '${getActiveCurrency()} ${n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }
}

class _DashedLinePainter extends CustomPainter {
  final Color color;
  _DashedLinePainter({required this.color});
  @override
  void paint(Canvas canvas, Size size) {
    const dashWidth = 4.0;
    const dashSpace = 4.0;
    double startX = 0;
    final paint = Paint()..color = color..strokeWidth = 1;
    while (startX < size.width) {
      canvas.drawLine(Offset(startX, 0), Offset(startX + dashWidth, 0), paint);
      startX += dashWidth + dashSpace;
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _CornerRibbonPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFE8C46A), Color(0xFFD4AF37), Color(0xFFB8941F)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
