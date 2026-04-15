import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
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

  int get _totalSold => _ticketClasses.fold<int>(0, (sum, tc) => sum + ((tc is Map ? tc['sold'] ?? 0 : 0) as int));
  int get _totalQuantity => _ticketClasses.fold<int>(0, (sum, tc) => sum + ((tc is Map ? tc['quantity'] ?? 0 : 0) as int));
  double get _totalRevenue => _soldTickets.fold<double>(0, (sum, t) => sum + ((t is Map ? (t['total_amount'] is num ? (t['total_amount'] as num).toDouble() : 0.0) : 0.0)));

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
          fillColor: const Color(0xFFF3F4F6),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
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

    return Column(children: [
      // Approval Status Banner (matches web)
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: _approvalBanner(),
      ),

      // Summary Cards (matches web)
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(children: [
          _summaryCard('Classes', '${_ticketClasses.length}', AppColors.primary),
          const SizedBox(width: 6),
          _summaryCard('Sold', '$_totalSold / $_totalQuantity', AppColors.success),
          const SizedBox(width: 6),
          _summaryCard('Orders', '${_soldTickets.length}', AppColors.blue),
          const SizedBox(width: 6),
          _summaryCard('Revenue', _fmtPrice(_totalRevenue), AppColors.primary),
        ]),
      ),

      // Ticket classes pills (matches web)
      if (_ticketClasses.isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: _ticketClasses.map((tc) {
              final t = tc is Map<String, dynamic> ? tc : <String, dynamic>{};
              return Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  SvgPicture.asset('assets/icons/ticket-icon.svg', width: 12, height: 12,
                    colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
                  const SizedBox(width: 5),
                  Text(t['name']?.toString() ?? '', style: appText(size: 11, weight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  Text('${t['sold'] ?? 0}/${t['quantity'] ?? 0}', style: appText(size: 10, color: AppColors.textTertiary)),
                  const SizedBox(width: 6),
                  Text(_fmtPrice(t['price']), style: appText(size: 10, weight: FontWeight.w700, color: AppColors.primary)),
                ]),
              );
            }).toList()),
          ),
        ),

      // View toggle
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: Row(children: [
          _viewTab('Ticket Classes', 0),
          const SizedBox(width: 8),
          _viewTab('Orders (${_soldTickets.length})', 1),
          const Spacer(),
          if (_selectedView == 0)
            GestureDetector(
              onTap: _showAddTicketClass,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.add_rounded, size: 16, color: Colors.white),
                  const SizedBox(width: 4),
                  Text('Add', style: appText(size: 12, weight: FontWeight.w600, color: Colors.white)),
                ]),
              ),
            ),
        ]),
      ),
      Expanded(child: RefreshIndicator(
        onRefresh: _load, color: AppColors.primary,
        child: _selectedView == 0 ? _classesView() : _soldView(),
      )),
    ]);
  }

  Widget _approvalBanner() {
    if (_approvalStatus == 'approved') {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.success.withOpacity(0.3)),
        ),
        child: Row(children: [
          Icon(Icons.check_circle_rounded, size: 18, color: AppColors.success),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Approved', style: appText(size: 13, weight: FontWeight.w700, color: AppColors.success)),
            Text('Your tickets are live and visible on the public tickets page.', style: appText(size: 10, color: AppColors.textTertiary)),
          ])),
        ]),
      );
    } else if (_approvalStatus == 'pending') {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.warning.withOpacity(0.08), borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.warning.withOpacity(0.3)),
        ),
        child: Row(children: [
          Icon(Icons.schedule_rounded, size: 18, color: AppColors.warning),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Pending Approval', style: appText(size: 13, weight: FontWeight.w700, color: AppColors.warning)),
            Text('Your ticketed event is under review. Tickets will be visible once approved.', style: appText(size: 10, color: AppColors.textTertiary)),
          ])),
        ]),
      );
    } else if (_approvalStatus == 'rejected') {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.error.withOpacity(0.08), borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.error.withOpacity(0.3)),
        ),
        child: Row(children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: AppColors.error),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Rejected', style: appText(size: 13, weight: FontWeight.w700, color: AppColors.error)),
            Text(_rejectionReason ?? 'Your ticketed event was not approved.', style: appText(size: 10, color: AppColors.textTertiary)),
          ])),
        ]),
      );
    } else if (_approvalStatus == 'removed') {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: AppColors.textTertiary),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Removed', style: appText(size: 13, weight: FontWeight.w700)),
            Text(_removedReason ?? 'Your ticketed event has been removed.', style: appText(size: 10, color: AppColors.textTertiary)),
          ])),
        ]),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)],
      ),
      child: Column(children: [
        Text(value, style: appText(size: 13, weight: FontWeight.w800, color: label == 'Revenue' ? color : AppColors.textPrimary),
            maxLines: 1, overflow: TextOverflow.ellipsis),
        const SizedBox(height: 2),
        Text(label, style: appText(size: 9, color: AppColors.textTertiary, weight: FontWeight.w600)),
      ]),
    ));
  }

  Widget _viewTab(String label, int index) {
    final active = _selectedView == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedView = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.primarySoft : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: appText(size: 12, weight: active ? FontWeight.w700 : FontWeight.w500,
          color: active ? AppColors.primary : AppColors.textTertiary)),
      ),
    );
  }

  Widget _classesView() {
    if (_ticketClasses.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset('assets/icons/ticket-icon.svg', width: 40, height: 40,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        const SizedBox(height: 14),
        Text('No ticket classes', style: appText(size: 15, weight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text('Create ticket classes for this event', style: appText(size: 12, color: AppColors.textTertiary)),
      ]));
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      itemCount: _ticketClasses.length,
      itemBuilder: (_, i) {
        final tc = _ticketClasses[i] is Map<String, dynamic> ? _ticketClasses[i] as Map<String, dynamic> : <String, dynamic>{};
        final name = tc['name']?.toString() ?? 'Ticket';
        final price = tc['price'];
        final qty = tc['quantity'] ?? 0;
        final sold = tc['sold'] ?? 0;
        final status = tc['status']?.toString() ?? 'available';
        final available = (qty is int ? qty : 0) - (sold is int ? sold : 0);

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderLight, width: 1),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(name, style: appText(size: 15, weight: FontWeight.w700))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: status == 'available' ? const Color(0xFFDCFCE7) : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(status, style: appText(size: 10, weight: FontWeight.w600,
                  color: status == 'available' ? const Color(0xFF16A34A) : AppColors.textTertiary)),
              ),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              _ticketStat('Price', price != null ? 'TZS ${_formatNum(price)}' : 'Free'),
              const SizedBox(width: 20),
              _ticketStat('Sold', '$sold/$qty'),
              const SizedBox(width: 20),
              _ticketStat('Available', '$available'),
            ]),
            if (sold is int && sold > 0) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: qty is int && qty > 0 ? sold / qty : 0,
                  minHeight: 4, backgroundColor: AppColors.borderLight,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
            ],
          ]),
        );
      },
    );
  }

  Widget _soldView() {
    if (_soldTickets.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset('assets/icons/ticket-icon.svg', width: 40, height: 40,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        const SizedBox(height: 14),
        Text('No ticket orders yet', style: appText(size: 15, weight: FontWeight.w600)),
      ]));
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      itemCount: _soldTickets.length,
      itemBuilder: (_, i) {
        final t = _soldTickets[i] is Map<String, dynamic> ? _soldTickets[i] as Map<String, dynamic> : <String, dynamic>{};
        final buyerName = t['buyer_name']?.toString() ?? 'Unknown';
        final className = t['ticket_class_name']?.toString() ?? t['ticket_class']?.toString() ?? '';
        final code = t['ticket_code']?.toString() ?? '';
        final qty = t['quantity'] ?? 1;
        final totalAmount = t['total_amount'];
        final status = t['status']?.toString() ?? 'pending';
        final checkedIn = t['checked_in'] == true;
        final ticketId = t['id']?.toString() ?? '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(14),
            border: Border.all(color: checkedIn ? const Color(0xFF16A34A).withOpacity(0.3) : AppColors.borderLight, width: 1),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: checkedIn ? const Color(0xFFDCFCE7) : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  checkedIn ? Icons.check_circle_rounded : Icons.person_rounded,
                  size: 20, color: checkedIn ? const Color(0xFF16A34A) : AppColors.textHint,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(buyerName, style: appText(size: 14, weight: FontWeight.w600)),
                Row(children: [
                  if (className.isNotEmpty) Text('$className · ', style: appText(size: 11, color: AppColors.textTertiary)),
                  Text(code, style: appText(size: 11, color: AppColors.textTertiary, weight: FontWeight.w500)),
                  Text(' · Qty: $qty', style: appText(size: 11, color: AppColors.textTertiary)),
                  if (totalAmount != null) Text(' · ${_fmtPrice(totalAmount)}', style: appText(size: 11, weight: FontWeight.w600, color: AppColors.primary)),
                ]),
              ])),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusColor(status).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(status, style: appText(size: 10, weight: FontWeight.w600, color: _statusColor(status))),
              ),
            ]),
            // Approve/Reject actions (matches web)
            if (status != 'cancelled') ...[
              const SizedBox(height: 8),
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
        );
      },
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Text(label, style: appText(size: 11, weight: FontWeight.w600, color: color)),
      ),
    );
  }

  Widget _ticketStat(String label, String value) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: appText(size: 10, color: AppColors.textTertiary)),
      Text(value, style: appText(size: 13, weight: FontWeight.w700)),
    ]);
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
    return 'TZS ${n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }
}
