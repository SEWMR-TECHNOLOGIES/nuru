import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/self_scrolling_pills.dart';
import '../../../core/utils/money_format.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/report_generator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/deleting_overlay.dart';
import '../../../core/l10n/l10n_helper.dart';
import '../report_preview_screen.dart';

/// Full redesign — Budget tab.
/// Flat surfaces, project SVG icons, skeleton loader, header summary with
/// progress ring (actual vs estimated), status filter pills, modern item cards.
const _kCategories = [
  'Venue','Catering','Decorations','Entertainment','Photography','Transport',
  'Printing','Gifts & Favors','Equipment Rental','Marketing','Staffing',
  'Audio & Visual','Flowers','Invitations','Security','Miscellaneous',
];

const _kStatusOptions = [
  {'value': 'pending', 'label': 'Pending', 'color': Color(0xFFD97706)},
  {'value': 'deposit_paid', 'label': 'Deposit', 'color': Color(0xFF2471E7)},
  {'value': 'paid', 'label': 'Paid', 'color': Color(0xFF16A34A)},
];

class EventBudgetTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTitle;
  final double? eventBudget;
  const EventBudgetTab({
    super.key,
    required this.eventId,
    this.permissions,
    this.eventTitle,
    this.eventBudget,
  });

  @override
  State<EventBudgetTab> createState() => _EventBudgetTabState();
}

