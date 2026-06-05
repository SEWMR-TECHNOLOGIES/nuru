import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/theme/app_colors.dart';
import '../core/services/cancellations_service.dart';

/// Two-step cancel flow: preview refund → confirm.
/// Returns true if the booking was cancelled.
Future<bool> showCancelBookingDialog(
  BuildContext context, {
  required String bookingId,
  String cancellingParty = 'organiser',
}) async {
  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _CancelBookingDialog(
      bookingId: bookingId,
      cancellingParty: cancellingParty,
    ),
  );
  return result == true;
}

class _CancelBookingDialog extends StatefulWidget {
  final String bookingId;
  final String cancellingParty;
  const _CancelBookingDialog({
    required this.bookingId,
    required this.cancellingParty,
  });

  @override
  State<_CancelBookingDialog> createState() => _CancelBookingDialogState();
}

class _CancelBookingDialogState extends State<_CancelBookingDialog> {
  Map<String, dynamic>? _preview;
  bool _loadingPreview = true;
  String? _previewError;
  final _reasonCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadPreview();
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPreview() async {
    final res = await CancellationsService.previewRefund(
      widget.bookingId,
      cancellingParty: widget.cancellingParty,
    );
    if (!mounted) return;
    setState(() {
      _loadingPreview = false;
      if (res['success'] == true) {
        _preview = res['data'] as Map<String, dynamic>?;
      } else {
        _previewError = res['message']?.toString() ?? 'Failed to load preview';
      }
    });
  }

  Future<void> _confirm() async {
    if (_reasonCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    final res = await CancellationsService.cancel(
        widget.bookingId, _reasonCtrl.text.trim());
    if (!mounted) return;
    setState(() => _submitting = false);
    if (res['success'] == true) {
      Navigator.of(context).pop(true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res['message']?.toString() ?? 'Cancel failed'),
      ));
    }
  }

  Color _tierColor(String tier) {
    switch (tier) {
      case 'flexible':
        return Colors.green.shade700;
      case 'strict':
        return Colors.red.shade700;
      default:
        return Colors.amber.shade800;
    }
  }

  String _money(dynamic v) {
    final n = (v is num) ? v : double.tryParse('$v') ?? 0;
    return 'KES ${n.toStringAsFixed(0)}';
  }

  Widget _row(String label, String value, {Color? valueColor, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 13, color: AppColors.textSecondary)),
          Text(value,
              style: GoogleFonts.inter(
                fontSize: bold ? 16 : 13,
                fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
                color: valueColor ?? AppColors.textPrimary,
              )),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final refundIsZero =
        preview != null && (preview['refund_to_organiser'] ?? 0) == 0;

    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.redAccent),
          const SizedBox(width: 8),
          Expanded(
            child: Text('Cancel this booking?',
                style: GoogleFonts.inter(
                    fontSize: 18, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Review your refund. This is calculated automatically from the Nuru policy.',
              style: GoogleFonts.inter(
                  fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            if (_loadingPreview)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                    child: CircularProgressIndicator(
                        color: AppColors.primary)),
              )
            else if (_previewError != null)
              Text(_previewError!,
                  style: GoogleFonts.inter(color: Colors.redAccent))
            else if (preview != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Tier',
                            style: GoogleFonts.inter(
                                fontSize: 12,
                                color: AppColors.textSecondary)),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: _tierColor(
                                    preview['tier']?.toString() ?? 'moderate')
                                .withOpacity(0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            (preview['tier']?.toString() ?? '').toUpperCase(),
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: _tierColor(
                                  preview['tier']?.toString() ?? 'moderate'),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _row('Total agreed', _money(preview['total'])),
                    _row('You will be refunded',
                        _money(preview['refund_to_organiser']),
                        bold: true,
                        valueColor: refundIsZero
                            ? Colors.redAccent
                            : Colors.green.shade700),
                    _row('Vendor retention',
                        _money(preview['vendor_retention'])),
                    const Divider(height: 16),
                    Text(
                      preview['human_summary']?.toString() ?? '',
                      style: GoogleFonts.inter(
                          fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason for cancelling *',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Keep booking'),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.redAccent,
            foregroundColor: Colors.white,
          ),
          onPressed: _submitting || _loadingPreview ? null : _confirm,
          child: Text(_submitting ? 'Cancelling…' : 'Confirm cancellation'),
        ),
      ],
    );
  }
}
