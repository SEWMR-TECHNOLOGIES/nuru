import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:nuru/core/services/meetings_service.dart';
import 'package:nuru/core/l10n/app_translations.dart';
import 'package:nuru/providers/locale_provider.dart';
import 'package:nuru/screens/meetings/meeting_room_screen.dart';
import 'package:nuru/screens/meetings/meeting_documents_screen.dart';
import 'package:nuru/screens/meetings/meeting_details_screen.dart';
import 'package:nuru/screens/meetings/create_meeting_screen.dart';

class EventMeetingsTab extends StatefulWidget {
  final String eventId;
  final bool isCreator;
  final Map<String, dynamic>? permissions;
  final String? eventName;
  final String? eventCover;
  final String? eventDate;
  final String? eventLocation;

  const EventMeetingsTab({
    super.key,
    required this.eventId,
    required this.isCreator,
    this.permissions,
    this.eventName,
    this.eventCover,
    this.eventDate,
    this.eventLocation,
  });

  @override
  State<EventMeetingsTab> createState() => _EventMeetingsTabState();
}

class _EventMeetingsTabState extends State<EventMeetingsTab> {
  final MeetingsService _service = MeetingsService();
  List<Map<String, dynamic>> _meetings = [];
  bool _loading = true;
  String? _joiningId;
  String? _endingId;
  String? _deletingId;
  int _activeTab = 0; // 0 = Upcoming, 1 = Ongoing, 2 = Past

  String _t(String key) {
    final locale = context.read<LocaleProvider>().languageCode;
    return AppTranslations.tr(key, locale);
  }

  @override
  void initState() {
    super.initState();
    _loadMeetings();
  }

  Future<void> _loadMeetings({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final res = await _service.listMeetings(widget.eventId);
      if (res['success'] == true && res['data'] != null) {
        if (mounted) {
          setState(() {
            _meetings = List<Map<String, dynamic>>.from(res['data']);
          });
        }
      }
    } catch (_) {}
    if (!silent && mounted) setState(() => _loading = false);
  }