class _EventBudgetTabState extends State<EventBudgetTab>
    with AutomaticKeepAliveClientMixin {
  List<dynamic> _items = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  bool _deleting = false;
  String _filter = 'all';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool background = false}) async {
    if (!background) setState(() => _loading = true);
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

  List<dynamic> get _filtered {
    if (_filter == 'all') return _items;
    return _items
        .where((i) => (i['status'] ?? 'pending').toString() == _filter)
        .toList();
  }

  bool get _canManage =>
      widget.permissions?['can_manage_budget'] == true ||
      widget.permissions?['is_creator'] == true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) return _skeleton();

    final estimated = _asNum(_summary['total_estimated']);
    final actual = _asNum(_summary['total_actual']);
    final variance =
        _summary['variance'] != null ? _asNum(_summary['variance']) : estimated - actual;
    final progress = estimated > 0 ? (actual / estimated).clamp(0.0, 1.0) : 0.0;

    final paidCount =
        _items.where((i) => (i['status'] ?? '') == 'paid').length;
    final pendingCount =
        _items.where((i) => (i['status'] ?? 'pending') == 'pending').length;
    final depositCount =
        _items.where((i) => (i['status'] ?? '') == 'deposit_paid').length;

    return Stack(children: [
      NuruRefreshIndicator(
        onRefresh: () => _load(background: true),
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
          children: [
            if (_summary.isNotEmpty || _items.isNotEmpty)
              _summaryHeader(estimated, actual, variance, progress),
            const SizedBox(height: 14),
            _exportRow(),
            const SizedBox(height: 18),
            _filterRow(_items.length, pendingCount, depositCount, paidCount),
            const SizedBox(height: 12),
            if (_items.isEmpty)
              _emptyState()
            else if (_filtered.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 36),
                alignment: Alignment.center,
                child: Text('No items in this view',
                    style: appText(size: 13, color: AppColors.textTertiary)),
              )
            else
              ..._filtered.map((i) => _itemCard(i as Map<String, dynamic>)),
            if (_canManage) ...[
              const SizedBox(height: 16),
              _addButton(),
            ],
          ],
        ),
      ),
      DeletingOverlay(visible: _deleting),
    ]);
  }

  // ---------- Skeleton ----------
  Widget _skeleton() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      children: [
        _skel(height: 152, radius: 20),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _skel(height: 46, radius: 14)),
          const SizedBox(width: 10),
          Expanded(child: _skel(height: 46, radius: 14)),
        ]),
        const SizedBox(height: 18),
        Row(children: [
          for (int i = 0; i < 4; i++) ...[
            _skel(height: 32, width: 72, radius: 999),
            const SizedBox(width: 8),
          ],
        ]),
        const SizedBox(height: 14),
        for (int i = 0; i < 4; i++) ...[
          _skel(height: 84, radius: 16),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  Widget _skel({double? width, required double height, double radius = 12}) =>
      Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
            color: AppColors.borderLight,
            borderRadius: BorderRadius.circular(radius)),
      );

  // ---------- Header summary ----------
  Widget _summaryHeader(double est, double act, double variance, double p) {
    final overBudget = act > est && est > 0;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          SizedBox(
            width: 76,
            height: 76,
            child: Stack(alignment: Alignment.center, children: [
              SizedBox(
                width: 76,
                height: 76,
                child: CircularProgressIndicator(
                  value: p,
                  strokeWidth: 7,
                  backgroundColor: AppColors.borderLight,
                  valueColor: AlwaysStoppedAnimation(
                      overBudget ? AppColors.error : AppColors.primary),
                ),
              ),
              Column(mainAxisSize: MainAxisSize.min, children: [
                Text('${(p * 100).round()}%',
                    style: appText(size: 16, weight: FontWeight.w800)),
                Text('spent',
                    style: appText(
                        size: 10,
                        color: AppColors.textTertiary,
                        weight: FontWeight.w600)),
              ]),
            ]),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Estimated',
                      style: appText(
                          size: 11,
                          color: AppColors.textTertiary,
                          weight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(_money(est),
                      style:
                          appText(size: 19, weight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  Row(children: [
                    const AppIcon('wallet', size: 12, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text('Actual ${_money(act)}',
                        style: appText(
                            size: 12,
                            color: AppColors.textSecondary,
                            weight: FontWeight.w600)),
                  ]),
                ]),
          ),
        ]),
        const SizedBox(height: 16),
        Container(height: 1, color: AppColors.borderLight),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
              child: _metric(
                  'Variance',
                  _money(variance.abs()),
                  variance >= 0 ? AppColors.success : AppColors.error,
                  variance >= 0 ? 'trending-up' : 'warning')),
          Container(width: 1, height: 34, color: AppColors.borderLight),
          Expanded(
              child: _metric('Items', '${_items.length}',
                  AppColors.textPrimary, 'package')),
        ]),
      ]),
    );
  }

  Widget _metric(String label, String value, Color color, String icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child:
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          AppIcon(icon, size: 12, color: color),
          const SizedBox(width: 5),
          Text(label,
              style: appText(
                  size: 11,
                  color: AppColors.textTertiary,
                  weight: FontWeight.w600)),
        ]),
        const SizedBox(height: 4),
        Text(value,
            style: appText(size: 14, weight: FontWeight.w800, color: color)),
      ]),
    );
  }

  // ---------- Export row ----------
  Widget _exportRow() {
    return Row(children: [
      Expanded(
          child: _exportBtn(
              'PDF', 'file-pdf', AppColors.error, () => _download('pdf'))),
      const SizedBox(width: 10),
      Expanded(
          child: _exportBtn(
              'Excel', 'file-excel', AppColors.success, () => _download('xlsx'))),
    ]);
  }

  Widget _exportBtn(String label, String icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          AppIcon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Text(label,
              style: appText(size: 13, weight: FontWeight.w700, color: color)),
        ]),
      ),
    );
  }

  // ---------- Filter pills ----------
  Widget _filterRow(int total, int pend, int dep, int paid) {
    final opts = [
      ['all', 'All', total],
      ['pending', 'Pending', pend],
      ['deposit_paid', 'Deposit', dep],
      ['paid', 'Paid', paid],
    ];
    final activeIndex = opts.indexWhere((o) => o[0] == _filter);
    return SelfScrollingPills(
      activeIndex: activeIndex < 0 ? 0 : activeIndex,
      height: 38,
      children: opts.map((o) {
        final active = _filter == o[0];
        return GestureDetector(
          onTap: () => setState(() => _filter = o[0] as String),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: active ? AppColors.primary : Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                  color: active ? AppColors.primary : AppColors.borderLight),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text(o[1] as String,
                  style: appText(
                      size: 12,
                      weight: FontWeight.w700,
                      color: active ? Colors.white : AppColors.textPrimary)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: active
                      ? Colors.white.withOpacity(0.22)
                      : AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('${o[2]}',
                    style: appText(
                        size: 10,
                        weight: FontWeight.w800,
                        color: active ? Colors.white : AppColors.primaryDark)),
              ),
            ]),
          ),
        );
      }).toList(),
    );
  }


  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(18),
          ),
          child:
              const Center(child: AppIcon('wallet', size: 26, color: AppColors.primary)),
        ),
        const SizedBox(height: 14),
        Text('No budget yet', style: appText(size: 15, weight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text('Plan how every shilling will be spent for this event.',
            style: appText(size: 12, color: AppColors.textTertiary),
            textAlign: TextAlign.center),
      ]),
    );
  }

  // ---------- Item card ----------
  Widget _itemCard(Map<String, dynamic> item) {
    final actualNum = _asNum(item['actual_cost']);
    final estNum = _asNum(item['estimated_cost']);
    final isEstimate = actualNum == 0;
    final effective = isEstimate ? estNum : actualNum;
    final status = (item['status'] ?? 'pending').toString();
    final s = _kStatusOptions
        .firstWhere((x) => x['value'] == status, orElse: () => _kStatusOptions.first);
    final category = item['category']?.toString();
    final name = item['description']?.toString() ??
        item['item_name']?.toString() ??
        'Item';
    final vendor = item['vendor_name']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(12)),
          child:
              const Center(child: AppIcon('package', size: 18, color: AppColors.primary)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              if (category != null && category.isNotEmpty)
                Flexible(
                  child: Text(category.toUpperCase(),
                      style: appText(
                          size: 10,
                          weight: FontWeight.w800,
                          color: AppColors.primary),
                      overflow: TextOverflow.ellipsis),
                ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                    color: (s['color'] as Color).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(999)),
                child: Text(s['label'] as String,
                    style: appText(
                        size: 10,
                        weight: FontWeight.w800,
                        color: s['color'] as Color)),
              ),
            ]),
            const SizedBox(height: 4),
            Text(name,
                style: appText(size: 14, weight: FontWeight.w700),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Row(children: [
              Text(_money(effective),
                  style: appText(
                      size: 14,
                      weight: FontWeight.w800,
                      color: AppColors.textPrimary)),
              if (isEstimate) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                      color: AppColors.warningSoft,
                      borderRadius: BorderRadius.circular(6)),
                  child: Text('estimate',
                      style: appText(
                          size: 9,
                          weight: FontWeight.w800,
                          color: AppColors.warning)),
                ),
              ],
              if (vendor != null && vendor.isNotEmpty) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const AppIcon('user',
                        size: 11, color: AppColors.textTertiary),
                    const SizedBox(width: 3),
                    Flexible(
                        child: Text(vendor,
                            style: appText(
                                size: 11,
                                color: AppColors.textTertiary),
                            overflow: TextOverflow.ellipsis)),
                  ]),
                ),
              ],
            ]),
            if (item['notes'] != null &&
                item['notes'].toString().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(item['notes'].toString(),
                  style: appText(size: 11, color: AppColors.textTertiary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ]),
        ),
        if (_canManage)
          GestureDetector(
            onTap: () => _deleteItem(item['id']?.toString() ?? ''),
            child: const Padding(
              padding: EdgeInsets.only(left: 8, top: 2),
              child: AppIcon('delete', size: 16, color: AppColors.textHint),
            ),
          ),
      ]),
    );
  }

  Widget _addButton() {
    return GestureDetector(
      onTap: _showAddSheet,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const AppIcon('plus', size: 16, color: Colors.white),
          const SizedBox(width: 8),
          Text('Add budget item',
              style: appText(
                  size: 14, weight: FontWeight.w800, color: Colors.white)),
        ]),
      ),
    );
  }

  // ---------- helpers ----------
  double _asNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  String _money(double v) {
    return '${getActiveCurrency()} ${v
        .toStringAsFixed(0)
        .replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  Future<void> _download(String format) async {
    AppSnackbar.success(
        context, 'Generating ${format == 'xlsx' ? 'Excel' : 'PDF'} report...');
    try {
      final res = await ReportGenerator.generateBudgetReport(
        widget.eventId,
        format: format,
        budgetItems: _items,
        summary: _summary,
        eventTitle: widget.eventTitle,
        eventBudget: widget.eventBudget,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => ReportPreviewScreen(
                        title: 'Budget Report',
                        pdfBytes: res['bytes'] as Uint8List,
                        filePath: res['path'] as String,
                      )));
        } else if (res['path'] != null) {
          await OpenFilex.open(res['path'] as String);
          if (mounted) AppSnackbar.success(context, 'Report opened');
        }
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to generate report');
    }
  }

  Future<void> _deleteItem(String id) async {
    if (id.isEmpty) return;
    setState(() => _deleting = true);
    final res = await EventsService.deleteBudgetItem(widget.eventId, id);
    if (!mounted) return;
    setState(() => _deleting = false);
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Removed');
      _load(background: true);
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  void _showAddSheet() {
    final descCtrl = TextEditingController();
    final estCtrl = TextEditingController();
    final actCtrl = TextEditingController();
    final vendorCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final customCatCtrl = TextEditingController();
    String selectedCategory = _kCategories.first;
    String selectedStatus = 'pending';
    bool customMode = false;

    final existing = <String>{};
    for (final i in _items) {
      if (i['category'] != null) existing.add(i['category'].toString());
    }
    final cats = (<String>{..._kCategories, ...existing}).toList()..sort();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
              20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(
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
                          borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('Add budget item',
                      style: appText(size: 18, weight: FontWeight.w800)),
                  const SizedBox(height: 18),
                  Row(children: [
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          _label('Category *'),
                          if (customMode)
                            Row(children: [
                              Expanded(child: _input(customCatCtrl, 'Custom')),
                              const SizedBox(width: 6),
                              GestureDetector(
                                onTap: () {
                                  if (customCatCtrl.text.trim().isNotEmpty) {
                                    setSheetState(() {
                                      selectedCategory =
                                          customCatCtrl.text.trim();
                                      customMode = false;
                                    });
                                  }
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 14),
                                  decoration: BoxDecoration(
                                      color: AppColors.primary,
                                      borderRadius: BorderRadius.circular(12)),
                                  child: Text('Set',
                                      style: appText(
                                          size: 12,
                                          weight: FontWeight.w700,
                                          color: Colors.white)),
                                ),
                              ),
                            ])
                          else
                            _dropdown<String>(
                              value: cats.contains(selectedCategory)
                                  ? selectedCategory
                                  : null,
                              hint: 'Select',
                              items: [
                                ...cats.map((c) =>
                                    DropdownMenuItem(value: c, child: Text(c))),
                                DropdownMenuItem(
                                    value: '__custom__',
                                    child: Text('+ Add custom',
                                        style: appText(
                                            size: 13,
                                            weight: FontWeight.w700,
                                            color: AppColors.primary))),
                              ],
                              onChanged: (v) {
                                if (v == '__custom__') {
                                  setSheetState(() => customMode = true);
                                } else if (v != null) {
                                  setSheetState(() => selectedCategory = v);
                                }
                              },
                            ),
                        ])),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          _label('Status'),
                          _dropdown<String>(
                            value: selectedStatus,
                            items: _kStatusOptions
                                .map((s) => DropdownMenuItem(
                                    value: s['value'] as String,
                                    child: Text(s['label'] as String)))
                                .toList(),
                            onChanged: (v) {
                              if (v != null) {
                                setSheetState(() => selectedStatus = v);
                              }
                            },
                          ),
                        ])),
                  ]),
                  const SizedBox(height: 14),
                  _label('Item name *'),
                  _input(descCtrl, 'e.g. Main hall booking'),
                  const SizedBox(height: 14),
                  Row(children: [
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          _label('Estimated cost'),
                          _input(estCtrl, '${getActiveCurrency()} 0',
                              keyboard: TextInputType.number),
                        ])),
                    const SizedBox(width: 12),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          _label('Actual cost'),
                          _input(actCtrl, '${getActiveCurrency()} 0',
                              keyboard: TextInputType.number),
                        ])),
                  ]),
                  const SizedBox(height: 14),
                  _label('Vendor / supplier'),
                  _input(vendorCtrl, 'Search or type name'),
                  const SizedBox(height: 14),
                  _label('Notes'),
                  _input(notesCtrl, 'Optional notes...', maxLines: 2),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999)),
                      ),
                      onPressed: () async {
                        if (descCtrl.text.trim().isEmpty) return;
                        Navigator.pop(ctx);
                        final res = await EventsService.addBudgetItem(
                            widget.eventId, {
                          'category': selectedCategory,
                          'description': descCtrl.text.trim(),
                          'estimated_cost':
                              double.tryParse(estCtrl.text.trim()) ?? 0,
                          'actual_cost':
                              double.tryParse(actCtrl.text.trim()) ?? 0,
                          'vendor_name': vendorCtrl.text.trim().isEmpty
                              ? null
                              : vendorCtrl.text.trim(),
                          'notes': notesCtrl.text.trim().isEmpty
                              ? null
                              : notesCtrl.text.trim(),
                          'status': selectedStatus,
                        });
                        if (!mounted) return;
                        if (res['success'] == true) {
                          AppSnackbar.success(context, 'Added');
                          _load(background: true);
                        } else {
                          AppSnackbar.error(
                              context, res['message'] ?? 'Failed');
                        }
                      },
                      child: Text('Save',
                          style: appText(
                              size: 14,
                              weight: FontWeight.w800,
                              color: Colors.white)),
                    ),
                  ),
                ]),
          ),
        ),
      ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t,
            style: appText(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.textSecondary)),
      );

  Widget _input(TextEditingController c, String hint,
      {TextInputType keyboard = TextInputType.text, int maxLines = 1}) {
    return TextField(
      controller: c,
      keyboardType: keyboard,
      maxLines: maxLines,
      style: appText(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: appText(size: 13, color: AppColors.textHint),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.borderLight)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.borderLight)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  Widget _dropdown<T>({
    required T? value,
    String? hint,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: DropdownButtonFormField<T>(
        value: value,
        decoration: InputDecoration(
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          hintText: hint,
          hintStyle: appText(size: 13, color: AppColors.textHint),
        ),
        style: appText(size: 13),
        isExpanded: true,
        items: items,
        onChanged: onChanged,
      ),
    );
  }
}
