import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/events_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../photos/my_photo_libraries_screen.dart';
import 'invitation_qr_screen.dart';
import '../../core/services/reminder_service.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.4}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

String _str(dynamic v, {String fallback = ''}) {
  if (v == null) return fallback;
  if (v is String) return v.isEmpty ? fallback : v;
  if (v is Map) return (v['name'] ?? v['title'] ?? v['label'] ?? v.values.first)?.toString() ?? fallback;
  return v.toString();
}

/// Public event view for invited guests — mirrors web EventView.
/// Shows event details, RSVP actions, schedule, dress code, and photo libraries.
/// Does NOT show management tabs (budget, committee, expenses, etc.)
class EventPublicViewScreen extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? initialData;

  const EventPublicViewScreen({super.key, required this.eventId, this.initialData});

  @override
  State<EventPublicViewScreen> createState() => _EventPublicViewScreenState();
}

class _EventPublicViewScreenState extends State<EventPublicViewScreen> {
  Map<String, dynamic>? _event;
  bool _loading = true;
  String _rsvpStatus = 'pending';
  bool _responding = false;
  String? _invitationCode;
  Map<String, dynamic>? _reminder;
  bool _savingReminder = false;

  @override
  void initState() {
    super.initState();
    _event = widget.initialData;
    _loadEvent();
    _loadInvitation();
    _loadReminder();
  }

  Future<void> _loadReminder() async {
    final reminder = await ReminderService.getReminder(widget.eventId);
    if (mounted) setState(() => _reminder = reminder);
  }

  String _reminderSubtitle() {
    if (_reminder == null) return 'Get reminded before the event';
    final label = _reminder?['reminder_label']?.toString() ?? 'Reminder set';
    final at = DateTime.tryParse(_reminder?['reminder_time']?.toString() ?? '');
    if (at == null) return label;
    return '$label • ${ReminderService.formatReminderDate(at)}';
  }

  Future<void> _saveReminder(DateTime eventStart, String label, DateTime time) async {
    if (_savingReminder) return;
    setState(() => _savingReminder = true);
    await ReminderService.setReminder(
      eventId: widget.eventId,
      eventTitle: _str(_event?['title'], fallback: 'Event'),
      reminderTime: time,
      reminderLabel: label,
      eventStart: eventStart,
    );
    final reminder = await ReminderService.getReminder(widget.eventId);
    if (mounted) {
      setState(() {
        _savingReminder = false;
        _reminder = reminder;
      });
      AppSnackbar.success(context, 'Reminder updated');
    }
  }

  Future<void> _deleteReminder() async {
    if (_savingReminder) return;
    setState(() => _savingReminder = true);
    await ReminderService.removeReminder(widget.eventId);
    if (mounted) {
      setState(() {
        _savingReminder = false;
        _reminder = null;
      });
      AppSnackbar.success(context, 'Reminder removed');
    }
  }

