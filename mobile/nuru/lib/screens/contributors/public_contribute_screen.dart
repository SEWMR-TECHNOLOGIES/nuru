/// PublicContributeScreen — native parity for the web `/c/:token` page.
///
/// Loads the public contribution link metadata (organiser, event, currency,
/// suggested amount), then opens the canonical [CheckoutSheet] with
/// `targetType: 'event_contribution'` so the payment goes through the SAME
/// pipeline as every other payment on Nuru: wallet, mobile money STK push,
/// or bank transfer — all gated by `/payments/initiate` and polled via
/// `/payments/{code}/status`.
///
/// On success the user lands on the receipt screen, identical to ticket and
/// booking payments.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/services/api_base.dart';
import '../wallet/checkout_sheet.dart';

class PublicContributeScreen extends StatefulWidget {
  final String token;

  const PublicContributeScreen({super.key, required this.token});

  @override
  State<PublicContributeScreen> createState() => _PublicContributeScreenState();
}

class _PublicContributeScreenState extends State<PublicContributeScreen> {
  Map<String, dynamic>? _link;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadLink();
  }

  Future<void> _loadLink() async {
    final res = await ApiBase.getRaw('/public/contribute/${widget.token}');
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true && res['data'] is Map<String, dynamic>) {
        _link = res['data'] as Map<String, dynamic>;
      }
    });
    if (_link == null) {
      AppSnackbar.error(context, 'Link is invalid or expired');
    }
  }

  String? _eventId() =>
      _link?['event_id']?.toString() ??
      (_link?['event'] is Map ? _link!['event']['id']?.toString() : null);

  num? _suggestedAmount() {
    final raw = _link?['suggested_amount'] ?? _link?['amount'] ?? _link?['balance'];
    if (raw is num) return raw;
    return num.tryParse(raw?.toString() ?? '');
  }

  void _openCheckout() {
    final eventId = _eventId();
    if (eventId == null || eventId.isEmpty) {
      AppSnackbar.error(context, 'This link is missing event details');
      return;
    }
    final eventTitle = _link?['event']?['title']?.toString()
        ?? _link?['event_title']?.toString()
        ?? 'Event contribution';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CheckoutSheet(
        targetType: 'event_contribution',
        targetId: eventId,
        amount: _suggestedAmount(),
        amountEditable: true,
        allowBank: false,
        title: 'Pay contribution',
        description: 'For $eventTitle',
        onSuccess: (_) {
          if (mounted) Navigator.pop(context, true);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final eventTitle = _link?['event']?['title']?.toString()
        ?? _link?['event_title']?.toString()
        ?? 'Event contribution';
    final cover = _link?['event']?['cover_image']?.toString()
        ?? _link?['cover_image']?.toString() ?? '';
    final organiser = _link?['organiser_name']?.toString()
        ?? _link?['organizer_name']?.toString()
        ?? _link?['event']?['organiser_name']?.toString()
        ?? '';
    final note = _link?['message']?.toString() ?? _link?['note']?.toString() ?? '';
    final suggested = _suggestedAmount();
    final currency = (_link?['currency_code'] ?? _link?['currency'] ?? 'TZS').toString();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const NuruSubPageAppBar(title: 'Contribute'),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
          : _link == null
              ? _invalidLinkState()
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.surfaceVariant,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      padding: const EdgeInsets.all(16),
                      child: Row(children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: cover.isNotEmpty
                              ? Image.network(cover, width: 64, height: 64, fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => _coverFallback())
                              : _coverFallback(),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Public contribution', style: GoogleFonts.inter(
                                  fontSize: 11, color: AppColors.textTertiary, letterSpacing: 0.6)),
                              const SizedBox(height: 4),
                              Text(eventTitle,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.inter(
                                      fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                              if (organiser.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text('Organised by $organiser',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                        fontSize: 12, color: AppColors.textSecondary)),
                              ],
                            ],
                          ),
                        ),
                      ]),
                    ),
                    if (note.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(note,
                            style: GoogleFonts.inter(
                                fontSize: 13, color: AppColors.textPrimary, height: 1.4)),
                      ),
                    ],
                    if (suggested != null) ...[
                      const SizedBox(height: 16),
                      Row(children: [
                        Text('Suggested amount',
                            style: GoogleFonts.inter(
                                fontSize: 12, color: AppColors.textTertiary)),
                        const Spacer(),
                        Text('$currency ${suggested.toStringAsFixed(0)}',
                            style: GoogleFonts.inter(
                                fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      ]),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _openCheckout,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: Text('Continue to payment',
                            style: GoogleFonts.inter(
                                fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Pay with Nuru Wallet, mobile money (M-Pesa, Tigo Pesa, Airtel Money), or bank transfer. You\u2019ll get a receipt right after.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                          fontSize: 11, color: AppColors.textTertiary, height: 1.4),
                    ),
                  ],
                ),
    );
  }

  Widget _coverFallback() => Container(
        width: 64, height: 64, color: AppColors.borderLight,
        child: const Icon(Icons.event_rounded, color: AppColors.textTertiary),
      );

  Widget _invalidLinkState() => Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.link_off_rounded, size: 56, color: AppColors.textHint),
            const SizedBox(height: 16),
            Text('This contribution link is invalid or expired.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
          ],
        ),
      );
}
