import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';

class EventChecklistTab extends StatefulWidget {
  final String eventId;
  final String? eventTypeId;
  const EventChecklistTab({super.key, required this.eventId, this.eventTypeId});

  @override
  State<EventChecklistTab> createState() => _EventChecklistTabState();
}

class _EventChecklistTabState extends State<EventChecklistTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> _items = [];
  Map<String, dynamic> _summary = {};
  List<dynamic> _templates = [];
  bool _loading = true;
  bool _templatesLoading = false;
  bool _applying = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _load(); _loadTemplates(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getChecklist(widget.eventId);
    if (mounted) setState(() {
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
    // If filtered by event type returns empty, fetch all
    if (res['success'] == true && (res['data'] is List) && (res['data'] as List).isEmpty && widget.eventTypeId != null) {
      res = await EventsService.getTemplates();
    }
    if (mounted) setState(() {
      _templatesLoading = false;
      if (res['success'] == true && res['data'] is List) {
        _templates = res['data'] as List;
      }
    });
  }

  Future<void> _applyTemplate(Map<String, dynamic> template) async {
    setState(() => _applying = true);
    final templateId = template['id']?.toString() ?? '';
    final res = await EventsService.applyTemplate(widget.eventId, templateId, clearExisting: _items.isEmpty);
    if (mounted) {
      setState(() => _applying = false);
      if (res['success'] == true) {
        final added = res['data']?['added'] ?? 0;
        AppSnackbar.success(context, '$added tasks added from template');
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to apply template');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    final progress = (_summary['progress_percentage'] ?? 0).toDouble() / 100.0;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Progress
          if (_summary.isNotEmpty && (_summary['total'] ?? 0) > 0)
            Container(
              padding: const EdgeInsets.all(18),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(child: Text('Checklist Progress', style: appText(size: 15, weight: FontWeight.w700))),
                    Text('${(progress * 100).toInt()}%', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.primary)),
                  ]),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(value: progress, minHeight: 6, backgroundColor: AppColors.border, valueColor: AlwaysStoppedAnimation(AppColors.primary)),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    _progressStat('${_summary['completed'] ?? 0}', 'Done', const Color(0xFF16A34A)),
                    const SizedBox(width: 16),
                    _progressStat('${_summary['in_progress'] ?? 0}', 'In Progress', const Color(0xFFD97706)),
                    const SizedBox(width: 16),
                    _progressStat('${_summary['pending'] ?? 0}', 'Pending', AppColors.textTertiary),
                  ]),
                ],
              ),
            ),

          // Items
          if (_items.isNotEmpty)
            ..._items.map((item) => _checklistTile(item)),

          // Empty state with templates
          if (_items.isEmpty) ...[
            Container(
              padding: const EdgeInsets.all(24),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
              child: Column(children: [
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
                  child: const Icon(Icons.checklist_rounded, size: 28, color: AppColors.primary),
                ),
                const SizedBox(height: 14),
                Text('No checklist items yet', style: appText(size: 15, weight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  _templates.isNotEmpty
                      ? 'Choose a template below to get started, or add tasks manually.'
                      : 'Add tasks to track your event planning progress.',
                  style: appText(size: 13, color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                ),
              ]),
            ),
          ],

          // Templates section (show when empty or as option)
          if (_templates.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10, top: 4),
              child: Row(children: [
                const Icon(Icons.auto_awesome_rounded, size: 16, color: AppColors.primary),
                const SizedBox(width: 6),
                Text('Available Templates', style: appText(size: 14, weight: FontWeight.w700)),
                const Spacer(),
                if (_items.isNotEmpty)
                  Text('${_templates.length} template${_templates.length != 1 ? 's' : ''}', style: appText(size: 12, color: AppColors.textTertiary)),
              ]),
            ),
            ..._templates.map((t) => _templateCard(t)),
            const SizedBox(height: 8),
          ],

          if (_templatesLoading)
            Container(
              padding: const EdgeInsets.all(20),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
                const SizedBox(width: 10),
                Text('Loading templates...', style: appText(size: 13, color: AppColors.textTertiary)),
              ]),
            ),

          // Add button
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: GestureDetector(
              onTap: _showAddSheet,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.add_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text('Add Task', style: appText(size: 14, weight: FontWeight.w600, color: AppColors.primary)),
                ]),
              ),
            ),
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _progressStat(String value, String label, Color color) {
    return Row(children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text('$value ', style: appText(size: 13, weight: FontWeight.w700, color: color)),
      Text(label, style: appText(size: 11, color: AppColors.textTertiary)),
    ]);
  }

  Widget _templateCard(Map<String, dynamic> template) {
    final name = template['name']?.toString() ?? 'Template';
    final desc = template['description']?.toString();
    final taskCount = template['task_count'] ?? (template['tasks'] is List ? (template['tasks'] as List).length : 0);

    return GestureDetector(
      onTap: _applying ? null : () => _confirmApplyTemplate(template),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.primary.withOpacity(0.15)),
        ),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.article_rounded, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: appText(size: 14, weight: FontWeight.w600)),
            if (desc != null && desc.isNotEmpty)
              Text(desc, style: appText(size: 12, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(8)),
            child: Text('$taskCount tasks', style: appText(size: 10, weight: FontWeight.w700, color: AppColors.primary)),
          ),
        ]),
      ),
    );
  }

  void _confirmApplyTemplate(Map<String, dynamic> template) {
    final name = template['name']?.toString() ?? 'Template';
    if (_items.isEmpty) {
      _applyTemplate(template);
      return;
    }
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Apply Template', style: appText(size: 18, weight: FontWeight.w700)),
        content: Text('Add tasks from "$name" to your existing checklist?', style: appText(size: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Cancel', style: appText(size: 14, weight: FontWeight.w600, color: AppColors.textTertiary))),
          TextButton(
            onPressed: () { Navigator.pop(ctx); _applyTemplate(template); },
            child: Text('Apply', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  Widget _checklistTile(Map<String, dynamic> item) {
    final title = item['title']?.toString() ?? '';
    final status = (item['status'] ?? 'pending').toString();
    final isCompleted = status == 'completed';
    final isInProgress = status == 'in_progress';
    final assignee = item['assigned_name']?.toString() ?? item['assigned_to_name']?.toString();
    final priority = item['priority']?.toString();
    final category = item['category']?.toString();
    final dueDate = item['due_date']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isCompleted ? const Color(0xFFF0FDF4) : isInProgress ? const Color(0xFFFFFBEB) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isCompleted ? const Color(0xFFBBF7D0) : isInProgress ? const Color(0xFFFDE68A) : AppColors.border.withOpacity(0.5)),
      ),
      child: Row(
        children: [
          // Tap = toggle done/pending, Long-press = set in_progress
          GestureDetector(
            onTap: () => _setStatus(item, isCompleted ? 'pending' : 'completed'),
            onLongPress: () => _setStatus(item, isInProgress ? 'pending' : 'in_progress'),
            child: Container(
              width: 26, height: 26,
              decoration: BoxDecoration(
                color: isCompleted ? AppColors.primary : isInProgress ? const Color(0xFFF59E0B) : Colors.transparent,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: isCompleted ? AppColors.primary : isInProgress ? const Color(0xFFF59E0B) : AppColors.border, width: 1.5),
              ),
              child: isCompleted
                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                  : isInProgress
                      ? const Icon(Icons.access_time_rounded, size: 14, color: Colors.white)
                      : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: appText(
                  size: 14,
                  weight: FontWeight.w600,
                  color: isCompleted ? AppColors.textTertiary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Wrap(spacing: 6, runSpacing: 4, children: [
                // Status hint
                if (isInProgress)
                  _chipBadge('In Progress', const Color(0xFFF59E0B)),
                if (category != null && category.isNotEmpty)
                  _chipBadge(category, AppColors.textTertiary),
                if (priority != null && priority != 'medium')
                  _chipBadge(priority, priority == 'high' ? AppColors.error : AppColors.blue),
                if (dueDate != null && dueDate.isNotEmpty)
                  _chipBadge(_formatDate(dueDate), AppColors.textTertiary),
                if (assignee != null && assignee.isNotEmpty)
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.person_outline_rounded, size: 11, color: AppColors.textHint),
                    const SizedBox(width: 2),
                    Text(assignee, style: appText(size: 10, color: AppColors.textTertiary)),
                  ]),
              ]),
            ],
          )),
          GestureDetector(
            onTap: () => _deleteItem(item['id']?.toString() ?? ''),
            child: const Icon(Icons.close_rounded, size: 16, color: AppColors.textHint),
          ),
        ],
      ),
    );
  }

  Widget _chipBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: appText(size: 9, weight: FontWeight.w700, color: color)),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[d.month - 1]} ${d.day}';
    } catch (_) { return dateStr; }
  }

  /// Optimistic status update — updates UI immediately, reverts on failure
  Future<void> _setStatus(Map<String, dynamic> item, String newStatus) async {
    final id = item['id']?.toString() ?? '';
    if (id.isEmpty) return;
    final oldStatus = item['status'];

    // Optimistic: update local state immediately
    setState(() { item['status'] = newStatus; });

    final res = await EventsService.updateChecklistItem(widget.eventId, id, {'status': newStatus});
    if (mounted) {
      if (res['success'] != true) {
        // Revert on failure
        setState(() { item['status'] = oldStatus; });
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  Future<void> _deleteItem(String id) async {
    if (id.isEmpty) return;
    // Optimistic: remove from list immediately
    final removedIndex = _items.indexWhere((i) => i['id']?.toString() == id);
    final removedItem = removedIndex >= 0 ? _items[removedIndex] : null;
    if (removedIndex >= 0) setState(() => _items.removeAt(removedIndex));

    final res = await EventsService.deleteChecklistItem(widget.eventId, id);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Task removed');
      } else {
        // Revert on failure
        if (removedItem != null && removedIndex >= 0) {
          setState(() => _items.insert(removedIndex, removedItem));
        }
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  static const List<String> _categories = [
    'Venue', 'Catering', 'Decorations', 'Photography', 'Music & Entertainment',
    'Invitations', 'Transport', 'Attire', 'Budget', 'Coordination', 'Other',
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
    List<dynamic> assignableMembers = [];
    bool membersLoaded = false;
    bool submitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          // Load assignable members on first open
          if (!membersLoaded) {
            membersLoaded = true;
            EventsService.getAssignableMembers(widget.eventId).then((res) {
              if (ctx.mounted && res['success'] == true) {
                final data = res['data'];
                setSheetState(() {
                  assignableMembers = data is List ? data : [];
                });
              }
            });
          }

          return DraggableScrollableSheet(
            expand: false, initialChildSize: 0.85, maxChildSize: 0.95, minChildSize: 0.5,
            builder: (_, scrollCtrl) => Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
              child: ListView(controller: scrollCtrl, children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                Text('Add Checklist Item', style: appText(size: 18, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('Add a new task to your event planning checklist', style: appText(size: 12, color: AppColors.textTertiary)),
                const SizedBox(height: 20),

                // Title
                _sheetLabel('Title *'),
                _sheetInput(titleCtrl, 'e.g. Book venue', autofocus: true),
                const SizedBox(height: 14),

                // Description
                _sheetLabel('Description'),
                _sheetInput(descCtrl, 'Task details...', maxLines: 2),
                const SizedBox(height: 14),

                // Category + Priority row
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _sheetLabel('Category'),
                    Container(
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                      child: DropdownButtonFormField<String>(
                        value: category.isEmpty ? null : category,
                        decoration: InputDecoration(border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), hintText: 'Select', hintStyle: appText(size: 13, color: AppColors.textHint)),
                        style: appText(size: 13), isExpanded: true,
                        items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c, style: appText(size: 13)))).toList(),
                        onChanged: (v) => setSheetState(() => category = v ?? ''),
                      ),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _sheetLabel('Priority'),
                    Container(
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                      child: DropdownButtonFormField<String>(
                        value: priority,
                        decoration: InputDecoration(border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4)),
                        style: appText(size: 13), isExpanded: true,
                        items: const [
                          DropdownMenuItem(value: 'high', child: Text('🔴 High')),
                          DropdownMenuItem(value: 'medium', child: Text('🟡 Medium')),
                          DropdownMenuItem(value: 'low', child: Text('🟢 Low')),
                        ],
                        onChanged: (v) => setSheetState(() => priority = v ?? 'medium'),
                      ),
                    ),
                  ])),
                ]),
                const SizedBox(height: 14),

                // Due date
                _sheetLabel('Due Date'),
                GestureDetector(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: ctx,
                      initialDate: dueDate ?? DateTime.now().add(const Duration(days: 7)),
                      firstDate: DateTime.now().subtract(const Duration(days: 30)),
                      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                      builder: (c, child) => Theme(data: Theme.of(c).copyWith(colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: Colors.white, surface: Colors.white)), child: child!),
                    );
                    if (date != null) setSheetState(() => dueDate = date);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      Icon(Icons.calendar_today_rounded, size: 16, color: dueDate != null ? AppColors.primary : AppColors.textHint),
                      const SizedBox(width: 10),
                      Expanded(child: Text(
                        dueDate != null ? _formatDate(dueDate!.toIso8601String()) : 'Pick a date',
                        style: appText(size: 14, color: dueDate != null ? AppColors.textPrimary : AppColors.textHint),
                      )),
                      if (dueDate != null) GestureDetector(
                        onTap: () => setSheetState(() => dueDate = null),
                        child: const Icon(Icons.close, size: 16, color: AppColors.textHint),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                // Assign to
                _sheetLabel('Assign To'),
                if (assignedTo != null && assignedName != null)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      CircleAvatar(radius: 14, backgroundColor: AppColors.primary.withOpacity(0.2),
                        child: Text(assignedName![0].toUpperCase(), style: appText(size: 11, weight: FontWeight.w700, color: AppColors.primary)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(child: Text(assignedName!, style: appText(size: 13, weight: FontWeight.w600))),
                      GestureDetector(
                        onTap: () => setSheetState(() { assignedTo = null; assignedName = null; }),
                        child: const Icon(Icons.close, size: 16, color: AppColors.textHint),
                      ),
                    ]),
                  )
                else
                  Container(
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                    child: DropdownButtonFormField<String>(
                      value: null,
                      decoration: InputDecoration(border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), hintText: 'Select member', hintStyle: appText(size: 13, color: AppColors.textHint)),
                      style: appText(size: 13), isExpanded: true,
                      items: assignableMembers.map((m) {
                        final mMap = m as Map<String, dynamic>;
                        final fullName = mMap['full_name']?.toString() ?? '${mMap['first_name'] ?? ''} ${mMap['last_name'] ?? ''}'.trim();
                        final role = mMap['role']?.toString() ?? '';
                        return DropdownMenuItem(
                          value: mMap['id']?.toString(),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                            Text(fullName, style: appText(size: 13, weight: FontWeight.w600)),
                            if (role.isNotEmpty) Text(role, style: appText(size: 10, color: AppColors.textTertiary)),
                          ]),
                        );
                      }).toList(),
                      onChanged: (v) {
                        if (v == null) return;
                        final member = assignableMembers.firstWhere((m) => (m as Map)['id']?.toString() == v, orElse: () => null);
                        if (member != null) {
                          final mMap = member as Map<String, dynamic>;
                          setSheetState(() {
                            assignedTo = v;
                            assignedName = mMap['full_name']?.toString() ?? '${mMap['first_name'] ?? ''} ${mMap['last_name'] ?? ''}'.trim();
                          });
                        }
                      },
                    ),
                  ),
                const SizedBox(height: 14),

                // Notes
                _sheetLabel('Notes'),
                _sheetInput(notesCtrl, 'Additional notes...', maxLines: 2),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity, height: 50,
                  child: ElevatedButton(
                    onPressed: submitting ? null : () async {
                      if (titleCtrl.text.trim().isEmpty) return;
                      setSheetState(() => submitting = true);
                      final data = <String, dynamic>{
                        'title': titleCtrl.text.trim(),
                        if (descCtrl.text.trim().isNotEmpty) 'description': descCtrl.text.trim(),
                        if (category.isNotEmpty) 'category': category,
                        'priority': priority,
                        if (dueDate != null) 'due_date': '${dueDate!.year}-${dueDate!.month.toString().padLeft(2, '0')}-${dueDate!.day.toString().padLeft(2, '0')}',
                        if (assignedTo != null) 'assigned_to': assignedTo,
                        if (notesCtrl.text.trim().isNotEmpty) 'notes': notesCtrl.text.trim(),
                      };
                      Navigator.pop(ctx);
                      final res = await EventsService.addChecklistItem(widget.eventId, data);
                      if (mounted) {
                        if (res['success'] == true) { AppSnackbar.success(context, 'Task added'); _load(); }
                        else AppSnackbar.error(context, res['message'] ?? 'Failed');
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, disabledBackgroundColor: AppColors.primary.withOpacity(0.5), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                    child: submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text('Add Task', style: appText(size: 15, weight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
                const SizedBox(height: 16),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _sheetLabel(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
  );

  Widget _sheetInput(TextEditingController ctrl, String hint, {int maxLines = 1, bool autofocus = false}) => TextField(
    controller: ctrl, maxLines: maxLines, autofocus: autofocus,
    style: appText(size: 14),
    decoration: InputDecoration(
      hintText: hint, hintStyle: appText(size: 13, color: AppColors.textHint),
      filled: true, fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: const Color(0xFFE5E7EB), width: 1)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    ),
  );
}