  void _showReminderSheet() {
    final e = _event;
    if (e == null) return;

    final startDate = _str(e['start_date']);
    final startTime = _str(e['start_time']);
    if (startDate.isEmpty) {
      AppSnackbar.error(context, 'Event date is missing');
      return;
    }

    final dateTimeString = startTime.isNotEmpty ? '${startDate}T$startTime:00' : startDate;
    final eventStart = DateTime.tryParse(dateTimeString) ?? DateTime.tryParse(startDate);

    if (eventStart == null || eventStart.isBefore(DateTime.now())) {
      AppSnackbar.error(context, 'This event has already started or ended');
      return;
    }

    final options = ReminderService.getReminderOptions(eventStart);
    if (options.isEmpty) {
      AppSnackbar.error(context, 'Event is too close to set a reminder');
      return;
    }

    final activeLabel = _reminder?['reminder_label']?.toString();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FractionallySizedBox(
        heightFactor: 0.78,
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(children: [
            const SizedBox(height: 10),
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(4)),
            ),
            const SizedBox(height: 14),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary.withOpacity(0.14), AppColors.primary.withOpacity(0.04)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.primary.withOpacity(0.15)),
              ),
              child: Row(children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Center(
                    child: SvgPicture.asset('assets/icons/bell-icon.svg', width: 20, height: 20,
                        colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Event reminder', style: _f(size: 15, weight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(_str(e['title'], fallback: 'Event'), style: _f(size: 12, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ]),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                itemCount: options.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final opt = options[i];
                  final label = opt['label'] as String;
                  final time = opt['time'] as DateTime;
                  final selected = label == activeLabel;
                  return GestureDetector(
                    onTap: _savingReminder
                        ? null
                        : () async {
                            await _saveReminder(eventStart, label, time);
                            if (mounted) Navigator.pop(ctx);
                          },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary.withOpacity(0.08) : AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: selected ? AppColors.primary.withOpacity(0.45) : AppColors.borderLight),
                      ),
                      child: Row(children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: selected ? AppColors.primary.withOpacity(0.14) : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: selected ? AppColors.primary.withOpacity(0.3) : AppColors.borderLight),
                          ),
                          child: Center(
                            child: SvgPicture.asset('assets/icons/clock-icon.svg', width: 18, height: 18,
                                colorFilter: ColorFilter.mode(selected ? AppColors.primary : AppColors.textSecondary, BlendMode.srcIn)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(label, style: _f(size: 14, weight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(ReminderService.formatReminderDate(time), style: _f(size: 11, color: AppColors.textTertiary)),
                          ]),
                        ),
                        if (selected)
                          SvgPicture.asset('assets/icons/verified-icon.svg', width: 16, height: 16,
                              colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                      ]),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
              child: Row(children: [
                if (_reminder != null)
                  Expanded(
                    child: GestureDetector(
                      onTap: _savingReminder
                          ? null
                          : () async {
                              await _deleteReminder();
                              if (mounted) Navigator.pop(ctx);
                            },
                      child: Container(
                        height: 46,
                        decoration: BoxDecoration(
                          color: AppColors.error.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.error.withOpacity(0.25)),
                        ),
                        child: Center(
                          child: Text('Remove reminder', style: _f(size: 13, weight: FontWeight.w700, color: AppColors.error)),
                        ),
                      ),
                    ),
                  ),
                if (_reminder != null) const SizedBox(width: 10),
                Expanded(
                  child: GestureDetector(
                    onTap: () => Navigator.pop(ctx),
                    child: Container(
                      height: 46,
                      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                      child: Center(child: Text('Close', style: _f(size: 13, weight: FontWeight.w700, color: AppColors.textSecondary))),
                    ),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Future<void> _loadEvent() async {
    final res = await EventsService.getEventById(widget.eventId);
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) _event = res['data'];
      });
    }
  }

  Future<void> _loadInvitation() async {
    final res = await EventsService.getInvitedEvents(limit: 100);
    if (mounted && res['success'] == true) {
      final events = res['data'];
      List<dynamic> eventList = [];
      if (events is List) {
        eventList = events;
      } else if (events is Map) {
        eventList = events['events'] ?? events['data'] ?? events['items'] ?? [];
      }
      for (final e in eventList) {
        if (e['id']?.toString() == widget.eventId) {
          final inv = e['invitation'] ?? e;
          setState(() {
            _rsvpStatus = inv['rsvp_status']?.toString() ?? 'pending';
            _invitationCode = inv['invitation_code']?.toString() ?? e['invitation_code']?.toString();
          });
          break;
        }
      }
    }
  }

  Future<void> _handleRSVP(String status) async {
    setState(() => _responding = true);
    final res = await EventsService.respondToInvitation(widget.eventId, status);
    if (mounted) {
      setState(() => _responding = false);
      if (res['success'] == true) {
        setState(() => _rsvpStatus = status);
        AppSnackbar.success(context, status == 'confirmed' ? 'You have accepted the invitation!' : 'You have declined the invitation.');
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to update RSVP');
      }
    }
  }

