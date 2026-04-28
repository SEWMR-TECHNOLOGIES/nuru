import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/services/wallet_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_loader.dart';
import '../../providers/wallet_provider.dart';

import '../../core/widgets/app_snackbar.dart';
import 'receipt_screen.dart';

/// Premium Payment History screen — matches the 2026 mockup exactly.
///
/// Features:
///   • Yellow "Total Spent" hero card with 30-day trend pill
///   • Horizontal scrollable category tabs (All / Tickets / Contributions /
///     Vendors / Promotions / Ads) — counts come from the backend
///   • Filter sheet (status + sort) reachable from the funnel icon
///   • Tap any row → ReceiptScreen (existing flow, unchanged)
///   • Pull-to-refresh + infinite scroll
///   • Empty state per category (Promotions / Ads return a friendly
///     "no payments yet" panel because they don't yet flow through the
///     unified Transaction table — backend explicitly returns []).
class PaymentHistoryScreen extends StatefulWidget {
  const PaymentHistoryScreen({super.key});

  @override
  State<PaymentHistoryScreen> createState() => _PaymentHistoryScreenState();
}

class _PaymentHistoryScreenState extends State<PaymentHistoryScreen> {
  static const _categories = <_CategoryDef>[
    _CategoryDef('all', 'All'),
    _CategoryDef('tickets', 'Tickets'),
    _CategoryDef('contributions', 'Contributions'),
    _CategoryDef('vendors', 'Vendors'),
    _CategoryDef('promotions', 'Promotions'),
    _CategoryDef('ads', 'Ads'),
  ];

  String _category = 'all';
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _page = 1;

  Map<String, dynamic> _summary = {};
  Map<String, int> _counts = const {};
  List<dynamic> _txs = [];
  String? _emptyReason;

  // Filter state — applied client-side over what the API returned.
  String _statusFilter = 'all'; // all | paid | pending | failed
  String _sortBy = 'newest'; // newest | oldest | highest | lowest

