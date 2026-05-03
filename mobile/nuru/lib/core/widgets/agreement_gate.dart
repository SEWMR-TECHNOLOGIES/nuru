import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../theme/app_colors.dart';
import '../services/agreements_service.dart';
import 'ai_markdown_content.dart';

/// Agreement modal that mirrors the web AgreementModal experience.
/// Shows the summary plus a "Read Full Agreement" view that fetches the
/// markdown document so users can review the full terms before accepting.
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
  bool _showFullDoc = false;
  bool _loadingDoc = false;
  String? _docContent;

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.4}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color, height: height);

  String get _agreementLabel =>
      widget.agreementType == 'vendor_agreement' ? 'Vendor Agreement' : 'Organiser Agreement';

  String get _docUrl => widget.agreementType == 'vendor_agreement'
      ? 'https://nuru.tz/docs/vendor-agreement.md'
      : 'https://nuru.tz/docs/organiser-agreement.md';

  List<String> get _bullets => widget.agreementType == 'vendor_agreement'
      ? const [
          'Payments are held in escrow until services are confirmed',
          'Cancellation and refund rules apply to all bookings',
          "Disputes are handled fairly through Nuru's resolution process",
          'Platform fees apply to completed transactions',
        ]
      : const [
          'Contributions and ticket sales are managed through secure channels',
          'Cancellation policies protect both organisers and guests',
          'Vendor bookings follow escrow-based payment processing',
          'Platform fees apply to transactions and payouts',
        ];

  Future<void> _openFullDoc() async {
    setState(() => _showFullDoc = true);
    if (_docContent != null) return;
    setState(() => _loadingDoc = true);
    try {
      final res = await http.get(Uri.parse(_docUrl)).timeout(const Duration(seconds: 12));
      if (!mounted) return;
      setState(() {
        _docContent = res.statusCode == 200
            ? res.body
            : 'Unable to load the agreement right now. Please try again.';
        _loadingDoc = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _docContent = 'Unable to load the agreement right now. Please check your connection and try again.';
        _loadingDoc = false;
      });
    }
  }

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
    final maxHeight = MediaQuery.of(context).size.height * 0.88;
    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: _showFullDoc ? _buildFullDoc() : _buildSummary(),
        ),
      ),
    );
  }

  Widget _buildSummary() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Center(
          child: Container(width: 40, height: 4,
            decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
        ),
        const SizedBox(height: 18),
        Center(
          child: Container(
            width: 56, height: 56,
            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), shape: BoxShape.circle),
            child: const Icon(Icons.shield_outlined, size: 28, color: AppColors.primary),
          ),
        ),
        const SizedBox(height: 14),
        Text('Before you continue', style: _f(size: 20, weight: FontWeight.w800), textAlign: TextAlign.center),
        const SizedBox(height: 4),
        Text(
          widget.agreementType == 'vendor_agreement'
              ? "Here's how Nuru protects everyone when you offer services"
              : "Here's how Nuru protects everyone when you organise events",
          style: _f(size: 13, color: AppColors.textTertiary),
          textAlign: TextAlign.center,
        ),
        if (widget.updateSummary != null) ...[
          const SizedBox(height: 12),
          Container(
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
        const SizedBox(height: 18),
        ...List.generate(_bullets.length, (i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.check_circle_rounded, size: 18, color: AppColors.primary),
            const SizedBox(width: 10),
            Expanded(child: Text(_bullets[i], style: _f(size: 13, color: AppColors.textSecondary))),
          ]),
        )),
        const SizedBox(height: 6),
        // Read full agreement link
        InkWell(
          onTap: _openFullDoc,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.description_outlined, size: 16, color: AppColors.primary),
              const SizedBox(width: 6),
              Text('Read Full $_agreementLabel',
                  style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        // Checkbox
        InkWell(
          onTap: () => setState(() => _agreed = !_agreed),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
              Expanded(child: Text('I have read and agree to the $_agreementLabel', style: _f(size: 13))),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _agreed && !_loading ? _accept : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              disabledBackgroundColor: AppColors.primary.withOpacity(0.3),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: _loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('Accept & Continue', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
          ),
        ),
        const SizedBox(height: 6),
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: Text('Cancel', style: _f(size: 13, color: AppColors.textTertiary)),
        ),
      ]),
    );
  }

  Widget _buildFullDoc() {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      const SizedBox(height: 10),
      Container(width: 40, height: 4,
        decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
      const SizedBox(height: 14),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(children: [
          Expanded(child: Text(_agreementLabel, style: _f(size: 17, weight: FontWeight.w800))),
          IconButton(
            onPressed: () => Navigator.pop(context, false),
            icon: const Icon(Icons.close_rounded, color: AppColors.textTertiary),
          ),
        ]),
      ),
      const Divider(height: 1, color: AppColors.borderLight),
      Flexible(
        child: _loadingDoc
            ? const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              )
            : SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: AiMarkdownContent(
                  content: _docContent ?? '',
                  textColor: AppColors.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.55,
                ),
              ),
      ),
      const Divider(height: 1, color: AppColors.borderLight),
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        child: Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => setState(() => _showFullDoc = false),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.textPrimary,
                side: const BorderSide(color: AppColors.borderLight),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Back to summary', style: _f(size: 13, weight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    ]);
  }
}
