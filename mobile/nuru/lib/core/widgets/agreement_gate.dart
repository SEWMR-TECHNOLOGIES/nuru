import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';
import '../services/agreements_service.dart';
import '../../core/l10n/l10n_helper.dart';

/// Agreement modal — matches web AgreementModal.tsx
/// Shows T&C before user creates a service or event
class AgreementGate {
  /// Check and prompt if needed. Returns true if accepted or already accepted.
  static Future<bool> checkAndPrompt(BuildContext context, String agreementType) async {
    try {
      final res = await AgreementsService.check(agreementType);
      final data = res['data'] ?? res;
      if (data['accepted'] == true) return true;

      final summary = data['summary']?.toString();
      final currentVersion = data['current_version'] ?? 1;
      final isUpdate = currentVersion > 1;

      if (!context.mounted) return false;
      final accepted = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => _AgreementSheet(
          agreementType: agreementType,
          updateSummary: isUpdate ? summary : null,
        ),
      );
      return accepted == true;
    } catch (_) {
      return true; // Fail open if agreement check fails
    }
  }
}

class _AgreementSheet extends StatefulWidget {
  final String agreementType;
  final String? updateSummary;
  const _AgreementSheet({required this.agreementType, this.updateSummary});

  @override
  State<_AgreementSheet> createState() => _AgreementSheetState();
}

class _AgreementSheetState extends State<_AgreementSheet> {
  bool _agreed = false;
  bool _loading = false;

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color, height: height);

  String get _title => widget.agreementType == 'vendor_agreement'
      ? 'Vendor Agreement'
      : 'Organiser Agreement';

  List<String> get _bullets => widget.agreementType == 'vendor_agreement'
      ? [
          'Service listings must be accurate and up to date',
          'Bookings create binding obligations between you and clients',
          'Nuru mediates disputes but is not liable for outcomes',
          'Platform fees apply to completed transactions',
        ]
      : [
          'Event details must be accurate and kept current',
          'You are responsible for guest safety and event compliance',
          'Contributions and ticket sales are subject to platform policies',
          'Platform fees apply to transactions and payouts',
        ];

  Future<void> _accept() async {
    setState(() => _loading = true);
    final res = await AgreementsService.accept(widget.agreementType);
    if (!mounted) return;
    if (res['success'] == true) {
      Navigator.pop(context, true);
    } else {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message']?.toString() ?? 'Failed to accept')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),

          // Icon
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.shield_outlined, size: 28, color: AppColors.primary),
          ),
          const SizedBox(height: 14),

          Text('Before you continue', style: _f(size: 20, weight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            widget.agreementType == 'vendor_agreement'
                ? "Here's how Nuru protects everyone when you offer services"
                : "Here's how Nuru protects everyone when you organise events",
            style: _f(size: 13, color: AppColors.textTertiary),
            textAlign: TextAlign.center,
          ),

          // Update banner
          if (widget.updateSummary != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.warning.withOpacity(0.3)),
              ),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.info_outline, size: 16, color: AppColors.warning),
                const SizedBox(width: 8),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Agreement Updated', style: _f(size: 12, weight: FontWeight.w700, color: AppColors.warning)),
                  Text(widget.updateSummary!, style: _f(size: 11, color: AppColors.textTertiary)),
                ])),
              ]),
            ),
          ],

          const SizedBox(height: 16),

          // Bullets
          ...List.generate(_bullets.length, (i) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.check_circle_rounded, size: 18, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(child: Text(_bullets[i], style: _f(size: 13, color: AppColors.textSecondary))),
            ]),
          )),

          const SizedBox(height: 16),

          // Checkbox
          GestureDetector(
            onTap: () => setState(() => _agreed = !_agreed),
            child: Row(children: [
              Container(
                width: 20, height: 20,
                decoration: BoxDecoration(
                  color: _agreed ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _agreed ? AppColors.primary : AppColors.borderLight, width: 1.5),
                ),
                child: _agreed ? const Icon(Icons.check, size: 14, color: Colors.white) : null,
              ),
              const SizedBox(width: 10),
              Expanded(child: Text('I have read and agree to the $_title', style: _f(size: 13))),
            ]),
          ),

          const SizedBox(height: 16),

          // Accept button
          SizedBox(
            width: double.infinity, height: 48,
            child: ElevatedButton(
              onPressed: _agreed && !_loading ? _accept : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.primary.withOpacity(0.3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text('Accept & Continue', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
            ),
          ),

          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: _f(size: 13, color: AppColors.textTertiary)),
          ),
        ]),
      ),
    );
  }
}
