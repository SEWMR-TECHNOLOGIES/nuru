import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/utils/money_format.dart';
import 'dart:typed_data';
import 'package:flutter/material.dart';

import 'package:open_filex/open_filex.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/report_generator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../report_preview_screen.dart';
import '../../../core/widgets/deleting_overlay.dart';
import '../../../core/theme/text_styles.dart';

/// Full redesign — Expenses tab.
/// Flat surfaces, generous whitespace, only one icon per surface (no per-row
/// chrome). Clean header summary, minimal export row, simple list cards.
class EventExpensesTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTitle;
  final double? eventBudget;
  final double? totalRaised;
  const EventExpensesTab({
    super.key,
    required this.eventId,
    this.permissions,
    this.eventTitle,
    this.eventBudget,
    this.totalRaised,
  });

  @override
  State<EventExpensesTab> createState() => _EventExpensesTabState();
}

class _EventExpensesTabState extends State<EventExpensesTab>
    with AutomaticKeepAliveClientMixin {
  List<dynamic> _expenses = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  bool _deleting = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getExpenses(widget.eventId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        _expenses = res['data']?['expenses'] ?? [];
        _summary = res['data']?['summary'] ?? {};
      }
    });
  }

  double _asNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final canManage = widget.permissions?['can_manage_budget'] == true ||
        widget.permissions?['is_creator'] == true;

    if (_loading) return _skeleton();

    final total = _summary['total_expenses'] != null
        ? _asNum(_summary['total_expenses'])
        : _expenses.fold<double>(0, (s, e) => s + _asNum(e['amount']));

    final budget = widget.eventBudget ?? 0;
    final pct = budget > 0 ? (total / budget).clamp(0.0, 1.0) : 0.0;
    final remaining = budget - total;

    return Stack(children: [
      NuruRefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
          children: [
            _summaryCard(total, budget, remaining, pct),
            const SizedBox(height: 14),
            _exportRow(),
            const SizedBox(height: 22),
            Row(children: [
              Expanded(
                child: Text('All expenses',
                    style: appText(
                        size: 15,
                        weight: FontWeight.w800,
                        color: AppColors.textPrimary)),
              ),
              if (canManage)
                GestureDetector(
                  onTap: _showAddExpenseSheet,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('+ Add',
                        style: appText(
                            size: 12,
                            weight: FontWeight.w700,
                            color: Colors.white)),
                  ),
                ),
            ]),
            const SizedBox(height: 12),
            if (_expenses.isEmpty)
              _emptyState()
            else
              for (final e in _expenses)
                _expenseCard(e as Map<String, dynamic>, canManage),
          ],
        ),
      ),
      DeletingOverlay(visible: _deleting),
    ]);
  }

  // ─────────── Summary ───────────
  Widget _summaryCard(double total, double budget, double remaining, double p) {
    final overBudget = budget > 0 && total > budget;
    final remColor = overBudget ? AppColors.error : AppColors.success;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Total spent',
            style: appText(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.textTertiary)),
        const SizedBox(height: 4),
        Text(_formatAmount(total),
            style: appText(
                size: 26,
                weight: FontWeight.w800,
                color: AppColors.textPrimary)),
        if (budget > 0) ...[
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: p,
              minHeight: 6,
              backgroundColor: AppColors.borderLight,
              valueColor: AlwaysStoppedAnimation(
                  overBudget ? AppColors.error : AppColors.primary),
            ),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Text('of ${_formatAmount(budget)} budget',
                style: appText(
                    size: 12,
                    color: AppColors.textTertiary,
                    weight: FontWeight.w600)),
            const Spacer(),
            Text(
                overBudget
                    ? '${_formatAmount(remaining.abs())} over'
                    : '${_formatAmount(remaining)} left',
                style: appText(
                    size: 12, weight: FontWeight.w800, color: remColor)),
          ]),
        ],
        const SizedBox(height: 14),
        Container(height: 1, color: AppColors.borderLight),
        const SizedBox(height: 12),
        Row(children: [
          _smallMetric('Items', '${_expenses.length}'),
          Container(width: 1, height: 28, color: AppColors.borderLight),
          _smallMetric(
              'Average',
              _expenses.isEmpty
                  ? '—'
                  : _formatAmount(total / _expenses.length)),
        ]),
      ]),
    );
  }

  Widget _smallMetric(String label, String value) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: appText(
                  size: 11,
                  weight: FontWeight.w600,
                  color: AppColors.textTertiary)),
          const SizedBox(height: 4),
          Text(value,
              style: appText(
                  size: 14,
                  weight: FontWeight.w800,
                  color: AppColors.textPrimary)),
        ]),
      ),
    );
  }

  // ─────────── Export row ───────────
  Widget _exportRow() {
    return Row(children: [
      Expanded(
          child: _exportBtn('PDF', AppColors.error, () => _downloadReport('pdf'))),
      const SizedBox(width: 10),
      Expanded(
          child: _exportBtn(
              'Excel', AppColors.success, () => _downloadReport('xlsx'))),
    ]);
  }

  Widget _exportBtn(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Center(
          child: Text('Export $label',
              style: appText(size: 13, weight: FontWeight.w700, color: color)),
        ),
      ),
    );
  }

  // ─────────── Empty ───────────
  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(children: [
        Text('No expenses yet',
            style: appText(size: 15, weight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text('Track every shilling spent on your event.',
            textAlign: TextAlign.center,
            style: appText(size: 12, color: AppColors.textTertiary)),
      ]),
    );
  }

  // ─────────── Expense card (minimal, icon-free) ───────────
  Widget _expenseCard(Map<String, dynamic> exp, bool canManage) {
    final dateRaw = exp['date'] ?? exp['created_at'] ?? exp['expense_date'];
    final dateStr = _formatDate(dateRaw);
    final category = exp['category']?.toString() ?? 'Vendor Payment';
    final desc = exp['description']?.toString() ??
        exp['title']?.toString() ??
        'Expense';
    final vendor = exp['vendor_name']?.toString() ?? '';
    final amount = exp['amount'];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(category.toUpperCase(),
                      style: appText(
                          size: 10,
                          weight: FontWeight.w800,
                          color: AppColors.primary)),
                  const SizedBox(height: 4),
                  Text(desc,
                      style: appText(size: 14, weight: FontWeight.w700),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                ]),
          ),
          Text(_formatAmount(amount),
              style: appText(
                  size: 15,
                  weight: FontWeight.w800,
                  color: AppColors.textPrimary)),
        ]),
        if (vendor.isNotEmpty || dateStr.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(children: [
            if (dateStr.isNotEmpty)
              Text(dateStr,
                  style: appText(
                      size: 12,
                      color: AppColors.textTertiary,
                      weight: FontWeight.w600)),
            if (dateStr.isNotEmpty && vendor.isNotEmpty)
              Text('  ·  ',
                  style: appText(size: 12, color: AppColors.textTertiary)),
            if (vendor.isNotEmpty)
              Expanded(
                child: Text(vendor,
                    style: appText(size: 12, color: AppColors.textTertiary),
                    overflow: TextOverflow.ellipsis),
              ),
            if (canManage)
              GestureDetector(
                onTap: () => _deleteExpense(exp['id']?.toString() ?? ''),
                child: Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text('Remove',
                      style: appText(
                          size: 12,
                          weight: FontWeight.w700,
                          color: AppColors.error)),
                ),
              ),
          ]),
        ],
      ]),
    );
  }

  String _formatDate(dynamic v) {
    if (v == null) return '';
    try {
      final d = DateTime.parse(v.toString()).toLocal();
      const months = [
        'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
      ];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return '';
    }
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return '${getActiveCurrency()} 0';
    final num val = amount is String
        ? (double.tryParse(amount) ?? 0)
        : (amount is num ? amount : 0);
    return '${getActiveCurrency()} ${val.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  Future<void> _downloadReport(String format) async {
    AppSnackbar.success(
        context, 'Generating ${format == 'xlsx' ? 'Excel' : 'PDF'} report...');
    try {
      final res = await ReportGenerator.generateExpensesReport(
        widget.eventId,
        format: format,
        expenses: _expenses,
        summary: _summary,
        eventTitle: widget.eventTitle,
        eventBudget: widget.eventBudget,
        totalRaised: widget.totalRaised,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ReportPreviewScreen(
                  title: 'Expense Report',
                  pdfBytes: res['bytes'] as Uint8List,
                  filePath: res['path'] as String,
                ),
              ));
        } else if (res['path'] != null) {
          await OpenFilex.open(res['path'] as String);
          if (mounted) AppSnackbar.success(context, 'Report opened');
        }
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to generate report');
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to generate report');
    }
  }

  Future<void> _deleteExpense(String id) async {
    if (id.isEmpty) return;
    setState(() => _deleting = true);
    final res = await EventsService.deleteExpense(widget.eventId, id);
    if (!mounted) return;
    setState(() => _deleting = false);
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Removed');
      _load();
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  void _showAddExpenseSheet() {
    final catCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final amtCtrl = TextEditingController();
    final vendorCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
                child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Text('Add Expense', style: appText(size: 18, weight: FontWeight.w800)),
            const SizedBox(height: 14),
            _input(catCtrl, 'Category'),
            const SizedBox(height: 12),
            _input(descCtrl, 'Description'),
            const SizedBox(height: 12),
            _input(amtCtrl, 'Amount', keyboard: TextInputType.number),
            const SizedBox(height: 12),
            _input(vendorCtrl, 'Vendor (optional)'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () async {
                  final data = <String, dynamic>{
                    'category': catCtrl.text.trim(),
                    'description': descCtrl.text.trim(),
                    'amount': double.tryParse(amtCtrl.text.trim()) ?? 0,
                  };
                  if (vendorCtrl.text.trim().isNotEmpty) {
                    data['vendor_name'] = vendorCtrl.text.trim();
                  }
                  Navigator.pop(ctx);
                  final res =
                      await EventsService.addExpense(widget.eventId, data);
                  if (!mounted) return;
                  if (res['success'] == true) {
                    AppSnackbar.success(context, 'Added');
                    _load();
                  } else {
                    AppSnackbar.error(context, res['message'] ?? 'Failed');
                  }
                },
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14))),
                child: Text('Save',
                    style: appText(
                        size: 14,
                        weight: FontWeight.w700,
                        color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _input(TextEditingController ctrl, String hint,
      {TextInputType keyboard = TextInputType.text}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      autocorrect: false,
      style: appText(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: appText(size: 13, color: AppColors.textHint),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: Color(0xFFE5E7EB), width: 1)),
      ),
    );
  }

  Widget _skeleton() {
    Widget box({double? w, required double h, double r = 12}) => Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
              color: AppColors.borderLight,
              borderRadius: BorderRadius.circular(r)),
        );
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      children: [
        box(h: 160, r: 20),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: box(h: 46, r: 14)),
          const SizedBox(width: 10),
          Expanded(child: box(h: 46, r: 14)),
        ]),
        const SizedBox(height: 22),
        box(w: 140, h: 20, r: 6),
        const SizedBox(height: 14),
        for (int i = 0; i < 4; i++) ...[
          box(h: 80, r: 16),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}
