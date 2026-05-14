import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/services/event_contributors_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/money_format.dart' show formatMoney;

/// Organiser-side scanner for the aggregate contribution receipt QR.
/// Scans a `https://nuru.tz/verify/contribution/<token>` URL, calls the
/// backend to resolve the token, and shows the authoritative summary.
class VerifyContributionScannerScreen extends StatefulWidget {
  const VerifyContributionScannerScreen({super.key});

  @override
  State<VerifyContributionScannerScreen> createState() =>
      _VerifyContributionScannerScreenState();
}

class _VerifyContributionScannerScreenState
    extends State<VerifyContributionScannerScreen> {
  late final MobileScannerController _controller;
  bool _busy = false;
  bool _torchOn = false;
  String? _lastToken;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _extractToken(String raw) {
    final s = raw.trim();
    if (s.isEmpty) return null;
    // Accept either the bare token or a full verify URL.
    final markers = ['/verify/contribution/', '/contributions/verify/'];
    for (final m in markers) {
      final i = s.indexOf(m);
      if (i >= 0) {
        var rest = s.substring(i + m.length);
        final q = rest.indexOf('?');
        if (q >= 0) rest = rest.substring(0, q);
        return rest.trim();
      }
    }
    if (RegExp(r'^[A-Za-z0-9_\-\.]+$').hasMatch(s)) return s;
    return null;
  }

  Future<void> _handleDetect(BarcodeCapture cap) async {
    if (_busy) return;
    final raw = cap.barcodes.firstOrNull?.rawValue;
    if (raw == null || raw.isEmpty) return;
    final token = _extractToken(raw);
    if (token == null) return;
    if (_lastToken == token) return;
    _lastToken = token;
    setState(() => _busy = true);
    try {
      final res = await EventContributorsService.verifyAggregateContribution(token);
      if (!mounted) return;
      if (res['success'] == true && res['data'] is Map) {
        final data = Map<String, dynamic>.from(res['data'] as Map);
        await showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _VerifyResultSheet(data: data),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message']?.toString() ?? 'Could not verify QR code')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Verify failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) _lastToken = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text('Verify Contribution',
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: Icon(_torchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded),
            onPressed: () {
              _controller.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
        ],
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(controller: _controller, onDetect: _handleDetect),
          Container(
            width: 240, height: 240,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white70, width: 2.5),
              borderRadius: BorderRadius.circular(18),
            ),
          ),
          if (_busy)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(color: Colors.white),
              ),
            ),
          Positioned(
            bottom: 32, left: 24, right: 24,
            child: Text(
              'Point at the QR on a Nuru contribution receipt',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

class _VerifyResultSheet extends StatelessWidget {
  final Map<String, dynamic> data;
  const _VerifyResultSheet({required this.data});

  @override
  Widget build(BuildContext context) {
    final currency = (data['currency'] ?? 'TZS').toString();
    final pledged = (data['total_pledged'] as num?)?.toDouble() ?? 0;
    final paid = (data['total_paid'] as num?)?.toDouble() ?? 0;
    final pending = (data['total_pending'] as num?)?.toDouble() ?? 0;
    final balance = (data['balance'] as num?)?.toDouble() ?? 0;
    final isComplete = data['is_complete'] == true;
    final eventName = data['event_name']?.toString() ?? 'Event';
    final contributor = data['contributor_name']?.toString() ?? 'Contributor';
    final count = (data['payment_count'] as num?)?.toInt() ?? 0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44, height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: (isComplete ? Colors.green : AppColors.primary).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isComplete ? Icons.verified_rounded : Icons.fact_check_rounded,
                color: isComplete ? Colors.green : AppColors.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Verified by Nuru',
                      style: GoogleFonts.inter(
                          fontSize: 11, letterSpacing: 1.0,
                          fontWeight: FontWeight.w700, color: AppColors.textTertiary)),
                  Text(contributor,
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                          fontSize: 16, fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 6),
          Text(eventName,
              style: GoogleFonts.inter(
                  fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(height: 18),
          _row('Total Paid', formatMoney(paid, currency: currency), bold: true),
          if (pledged > 0) _row('Pledged', formatMoney(pledged, currency: currency)),
          if (pending > 0) _row('Pending', formatMoney(pending, currency: currency)),
          _row('Balance', formatMoney(balance, currency: currency),
              valueColor: balance > 0 ? Colors.orange.shade700 : Colors.green.shade700),
          const SizedBox(height: 6),
          _row('Payments recorded', '$count'),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Done',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: GoogleFonts.inter(
                    fontSize: 13, color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500)),
          ),
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: bold ? 16 : 13.5,
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w700,
                  color: valueColor ?? AppColors.textPrimary)),
        ],
      ),
    );
  }
}