  void _openLocationInMaps(String location, String venue, Map<String, dynamic> event) async {
    // Try venue coordinates first
    final vc = event['venue_coordinates'];
    double? lat;
    double? lng;
    if (vc is Map) {
      lat = double.tryParse(vc['latitude']?.toString() ?? '');
      lng = double.tryParse(vc['longitude']?.toString() ?? '');
    }

    Uri mapUri;
    if (lat != null && lng != null) {
      // Open with coordinates
      mapUri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    } else {
      // Open with address query
      final query = [venue, location].where((s) => s.isNotEmpty).join(', ');
      mapUri = Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(query)}');
    }

    if (await canLaunchUrl(mapUri)) {
      await launchUrl(mapUri, mode: LaunchMode.externalApplication);
    }
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      final weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      final months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return '${weekdays[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarContrastEnforced: false,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: _loading && _event == null
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _event == null
                ? _emptyState()
                : _buildContent(),
      ),
    );
  }

  Widget _emptyState() {
    return SafeArea(
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.event_busy_rounded, size: 48, color: AppColors.textHint),
          const SizedBox(height: 12),
          Text('Event not found', style: _f(size: 16, weight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('This event may have been removed', style: _f(size: 13, color: AppColors.textTertiary)),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
              child: Text('Go Back', style: _f(size: 13, weight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildContent() {
    final e = _event!;
    final title = _str(e['title'], fallback: 'Event');
    final cover = e['cover_image']?.toString();
    final location = _str(e['location']);
    final venue = _str(e['venue']);
    final startDate = _str(e['start_date']);
    final startTime = _str(e['start_time']);
    final description = _str(e['description']);
    final dressCode = _str(e['dress_code']);
    final specialInstructions = _str(e['special_instructions']);
    final eventType = _str(e['event_type']);
    final schedule = e['schedule'] is List ? e['schedule'] as List : [];
    final hasReminder = _reminder != null;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // ─── Cover Image Hero ───
        SliverAppBar(
          expandedHeight: 240,
          pinned: true,
          backgroundColor: AppColors.primary,
          leading: GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(12)),
              child: Center(child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 22, height: 22,
                  colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn))),
            ),
          ),
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(children: [
              if (cover != null)
                Positioned.fill(
                  child: CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => Container(color: AppColors.primary)),
                )
              else
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(colors: [AppColors.primary, Color(0xFF1A3B6E)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  ),
                ),
              // Gradient overlay
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter, end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withOpacity(0.6)],
                      stops: const [0.4, 1.0],
                    ),
                  ),
                ),
              ),
              // Title + type badge
              Positioned(
                bottom: 16, left: 20, right: 20,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (eventType.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.9), borderRadius: BorderRadius.circular(6)),
                      child: Text(eventType, style: _f(size: 11, weight: FontWeight.w600, color: Colors.white)),
                    ),
                  Text(title, style: _f(size: 22, weight: FontWeight.w800, color: Colors.white, height: 1.2), maxLines: 2, overflow: TextOverflow.ellipsis),
                ]),
              ),
            ]),
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // ─── RSVP Card ───
              _rsvpCard(),
              const SizedBox(height: 14),

              // ─── QR Code / Invitation Code button ───
              if (_rsvpStatus == 'confirmed' && _invitationCode != null && _invitationCode!.isNotEmpty) ...[
                GestureDetector(
                  onTap: () {
                    Navigator.push(context, MaterialPageRoute(
                      builder: (_) => InvitationQRScreen(eventId: widget.eventId),
                    ));
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                    ),
                    child: Row(children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.12), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.qr_code_rounded, size: 22, color: AppColors.primary),
                      ),
                      const SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Your Invitation QR Code', style: _f(size: 14, weight: FontWeight.w700)),
                        Text('Show this at check-in', style: _f(size: 11, color: AppColors.textTertiary)),
                      ])),
                      SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 18, height: 18,
                          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // ─── Reminder Button ───
              GestureDetector(
                onTap: _showReminderSheet,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: hasReminder
                        ? LinearGradient(
                            colors: [AppColors.primary.withOpacity(0.12), AppColors.primary.withOpacity(0.04)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    color: hasReminder ? null : AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: hasReminder ? AppColors.primary.withOpacity(0.24) : AppColors.border),
                  ),
                  child: Row(children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: hasReminder ? AppColors.primary.withOpacity(0.2) : AppColors.borderLight),
                      ),
                      child: Center(
                        child: SvgPicture.asset('assets/icons/bell-icon.svg', width: 21, height: 21,
                            colorFilter: ColorFilter.mode(hasReminder ? AppColors.primary : AppColors.textSecondary, BlendMode.srcIn)),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(hasReminder ? 'Reminder Active' : 'Set Reminder', style: _f(size: 14, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(_reminderSubtitle(), style: _f(size: 11, color: AppColors.textTertiary), maxLines: 2, overflow: TextOverflow.ellipsis),
                    ])),
                    SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 18, height: 18,
                        colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                  ]),
                ),
              ),
              const SizedBox(height: 14),

              // ─── Event Details Cards ───
              Row(children: [
                if (startDate.isNotEmpty)
                  Expanded(child: _detailCard('assets/icons/calendar-icon.svg', 'Date', _formatDate(startDate))),
                if (startDate.isNotEmpty && startTime.isNotEmpty) const SizedBox(width: 10),
                if (startTime.isNotEmpty)
                  Expanded(child: _detailCard('assets/icons/clock-icon.svg', 'Time', startTime)),
              ]),
              const SizedBox(height: 10),

              if (location.isNotEmpty || venue.isNotEmpty)
                GestureDetector(
                  onTap: () => _openLocationInMaps(location, venue, e),
                  child: _detailCard('assets/icons/location-icon.svg', 'Location',
                      [venue, location].where((s) => s.isNotEmpty).join(', ')),
                ),
              const SizedBox(height: 10),


              // ─── Description ───
              if (description.isNotEmpty) ...[
                _sectionCard('About This Event', description),
                const SizedBox(height: 14),
              ],

              // ─── Dress Code & Instructions ───
              if (dressCode.isNotEmpty || specialInstructions.isNotEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.borderLight),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (dressCode.isNotEmpty) ...[
                      Text('Dress Code', style: _f(size: 11, weight: FontWeight.w600, color: AppColors.textTertiary)),
                      const SizedBox(height: 4),
                      Text(dressCode, style: _f(size: 14, weight: FontWeight.w500)),
                      if (specialInstructions.isNotEmpty) const SizedBox(height: 14),
                    ],
                    if (specialInstructions.isNotEmpty) ...[
                      Text('Special Instructions', style: _f(size: 11, weight: FontWeight.w600, color: AppColors.textTertiary)),
                      const SizedBox(height: 4),
                      Text(specialInstructions, style: _f(size: 14, weight: FontWeight.w500)),
                    ],
                  ]),
                ),
              if (dressCode.isNotEmpty || specialInstructions.isNotEmpty) const SizedBox(height: 14),

              // ─── Schedule ───
              if (schedule.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.borderLight),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Event Schedule', style: _f(size: 15, weight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    ...schedule.map((item) {
                      final sTime = item['start_time']?.toString() ?? '';
                      final sTitle = item['title']?.toString() ?? '';
                      final sDesc = item['description']?.toString() ?? '';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SizedBox(
                            width: 60,
                            child: Text(sTime.length > 5 ? sTime.substring(0, 5) : sTime,
                                style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
                          ),
                          Container(width: 2, height: 36, margin: const EdgeInsets.only(right: 12),
                            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.2), borderRadius: BorderRadius.circular(1))),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(sTitle, style: _f(size: 13, weight: FontWeight.w600)),
                            if (sDesc.isNotEmpty) Text(sDesc, style: _f(size: 12, color: AppColors.textTertiary)),
                          ])),
                        ]),
                      );
                    }),
                  ]),
                ),
                const SizedBox(height: 14),
              ],
            ]),
          ),
        ),
      ],
    );
  }

  Widget _rsvpCard() {
    final statusColor = _rsvpStatus == 'confirmed'
        ? AppColors.success
        : _rsvpStatus == 'declined'
            ? AppColors.error
            : const Color(0xFFE6A817);

    final statusBg = _rsvpStatus == 'confirmed'
        ? AppColors.success.withOpacity(0.08)
        : _rsvpStatus == 'declined'
            ? AppColors.error.withOpacity(0.08)
            : const Color(0xFFE6A817).withOpacity(0.08);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withOpacity(0.25)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Your RSVP Status', style: _f(size: 11, weight: FontWeight.w600, color: AppColors.textTertiary)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(8)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(
                  _rsvpStatus == 'confirmed' ? Icons.check_circle_rounded
                      : _rsvpStatus == 'declined' ? Icons.cancel_rounded : Icons.schedule_rounded,
                  size: 14, color: statusColor,
                ),
                const SizedBox(width: 4),
                Text(
                  _rsvpStatus[0].toUpperCase() + _rsvpStatus.substring(1),
                  style: _f(size: 12, weight: FontWeight.w700, color: statusColor),
                ),
              ]),
            ),
          ])),
        ]),
        const SizedBox(height: 14),
        // Action buttons
        if (_rsvpStatus == 'pending')
          Row(children: [
            Expanded(
              child: _actionButton('Accept', AppColors.primary, Colors.white, Icons.check_circle_rounded,
                  () => _handleRSVP('confirmed')),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _actionButton('Decline', Colors.white, AppColors.error, Icons.cancel_rounded,
                  () => _handleRSVP('declined'), outlined: true),
            ),
          ]),
        if (_rsvpStatus == 'confirmed')
          _actionButton('Cancel RSVP', Colors.white, AppColors.error, Icons.cancel_rounded,
              () => _handleRSVP('declined'), outlined: true),
        if (_rsvpStatus == 'declined')
          _actionButton('Accept Instead', AppColors.primary, Colors.white, Icons.check_circle_rounded,
              () => _handleRSVP('confirmed')),
      ]),
    );
  }

  Widget _actionButton(String label, Color bg, Color fg, IconData icon, VoidCallback onTap, {bool outlined = false}) {
    return GestureDetector(
      onTap: _responding ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: outlined ? Colors.transparent : bg,
          borderRadius: BorderRadius.circular(12),
          border: outlined ? Border.all(color: fg.withOpacity(0.3), width: 1.5) : null,
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (_responding)
            SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: outlined ? fg : Colors.white))
          else ...[
            Icon(icon, size: 16, color: outlined ? fg : Colors.white),
            const SizedBox(width: 6),
            Text(label, style: _f(size: 13, weight: FontWeight.w700, color: outlined ? fg : Colors.white)),
          ],
        ]),
      ),
    );
  }

  Widget _detailCard(String svgIcon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
          child: Center(child: SvgPicture.asset(svgIcon, width: 18, height: 18,
              colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: _f(size: 11, color: AppColors.textTertiary, weight: FontWeight.w500)),
          const SizedBox(height: 2),
          Text(value, style: _f(size: 13, weight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
        ])),
      ]),
    );
  }

  Widget _detailCardIcon(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
          child: Center(child: Icon(icon, size: 18, color: AppColors.primary)),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: _f(size: 11, color: AppColors.textTertiary, weight: FontWeight.w500)),
          const SizedBox(height: 2),
          Text(value, style: _f(size: 13, weight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
        ])),
      ]),
    );
  }

  Widget _sectionCard(String title, String content) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: _f(size: 15, weight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(content, style: _f(size: 14, color: AppColors.textSecondary, height: 1.6)),
      ]),
    );
  }
}
