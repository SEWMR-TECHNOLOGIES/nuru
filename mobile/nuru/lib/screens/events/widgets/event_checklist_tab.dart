import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/self_scrolling_pills.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/services/events_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/l10n/l10n_helper.dart';

/// Full redesign — Checklist tab.
/// Flat surfaces, project SVG icons, skeleton loaders, background refresh,
/// progress ring header, filter pills, modern task tile.
class EventChecklistTab extends StatefulWidget {
  final String eventId;
  final String? eventTypeId;
  const EventChecklistTab({super.key, required this.eventId, this.eventTypeId});

  @override
  State<EventChecklistTab> createState() => _EventChecklistTabState();
}

class _EventChecklistTabState extends State<EventChecklistTab>
    with AutomaticKeepAliveClientMixin {
  List<dynamic> _items = [];
  Map<String, dynamic> _summary = {};
  List<dynamic> _templates = [];
  bool _loading = true;
  bool _templatesLoading = false;
  bool _applying = false;
  String _filter = 'all'; // all | pending | in_progress | completed

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
    _loadTemplates();
  }

  Future<void> _load({bool background = false}) async {
    if (!background) setState(() => _loading = true);
    final res = await EventsService.getChecklist(widget.eventId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _items = data?['items'] ?? [];
        _summary = data?['summary'] ?? {};
      }
    });
  }

  Future<void> _loadTemplates() async {
    setState(() => _templatesLoading = true);
    var res = await EventsService.getTemplates(eventTypeId: widget.eventTypeId);
    if (res['success'] == true &&
        (res['data'] is List) &&
        (res['data'] as List).isEmpty &&
        widget.eventTypeId != null) {
      res = await EventsService.getTemplates();
    }
    if (!mounted) return;
    setState(() {
      _templatesLoading = false;
      if (res['success'] == true && res['data'] is List) {
        _templates = res['data'] as List;
      }
    });
  }

  Future<void> _applyTemplate(Map<String, dynamic> template) async {
    setState(() => _applying = true);
    final id = template['id']?.toString() ?? '';
    final res = await EventsService.applyTemplate(widget.eventId, id,
        clearExisting: _items.isEmpty);
    if (!mounted) return;
    setState(() => _applying = false);
    if (res['success'] == true) {
      final added = res['data']?['added'] ?? 0;
      AppSnackbar.success(context, '$added tasks added from template');
      _load(background: true);
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed to apply template');
    }
  }

  List<dynamic> get _filtered {
    if (_filter == 'all') return _items;
    return _items.where((i) => (i['status'] ?? 'pending').toString() == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) return _skeleton();

    final total = (_summary['total'] ?? _items.length) as int;
    final completed = (_summary['completed'] ?? 0) as int;
    final inProgress = (_summary['in_progress'] ?? 0) as int;
    final pending = (_summary['pending'] ?? math.max(0, total - completed - inProgress)) as int;
    final progress = total == 0 ? 0.0 : completed / total;

    return NuruRefreshIndicator(
      onRefresh: () => _load(background: true),
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          if (total > 0) _progressHeader(progress, completed, inProgress, pending, total),
          if (total > 0) const SizedBox(height: 14),
          if (total > 0) _filterRow(total, completed, inProgress, pending),
          if (total > 0) const SizedBox(height: 12),

          if (_items.isEmpty) ...[
            _emptyState(),
            const SizedBox(height: 16),
          ],

          ..._filtered.map(_taskTile),

          if (_items.isNotEmpty && _filtered.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 36),
              alignment: Alignment.center,
              child: Text('No tasks in this view',
                  style: appText(size: 13, color: AppColors.textTertiary)),
            ),

          if (_templates.isNotEmpty) ...[
            const SizedBox(height: 18),
            Row(children: [
              const AppIcon('sparkle', size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text('Templates',
                  style: appText(size: 14, weight: FontWeight.w700)),
              const Spacer(),
              Text('${_templates.length}',
                  style: appText(size: 12, color: AppColors.textTertiary)),
            ]),
            const SizedBox(height: 10),
            ..._templates.map((t) => _templateCard(t as Map<String, dynamic>)),
          ],

          if (_templatesLoading)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Center(
                child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.primary)),
              ),
            ),

          const SizedBox(height: 16),
          _addButton(),
        ],
      ),
    );
  }

  // ---------- Skeleton ----------
  Widget _skeleton() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      children: [
        _skelBox(height: 132, radius: 20),
        const SizedBox(height: 14),
        Row(children: [
          for (int i = 0; i < 4; i++) ...[
            _skelBox(height: 32, width: 72, radius: 999),
            const SizedBox(width: 8),
          ],
        ]),
        const SizedBox(height: 14),
        for (int i = 0; i < 5; i++) ...[
          _skelBox(height: 64, radius: 16),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  Widget _skelBox({double? width, required double height, double radius = 12}) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.borderLight,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }

  // ---------- Progress header ----------
  Widget _progressHeader(double p, int done, int prog, int pend, int total) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(children: [
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
                valueColor: const AlwaysStoppedAnimation(AppColors.primary),
              ),
            ),
            Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${(p * 100).round()}%',
                  style: appText(size: 18, weight: FontWeight.w800)),
              Text('done',
                  style:
                      appText(size: 10, color: AppColors.textTertiary, weight: FontWeight.w600)),
            ]),
          ]),
        ),
        const SizedBox(width: 18),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Planning Progress',
                  style: appText(size: 15, weight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('$total task${total == 1 ? '' : 's'} total',
                  style: appText(size: 12, color: AppColors.textTertiary)),
              const SizedBox(height: 12),
              Wrap(spacing: 14, runSpacing: 6, children: [
                _miniStat(done, 'Done', const Color(0xFF16A34A)),
                _miniStat(prog, 'In progress', const Color(0xFFD97706)),
                _miniStat(pend, 'Pending', AppColors.textTertiary),
              ]),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _miniStat(int n, String label, Color color) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 6),
      Text('$n', style: appText(size: 13, weight: FontWeight.w800, color: color)),
      const SizedBox(width: 4),
      Text(label, style: appText(size: 11, color: AppColors.textTertiary)),
    ]);
  }

  // ---------- Filter pills (self-scrolls active into view) ----------
  Widget _filterRow(int total, int done, int prog, int pend) {
    final opts = [
      ['all', 'All', total],
      ['pending', 'Pending', pend],
      ['in_progress', 'In progress', prog],
      ['completed', 'Done', done],
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

  // ---------- Empty state ----------
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
          child: const AppIcon('checklist', size: 26, color: AppColors.primary),
        ),
        const SizedBox(height: 14),
        Text('Start planning', style: appText(size: 15, weight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(
          _templates.isNotEmpty
              ? 'Pick a template below or add tasks manually.'
              : 'Add tasks to track every step of your event.',
          style: appText(size: 12, color: AppColors.textTertiary),
          textAlign: TextAlign.center,
        ),
      ]),
    );
  }

  // ---------- Task tile ----------
  Widget _taskTile(dynamic raw) {
    final item = raw as Map<String, dynamic>;
    final title = item['title']?.toString() ?? '';
    final status = (item['status'] ?? 'pending').toString();
    final isDone = status == 'completed';
    final isProg = status == 'in_progress';
    final assignee = item['assigned_name']?.toString() ??
        item['assigned_to_name']?.toString();
    final priority = item['priority']?.toString();
    final category = item['category']?.toString();
    final due = item['due_date']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: () => _setStatus(item, isDone ? 'pending' : 'completed'),
          onLongPress: () =>
              _setStatus(item, isProg ? 'pending' : 'in_progress'),
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: isDone
                  ? AppColors.primary
                  : isProg
                      ? const Color(0xFFF59E0B)
                      : Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isDone
                    ? AppColors.primary
                    : isProg
                        ? const Color(0xFFF59E0B)
                        : AppColors.border,
                width: 1.5,
              ),
            ),
            child: isDone
                ? const Center(
                    child: AppIcon('double-check', size: 14, color: Colors.white))
                : isProg
                    ? const Center(
                        child: AppIcon('clock', size: 12, color: Colors.white))
                    : null,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              title,
              style: appText(
                size: 14,
                weight: FontWeight.w700,
                color: isDone ? AppColors.textTertiary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              if (isProg) _chip('In progress', const Color(0xFFD97706)),
              if (category != null && category.isNotEmpty)
                _chip(category, AppColors.primaryDark),
              if (priority != null && priority != 'medium')
                _chip(priority,
                    priority == 'high' ? AppColors.error : AppColors.blue),
              if (due != null && due.isNotEmpty)
                _chipIcon('calendar', _formatDate(due), const Color(0xFF2563EB)),
              if (assignee != null && assignee.isNotEmpty)
                _chipIcon('user', assignee, const Color(0xFF7C3AED)),
            ]),
          ]),
        ),
        GestureDetector(
          onTap: () => _deleteItem(item['id']?.toString() ?? ''),
          child: const Padding(
            padding: EdgeInsets.only(left: 8, top: 2),
            child: AppIcon('close', size: 14, color: AppColors.textHint),
          ),
        ),
      ]),
    );
  }

  Widget _chip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(999)),
      child: Text(text,
          style: appText(size: 10, weight: FontWeight.w700, color: color)),
    );
  }

  Widget _chipIcon(String icon, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
          color: color.withOpacity(0.10),
          borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        AppIcon(icon, size: 10, color: color),
        const SizedBox(width: 4),
        Text(text, style: appText(size: 10, weight: FontWeight.w700, color: color)),
      ]),
    );
  }

  // ---------- Templates ----------
  Widget _templateCard(Map<String, dynamic> t) {
    final name = t['name']?.toString() ?? 'Template';
    final desc = t['description']?.toString();
    final count = t['task_count'] ??
        (t['tasks'] is List ? (t['tasks'] as List).length : 0);
    return GestureDetector(
      onTap: _applying ? null : () => _confirmApplyTemplate(t),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(12)),
            child: const Center(
                child: AppIcon('checklist', size: 18, color: AppColors.primary)),
          ),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(name, style: appText(size: 13, weight: FontWeight.w700)),
                if (desc != null && desc.isNotEmpty)
                  Text(desc,
                      style: appText(size: 11, color: AppColors.textTertiary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
              ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
                color: AppColors.borderLight,
                borderRadius: BorderRadius.circular(999)),
            child: Text('$count tasks',
                style: appText(
                    size: 10,
                    weight: FontWeight.w700,
                    color: AppColors.textSecondary)),
          ),
        ]),
      ),
    );
  }

  void _confirmApplyTemplate(Map<String, dynamic> t) {
    if (_items.isEmpty) {
      _applyTemplate(t);
      return;
    }
    final name = t['name']?.toString() ?? 'Template';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Apply template',
            style: appText(size: 17, weight: FontWeight.w700)),
        content: Text('Add tasks from "$name" to your existing checklist?',
            style: appText(size: 13, color: AppColors.textSecondary)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel',
                  style: appText(
                      size: 13,
                      weight: FontWeight.w600,
                      color: AppColors.textTertiary))),
          TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                _applyTemplate(t);
              },
              child: Text('Apply',
                  style: appText(
                      size: 13,
                      weight: FontWeight.w700,
                      color: AppColors.primary))),
        ],
      ),
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
          Text('Add task',
              style: appText(
                  size: 14, weight: FontWeight.w800, color: Colors.white)),
        ]),
      ),
    );
  }

  // ---------- Helpers ----------
  String _formatDate(String s) {
    try {
      final d = DateTime.parse(s);
      const m = [
        'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
      ];
      return '${m[d.month - 1]} ${d.day}';
    } catch (_) {
      return s;
    }
  }

  Future<void> _setStatus(Map<String, dynamic> item, String newStatus) async {
    final id = item['id']?.toString() ?? '';
    if (id.isEmpty) return;
    final old = item['status'];
    setState(() => item['status'] = newStatus);
    final res = await EventsService.updateChecklistItem(
        widget.eventId, id, {'status': newStatus});
    if (!mounted) return;
    if (res['success'] != true) {
      setState(() => item['status'] = old);
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    } else {
      // refresh summary in background
      _load(background: true);
    }
  }

  Future<void> _deleteItem(String id) async {
    if (id.isEmpty) return;
    final idx = _items.indexWhere((i) => i['id']?.toString() == id);
    final removed = idx >= 0 ? _items[idx] : null;
    if (idx >= 0) setState(() => _items.removeAt(idx));
    final res = await EventsService.deleteChecklistItem(widget.eventId, id);
    if (!mounted) return;
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Task removed');
      _load(background: true);
    } else {
      if (removed != null && idx >= 0) {
        setState(() => _items.insert(idx, removed));
      }
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  static const List<String> _categories = [
    'Venue','Catering','Decorations','Photography','Music & Entertainment',
    'Invitations','Transport','Attire','Budget','Coordination','Other',
  ];

  void _showAddSheet() {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String category = '';
    String priority = 'medium';
    DateTime? dueDate;
    String? assignedTo;
    String? assignedName;
    List<dynamic> members = [];
    bool membersLoaded = false;
    bool submitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheetState) {
        if (!membersLoaded) {
          membersLoaded = true;
          EventsService.getAssignableMembers(widget.eventId).then((res) {
            if (ctx.mounted && res['success'] == true) {
              setSheetState(() =>
                  members = res['data'] is List ? res['data'] as List : []);
            }
          });
        }
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.85,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          builder: (_, scrollCtrl) => Padding(
            padding: EdgeInsets.fromLTRB(
                20, 12, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: ListView(controller: scrollCtrl, children: [
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
              Text('New task', style: appText(size: 18, weight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Add a new task to your event checklist',
                  style: appText(size: 12, color: AppColors.textTertiary)),
              const SizedBox(height: 20),
              _label('Title *'),
              _input(titleCtrl, 'e.g. Book venue', autofocus: true),
              const SizedBox(height: 14),
              _label('Description'),
              _input(descCtrl, 'Task details...', maxLines: 2),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      _label('Category'),
                      _dropdown<String>(
                        value: category.isEmpty ? null : category,
                        hint: 'Select',
                        items: _categories
                            .map((c) =>
                                DropdownMenuItem(value: c, child: Text(c)))
                            .toList(),
                        onChanged: (v) =>
                            setSheetState(() => category = v ?? ''),
                      ),
                    ])),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      _label('Priority'),
                      _dropdown<String>(
                        value: priority,
                        items: const [
                          DropdownMenuItem(value: 'high', child: Text('High')),
                          DropdownMenuItem(
                              value: 'medium', child: Text('Medium')),
                          DropdownMenuItem(value: 'low', child: Text('Low')),
                        ],
                        onChanged: (v) =>
                            setSheetState(() => priority = v ?? 'medium'),
                      ),
                    ])),
              ]),
              const SizedBox(height: 14),
              _label('Due date'),
              GestureDetector(
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate:
                        dueDate ?? DateTime.now().add(const Duration(days: 7)),
                    firstDate:
                        DateTime.now().subtract(const Duration(days: 30)),
                    lastDate:
                        DateTime.now().add(const Duration(days: 365 * 2)),
                  );
                  if (d != null) setSheetState(() => dueDate = d);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.borderLight),
                  ),
                  child: Row(children: [
                    AppIcon('calendar',
                        size: 14,
                        color: dueDate != null
                            ? AppColors.primary
                            : AppColors.textHint),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        dueDate != null
                            ? _formatDate(dueDate!.toIso8601String())
                            : 'Pick a date',
                        style: appText(
                            size: 13,
                            color: dueDate != null
                                ? AppColors.textPrimary
                                : AppColors.textHint),
                      ),
                    ),
                    if (dueDate != null)
                      GestureDetector(
                        onTap: () => setSheetState(() => dueDate = null),
                        child: const AppIcon('close',
                            size: 14, color: AppColors.textHint),
                      ),
                  ]),
                ),
              ),
              const SizedBox(height: 14),
              _label('Assign to'),
              if (assignedTo != null && assignedName != null)
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    CircleAvatar(
                        radius: 14,
                        backgroundColor: AppColors.primary.withOpacity(0.2),
                        child: Text(assignedName![0].toUpperCase(),
                            style: appText(
                                size: 11,
                                weight: FontWeight.w700,
                                color: AppColors.primary))),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text(assignedName!,
                            style:
                                appText(size: 13, weight: FontWeight.w600))),
                    GestureDetector(
                      onTap: () => setSheetState(() {
                        assignedTo = null;
                        assignedName = null;
                      }),
                      child: const AppIcon('close',
                          size: 14, color: AppColors.textHint),
                    ),
                  ]),
                )
              else
                _dropdown<String>(
                  value: null,
                  hint: 'Select member',
                  items: members.map((m) {
                    final mm = m as Map<String, dynamic>;
                    final name = mm['full_name']?.toString() ??
                        '${mm['first_name'] ?? ''} ${mm['last_name'] ?? ''}'
                            .trim();
                    return DropdownMenuItem(
                        value: mm['id']?.toString(), child: Text(name));
                  }).toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    final m = members.firstWhere(
                        (e) => (e as Map)['id']?.toString() == v,
                        orElse: () => null);
                    if (m != null) {
                      final mm = m as Map<String, dynamic>;
                      setSheetState(() {
                        assignedTo = v;
                        assignedName = mm['full_name']?.toString() ??
                            '${mm['first_name'] ?? ''} ${mm['last_name'] ?? ''}'
                                .trim();
                      });
                    }
                  },
                ),
              const SizedBox(height: 14),
              _label('Notes'),
              _input(notesCtrl, 'Additional notes...', maxLines: 2),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: submitting
                      ? null
                      : () async {
                          if (titleCtrl.text.trim().isEmpty) return;
                          setSheetState(() => submitting = true);
                          final data = <String, dynamic>{
                            'title': titleCtrl.text.trim(),
                            if (descCtrl.text.trim().isNotEmpty)
                              'description': descCtrl.text.trim(),
                            if (category.isNotEmpty) 'category': category,
                            'priority': priority,
                            if (dueDate != null)
                              'due_date':
                                  '${dueDate!.year}-${dueDate!.month.toString().padLeft(2, '0')}-${dueDate!.day.toString().padLeft(2, '0')}',
                            if (assignedTo != null) 'assigned_to': assignedTo,
                            if (notesCtrl.text.trim().isNotEmpty)
                              'notes': notesCtrl.text.trim(),
                          };
                          Navigator.pop(ctx);
                          final res = await EventsService.addChecklistItem(
                              widget.eventId, data);
                          if (mounted) {
                            if (res['success'] == true) {
                              AppSnackbar.success(context, 'Task added');
                              _load(background: true);
                            } else {
                              AppSnackbar.error(
                                  context, res['message'] ?? 'Failed');
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999)),
                  ),
                  child: submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text('Add task',
                          style: appText(
                              size: 14,
                              weight: FontWeight.w800,
                              color: Colors.white)),
                ),
              ),
              const SizedBox(height: 12),
            ]),
          ),
        );
      }),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: appText(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.textSecondary)),
      );

  Widget _input(TextEditingController c, String hint,
      {int maxLines = 1, bool autofocus = false}) {
    return TextField(
      controller: c,
      maxLines: maxLines,
      autofocus: autofocus,
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
