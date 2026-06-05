import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/utils/money_format.dart';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../core/widgets/app_icon.dart';
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

    final total = _summary['total_expenses'] ?? _expenses.fold<double>(0, (s, e) {
      final a = e['amount'];
      return s + (a is num ? a.toDouble() : double.tryParse('$a') ?? 0);
    });

    return Stack(
      children: [
        NuruRefreshIndicator(
          onRefresh: _load,
          color: AppColors.primary,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              // Combined summary card: Total + Count
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12, offset: const Offset(0, 4))],
                ),
                child: Row(children: [
                  Expanded(child: Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                      child: const AppIcon('wallet', size: 22, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('Total Expenses', style: appText(size: 11, color: AppColors.textTertiary, weight: FontWeight.w500)),
                      const SizedBox(height: 2),
                      Text(_formatAmount(total), style: appText(size: 16, weight: FontWeight.w800, color: AppColors.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ])),
                  ])),
                  Container(width: 1, height: 44, color: AppColors.divider),
                  const SizedBox(width: 12),
                  Row(children: [
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(color: AppColors.blueSoft, borderRadius: BorderRadius.circular(14)),
                      child: const AppIcon('card', size: 22, color: AppColors.blue),
                    ),
                    const SizedBox(width: 10),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('Count', style: appText(size: 11, color: AppColors.textTertiary, weight: FontWeight.w500)),
                      const SizedBox(height: 2),
                      Text('${_expenses.length}', style: appText(size: 16, weight: FontWeight.w800, color: AppColors.textPrimary)),
                    ]),
                  ]),
                ]),
              ),

              const SizedBox(height: 12),

              // Export buttons
              Row(children: [
                Expanded(child: _exportButton('Export PDF', 'file-pdf', AppColors.error, () => _downloadReport('pdf'))),
                const SizedBox(width: 10),
                Expanded(child: _exportButton('Export Excel', 'file-excel', AppColors.accent, () => _downloadReport('xlsx'))),
              ]),

              const SizedBox(height: 22),

              // Section header
              Row(children: [
                Expanded(child: Text('Expenses', style: appText(size: 17, weight: FontWeight.w800, color: AppColors.textPrimary))),
                if (canManage)
                  GestureDetector(
                    onTap: _showAddExpenseSheet,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const AppIcon('plus', size: 16, color: Colors.white),
                        const SizedBox(width: 4),
                        Text('Add Expense', style: appText(size: 12, weight: FontWeight.w700, color: Colors.white)),
                      ]),
                    ),
                  ),
              ]),

              const SizedBox(height: 14),

              if (_expenses.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                  child: Column(children: [
                    Container(
                      width: 56, height: 56,
                      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(18)),
                      child: const AppIcon('card', size: 24, color: AppColors.primary),
                    ),
                    const SizedBox(height: 14),
                    Text('No expenses yet', style: appText(size: 15, weight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('Track every shilling spent on your event', style: appText(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
                  ]),
                )
              else
                // Timeline header clock node (matches mockup)
                Padding(
                  padding: const EdgeInsets.only(left: 0, bottom: 2),
                  child: Row(children: [
                    SizedBox(
                      width: 28,
                      child: Center(
                        child: Container(
                          width: 30, height: 30,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFBE7C7),
                            shape: BoxShape.circle,
                          ),
                          child: const AppIcon('report', size: 14, color: Color(0xFFD4AF37)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                  ]),
                ),

              for (int i = 0; i < _expenses.length; i++)
                _timelineExpenseCard(_expenses[i] as Map<String, dynamic>, i, _expenses.length, canManage),

              if (_expenses.isNotEmpty) ...[
                const SizedBox(height: 18),
                // Spending Insights card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2))],
                  ),
                  child: Row(children: [
                    Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                      child: const AppIcon('bar-chart', size: 18, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('Spending Insights', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.textPrimary)),
                      const SizedBox(height: 2),
                      Text(_insightLine(), style: appText(size: 11, color: AppColors.textTertiary)),
                    ])),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(color: AppColors.accent.withOpacity(0.12), borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        AppIcon('trending-up', size: 12, color: AppColors.success),
                        const SizedBox(width: 4),
                        Text('View', style: appText(size: 11, weight: FontWeight.w700, color: AppColors.success)),
                      ]),
                    ),
                  ]),
                ),
              ],
            ],
          ),
        ),
        DeletingOverlay(visible: _deleting),
      ],
    );
  }

  String _insightLine() {
    final vendor = _expenses.where((e) => (e['category']?.toString().toLowerCase() ?? '').contains('vendor')).length;
    if (_expenses.isEmpty) return 'No expenses yet';
    final pct = ((vendor / _expenses.length) * 100).round();
    if (vendor > 0) return '$pct% of expenses are from vendor payments.';
    return '${_expenses.length} expense${_expenses.length == 1 ? '' : 's'} recorded.';
  }

  Widget _exportButton(String label, String iconName, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.35), width: 1),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          AppIcon(iconName, size: 18, color: color),
          const SizedBox(width: 8),
          Text(label, style: appText(size: 13, weight: FontWeight.w700, color: color)),
        ]),
      ),
    );
  }

  Widget _timelineExpenseCard(Map<String, dynamic> exp, int index, int total, bool canManage) {
    final dateRaw = exp['date'] ?? exp['created_at'] ?? exp['expense_date'];
    final dateStr = _formatDate(dateRaw);
    final timeStr = _formatTime(dateRaw);
    final ref = exp['reference'] ?? exp['code'] ?? '#EXP-${(1000 + index + 1)}';
    final category = exp['category']?.toString() ?? 'Vendor Payment';
    final desc = exp['description']?.toString() ?? exp['title']?.toString() ?? 'Expense';
    final vendor = exp['vendor_name']?.toString() ?? '';
    final amount = exp['amount'];
    final isLast = index == total - 1;

    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Timeline rail
        SizedBox(
          width: 28,
          child: Column(children: [
            const SizedBox(height: 22),
            Container(
              width: 14, height: 14,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primary, width: 2.5),
              ),
            ),
            if (!isLast)
              Expanded(child: Container(width: 2, color: AppColors.primary.withOpacity(0.35))),
          ]),
        ),
        // Ticket-shaped card with scalloped right edge
        Expanded(child: Padding(
          padding: const EdgeInsets.only(bottom: 12, left: 4),
          child: PhysicalShape(
            color: Colors.white,
            elevation: 1.5,
            shadowColor: Colors.black.withOpacity(0.08),
            clipper: const _TicketRightScallopClipper(scallopRadius: 6, scallopSpacing: 4),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 22, 14),
              child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                SizedBox(
                  width: 86,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(dateStr, style: appText(size: 12, weight: FontWeight.w700, color: AppColors.textSecondary)),
                    if (timeStr.isNotEmpty)
                      Text(timeStr, style: appText(size: 12, weight: FontWeight.w700, color: AppColors.textSecondary)),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: const Color(0xFFFBE7C7), borderRadius: BorderRadius.circular(6)),
                      child: Text(ref.toString(), style: appText(size: 10, weight: FontWeight.w700, color: const Color(0xFFB8860B))),
                    ),
                  ]),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: SizedBox(
                    width: 1, height: 78,
                    child: CustomPaint(painter: _DashedLinePainter(color: AppColors.divider)),
                  ),
                ),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(category, style: appText(size: 12, weight: FontWeight.w700, color: const Color(0xFFD4AF37))),
                  const SizedBox(height: 3),
                  Text(desc, style: appText(size: 13, weight: FontWeight.w700, color: AppColors.textPrimary), maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (vendor.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(vendor, style: appText(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 8),
                  Container(height: 1, color: AppColors.divider),
                  const SizedBox(height: 8),
                  Text(_formatAmount(amount), style: appText(size: 15, weight: FontWeight.w800, color: AppColors.textPrimary)),
                ])),
                const SizedBox(width: 6),
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: const Color(0xFFFBE7C7), borderRadius: BorderRadius.circular(10)),
                  child: const AppIcon('wallet', size: 18, color: Color(0xFFD4AF37)),
                ),
                if (canManage) ...[
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () => _deleteExpense(exp['id']?.toString() ?? ''),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: AppIcon('delete', size: 14, color: AppColors.textHint),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        )),
      ]),
    );
  }

  String _formatDate(dynamic v) {
    if (v == null) return '';
    try {
      final d = DateTime.parse(v.toString()).toLocal();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) { return ''; }
  }

  String _formatTime(dynamic v) {
    if (v == null) return '';
    try {
      final d = DateTime.parse(v.toString()).toLocal();
      final h = d.hour;
      final m = d.minute.toString().padLeft(2, '0');
      final hh = (h == 0 ? 12 : (h > 12 ? h - 12 : h)).toString().padLeft(2, '0');
      final ap = h >= 12 ? 'PM' : 'AM';
      return '$hh:$m $ap';
    } catch (_) { return ''; }
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return '${getActiveCurrency()} 0';
    final num val = (amount is String ? double.tryParse(amount) ?? 0 : (amount is num ? amount : 0));
    return '${getActiveCurrency()} ${val.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
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
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
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
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
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
      autocorrect: false,
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

/// Clipper that gives a card a ticket look with semi-circular notches
/// along the right edge (scalloped). Left side uses regular rounded corners.
class _TicketRightScallopClipper extends CustomClipper<Path> {
  final double scallopRadius;
  final double scallopSpacing;
  final double cornerRadius;
  const _TicketRightScallopClipper({
    this.scallopRadius = 6,
    this.scallopSpacing = 4,
    this.cornerRadius = 14,
  });

  @override
  Path getClip(Size size) {
    final p = Path();
    final r = cornerRadius;
    // start top-left
    p.moveTo(r, 0);
    p.lineTo(size.width - r, 0);
    p.quadraticBezierTo(size.width, 0, size.width, r);

    // Scallops down the right edge
    final diameter = scallopRadius * 2;
    final step = diameter + scallopSpacing;
    final available = size.height - 2 * r;
    final count = (available / step).floor();
    final totalUsed = count * step - scallopSpacing;
    double y = r + (available - totalUsed) / 2;
    for (int i = 0; i < count; i++) {
      p.lineTo(size.width, y);
      // semi-circle cut INWARD (concave on the right edge)
      p.arcToPoint(
        Offset(size.width, y + diameter),
        radius: Radius.circular(scallopRadius),
        clockwise: false,
      );
      y += step;
    }
    p.lineTo(size.width, size.height - r);
    p.quadraticBezierTo(size.width, size.height, size.width - r, size.height);
    p.lineTo(r, size.height);
    p.quadraticBezierTo(0, size.height, 0, size.height - r);
    p.lineTo(0, r);
    p.quadraticBezierTo(0, 0, r, 0);
    p.close();
    return p;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _DashedLinePainter extends CustomPainter {
  final Color color;
  _DashedLinePainter({required this.color});
  @override
  void paint(Canvas canvas, Size size) {
    const dashHeight = 3.0;
    const dashSpace = 3.0;
    double startY = 0;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.round;
    while (startY < size.height) {
      canvas.drawLine(Offset(0, startY), Offset(0, startY + dashHeight), paint);
      startY += dashHeight + dashSpace;
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

