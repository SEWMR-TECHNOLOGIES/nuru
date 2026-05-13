import '../../../core/widgets/nuru_refresh_indicator.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/received_payments_service.dart';
import '../../../core/utils/money_format.dart';
import '../../payments/payment_receipt_screen.dart';

/// My Contribution Payments — receipts for every contribution the current
/// user has paid towards events. Mirrors `MyTicketPaymentsTab` exactly.
class MyContributionPaymentsTab extends StatefulWidget {
  const MyContributionPaymentsTab({super.key});

  @override
  State<MyContributionPaymentsTab> createState() => _MyContributionPaymentsTabState();
}

class _MyContributionPaymentsTabState extends State<MyContributionPaymentsTab>
    with AutomaticKeepAliveClientMixin {
  List<dynamic> _payments = [];
  Map<String, dynamic>? _pagination;
  bool _loading = true;
  int _page = 1;
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await ReceivedPaymentsService.myContributions(
      page: _page, limit: 15,
      search: _search.isNotEmpty ? _search : null,
    );
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _payments = data is Map ? List.from(data['payments'] ?? []) : [];
        _pagination = data is Map && data['pagination'] is Map
            ? Map<String, dynamic>.from(data['pagination']) : null;
      }
    });
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'completed': return const Color(0xFF059669);
      case 'confirmed': return const Color(0xFF2563EB);
      case 'pending':   return const Color(0xFFD97706);
      case 'failed':    return AppColors.error;
      default:          return AppColors.textTertiary;
    }
  }

  TextStyle _txt({double size = 12, FontWeight weight = FontWeight.w500, Color? color, double? height}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return NuruRefreshIndicator(
      onRefresh: _load, color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _searchCtrl,
            onSubmitted: (v) { _page = 1; _search = v.trim(); _load(); },
            decoration: InputDecoration(
              hintText: 'Search by code, event, beneficiary…',
              hintStyle: _txt(size: 12, color: AppColors.textTertiary),
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppColors.textTertiary),
              filled: true, fillColor: AppColors.surfaceVariant,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading) ...[
            for (int i = 0; i < 4; i++) Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Container(height: 72,
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14))),
            ),
          ] else if (_payments.isEmpty) ...[
            const SizedBox(height: 60),
            Icon(Icons.volunteer_activism_outlined, size: 48, color: AppColors.textHint.withOpacity(0.6)),
            const SizedBox(height: 10),
            Center(child: Text('No contributions paid yet',
              style: _txt(size: 14, weight: FontWeight.w600, color: AppColors.textSecondary))),
            const SizedBox(height: 4),
            Center(child: Text('Receipts will appear here once you contribute.',
              style: _txt(size: 12, color: AppColors.textTertiary))),
          ] else ...[
            for (final p in _payments) _row(p as Map<String, dynamic>),
          ],
          if (_pagination != null && (_pagination!['total_pages'] ?? 1) > 1) ...[
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              IconButton(onPressed: (_pagination!['has_previous'] == true) ? () { _page--; _load(); } : null,
                icon: const Icon(Icons.chevron_left_rounded)),
              Text('Page ${_pagination!['page']} of ${_pagination!['total_pages']}',
                style: _txt(size: 12, color: AppColors.textSecondary)),
              IconButton(onPressed: (_pagination!['has_next'] == true) ? () { _page++; _load(); } : null,
                icon: const Icon(Icons.chevron_right_rounded)),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> p) {
    final status = (p['status'] ?? 'pending').toString();
    final amount = (p['gross_amount'] is num) ? (p['gross_amount'] as num).toDouble() : 0.0;
    final code = (p['transaction_code'] ?? '').toString();
    final desc = (p['description'] ?? 'Contribution payment').toString();
    final method = (p['method_type'] ?? '').toString();
    final provider = (p['provider_name'] ?? '').toString();
    final ts = (p['completed_at'] ?? p['confirmed_at'] ?? p['initiated_at'])?.toString();
    final currency = (p['currency_code'] ?? getActiveCurrency()).toString();
    final canRetry = p['can_retry'] == true;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => PaymentReceiptScreen(payment: p)),
      ),
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface, borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(width: 38, height: 38,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.south_west_rounded, color: AppColors.primary, size: 18)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(desc,
              style: _txt(size: 13, weight: FontWeight.w600, color: AppColors.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: _statusColor(status).withOpacity(0.12), borderRadius: BorderRadius.circular(999)),
              child: Text(status, style: _txt(size: 9, weight: FontWeight.w700, color: _statusColor(status))),
            ),
          ]),
          const SizedBox(height: 2),
          Text('$code${method.isNotEmpty ? " · $method" : ""}${provider.isNotEmpty ? " · $provider" : ""}',
            style: _txt(size: 10, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
          if (ts != null) Text(ts.replaceAll('T', ' ').split('.').first,
            style: _txt(size: 10, color: AppColors.textHint)),
          if (canRetry) Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.refresh_rounded, size: 12, color: AppColors.primary),
                const SizedBox(width: 4),
                Text('Tap to retry', style: _txt(size: 10, weight: FontWeight.w700, color: AppColors.primary)),
              ]),
            ),
          ),
        ])),
        const SizedBox(width: 8),
        Text(formatMoney(amount, currency: currency),
          style: _txt(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary)),
      ]),
    ),
    );
  }
}
