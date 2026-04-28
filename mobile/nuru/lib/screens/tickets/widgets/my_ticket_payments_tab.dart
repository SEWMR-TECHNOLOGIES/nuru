import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/received_payments_service.dart';
import '../../../core/utils/money_format.dart';

/// My Ticket Payments — payment history for tickets the current user purchased.
/// Mirrors the web `MyTicketPaymentsTab` look-and-feel.
class MyTicketPaymentsTab extends StatefulWidget {
  const MyTicketPaymentsTab({super.key});

  @override
  State<MyTicketPaymentsTab> createState() => _MyTicketPaymentsTabState();
}

class _MyTicketPaymentsTabState extends State<MyTicketPaymentsTab>
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

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await ReceivedPaymentsService.myTickets(
      page: _page,
      limit: 15,
      search: _search.isNotEmpty ? _search : null,
    );
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _payments = data is Map ? List.from(data['payments'] ?? []) : [];
        _pagination = data is Map && data['pagination'] is Map
            ? Map<String, dynamic>.from(data['pagination'])
            : null;
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'completed':
        return AppColors.success;
      case 'confirmed':
        return AppColors.blue;
      case 'pending':
        return AppColors.warning;
      case 'failed':
        return AppColors.error;
      default:
        return AppColors.textTertiary;
    }
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    return '${d.day}/${d.month}/${d.year} '
        '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) {
                _search = v;
                _page = 1;
                _load();
              },
              style: GoogleFonts.inter(fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Search by code, event, payer…',
                hintStyle: GoogleFonts.inter(
                    fontSize: 13, color: AppColors.textHint),
                prefixIcon: const Icon(Icons.search,
                    size: 18, color: AppColors.textTertiary),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            ...List.generate(4, (_) => _skeleton())
          else if (_payments.isEmpty)
            _empty()
          else
            ..._payments.map(_row),
          if (_pagination != null && (_pagination!['total_pages'] ?? 1) > 1)
            _pager(),
        ],
      ),
    );
  }

  Widget _skeleton() => Container(
        margin: const EdgeInsets.only(bottom: 8),
        height: 70,
        decoration: BoxDecoration(
            color: AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(12)),
      );

  Widget _empty() => Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderLight, width: 1.4),
        ),
        child: Column(children: [
          Icon(Icons.receipt_long_outlined,
              size: 40, color: AppColors.textHint.withOpacity(0.5)),
          const SizedBox(height: 8),
          Text('No ticket payments yet',
              style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary)),
          const SizedBox(height: 4),
          Text('Your purchase receipts will appear here.',
              style: GoogleFonts.inter(
                  fontSize: 11, color: AppColors.textTertiary)),
        ]),
      );

  Widget _row(dynamic p) {
    final m = p is Map ? p : <String, dynamic>{};
    final status = m['status']?.toString() ?? 'pending';
    final color = _statusColor(status);
    final gross = (m['gross_amount'] is num) ? (m['gross_amount'] as num) : 0;
    final fee =
        (m['commission_amount'] is num) ? (m['commission_amount'] as num) : 0;
    final currency = m['currency_code']?.toString() ?? '';
    final dateIso = m['completed_at'] ?? m['confirmed_at'] ?? m['initiated_at'];
    final meta = [
      m['transaction_code']?.toString() ?? '',
      if (m['method_type'] != null) m['method_type'].toString(),
      if (m['provider_name'] != null) m['provider_name'].toString(),
    ].where((s) => s.isNotEmpty).join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
              shape: BoxShape.circle, color: AppColors.primarySoft),
          child: const Icon(Icons.south_west_rounded,
              color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: 10),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
                child: Text(
              m['description']?.toString() ?? 'Ticket payment',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: AppColors.textPrimary),
            )),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20)),
              child: Text(status,
                  style: GoogleFonts.inter(
                      fontSize: 9, fontWeight: FontWeight.w700, color: color)),
            ),
          ]),
          const SizedBox(height: 2),
          Text(meta,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.robotoMono(
                  fontSize: 10, color: AppColors.textTertiary)),
          if (dateIso != null)
            Text(_formatDate(dateIso.toString()),
                style: GoogleFonts.inter(
                    fontSize: 10, color: AppColors.textTertiary)),
        ])),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(formatMoney(gross, currency: currency),
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: AppColors.textPrimary)),
          if (fee > 0)
            Text('fee ${formatMoney(fee, currency: currency)}',
                style: GoogleFonts.inter(
                    fontSize: 9, color: AppColors.textTertiary)),
        ]),
      ]),
    );
  }

  Widget _pager() {
    final p = _pagination!;
    final hasPrev = p['has_previous'] == true;
    final hasNext = p['has_next'] == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        IconButton(
          onPressed: hasPrev
              ? () {
                  setState(() => _page--);
                  _load();
                }
              : null,
          icon: const Icon(Icons.chevron_left),
        ),
        Text('Page ${p['page']} of ${p['total_pages']}',
            style: GoogleFonts.inter(
                fontSize: 12, color: AppColors.textSecondary)),
        IconButton(
          onPressed: hasNext
              ? () {
                  setState(() => _page++);
                  _load();
                }
              : null,
          icon: const Icon(Icons.chevron_right),
        ),
      ]),
    );
  }
}
