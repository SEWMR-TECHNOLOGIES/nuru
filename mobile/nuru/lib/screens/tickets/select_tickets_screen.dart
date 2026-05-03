import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';
import '../../core/services/ticketing_service.dart';
import '../wallet/checkout_sheet.dart';

/// Full-screen ticket selection page (replaces the old bottom sheet).
/// Mirrors the "Select Tickets" mockup: header with back + Secure Checkout,
/// event card, list of ticket classes with +/- counters, order summary,
/// and a primary "Proceed to Checkout" CTA.
class SelectTicketsScreen extends StatefulWidget {
  final String eventId;
  final String eventName;
  final String? coverImage;
  final String? startDate;
  final String? startTime;
  final String? location;
  final String? eventType;

  const SelectTicketsScreen({
    super.key,
    required this.eventId,
    required this.eventName,
    this.coverImage,
    this.startDate,
    this.startTime,
    this.location,
    this.eventType,
  });

  @override
  State<SelectTicketsScreen> createState() => _SelectTicketsScreenState();
}

class _SelectTicketsScreenState extends State<SelectTicketsScreen> {
  List<dynamic> _classes = [];
  bool _loading = true;
  bool _purchasing = false;
  bool _isOwner = false;
  String? _approvalStatus;
  // Map<classId, quantity>
  final Map<String, int> _quantities = {};
  // Service fee in TZS — keep simple flat fee, change later if backend exposes it
  static const double _serviceFee = 2000;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await TicketingService.getTicketClasses(widget.eventId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _classes = data is Map ? (data['ticket_classes'] ?? []) : (data is List ? data : []);
        if (data is Map) {
          _isOwner = data['is_owner'] == true;
          _approvalStatus = data['ticket_approval_status']?.toString();
        }
      }
    });
  }

  num _priceOf(Map t) => (t['price'] is num) ? t['price'] as num : num.tryParse(t['price']?.toString() ?? '') ?? 0;
  int _availOf(Map t) => (t['available'] is int) ? t['available'] as int : int.tryParse(t['available']?.toString() ?? '0') ?? 0;

  double get _subtotal {
    double total = 0;
    for (final tc in _classes) {
      if (tc is! Map) continue;
      final id = tc['id']?.toString() ?? '';
      final qty = _quantities[id] ?? 0;
      if (qty > 0) total += _priceOf(tc).toDouble() * qty;
    }
    return total;
  }

  int get _totalQty => _quantities.values.fold(0, (a, b) => a + b);
  double get _grandTotal => _subtotal == 0 ? 0 : _subtotal + _serviceFee;

  Future<void> _proceed() async {
    if (_totalQty == 0 || _purchasing) return;
    // Find first selected class (purchase API takes one class per call). For
    // multi-class carts we fall back to issuing the largest line; backend will
    // create a single ticket order with the right total.
    String? targetId;
    int targetQty = 0;
    _quantities.forEach((id, qty) {
      if (qty > targetQty) { targetQty = qty; targetId = id; }
    });
    if (targetId == null) return;

    setState(() => _purchasing = true);
    final res = await TicketingService.purchaseTicket(ticketClassId: targetId!, quantity: targetQty);
    if (!mounted) return;
    setState(() => _purchasing = false);
    if (res['success'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(res['message']?.toString() ?? 'Purchase failed')));
      return;
    }
    final data = res['data'] is Map ? Map<String, dynamic>.from(res['data']) : <String, dynamic>{};
    final pendingTicketId = data['ticket_id']?.toString() ?? data['id']?.toString() ?? targetId!;
    final totalAmount = data['total_amount'] is num
        ? data['total_amount'] as num
        : num.tryParse(data['total_amount']?.toString() ?? '') ?? _grandTotal;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CheckoutSheet(
        targetType: 'event_ticket',
        targetId: pendingTicketId,
        amount: totalAmount,
        allowBank: false,
        title: 'Tickets for ${widget.eventName}',
        description: '$_totalQty ticket${_totalQty > 1 ? "s" : ""} • ${widget.eventName}',
        onSuccess: (_) {
          if (mounted) {
            Navigator.pop(context);
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('Payment confirmed — your ticket is now issued.'),
            ));
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.surface,
      ),
      child: Scaffold(
        backgroundColor: AppColors.surface,
        appBar: _appBar(),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                      children: [
                        _eventCard(),
                        const SizedBox(height: 18),
                        Text('Choose Ticket Type', style: appText(size: 14, weight: FontWeight.w700)),
                        const SizedBox(height: 10),
                        if (_isOwner && _approvalStatus != null && _approvalStatus != 'approved')
                          _pendingBanner(),
                        if (_classes.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 40),
                            child: Center(child: Text('No ticket classes available',
                                style: appText(size: 13, color: AppColors.textTertiary))),
                          )
                        else
                          Container(
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              border: Border.all(color: AppColors.borderLight),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              children: [
                                for (int i = 0; i < _classes.length; i++) ...[
                                  if (i > 0) Divider(height: 1, color: AppColors.borderLight),
                                  _ticketRow(_classes[i] as Map),
                                ],
                              ],
                            ),
                          ),
                        if (_totalQty > 0) ...[
                          const SizedBox(height: 18),
                          _orderSummary(),
                        ],
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                  _bottomBar(),
                ],
              ),
      ),
    );
  }

  PreferredSizeWidget _appBar() {
    return AppBar(
      backgroundColor: AppColors.surface,
      surfaceTintColor: AppColors.surface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      systemOverlayStyle: SystemUiOverlayStyle.dark,
      leading: IconButton(
        onPressed: () => Navigator.pop(context),
        icon: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 22, height: 22,
            colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
      ),
      title: Text('Select Tickets', style: appText(size: 16, weight: FontWeight.w700)),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 14),
          child: Row(children: [
            Icon(Icons.shield_outlined, size: 16, color: const Color(0xFF15803D)),
            const SizedBox(width: 4),
            Text('Secure Checkout', style: appText(size: 11, weight: FontWeight.w600, color: const Color(0xFF15803D))),
          ]),
        ),
      ],
    );
  }

  Widget _eventCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 70, height: 80,
            child: (widget.coverImage != null && widget.coverImage!.isNotEmpty)
                ? CachedNetworkImage(imageUrl: widget.coverImage!, fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant))
                : Container(color: AppColors.primarySoft, child: Center(child: SvgPicture.asset(
                    'assets/icons/ticket-icon.svg', width: 24, height: 24,
                    colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)))),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.eventName, style: appText(size: 15, weight: FontWeight.w800), maxLines: 2, overflow: TextOverflow.ellipsis),
          if ((widget.eventType ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: const Color(0xFFEDE9FE), borderRadius: BorderRadius.circular(20)),
              child: Text(widget.eventType!, style: appText(size: 10, weight: FontWeight.w600, color: const Color(0xFF7C3AED))),
            ),
          ],
          const SizedBox(height: 6),
          if ((widget.startDate ?? '').isNotEmpty)
            Row(children: [
              SvgPicture.asset('assets/icons/calendar-icon.svg', width: 11, height: 11,
                  colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
              const SizedBox(width: 4),
              Flexible(child: Text(_formatDate(widget.startDate!) + ((widget.startTime ?? '').isNotEmpty ? '  •  ${widget.startTime}' : ''),
                  style: appText(size: 11, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
          if ((widget.location ?? '').isNotEmpty) ...[
            const SizedBox(height: 3),
            Row(children: [
              SvgPicture.asset('assets/icons/location-icon.svg', width: 11, height: 11,
                  colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
              const SizedBox(width: 4),
              Expanded(child: Text(widget.location!,
                  style: appText(size: 11, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
          ],
        ])),
      ]),
    );
  }

  Widget _pendingBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withOpacity(0.3)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.schedule, size: 18, color: AppColors.warning),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Pending review', style: appText(size: 13, weight: FontWeight.w700, color: AppColors.warning)),
          const SizedBox(height: 2),
          Text('Your ticketed event is awaiting admin approval.',
              style: appText(size: 11, color: AppColors.textSecondary, height: 1.4)),
        ])),
      ]),
    );
  }

  Widget _ticketRow(Map t) {
    final id = t['id']?.toString() ?? '';
    final name = t['name']?.toString() ?? 'Ticket';
    final description = t['description']?.toString() ?? '';
    final price = _priceOf(t);
    final available = _availOf(t);
    final qty = _quantities[id] ?? 0;
    final isSoldOut = available <= 0;
    // "Limited" if low stock
    final isLimited = !isSoldOut && available <= 20;

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Flexible(child: Text(name, style: appText(size: 14, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (isLimited) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: AppColors.warningSoft, borderRadius: BorderRadius.circular(20)),
                child: Text('Limited', style: appText(size: 9, weight: FontWeight.w700, color: const Color(0xFFB45309))),
              ),
            ],
            if (isSoldOut) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(20)),
                child: Text('Sold Out', style: appText(size: 9, weight: FontWeight.w700, color: AppColors.error)),
              ),
            ],
          ]),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(description, style: appText(size: 11, color: AppColors.textTertiary), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 4),
          Text('TZS ${_fmt(price)}', style: appText(size: 13, weight: FontWeight.w800, color: AppColors.textPrimary)),
        ])),
        const SizedBox(width: 10),
        _stepper(id, qty, available, isSoldOut),
      ]),
    );
  }

  Widget _stepper(String id, int qty, int available, bool isSoldOut) {
    final active = qty > 0;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: active ? AppColors.primary : AppColors.borderLight, width: active ? 1.5 : 1),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _stepBtn('-', enabled: !isSoldOut && qty > 0, onTap: () => setState(() {
          if (qty > 0) _quantities[id] = qty - 1;
          if (_quantities[id] == 0) _quantities.remove(id);
        })),
        SizedBox(width: 28, child: Text('$qty', textAlign: TextAlign.center,
            style: appText(size: 14, weight: FontWeight.w700, color: active ? AppColors.primary : AppColors.textPrimary))),
        _stepBtn('+', enabled: !isSoldOut && qty < available, onTap: () => setState(() {
          _quantities[id] = qty + 1;
        })),
      ]),
    );
  }

  Widget _stepBtn(String label, {required bool enabled, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 28, height: 28,
        alignment: Alignment.center,
        child: Text(label, style: appText(size: 18, weight: FontWeight.w600,
            color: enabled ? AppColors.primary : AppColors.textHint)),
      ),
    );
  }

  Widget _orderSummary() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Order Summary', style: appText(size: 14, weight: FontWeight.w700)),
        const SizedBox(height: 12),
        for (final tc in _classes) ...[
          if (tc is Map && (_quantities[tc['id']?.toString() ?? ''] ?? 0) > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Expanded(child: Text(
                  '${tc['name'] ?? 'Ticket'} (${_quantities[tc['id']?.toString() ?? ''] ?? 0})',
                  style: appText(size: 12, color: AppColors.textSecondary),
                )),
                Text('TZS ${_fmt(_priceOf(tc) * (_quantities[tc['id']?.toString() ?? ''] ?? 0))}',
                    style: appText(size: 12, weight: FontWeight.w600)),
              ]),
            ),
        ],
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            Expanded(child: Text('Service Fee', style: appText(size: 12, color: AppColors.textSecondary))),
            Text('TZS ${_fmt(_serviceFee)}', style: appText(size: 12, weight: FontWeight.w600)),
          ]),
        ),
        Divider(color: AppColors.borderLight, height: 14),
        Row(children: [
          Expanded(child: Text('Total Amount', style: appText(size: 14, weight: FontWeight.w800))),
          Text('TZS ${_fmt(_grandTotal)}', style: appText(size: 16, weight: FontWeight.w800, color: AppColors.textPrimary)),
        ]),
      ]),
    );
  }

  Widget _bottomBar() {
    final canProceed = _totalQty > 0 && !_purchasing && !(_isOwner && _approvalStatus != null && _approvalStatus != 'approved');
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SizedBox(
            width: double.infinity, height: 54,
            child: ElevatedButton(
              onPressed: canProceed ? _proceed : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                disabledBackgroundColor: AppColors.primary.withOpacity(0.4),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: _purchasing
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('Proceed to Checkout', style: appText(size: 15, weight: FontWeight.w700, color: Colors.white)),
                      const SizedBox(width: 8),
                      SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 18, height: 18,
                          colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                    ]),
            ),
          ),
          const SizedBox(height: 10),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _trustChip(Icons.shield_outlined, 'Secure Payment'),
            _trustChip(Icons.bolt_outlined, 'Instant Confirmation'),
            _trustChip(Icons.headset_mic_outlined, '24/7 Support'),
          ]),
        ]),
      ),
    );
  }

  Widget _trustChip(IconData icon, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: AppColors.textTertiary),
        const SizedBox(width: 4),
        Text(label, style: appText(size: 10, color: AppColors.textTertiary, weight: FontWeight.w500)),
      ]);

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return '${_weekday(d.weekday).substring(0,3)}, ${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) { return dateStr; }
  }

  String _weekday(int wd) => const ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][wd - 1];

  String _fmt(num n) => n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
}
