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
import '../../../core/l10n/l10n_helper.dart';

class EventExpensesTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTitle;
  final double? eventBudget;
  final double? totalRaised;
  const EventExpensesTab({super.key, required this.eventId, this.permissions, this.eventTitle, this.eventBudget, this.totalRaised});

  @override
  State<EventExpensesTab> createState() => _EventExpensesTabState();
}

class _EventExpensesTabState extends State<EventExpensesTab> with AutomaticKeepAliveClientMixin {
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

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final canManage = widget.permissions?['can_manage_budget'] == true || widget.permissions?['is_creator'] == true;

    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    return Stack(
      children: [
        NuruRefreshIndicator(
          onRefresh: _load,
          color: AppColors.primary,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Summary cards
              if (_summary.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Expense Summary', style: appText(size: 15, weight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _summaryCard('Total Expenses', _formatAmount(_summary['total_expenses']), AppColors.secondary)),
                      const SizedBox(width: 10),
                      Expanded(child: _summaryCard('Count', '${_expenses.length}', AppColors.primary)),
                    ]),
                  ]),
                ),

              // Download Reports
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Download Report', style: appText(size: 13, weight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _downloadReport('pdf'),
                          icon: const Icon(Icons.picture_as_pdf_rounded, size: 16),
                          label: Text('PDF', style: appText(size: 12, weight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.error,
                            side: const BorderSide(color: AppColors.error),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _downloadReport('xlsx'),
                          icon: const Icon(Icons.table_chart_rounded, size: 16),
                          label: Text('Excel', style: appText(size: 12, weight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.accent,
                            side: BorderSide(color: AppColors.accent),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ]),
                  ],
                ),
              ),

              Row(
                children: [
                  Expanded(child: Text('Expenses', style: appText(size: 15, weight: FontWeight.w700))),
                  if (canManage)
                    GestureDetector(
                      onTap: _showAddExpenseSheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(20)),
                        child: Text('+ Add', style: appText(size: 12, weight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              if (_expenses.isEmpty)
                Container(
                  padding: const EdgeInsets.all(30),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: Center(child: Text('No expenses recorded', style: appText(size: 14, color: AppColors.textTertiary))),
                )
              else
                ..._expenses.map((exp) => _expenseTile(exp, canManage)),
            ],
          ),
        ),
        DeletingOverlay(visible: _deleting),
      ],
    );
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: appText(size: 11, color: AppColors.textTertiary)),
        const SizedBox(height: 4),
        Text(value, style: appText(size: 15, weight: FontWeight.w700, color: color)),
      ]),
    );
  }

  Widget _expenseTile(Map<String, dynamic> exp, bool canManage) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (exp['category'] != null) Text(exp['category'].toString(), style: appText(size: 11, weight: FontWeight.w700, color: AppColors.secondary)),
                Text(exp['description']?.toString() ?? 'Expense', style: appText(size: 14, weight: FontWeight.w600)),
                Row(children: [
                  Text(_formatAmount(exp['amount']), style: appText(size: 13, weight: FontWeight.w700, color: AppColors.secondary)),
                  if (exp['vendor_name'] != null) ...[const SizedBox(width: 8), Text(exp['vendor_name'].toString(), style: appText(size: 12, color: AppColors.textTertiary))],
                ]),
              ],
            ),
          ),
          if (canManage)
            GestureDetector(
              onTap: () => _deleteExpense(exp['id']?.toString() ?? ''),
              child: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.textHint),
            ),
        ],
      ),
    );
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return '${getActiveCurrency()} 0';
    final num = (amount is String ? double.tryParse(amount) : amount.toDouble()) ?? 0.0;
    return '${getActiveCurrency()} ${num.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  Future<void> _downloadReport(String format) async {
    AppSnackbar.success(context, 'Generating ${format == 'xlsx' ? 'Excel' : 'PDF'} report...');
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
          Navigator.push(context, MaterialPageRoute(
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Add Expense', style: appText(size: 18, weight: FontWeight.w700)),
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
                  if (vendorCtrl.text.trim().isNotEmpty) data['vendor_name'] = vendorCtrl.text.trim();
                  Navigator.pop(ctx);
                  final res = await EventsService.addExpense(widget.eventId, data);
                  if (!mounted) return;
                  if (res['success'] == true) {
                    AppSnackbar.success(context, 'Added');
                    _load();
                  } else {
                    AppSnackbar.error(context, res['message'] ?? 'Failed');
                  }
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                child: Text('Save', style: appText(size: 14, weight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _input(TextEditingController ctrl, String hint, {TextInputType keyboard = TextInputType.text}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      style: appText(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: appText(size: 13, color: AppColors.textHint),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: const Color(0xFFE5E7EB), width: 1)),
      ),
    );
  }
}
