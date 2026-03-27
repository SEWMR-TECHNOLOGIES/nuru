import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:open_filex/open_filex.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/report_generator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../report_preview_screen.dart';
import '../../../core/widgets/deleting_overlay.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.2}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

/// Budget categories matching web app
const _kCategories = [
  'Venue', 'Catering', 'Decorations', 'Entertainment', 'Photography',
  'Transport', 'Printing', 'Gifts & Favors', 'Equipment Rental',
  'Marketing', 'Staffing', 'Audio & Visual', 'Flowers', 'Invitations',
  'Security', 'Miscellaneous',
];

const _kStatusOptions = [
  {'value': 'pending', 'label': 'Pending', 'color': Color(0xFFf59e0b)},
  {'value': 'deposit_paid', 'label': 'Deposit Paid', 'color': Color(0xFF3b82f6)},
  {'value': 'paid', 'label': 'Paid', 'color': Color(0xFF22c55e)},
];

class EventBudgetTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  const EventBudgetTab({super.key, required this.eventId, this.permissions});

  @override
  State<EventBudgetTab> createState() => _EventBudgetTabState();
}

class _EventBudgetTabState extends State<EventBudgetTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> _items = [];
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
    final res = await EventsService.getBudget(widget.eventId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        _items = res['data']?['items'] ?? res['data']?['budget_items'] ?? [];
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
        RefreshIndicator(
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
                    Text('Budget Summary', style: _f(size: 15, weight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _summaryCard('Total Estimated', _formatAmount(_summary['total_estimated']), AppColors.primary)),
                      const SizedBox(width: 10),
                      Expanded(child: _summaryCard('Total Actual', _formatAmount(_summary['total_actual']), AppColors.secondary)),
                    ]),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(child: _summaryCard('Variance', _formatAmount(_summary['variance']), AppColors.accent)),
                      const SizedBox(width: 10),
                      Expanded(child: _summaryCard('Items', '${_items.length}', AppColors.textSecondary)),
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
                    Text('Download Report', style: _f(size: 13, weight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _downloadReport('pdf'),
                          icon: const Icon(Icons.picture_as_pdf_rounded, size: 16),
                          label: Text('PDF', style: _f(size: 12, weight: FontWeight.w600)),
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
                          label: Text('Excel', style: _f(size: 12, weight: FontWeight.w600)),
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
                  Expanded(child: Text('Budget Items', style: _f(size: 15, weight: FontWeight.w700))),
                  if (canManage)
                    GestureDetector(
                      onTap: _showAddBudgetSheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
                        child: Text('+ Add', style: _f(size: 12, weight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              if (_items.isEmpty)
                Container(
                  padding: const EdgeInsets.all(30),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                  child: Center(child: Text('No budget items yet', style: _f(size: 14, color: AppColors.textTertiary))),
                )
              else
                ..._items.map((item) => _budgetTile(item, canManage)),
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
        Text(label, style: _f(size: 11, color: AppColors.textTertiary)),
        const SizedBox(height: 4),
        Text(value, style: _f(size: 15, weight: FontWeight.w700, color: color)),
      ]),
    );
  }

  Widget _budgetTile(Map<String, dynamic> item, bool canManage) {
    final effectiveCost = (item['actual_cost'] != null && (item['actual_cost'] as num?) != 0)
        ? item['actual_cost']
        : item['estimated_cost'];
    final isEstimate = item['actual_cost'] == null || item['actual_cost'] == 0;
    final status = (item['status'] ?? 'pending').toString();
    final statusOpt = _kStatusOptions.firstWhere((s) => s['value'] == status, orElse: () => _kStatusOptions[0]);

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
                Row(children: [
                  if (item['category'] != null)
                    Text(item['category'].toString(), style: _f(size: 11, weight: FontWeight.w700, color: AppColors.primary)),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: (statusOpt['color'] as Color).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(statusOpt['label'] as String, style: _f(size: 9, weight: FontWeight.w700, color: statusOpt['color'] as Color)),
                  ),
                ]),
                const SizedBox(height: 2),
                Text(item['description']?.toString() ?? item['item_name']?.toString() ?? 'Budget Item', style: _f(size: 14, weight: FontWeight.w600)),
                Row(children: [
                  Text(_formatAmount(effectiveCost), style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
                  if (isEstimate) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppColors.warning.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                      child: Text('estimate', style: _f(size: 9, weight: FontWeight.w700, color: AppColors.warning)),
                    ),
                  ],
                  if (item['vendor_name'] != null) ...[
                    const SizedBox(width: 8),
                    Flexible(child: Text(item['vendor_name'].toString(), style: _f(size: 12, color: AppColors.textTertiary), overflow: TextOverflow.ellipsis)),
                  ],
                ]),
                if (item['notes'] != null && item['notes'].toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(item['notes'].toString(), style: _f(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
              ],
            ),
          ),
          if (canManage)
            GestureDetector(
              onTap: () => _deleteBudgetItem(item['id']?.toString() ?? ''),
              child: const Padding(
                padding: EdgeInsets.only(left: 8),
                child: Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.textHint),
              ),
            ),
        ],
      ),
    );
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return 'TZS 0';
    final num = (amount is String ? double.tryParse(amount) : amount.toDouble()) ?? 0.0;
    return 'TZS ${num.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  Future<void> _downloadReport(String format) async {
    AppSnackbar.success(context, 'Generating ${format == 'xlsx' ? 'Excel' : 'PDF'} report...');
    try {
      final res = await ReportGenerator.generateBudgetReport(
        widget.eventId,
        format: format,
        budgetItems: _items,
        summary: _summary,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => ReportPreviewScreen(
              title: 'Budget Report',
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

  Future<void> _deleteBudgetItem(String id) async {
    if (id.isEmpty) return;
    setState(() => _deleting = true);
    final res = await EventsService.deleteBudgetItem(widget.eventId, id);
    if (!mounted) return;
    setState(() => _deleting = false);
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Removed');
      _load();
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  /// Full add budget item bottom sheet matching web: Category (select), Status, Item Name,
  /// Estimated Cost, Actual Cost, Vendor, Notes
  void _showAddBudgetSheet() {
    final descCtrl = TextEditingController();
    final estCtrl = TextEditingController();
    final actCtrl = TextEditingController();
    final vendorCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String selectedCategory = _kCategories.first;
    String selectedStatus = 'pending';
    bool customCategoryMode = false;
    final customCatCtrl = TextEditingController();

    // Collect unique categories from existing items
    final existingCats = <String>{};
    for (final item in _items) {
      if (item['category'] != null) existingCats.add(item['category'].toString());
    }
    final allCats = <String>{..._kCategories, ...existingCats};
    final sortedCats = allCats.toList()..sort();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 20),
                Text('Add Budget Item', style: _f(size: 18, weight: FontWeight.w700)),
                const SizedBox(height: 18),

                // Category + Status row
                Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Category *', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                      const SizedBox(height: 6),
                      if (customCategoryMode)
                        Row(children: [
                          Expanded(child: _styledInput(customCatCtrl, 'Custom category')),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () {
                              if (customCatCtrl.text.trim().isNotEmpty) {
                                setSheetState(() {
                                  selectedCategory = customCatCtrl.text.trim();
                                  customCategoryMode = false;
                                });
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                              child: Text('Set', style: _f(size: 12, weight: FontWeight.w700, color: Colors.white)),
                            ),
                          ),
                        ])
                      else
                        Container(
                          decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: sortedCats.contains(selectedCategory) ? selectedCategory : null,
                              isExpanded: true,
                              style: _f(size: 14),
                              hint: Text('Select', style: _f(size: 14, color: AppColors.textHint)),
                              items: [
                                ...sortedCats.map((c) => DropdownMenuItem(value: c, child: Text(c, style: _f(size: 14)))),
                                DropdownMenuItem(value: '__custom__', child: Text('+ Add custom', style: _f(size: 14, color: AppColors.primary, weight: FontWeight.w600))),
                              ],
                              onChanged: (v) {
                                if (v == '__custom__') {
                                  setSheetState(() => customCategoryMode = true);
                                } else if (v != null) {
                                  setSheetState(() => selectedCategory = v);
                                }
                              },
                            ),
                          ),
                        ),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Status', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                      const SizedBox(height: 6),
                      Container(
                        decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: selectedStatus,
                            isExpanded: true,
                            style: _f(size: 14),
                            items: _kStatusOptions.map((s) => DropdownMenuItem(
                              value: s['value'] as String,
                              child: Text(s['label'] as String, style: _f(size: 14)),
                            )).toList(),
                            onChanged: (v) { if (v != null) setSheetState(() => selectedStatus = v); },
                          ),
                        ),
                      ),
                    ]),
                  ),
                ]),
                const SizedBox(height: 14),

                // Item Name
                Text('Item Name *', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                _styledInput(descCtrl, 'e.g. Main hall booking'),
                const SizedBox(height: 14),

                // Estimated + Actual Cost row
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Estimated Cost', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                    const SizedBox(height: 6),
                    _styledInput(estCtrl, 'TZS 0', keyboard: TextInputType.number),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Actual Cost', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                    const SizedBox(height: 6),
                    _styledInput(actCtrl, 'TZS 0', keyboard: TextInputType.number),
                  ])),
                ]),
                const SizedBox(height: 14),

                // Vendor
                Text('Vendor / Supplier', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                _styledInput(vendorCtrl, 'Search or type vendor name'),
                const SizedBox(height: 14),

                // Notes
                Text('Notes', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                _styledInput(notesCtrl, 'Optional notes...', maxLines: 2),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity, height: 50,
                  child: ElevatedButton(
                    onPressed: () async {
                      if (descCtrl.text.trim().isEmpty) return;
                      Navigator.pop(ctx);
                      final res = await EventsService.addBudgetItem(widget.eventId, {
                        'category': selectedCategory,
                        'description': descCtrl.text.trim(),
                        'estimated_cost': double.tryParse(estCtrl.text.trim()) ?? 0,
                        'actual_cost': double.tryParse(actCtrl.text.trim()) ?? 0,
                        'vendor_name': vendorCtrl.text.trim().isEmpty ? null : vendorCtrl.text.trim(),
                        'notes': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
                        'status': selectedStatus,
                      });
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
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    child: Text('Save', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _styledInput(TextEditingController ctrl, String hint, {TextInputType keyboard = TextInputType.text, int maxLines = 1}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      maxLines: maxLines,
      style: _f(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: _f(size: 13, color: AppColors.textHint),
        filled: true,
        fillColor: const Color(0xFFF5F7FA),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