  Future<void> _createMeeting() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CreateMeetingScreen(
          eventId: widget.eventId,
          eventName: widget.eventName,
        ),
      ),
    );
    if (created == true) {
      _loadMeetings();
    }
  }

  Future<void> _joinMeeting(Map<String, dynamic> meeting) async {
    setState(() => _joiningId = meeting['id']);
    try {
      final res = await _service.joinMeeting(widget.eventId, meeting['id']);
      if (res['success'] == true) {
        final roomId = res['data']?['room_id'] ?? meeting['room_id'] ?? '';
        if (roomId.isNotEmpty && mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => MeetingRoomScreen(
                eventId: widget.eventId,
                meetingId: meeting['id'],
                roomId: roomId,
                eventName: widget.eventName,
              ),
            ),
          );
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_t('could_not_join')),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    }
    if (mounted) setState(() => _joiningId = null);
  }

  Future<void> _deleteMeeting(String meetingId) async {
    final theme = Theme.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(_t('cancel_meeting_q'), style: const TextStyle(fontWeight: FontWeight.w700)),
        content: Text(_t('cancel_meeting_confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(_t('go_back')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(_t('cancel_meeting')),
          ),
        ],
      ),
    );
    if (confirm == true) {
      setState(() => _deletingId = meetingId);
      try {
        await _service.deleteMeeting(widget.eventId, meetingId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_t('meeting_cancelled')),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
        _loadMeetings();
      } catch (_) {}
      if (mounted) setState(() => _deletingId = null);
    }
  }

  Future<void> _editMeeting(Map<String, dynamic> meeting) async {
    final titleCtrl = TextEditingController(text: meeting['title'] ?? '');
    final descCtrl = TextEditingController(text: meeting['description'] ?? '');
    final existingDate = meeting['scheduled_at'] != null
        ? DateTime.tryParse(meeting['scheduled_at'])?.toLocal()
        : null;
    DateTime? selectedDate = existingDate;
    TimeOfDay? selectedTime = existingDate != null
        ? TimeOfDay(hour: existingDate.hour, minute: existingDate.minute)
        : null;
    String duration = meeting['duration_minutes']?.toString() ?? '60';
    int currentStep = 0;

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final theme = Theme.of(ctx);
        final isDark = theme.brightness == Brightness.dark;
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Container(
              constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SingleChildScrollView(
                padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom + 24, left: 24, right: 24, top: 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)))),
                    const SizedBox(height: 20),
                    Row(children: [
                      Container(height: 3, width: (MediaQuery.of(ctx).size.width - 60) / 2, decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(2))),
                      const SizedBox(width: 6),
                      Container(height: 3, width: (MediaQuery.of(ctx).size.width - 60) / 2, decoration: BoxDecoration(color: currentStep >= 1 ? theme.colorScheme.primary : Colors.grey[300], borderRadius: BorderRadius.circular(2))),
                    ]),
                    const SizedBox(height: 20),
                    Text(
                      currentStep == 0 ? _t('edit_a_meeting') : _t('date_and_time'),
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
                    ),
                    const SizedBox(height: 4),
                    Text(_t('edit_meeting_subtitle'), style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
                    const SizedBox(height: 24),

                    if (currentStep == 0) ...[
                      _buildLabel(_t('meeting_title'), theme),
                      const SizedBox(height: 8),
                      TextField(controller: titleCtrl, decoration: _inputDecoration(_t('meeting_title_placeholder'), Icons.title_rounded, theme)),
                      const SizedBox(height: 16),
                      _buildLabel(_t('meeting_description'), theme),
                      const SizedBox(height: 8),
                      TextField(controller: descCtrl, maxLines: 2, decoration: _inputDecoration(_t('meeting_description_placeholder'), Icons.notes_rounded, theme)),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity, height: 52,
                        child: FilledButton(
                          onPressed: () {
                            if (titleCtrl.text.trim().isEmpty) {
                              ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(_t('enter_title_date_time')), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))));
                              return;
                            }
                            setModalState(() => currentStep = 1);
                          },
                          style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text(_t('date_and_time'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward_rounded, size: 18),
                          ]),
                        ),
                      ),
                    ] else ...[
                      _buildPickerButton(icon: Icons.calendar_today_rounded, label: selectedDate != null ? DateFormat('EEEE, MMM d, yyyy').format(selectedDate!) : _t('pick_date'), isSelected: selectedDate != null, theme: theme, onTap: () async {
                        final d = await showDatePicker(context: ctx, initialDate: selectedDate ?? DateTime.now(), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                        if (d != null) setModalState(() => selectedDate = d);
                      }),
                      const SizedBox(height: 12),
                      _buildPickerButton(icon: Icons.access_time_rounded, label: selectedTime != null ? '${selectedTime!.hour.toString().padLeft(2, '0')}:${selectedTime!.minute.toString().padLeft(2, '0')}' : _t('pick_time'), isSelected: selectedTime != null, theme: theme, onTap: () async {
                        final t = await showTimePicker(
                          context: ctx,
                          initialTime: selectedTime ?? const TimeOfDay(hour: 9, minute: 0),
                          builder: (c, child) => MediaQuery(
                            data: MediaQuery.of(c).copyWith(alwaysUse24HourFormat: true),
                            child: child!,
                          ),
                        );
                        if (t != null) setModalState(() => selectedTime = t);
                      }),
                      const SizedBox(height: 16),
                      _buildLabel(_t('duration'), theme),
                      const SizedBox(height: 8),
                      Wrap(spacing: 8, children: [
                        for (final d in [{'v': '30', 'l': _t('minutes_30')}, {'v': '60', 'l': _t('hour_1')}, {'v': '90', 'l': _t('hours_1_5')}, {'v': '120', 'l': _t('hours_2')}])
                          ChoiceChip(label: Text(d['l']!), selected: duration == d['v'], onSelected: (_) => setModalState(() => duration = d['v']!),
                            selectedColor: theme.colorScheme.primary.withOpacity(0.15),
                            labelStyle: TextStyle(fontWeight: duration == d['v'] ? FontWeight.w700 : FontWeight.normal, color: duration == d['v'] ? theme.colorScheme.primary : null),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                      ]),
                      const SizedBox(height: 24),
                      Row(children: [
                        OutlinedButton(
                          onPressed: () => setModalState(() => currentStep = 0),
                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                          child: const Icon(Icons.chevron_left_rounded, size: 18),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: SizedBox(height: 52, child: FilledButton.icon(
                          onPressed: (selectedDate == null || selectedTime == null) ? null : () {
                            Navigator.pop(ctx, {'title': titleCtrl.text.trim(), 'description': descCtrl.text.trim(), 'date': selectedDate!, 'time': selectedTime!, 'duration': duration});
                          },
                          icon: const Icon(Icons.check_rounded, size: 18),
                          label: Text(_t('update_meeting'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                          style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                        ))),
                      ]),
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (result != null) {
      final dt = DateTime(
        (result['date'] as DateTime).year,
        (result['date'] as DateTime).month,
        (result['date'] as DateTime).day,
        (result['time'] as TimeOfDay).hour,
        (result['time'] as TimeOfDay).minute,
      );
      try {
        final res = await _service.updateMeeting(
          widget.eventId,
          meeting['id'],
          title: result['title'],
          description: (result['description'] as String).isEmpty ? null : result['description'],
          scheduledAt: dt.toUtc().toIso8601String(),
          timezone: DateTime.now().timeZoneName,
          durationMinutes: result['duration'],
        );
        if (mounted && res['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_t('meeting_updated')), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          );
          _loadMeetings();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_t('something_went_wrong')), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          );
        }
      }
    }
  }

  /// Parse server-provided ISO date safely. If the string lacks any TZ
  /// marker (Z or +HH:MM), assume UTC (matches backend convention) and then
  /// convert to the user's local time.
  DateTime? _parseServerDate(dynamic raw) {
    if (raw == null) return null;
    final s = raw.toString();
    if (s.isEmpty) return null;
    var d = DateTime.tryParse(s);
    if (d == null) return null;
    final hasTz =
        s.endsWith('Z') || RegExp(r'[+\-]\d{2}:?\d{2}$').hasMatch(s);
    if (!hasTz) {
      d = DateTime.utc(d.year, d.month, d.day, d.hour, d.minute, d.second,
          d.millisecond);
    }
    return d.toLocal();
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'in_progress': return const Color(0xFF10B981);
      case 'ended': return Colors.grey;
      default: return const Color(0xFF3B82F6);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'in_progress': return _t('status_live');
      case 'ended': return _t('status_ended');
      default: return _t('status_scheduled');
    }
  }

  List<Map<String, dynamic>> get _filteredMeetings {
    return _meetings.where((m) {
      final s = (m['status'] ?? 'scheduled').toString();
      switch (_activeTab) {
        case 1: return s == 'in_progress';
        case 2: return s == 'ended';
        default: return s == 'scheduled' || s == 'in_progress';
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    context.watch<LocaleProvider>();
    final filtered = _filteredMeetings;

    return NuruRefreshIndicator(
      onRefresh: _loadMeetings,
      child: Container(
        color: Colors.white,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                children: [
                  _buildEventHeader(theme),
                  const SizedBox(height: 16),
                  _buildTabs(theme),
                  const SizedBox(height: 18),
                  if (widget.isCreator) _buildPromoCard(theme),
                  if (widget.isCreator) const SizedBox(height: 18),
                  _buildSectionTitle(theme),
                  const SizedBox(height: 10),
                  if (filtered.isEmpty)
                    _buildInlineEmpty(theme)
                  else
                    ...filtered.map((m) => _buildMeetingCard(m, theme)),
                ],
              ),
      ),
    );
  }

  Widget _buildEventHeader(ThemeData theme) {
    final hasCover = (widget.eventCover ?? '').isNotEmpty;
    DateTime? date;
    if ((widget.eventDate ?? '').isNotEmpty) {
      date = DateTime.tryParse(widget.eventDate!);
    }
    final dateLabel = date != null
        ? DateFormat('MMM d, yyyy').format(date)
        : (widget.eventDate ?? '');
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFEDEDF3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: hasCover
                ? Image.network(
                    widget.eventCover!,
                    width: 64, height: 64, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _coverFallback(),
                  )
                : _coverFallback(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.eventName ?? 'Event',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                ),
                if (dateLabel.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(children: [
                    SvgPicture.asset('assets/icons/calendar-icon.svg',
                        width: 13, height: 13,
                        colorFilter: ColorFilter.mode(
                            Colors.grey[600]!, BlendMode.srcIn)),
                    const SizedBox(width: 6),
                    Text(dateLabel,
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: Colors.grey[700], fontSize: 12)),
                  ]),
                ],
                if ((widget.eventLocation ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(children: [
                    SvgPicture.asset('assets/icons/location-icon.svg',
                        width: 13, height: 13,
                        colorFilter: ColorFilter.mode(
                            Colors.grey[600]!, BlendMode.srcIn)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(widget.eventLocation!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.grey[700], fontSize: 12)),
                    ),
                  ]),
                ],
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF4D6),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text('Event Workspace',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF8A6A00),
                        )),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _coverFallback() {
    return Container(
      width: 64, height: 64,
      color: const Color(0xFFF1F1F4),
      child: const Icon(Icons.event_rounded, color: Colors.grey),
    );
  }

  Widget _buildTabs(ThemeData theme) {
    final tabs = ['Upcoming', 'Ongoing', 'Past Meetings'];
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(
          bottom: BorderSide(color: AppColors.borderLight, width: 1),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          children: List.generate(tabs.length, (i) {
            final selected = i == _activeTab;
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _activeTab = i),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: IntrinsicWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        tabs[i],
                        textAlign: TextAlign.center,
                        style: appText(
                          size: 13,
                          weight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected
                              ? AppColors.textPrimary
                              : AppColors.textTertiary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: selected ? AppColors.primary : Colors.transparent,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _buildPromoCard(ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF17171C) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: isDark ? Colors.white10 : const Color(0xFFEDEDF3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: SvgPicture.asset(
                    'assets/icons/video_chat_icon.svg',
                    width: 18, height: 18,
                    colorFilter: ColorFilter.mode(
                        theme.colorScheme.primary, BlendMode.srcIn),
                  ),
                ),
                const SizedBox(height: 10),
                Text('Plan better together',
                    style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800, letterSpacing: -0.2)),
                const SizedBox(height: 4),
                Text(
                  'Host meetings with your committee anytime, anywhere.',
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.grey, height: 1.35),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _createMeeting,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('New Meeting',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700)),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFF7B500),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SvgPicture.asset(
            'assets/illustrations/meetings.svg',
            width: 130, height: 110, fit: BoxFit.contain,
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(ThemeData theme) {
    final label = _activeTab == 1
        ? 'Ongoing Meetings'
        : _activeTab == 2
            ? 'Past Meetings'
            : 'Upcoming Meetings';
    return Text(label,
        style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800, letterSpacing: -0.3));
  }

  Widget _buildInlineEmpty(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(children: [
        SvgPicture.asset('assets/illustrations/meetings.svg',
            width: 200, height: 160, fit: BoxFit.contain),
        const SizedBox(height: 8),
        Text(_t('no_meetings_yet'),
            style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(_t('no_meetings_desc'),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
      ]),
    );
  }


  Widget _buildEmptyState(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SvgPicture.asset(
              'assets/illustrations/meetings.svg',
              width: 240,
              height: 200,
              fit: BoxFit.contain,
            ),
            const SizedBox(height: 8),
            Text(
              _t('no_meetings_yet'),
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
            ),
            const SizedBox(height: 8),
            Text(
              _t('no_meetings_desc'),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey, height: 1.5),
            ),
            if (widget.isCreator) ...[
              const SizedBox(height: 28),
              FilledButton.icon(
                onPressed: _createMeeting,
                icon: const Icon(Icons.add_rounded),
                label: Text(_t('schedule_first_meeting')),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMeetingCard(Map<String, dynamic> meeting, ThemeData theme) {
    final status = (meeting['status'] ?? 'scheduled').toString();
    final isLive = status == 'in_progress';
    final isEnded = status == 'ended';
    final scheduledAt = _parseServerDate(meeting['scheduled_at']);

    final dateLine = scheduledAt != null
        ? '${DateFormat('MMM d, yyyy').format(scheduledAt)} · ${DateFormat('h:mm a').format(scheduledAt)}'
        : '--';

    final desc = (meeting['description'] ?? '').toString();

    // Right-side relative badge
    String relLabel;
    Color relBg;
    Color relFg;
    if (isLive) {
      relLabel = 'Live';
      relBg = const Color(0xFFFEE2E2);
      relFg = const Color(0xFFB91C1C);
    } else if (isEnded) {
      relLabel = 'Ended';
      relBg = const Color(0xFFF1F1F4);
      relFg = const Color(0xFF6B7280);
    } else if (scheduledAt != null) {
      final diff = scheduledAt.difference(DateTime.now());
      if (diff.inMinutes < 60 && diff.inMinutes > 0) {
        relLabel = 'In ${diff.inMinutes} min';
      } else if (diff.inHours < 24 && diff.inHours > 0) {
        relLabel = 'In ${diff.inHours}h';
      } else if (diff.inDays >= 0) {
        relLabel = diff.inDays == 0 ? 'Today' : 'In ${diff.inDays} days';
      } else {
        relLabel = 'Past due';
      }
      relBg = const Color(0xFFEDE9FE);
      relFg = const Color(0xFF6D28D9);
    } else {
      relLabel = 'Scheduled';
      relBg = const Color(0xFFEDE9FE);
      relFg = const Color(0xFF6D28D9);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEDEDF3)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _openDetails(meeting),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEDE9FE),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: SvgPicture.asset(
                      'assets/icons/people-in-meeting.svg',
                      width: 22, height: 22,
                      colorFilter: const ColorFilter.mode(
                          Color(0xFF6D28D9), BlendMode.srcIn),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        meeting['title'] ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        dateLine,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.grey[600], fontSize: 12,
                        ),
                      ),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          desc,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.grey[700], fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: relBg,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        relLabel,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: relFg,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    InkWell(
                      onTap: () => _showMeetingMenu(meeting),
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(Icons.more_vert_rounded,
                            size: 18, color: Colors.grey[500]),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openDetails(Map<String, dynamic> meeting) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => MeetingDetailsScreen(
        eventId: widget.eventId,
        meetingId: meeting['id'].toString(),
        initialMeeting: meeting,
        eventName: widget.eventName,
        isCreator: widget.isCreator,
      ),
    )).then((_) => _loadMeetings(silent: true));
  }

  void _showMeetingMenu(Map<String, dynamic> meeting) {
    final status = meeting['status'] ?? 'scheduled';
    final isEnded = status == 'ended';
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 8),
            _menuTile('assets/icons/info-icon.svg', 'Meeting details', () { Navigator.pop(ctx); _openDetails(meeting); }),
            _menuTile('assets/icons/chat-icon.svg', 'Agenda & Minutes', () {
              Navigator.pop(ctx);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => MeetingDocumentsScreen(
                  eventId: widget.eventId,
                  meetingId: meeting['id'],
                  meetingTitle: meeting['title'] ?? '',
                  meetingDescription: meeting['description'],
                  meetingDate: meeting['scheduled_at'] ?? '',
                  isCreator: widget.isCreator,
                  eventName: widget.eventName,
                ),
              ));
            }),
            _menuTile('assets/icons/share-upload-icon.svg', _t('copy_link'), () {
              Navigator.pop(ctx);
              final url = meeting['meeting_url'] ?? 'https://nuru.tz/meet/${meeting['room_id'] ?? ''}';
              Clipboard.setData(ClipboardData(text: url.toString()));
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text(_t('copy_link')),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ));
            }),
            if (widget.isCreator && status == 'scheduled')
              _menuTile('assets/icons/pen-icon.svg', _t('edit_meeting'),
                  () { Navigator.pop(ctx); _editMeeting(meeting); }),
            if (widget.isCreator && !isEnded)
              _menuTile('assets/icons/close-circle-icon.svg', _t('cancel_meeting'),
                  () { Navigator.pop(ctx); _deleteMeeting(meeting['id']); },
                  color: Colors.red),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _menuTile(String svg, String label, VoidCallback onTap, {Color? color}) {
    return ListTile(
      leading: SvgPicture.asset(svg,
          width: 20, height: 20,
          colorFilter:
              ColorFilter.mode(color ?? Colors.black87, BlendMode.srcIn)),
      title: Text(label,
          style: TextStyle(
              color: color ?? Colors.black87,
              fontSize: 14,
              fontWeight: FontWeight.w600)),
      onTap: onTap,
    );
  }

  // ── Helper widgets ──

  Widget _buildLabel(String text, ThemeData theme) {
    return Text(
      text,
      style: theme.textTheme.bodySmall?.copyWith(
        fontWeight: FontWeight.w600,
        color: Colors.grey[600],
        letterSpacing: 0.3,
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon, ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20, color: Colors.grey[500]),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.grey[300]!),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: isDark ? Colors.white12 : Colors.grey[300]!),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: theme.colorScheme.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  Widget _buildPickerButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required ThemeData theme,
    required VoidCallback onTap,
  }) {
    final isDark = theme.brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? theme.colorScheme.primary.withOpacity(0.5)
                : isDark ? Colors.white12 : Colors.grey[300]!,
          ),
          color: isSelected ? theme.colorScheme.primary.withOpacity(0.05) : null,
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: isSelected ? theme.colorScheme.primary : Colors.grey[500]),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected ? theme.colorScheme.primary : Colors.grey[600],
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetaChip(IconData icon, String text, ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.06) : Colors.grey[100],
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.grey[500]),
          const SizedBox(width: 5),
          Text(text, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildIconAction(IconData icon, String tooltip, ThemeData theme, {Color? color, required VoidCallback onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.brightness == Brightness.dark ? Colors.white12 : Colors.grey[200]!),
          ),
          child: Icon(icon, size: 20, color: color ?? Colors.grey[600]),
        ),
      ),
    );
  }

  Widget _buildSvgIconAction(String assetPath, String tooltip, ThemeData theme, {Color? color, required VoidCallback onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.brightness == Brightness.dark ? Colors.white12 : Colors.grey[200]!),
          ),
          child: Center(
            child: SvgPicture.asset(assetPath, width: 20, height: 20,
              colorFilter: ColorFilter.mode(color ?? Colors.grey[600]!, BlendMode.srcIn)),
          ),
        ),
      ),
    );
  }

  Widget _buildMetaChipSvg(String assetPath, String text, ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.06) : Colors.grey[100],
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(assetPath, width: 13, height: 13,
            colorFilter: ColorFilter.mode(Colors.grey[500]!, BlendMode.srcIn)),
          const SizedBox(width: 5),
          Text(text, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
        ],
      ),
    );
  }
}