import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/escrow_service.dart';

/// Reusable card showing escrow status for a booking.
/// Shown on booking detail / vendor workspace.
class EscrowStatusCard extends StatefulWidget {
  final String bookingId;

  /// 'organiser' shows the Release button; 'vendor' shows Refund.
  final String viewerRole;

  const EscrowStatusCard({
    super.key,
    required this.bookingId,
    required this.viewerRole,
  });

  @override
  State<EscrowStatusCard> createState() => _EscrowStatusCardState();
}

class _EscrowStatusCardState extends State<EscrowStatusCard> {
  Map<String, dynamic>? _hold;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final res = await EscrowService.getForBooking(widget.bookingId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        _hold = res['data'] as Map<String, dynamic>?;
      } else {
        _error = res['message']?.toString() ?? 'Failed to load escrow';
      }
    });
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'held':
        return AppColors.primary;
      case 'released':
        return Colors.green;
      case 'refunded':
        return Colors.redAccent;
      case 'disputed':
        return Colors.deepOrange;
      case 'partially_released':
        return Colors.amber.shade800;
      default:
        return AppColors.textSecondary;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending':
        return 'Awaiting payment';
      case 'held':
        return 'Funds secured';
      case 'partially_released':
        return 'Partially released';
      case 'released':
        return 'Released to vendor';
      case 'refunded':
        return 'Refunded';
      case 'disputed':
        return 'Disputed (frozen)';
      default:
        return status;
    }
  }

  Future<void> _release() async {
    final res = await EscrowService.release(widget.bookingId,
        reason: 'organiser_confirmed_delivery');
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(res['message']?.toString() ?? 'Done'),
    ));
    if (res['success'] == true) _load();
  }

  Future<void> _refund() async {
    final ctrl = TextEditingController();
    final amt = await showDialog<double>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Refund amount'),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(hintText: 'e.g. 1000'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(
                  context, double.tryParse(ctrl.text.trim()) ?? 0),
              child: const Text('Refund')),
        ],
      ),
    );
    if (amt == null || amt <= 0) return;
    final res = await EscrowService.refund(widget.bookingId, amt);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(res['message']?.toString() ?? 'Done'),
    ));
    if (res['success'] == true) _load();
  }

  Widget _row(String label, String value, {bool emphasise = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 13, color: AppColors.textSecondary)),
          Text(value,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: emphasise ? FontWeight.w700 : FontWeight.w500,
                color: emphasise ? AppColors.primary : AppColors.textPrimary,
              )),
        ],
      ),
    );
  }

  String _money(dynamic v) {
    final n = (v is num) ? v : double.tryParse('$v') ?? 0;
    return 'KES ${n.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: _loading
            ? const Center(
                child: Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: CircularProgressIndicator(color: AppColors.primary),
              ))
            : _error != null || _hold == null
                ? Text(_error ?? 'Escrow not available',
                    style: GoogleFonts.inter(color: Colors.redAccent))
                : _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    final hold = _hold!;
    final status = hold['status']?.toString() ?? 'pending';
    final held = (hold['amount_currently_held'] ?? 0) as num;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(Icons.shield_outlined, size: 18, color: AppColors.primary),
            const SizedBox(width: 6),
            Text('Escrow & Payment',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700, fontSize: 15)),
            const Spacer(),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _statusColor(status).withOpacity(0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(_statusLabel(status),
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _statusColor(status))),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _row('Total agreed', _money(hold['amount_total'])),
        _row('Currently held', _money(held), emphasise: true),
        _row('Released', _money(hold['amount_released'])),
        _row('Refunded', _money(hold['amount_refunded'])),
        if (hold['auto_release_at'] != null) ...[
          const SizedBox(height: 4),
          Text('Auto-release: ${hold['auto_release_at']}',
              style: GoogleFonts.inter(
                  fontSize: 11, color: AppColors.textSecondary)),
        ],
        const SizedBox(height: 12),
        if (held > 0)
          Row(
            children: [
              if (widget.viewerRole == 'organiser')
                Expanded(
                  child: ElevatedButton(
                    onPressed: _release,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Release to vendor'),
                  ),
                ),
              if (widget.viewerRole == 'vendor')
                Expanded(
                  child: OutlinedButton(
                    onPressed: _refund,
                    child: const Text('Issue refund'),
                  ),
                ),
            ],
          ),
      ],
    );
  }
}