  final ScrollController _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >=
              _scrollCtrl.position.maxScrollExtent - 240 &&
          _hasMore &&
          !_loadingMore) {
        _loadMore();
      }
    });
    _load();
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool refresh = false}) async {
    if (refresh) _page = 1;
    setState(() => _loading = true);
    final res = await WalletService.paymentHistory(
      category: _category,
      page: 1,
      limit: 20,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      final data = (res['data'] as Map?) ?? {};
      final pagination = (data['pagination'] as Map?) ?? {};
      setState(() {
        _summary = (data['summary'] as Map?)?.cast<String, dynamic>() ?? {};
        _counts =
            ((data['counts'] as Map?) ?? {}).map((k, v) => MapEntry('$k', (v as num).toInt()));
        _txs = (data['transactions'] as List?) ?? [];
        _emptyReason = data['empty_reason'] as String?;
        final totalPages = (pagination['total_pages'] as num?)?.toInt() ?? 1;
        _hasMore = totalPages > 1;
        _page = 1;
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
        _txs = [];
        _hasMore = false;
      });
      AppSnackbar.error(context, res['message']?.toString() ?? 'Failed to load history');
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    final next = _page + 1;
    final res = await WalletService.paymentHistory(
      category: _category,
      page: next,
      limit: 20,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      final data = (res['data'] as Map?) ?? {};
      final pagination = (data['pagination'] as Map?) ?? {};
      final totalPages = (pagination['total_pages'] as num?)?.toInt() ?? 1;
      setState(() {
        _txs = [..._txs, ...((data['transactions'] as List?) ?? [])];
        _page = next;
        _hasMore = next < totalPages;
        _loadingMore = false;
      });
    } else {
      setState(() => _loadingMore = false);
    }
  }

  void _setCategory(String c) {
    if (_category == c) return;
    setState(() => _category = c);
    _load(refresh: true);
  }

  // ─── Filtering / sorting (client-side over current page set) ──────
  List<dynamic> get _visibleTxs {
    Iterable<dynamic> list = _txs;
    if (_statusFilter != 'all') {
      list = list.where((t) {
        final s = (t is Map ? '${t['status']}' : '').toLowerCase();
        if (_statusFilter == 'paid') return s == 'paid' || s == 'credited';
        if (_statusFilter == 'pending') return s == 'pending' || s == 'processing';
        if (_statusFilter == 'failed') return s == 'failed' || s == 'reversed';
        return true;
      });
    }
    final sorted = list.toList();
    sorted.sort((a, b) {
      final am = a is Map ? a : <String, dynamic>{};
      final bm = b is Map ? b : <String, dynamic>{};
      switch (_sortBy) {
        case 'oldest':
          return ('${am['created_at'] ?? am['initiated_at'] ?? ''}')
              .compareTo('${bm['created_at'] ?? bm['initiated_at'] ?? ''}');
        case 'highest':
          return ((bm['gross_amount'] as num?) ?? 0)
              .compareTo((am['gross_amount'] as num?) ?? 0);
        case 'lowest':
          return ((am['gross_amount'] as num?) ?? 0)
              .compareTo((bm['gross_amount'] as num?) ?? 0);
        case 'newest':
        default:
          return ('${bm['initiated_at'] ?? bm['created_at'] ?? ''}')
              .compareTo('${am['initiated_at'] ?? am['created_at'] ?? ''}');
      }
    });
    return sorted;
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  TextStyle _f({
    double size = 14,
    FontWeight weight = FontWeight.w500,
    Color color = AppColors.textPrimary,
    double height = 1.3,
    double letterSpacing = 0,
  }) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
        letterSpacing: letterSpacing,
      );

  String _fmtMoney(num v, String currency) {
    final s = v
        .toStringAsFixed(0)
        .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
    return '$currency $s';
  }

  String _fmtDate(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final ampm = dt.hour >= 12 ? 'PM' : 'AM';
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year}  •  $h:$mm $ampm';
  }

  // ─── Build ────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final walletCurrency = context.watch<WalletProvider>().currency;
    final currency =
        (_summary['currency_code']?.toString().isNotEmpty == true)
            ? _summary['currency_code'].toString()
            : walletCurrency;
    final totalSpent = (_summary['total_spent'] as num?) ?? 0;
    final txCount = (_summary['transaction_count'] as num?)?.toInt() ?? 0;
    final pct = (_summary['percent_change_30d'] as num?)?.toDouble() ?? 0.0;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        leadingWidth: 56,
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded,
              size: 24, color: AppColors.textPrimary),
        ),
        title: Text(
          'Payment History',
          style: _f(size: 17, weight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Filter',
            icon: const Icon(Icons.tune_rounded, color: AppColors.textPrimary),
            onPressed: _openFilterSheet,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => _load(refresh: true),
        child: CustomScrollView(
          controller: _scrollCtrl,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ─── Category tabs (sticky) ───
            SliverToBoxAdapter(child: _categoryTabs()),

            // ─── Total Spent hero card ───
            SliverToBoxAdapter(
              child: _loading
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                      child: _skeletonHero(),
                    )
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                      child: _totalSpentCard(currency, totalSpent, txCount, pct),
                    ),
            ),

            // ─── "Recent Transactions" header ───
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 10),
                child: Text('Recent Transactions',
                    style: _f(size: 16, weight: FontWeight.w700)),
              ),
            ),

            // ─── List ───
            if (_loading)
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, __) => _skeletonRow(),
                  childCount: 6,
                ),
              )
            else if (_visibleTxs.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _emptyState(),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) {
                    if (i >= _visibleTxs.length) {
                      return _loadingMore
                          ? const Padding(
                              padding: EdgeInsets.symmetric(vertical: 18),
                              child: Center(child: NuruLoader(size: 28)),
                            )
                          : const SizedBox.shrink();
                    }
                    return _txRow(_visibleTxs[i] as Map<String, dynamic>, currency);
                  },
                  childCount: _visibleTxs.length + (_hasMore ? 1 : 0),
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  // ─── Category tabs row (matches Vendors page chip style) ─────────
  Widget _categoryTabs() {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final c = _categories[i];
          final selected = c.key == _category;
          return GestureDetector(
            onTap: () => _setCategory(c.key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary : const Color(0xFFF9F9F9),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: selected ? AppColors.primary : const Color(0xFFEFEFEF),
                  width: 1,
                ),
              ),
              child: Center(
                child: Text(
                  c.label,
                  style: _f(
                    size: 11,
                    weight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ─── Total Spent hero card (yellow on the mockup uses neutral grey) ──
  // The mockup screen shows a soft grey hero card; only navigation
  // chips and CTAs are yellow. We follow the mockup precisely.
  Widget _totalSpentCard(String currency, num total, int count, double pct) {
    final isPositive = pct >= 0;
    final pctText =
        '${isPositive ? '↑' : '↓'} ${pct.abs().toStringAsFixed(0)}%';
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 16, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEFEFF3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Total Spent',
                    style: _f(
                      size: 13,
                      weight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    )),
                const SizedBox(height: 6),
                Text(
                  _fmtMoney(total, currency),
                  style: _f(size: 26, weight: FontWeight.w800, height: 1.1),
                ),
                const SizedBox(height: 6),
                Text(
                  count == 1
                      ? 'Across 1 transaction'
                      : 'Across $count transactions',
                  style: _f(
                    size: 12,
                    color: AppColors.textTertiary,
                    weight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: isPositive
                  ? AppColors.success.withOpacity(0.12)
                  : AppColors.error.withOpacity(0.10),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              pctText,
              style: _f(
                size: 11,
                weight: FontWeight.w800,
                color: isPositive ? AppColors.success : AppColors.error,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Single transaction row (matches mockup: square icon, title,
  //     subtitle, amount + status pill, chevron) ──────────────────
  Widget _txRow(Map<String, dynamic> tx, String currency) {
    final targetType = (tx['target_type'] ?? '').toString();
    final desc = (tx['payment_description'] ?? '').toString();
    final amount = (tx['gross_amount'] as num?) ?? 0;
    final status = (tx['status'] ?? '').toString();
    final txCurrency = (tx['currency_code'] ?? currency).toString();
    final when = _fmtDate(
      (tx['confirmed_at'] ?? tx['initiated_at'] ?? tx['created_at'])?.toString(),
    );

    final visual = _visualForTarget(targetType);
    final title = _titleForTx(targetType, desc);
    final subtitle = _subtitleForTx(targetType, desc);
    final statusPill = _statusPill(status);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            final code = (tx['transaction_code'] ?? tx['id'] ?? '').toString();
            if (code.isNotEmpty) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ReceiptScreen(transactionCode: code),
                ),
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: visual.bg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: visual.svg != null
                      ? SvgPicture.asset(
                          visual.svg!,
                          width: 22,
                          height: 22,
                          colorFilter: ColorFilter.mode(visual.fg, BlendMode.srcIn),
                        )
                      : Icon(visual.icon, color: visual.fg, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: _f(size: 14, weight: FontWeight.w700),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 3),
                      if (subtitle.isNotEmpty)
                        Text(subtitle,
                            style: _f(
                              size: 12,
                              color: AppColors.textTertiary,
                              weight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      if (when.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(when,
                            style: _f(
                              size: 11,
                              color: AppColors.textTertiary,
                              weight: FontWeight.w500,
                            )),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(_fmtMoney(amount, txCurrency),
                        style: _f(size: 13, weight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    statusPill,
                  ],
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.textTertiary, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statusPill(String status) {
    final s = status.toLowerCase();
    Color bg, fg;
    String label;
    if (s == 'paid' || s == 'credited') {
      bg = AppColors.success.withOpacity(0.12);
      fg = AppColors.success;
      label = 'Paid';
    } else if (s == 'pending' || s == 'processing') {
      bg = AppColors.warning.withOpacity(0.14);
      fg = const Color(0xFFB45309);
      label = s == 'processing' ? 'Processing' : 'Pending';
    } else if (s == 'failed' || s == 'reversed') {
      bg = AppColors.error.withOpacity(0.10);
      fg = AppColors.error;
      label = s == 'reversed' ? 'Reversed' : 'Failed';
    } else {
      bg = const Color(0xFFEFF1F5);
      fg = AppColors.textSecondary;
      label = status.isEmpty ? '—' : status;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label,
          style: _f(size: 10, weight: FontWeight.w800, color: fg)),
    );
  }

  // ─── Visual mapping per target type ──────────────────────────────
  _Visual _visualForTarget(String t) {
    switch (t) {
      case 'ticket':
        return _Visual(
          bg: const Color(0xFFFFF6CF),
          fg: const Color(0xFFB45309),
          svg: 'assets/icons/ticket-icon.svg',
        );
      case 'contribution':
        return _Visual(
          bg: AppColors.success.withOpacity(0.12),
          fg: AppColors.success,
          icon: Icons.card_giftcard_rounded,
        );
      case 'booking':
        return _Visual(
          bg: AppColors.blue.withOpacity(0.10),
          fg: AppColors.blue,
          icon: Icons.storefront_rounded,
        );
      case 'wallet_topup':
        return _Visual(
          bg: AppColors.primary.withOpacity(0.12),
          fg: const Color(0xFFB45309),
          icon: Icons.account_balance_wallet_rounded,
        );
      default:
        return _Visual(
          bg: const Color(0xFFEFF1F5),
          fg: AppColors.textSecondary,
          icon: Icons.payments_rounded,
        );
    }
  }

  String _titleForTx(String t, String desc) {
    switch (t) {
      case 'ticket':
        return 'Ticket Purchase';
      case 'contribution':
        return 'Contribution';
      case 'booking':
        return 'Vendor Payment';
      case 'wallet_topup':
        return 'Wallet Top-Up';
      default:
        return desc.isEmpty ? 'Payment' : desc;
    }
  }

  String _subtitleForTx(String t, String desc) {
    if (desc.isEmpty) return '';
    // Strip the leading "Ticket purchase for ..." style prefix to keep
    // the subtitle short.
    final cleaned = desc
        .replaceAll(RegExp(r'^(ticket purchase for|contribution to|booking for)\s*',
            caseSensitive: false), '')
        .trim();
    return cleaned;
  }

  // ─── Empty state ──────────────────────────────────────────────────
  Widget _emptyState() {
    final isVirtual = _emptyReason == 'no_promotion_payments_yet';
    final cat = _categories.firstWhere((c) => c.key == _category, orElse: () => _categories.first);
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 60),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.10),
              borderRadius: BorderRadius.circular(28),
            ),
            child: Icon(
              isVirtual ? Icons.campaign_rounded : Icons.receipt_long_rounded,
              size: 38,
              color: const Color(0xFFB45309),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            isVirtual ? 'Nothing here yet' : 'No ${cat.label.toLowerCase()} payments',
            style: _f(size: 17, weight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            isVirtual
                ? '${cat.label} payments will appear here once you start running them.'
                : 'When you make a payment in this category it will appear here.',
            textAlign: TextAlign.center,
            style: _f(
              size: 13,
              color: AppColors.textSecondary,
              weight: FontWeight.w500,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Skeletons ───────────────────────────────────────────────────
  Widget _skeletonHero() {
    return Container(
      height: 100,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F2F6),
        borderRadius: BorderRadius.circular(18),
      ),
    );
  }

  Widget _skeletonRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  // ─── Filter sheet ────────────────────────────────────────────────
  void _openFilterSheet() {
    String tmpStatus = _statusFilter;
    String tmpSort = _sortBy;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Container(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 26),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE7E8EE),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Filter & Sort',
                  style: _f(size: 17, weight: FontWeight.w800)),
              const SizedBox(height: 18),
              Text('Status',
                  style: _f(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.4,
                  )),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: const [
                  _ChoiceChip(value: 'all', label: 'All'),
                  _ChoiceChip(value: 'paid', label: 'Paid'),
                  _ChoiceChip(value: 'pending', label: 'Pending'),
                  _ChoiceChip(value: 'failed', label: 'Failed'),
                ]
                    .map((c) => ChoiceChip(
                          label: Text(c.label),
                          selected: tmpStatus == c.value,
                          onSelected: (_) => setSheet(() => tmpStatus = c.value),
                          labelStyle: _f(
                            size: 12,
                            weight: FontWeight.w700,
                            color: tmpStatus == c.value
                                ? const Color(0xFF1C1C24)
                                : AppColors.textPrimary,
                          ),
                          selectedColor: AppColors.primary,
                          backgroundColor: const Color(0xFFF1F2F6),
                          side: BorderSide.none,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 18),
              Text('Sort by',
                  style: _f(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.4,
                  )),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: const [
                  _ChoiceChip(value: 'newest', label: 'Newest first'),
                  _ChoiceChip(value: 'oldest', label: 'Oldest first'),
                  _ChoiceChip(value: 'highest', label: 'Highest amount'),
                  _ChoiceChip(value: 'lowest', label: 'Lowest amount'),
                ]
                    .map((c) => ChoiceChip(
                          label: Text(c.label),
                          selected: tmpSort == c.value,
                          onSelected: (_) => setSheet(() => tmpSort = c.value),
                          labelStyle: _f(
                            size: 12,
                            weight: FontWeight.w700,
                            color: tmpSort == c.value
                                ? const Color(0xFF1C1C24)
                                : AppColors.textPrimary,
                          ),
                          selectedColor: AppColors.primary,
                          backgroundColor: const Color(0xFFF1F2F6),
                          side: BorderSide.none,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: const Color(0xFF1C1C24),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: () {
                    setState(() {
                      _statusFilter = tmpStatus;
                      _sortBy = tmpSort;
                    });
                    Navigator.pop(ctx);
                  },
                  child: Text('Apply',
                      style: _f(
                        size: 14,
                        weight: FontWeight.w800,
                        color: const Color(0xFF1C1C24),
                      )),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryDef {
  final String key;
  final String label;
  const _CategoryDef(this.key, this.label);
}

class _Visual {
  final Color bg;
  final Color fg;
  final String? svg;
  final IconData? icon;
  const _Visual({required this.bg, required this.fg, this.svg, this.icon});
}

class _ChoiceChip {
  final String value;
  final String label;
  const _ChoiceChip({required this.value, required this.label});
}
