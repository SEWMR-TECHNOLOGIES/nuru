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

class EventMeetingsTab extends StatefulWidget {
  final String eventId;
  final bool isCreator;
  final Map<String, dynamic>? permissions;
  final String? eventName;

  const EventMeetingsTab({
    super.key,
    required this.eventId,
    required this.isCreator,
    this.permissions,
    this.eventName,
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

  String _t(String key) {
    final locale = context.read<LocaleProvider>().languageCode;
    return AppTranslations.tr(key, locale);
  }

  @override
  void initState() {
    super.initState();
    _loadMeetings();
  }

  Future<void> _loadMeetings() async {
    setState(() => _loading = true);
    try {
      final res = await _service.listMeetings(widget.eventId);
      if (res['success'] == true && res['data'] != null) {
        setState(() {
          _meetings = List<Map<String, dynamic>>.from(res['data']);
        });
      }
    } catch (_) {}
    setState(() => _loading = false);
  }

  Future<void> _createMeeting() async {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    DateTime? selectedDate;
    TimeOfDay? selectedTime;
    String duration = '60';
    int currentStep = 0; // 0 = details, 1 = date/time

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final theme = Theme.of(ctx);
          final isDark = theme.brightness == Brightness.dark;
          final primaryColor = theme.colorScheme.primary;

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.88,
            ),
            decoration: BoxDecoration(
              color: theme.scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.15),
                  blurRadius: 20,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            padding: EdgeInsets.only(
              left: 24, right: 24, top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      width: 40, height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white24 : Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Progress indicator
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 3,
                          decoration: BoxDecoration(
                            color: primaryColor,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Container(
                          height: 3,
                          decoration: BoxDecoration(
                            color: currentStep >= 1 ? primaryColor : (isDark ? Colors.white12 : Colors.grey[200]),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Header with icon
                  Row(
                    children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: primaryColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 24, height: 24, colorFilter: ColorFilter.mode(primaryColor, BlendMode.srcIn)),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              currentStep == 0 ? _t('schedule_a_meeting') : _t('date_and_time'),
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              currentStep == 0 ? _t('meeting_invite_subtitle') : 'Choose when your meeting takes place.',
                              style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  if (currentStep == 0) ...[
                    // ── STEP 1: Title & Description ──
                    _buildLabel(_t('meeting_title'), theme),
                    const SizedBox(height: 6),
                    TextField(
                      controller: titleCtrl,
                      decoration: _inputDecoration(
                        _t('meeting_title_placeholder'),
                        Icons.title_rounded,
                        theme,
                      ),
                    ),
                    const SizedBox(height: 16),

                    _buildLabel(_t('meeting_description'), theme),
                    const SizedBox(height: 6),
                    TextField(
                      controller: descCtrl,
                      maxLines: 2,
                      decoration: _inputDecoration(
                        _t('meeting_description_placeholder'),
                        Icons.notes_rounded,
                        theme,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Next button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                        label: Text(
                          _t('date_and_time'),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                        ),
                        style: FilledButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        onPressed: () {
                          if (titleCtrl.text.trim().isEmpty) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(
                                content: Text(_t('enter_title_date_time')),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            );
                            return;
                          }
                          setSheetState(() => currentStep = 1);
                        },
                      ),
                    ),
                  ] else ...[
                    // ── STEP 2: Date, Time, Duration ──

                    // Date picker button
                    _buildLabel(_t('pick_date'), theme),
                    const SizedBox(height: 6),
                    _buildPickerButton(
                      icon: Icons.calendar_today_rounded,
                      label: selectedDate != null
                          ? DateFormat('EEEE, MMM d, yyyy').format(selectedDate!)
                          : _t('pick_date'),
                      isSelected: selectedDate != null,
                      theme: theme,
                      onTap: () async {
                        final d = await showDatePicker(
                          context: ctx,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                          initialDate: selectedDate ?? DateTime.now(),
                          builder: (context, child) => Theme(
                            data: theme.copyWith(
                              colorScheme: theme.colorScheme.copyWith(primary: primaryColor),
                            ),
                            child: child!,
                          ),
                        );
                        if (d != null) setSheetState(() => selectedDate = d);
                      },
                    ),
                    const SizedBox(height: 20),

                    // Time picker – premium grid
                    _buildLabel(_t('pick_time'), theme),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withOpacity(0.04) : Colors.grey[50],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? Colors.white12 : Colors.grey[200]!),
                      ),
                      child: Column(
                        children: [
                          // Hour label
                          Text('HOUR', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: Colors.grey[500])),
                          const SizedBox(height: 8),
                          // Hour grid (4 columns x 6 rows)
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: List.generate(24, (i) {
                              final h = i;
                              final label = h.toString().padLeft(2, '0');
                              final isSelected = selectedTime?.hour == h;
                              return GestureDetector(
                                onTap: () {
                                  setSheetState(() {
                                    selectedTime = TimeOfDay(hour: h, minute: selectedTime?.minute ?? 0);
                                  });
                                },
                                child: Container(
                                  width: 48, height: 38,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: isSelected ? primaryColor : Colors.transparent,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    label,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.grey[700]),
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ),
                          const SizedBox(height: 12),
                          Divider(height: 1, color: isDark ? Colors.white12 : Colors.grey[200]),
                          const SizedBox(height: 12),
                          // Minute label
                          Text('MINUTE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.2, color: Colors.grey[500])),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [0, 15, 30, 45].map((m) {
                              final isSelected = (selectedTime?.minute ?? 0) == m;
                              return GestureDetector(
                                onTap: () {
                                  setSheetState(() {
                                    selectedTime = TimeOfDay(hour: selectedTime?.hour ?? 9, minute: m);
                                  });
                                },
                                child: Container(
                                  width: 58, height: 42,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: isSelected ? primaryColor : Colors.transparent,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    ':${m.toString().padLeft(2, '0')}',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.grey[700]),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                    // Selected time preview
                    if (selectedTime != null) ...[
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          '${selectedTime!.hour.toString().padLeft(2, '0')}:${selectedTime!.minute.toString().padLeft(2, '0')} (${DateTime.now().timeZoneName})',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),

                    // Duration chips
                    _buildLabel(_t('duration'), theme),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        {'val': '30', 'lbl': _t('minutes_30')},
                        {'val': '60', 'lbl': _t('hour_1')},
                        {'val': '90', 'lbl': _t('hours_1_5')},
                        {'val': '120', 'lbl': _t('hours_2')},
                      ].map((d) {
                        final isActive = duration == d['val'];
                        return Expanded(
                          child: GestureDetector(
                            onTap: () => setSheetState(() => duration = d['val']!),
                            child: Container(
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: isActive ? primaryColor : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isActive ? primaryColor : (isDark ? Colors.white12 : Colors.grey[300]!),
                                ),
                              ),
                              child: Text(
                                d['lbl']!,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                                  color: isActive ? Colors.white : (isDark ? Colors.white70 : Colors.grey[700]),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),

                    // Back + Schedule buttons
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: SizedBox(
                            height: 52,
                            child: OutlinedButton.icon(
                              icon: const Icon(Icons.arrow_back_rounded, size: 18),
                              label: Text(_t('go_back'), style: const TextStyle(fontWeight: FontWeight.w600)),
                              style: OutlinedButton.styleFrom(
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              onPressed: () => setSheetState(() => currentStep = 0),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 3,
                          child: SizedBox(
                            height: 52,
                            child: FilledButton.icon(
                              icon: SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 20, height: 20, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                              label: Text(
                                _t('schedule_meeting_btn'),
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                              ),
                              style: FilledButton.styleFrom(
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              onPressed: () {
                                if (selectedDate == null || selectedTime == null) {
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(
                                      content: Text(_t('enter_title_date_time')),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                  );
                                  return;
                                }
                                Navigator.pop(ctx, {
                                  'title': titleCtrl.text.trim(),
                                  'description': descCtrl.text.trim(),
                                  'date': selectedDate,
                                  'time': selectedTime,
                                  'duration': duration,
                                });
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
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
        final res = await _service.createMeeting(
          widget.eventId,
          title: result['title'],
          description: (result['description'] as String).isEmpty ? null : result['description'],
          scheduledAt: dt.toUtc().toIso8601String(),
          timezone: DateTime.now().timeZoneName,
          durationMinutes: result['duration'],
        );
        if (mounted && res['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_t('meeting_scheduled_invites')),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
          _loadMeetings();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(_t('something_went_wrong')),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      }
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
                      _buildPickerButton(icon: Icons.access_time_rounded, label: selectedTime != null ? selectedTime!.format(ctx) : _t('pick_time'), isSelected: selectedTime != null, theme: theme, onTap: () async {
                        final t = await showTimePicker(context: ctx, initialTime: selectedTime ?? const TimeOfDay(hour: 9, minute: 0));
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
                          child: const Icon(Icons.arrow_back_rounded, size: 18),
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Listen to locale changes
    context.watch<LocaleProvider>();

    return RefreshIndicator(
      onRefresh: _loadMeetings,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _meetings.isEmpty
              ? _buildEmptyState(theme)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _meetings.length + 1,
                  itemBuilder: (ctx, i) {
                    if (i == 0) return _buildHeader(theme);
                    return _buildMeetingCard(_meetings[i - 1], theme);
                  },
                ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 22, height: 22, colorFilter: ColorFilter.mode(theme.colorScheme.primary, BlendMode.srcIn)),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_t('meetings'), style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                  const SizedBox(height: 2),
                  Text(_t('meetings_subtitle'), style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey)),
                ],
              ),
            ],
          ),
          if (widget.isCreator)
            FilledButton.icon(
              onPressed: _createMeeting,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: Text(_t('schedule_meeting')),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 88, height: 88,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    theme.colorScheme.primary.withOpacity(0.12),
                    theme.colorScheme.primary.withOpacity(0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 44, height: 44, colorFilter: ColorFilter.mode(theme.colorScheme.primary, BlendMode.srcIn)),
            ),
            const SizedBox(height: 24),
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
    final status = meeting['status'] ?? 'scheduled';
    final isLive = status == 'in_progress';
    final isEnded = status == 'ended';
    final participants = List<Map<String, dynamic>>.from(meeting['participants'] ?? []);
    final scheduledAt = meeting['scheduled_at'] != null
        ? DateTime.tryParse(meeting['scheduled_at'])?.toLocal()
        : null;
    final isDark = theme.brightness == Brightness.dark;
    final createdBy = meeting['created_by'];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: isLive
            ? Border.all(color: const Color(0xFF10B981).withOpacity(0.4), width: 2)
            : Border.all(color: isDark ? Colors.white10 : Colors.grey[200]!),
        boxShadow: [
          if (isLive)
            BoxShadow(color: const Color(0xFF10B981).withOpacity(0.08), blurRadius: 20, offset: const Offset(0, 4))
          else
            BoxShadow(color: Colors.black.withOpacity(isDark ? 0.2 : 0.04), blurRadius: 12, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Live indicator bar
          if (isLive)
            Container(
              height: 3,
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [Color(0xFF10B981), Color(0xFF14B8A6)]),
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title + status
                Row(
                  children: [
                    Container(
                      width: 40, height: 40,
                      decoration: BoxDecoration(
                        color: isLive
                            ? const Color(0xFF10B981).withOpacity(0.1)
                            : isEnded
                                ? Colors.grey.withOpacity(0.1)
                                : theme.colorScheme.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: SvgPicture.asset(
                        'assets/icons/video_chat_icon.svg',
                        width: 22, height: 22,
                        colorFilter: ColorFilter.mode(
                          isLive ? const Color(0xFF10B981) : isEnded ? Colors.grey : theme.colorScheme.primary,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            meeting['title'] ?? '',
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.2),
                          ),
                          if (createdBy != null && createdBy['name'] != null)
                            Text(
                              '${_t('created_by')} ${createdBy['name']}',
                              style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey, fontSize: 11),
                            ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: _statusColor(status).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusLabel(status),
                        style: TextStyle(color: _statusColor(status), fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),

                if (meeting['description'] != null && meeting['description'].toString().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    meeting['description'],
                    style: theme.textTheme.bodySmall?.copyWith(color: Colors.grey, height: 1.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],

                const SizedBox(height: 14),

                // Meta info chips
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _buildMetaChipSvg(
                      'assets/icons/calendar-icon.svg',
                      scheduledAt != null ? DateFormat('MMM d, yyyy · h:mm a').format(scheduledAt) : '--',
                      theme,
                    ),
                    _buildMetaChip(
                      Icons.timer_outlined,
                      '${meeting['duration_minutes'] ?? '60'} ${_t('min_suffix')}',
                      theme,
                    ),
                    _buildMetaChip(
                      Icons.people_outline_rounded,
                      '${participants.length}',
                      theme,
                    ),
                  ],
                ),

                // Participant avatars
                if (participants.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 36,
                    child: Stack(
                      children: [
                        ...participants.take(6).toList().asMap().entries.map((entry) {
                          final p = entry.value;
                          return Positioned(
                            left: entry.key * 24.0,
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: theme.scaffoldBackgroundColor, width: 2),
                              ),
                              child: CircleAvatar(
                                radius: 16,
                                backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
                                backgroundImage: (p['avatar_url'] != null && p['avatar_url'].toString().isNotEmpty) ? NetworkImage(p['avatar_url']) : null,
                                child: (p['avatar_url'] == null || p['avatar_url'].toString().isEmpty)
                                    ? Text(
                                        (p['name'] ?? '?')[0],
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: theme.colorScheme.primary),
                                      )
                                    : null,
                              ),
                            ),
                          );
                        }),
                        if (participants.length > 6)
                          Positioned(
                            left: 6 * 24.0,
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: theme.scaffoldBackgroundColor, width: 2),
                              ),
                              child: CircleAvatar(
                                radius: 16,
                                backgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                                child: Text('+${participants.length - 6}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 14),

                // Actions
                Row(
                  children: [
                    if (!isEnded)
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _joiningId == meeting['id'] ? null : () => _joinMeeting(meeting),
                          icon: _joiningId == meeting['id']
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : isLive ? SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 18, height: 18, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)) : const Icon(Icons.play_arrow_rounded, size: 18),
                          label: Text(
                            isLive ? _t('join_now') : _t('join_meeting'),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: isLive ? const Color(0xFF10B981) : null,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                    if (!isEnded) const SizedBox(width: 8),
                    _buildIconAction(
                      Icons.link_rounded,
                      _t('copy_link'),
                      theme,
                      onTap: () {
                        final url = meeting['meeting_url'] ?? 'https://nuru.tz/meet/${meeting['room_id'] ?? ''}';
                        Clipboard.setData(ClipboardData(text: url));
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(_t('copy_link')),
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                    ),
                    if (widget.isCreator && status == 'scheduled') ...[
                      const SizedBox(width: 4),
                      _buildIconAction(
                        Icons.edit_outlined,
                        _t('edit_meeting'),
                        theme,
                        onTap: () => _editMeeting(meeting),
                      ),
                    ],
                    if (widget.isCreator && !isEnded) ...[
                      const SizedBox(width: 4),
                      _buildSvgIconAction(
                        'assets/icons/delete-icon.svg',
                        _t('cancel_meeting'),
                        theme,
                        color: Colors.red,
                        onTap: () => _deleteMeeting(meeting['id']),
                      ),
                    ],
                    const SizedBox(width: 4),
                    _buildIconAction(
                      Icons.list_alt_rounded,
                      _t('agenda_minutes'),
                      theme,
                      onTap: () => Navigator.push(context, MaterialPageRoute(
                        builder: (_) => MeetingDocumentsScreen(
                          eventId: widget.eventId,
                          meetingId: meeting['id'],
                          meetingTitle: meeting['title'] ?? '',
                          meetingDescription: meeting['description'],
                          meetingDate: meeting['scheduled_at'] ?? '',
                          isCreator: widget.isCreator,
                          eventName: widget.eventName,
                        ),
                      )),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
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