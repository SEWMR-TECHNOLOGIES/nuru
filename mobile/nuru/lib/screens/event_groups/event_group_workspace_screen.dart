import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/event_groups_service.dart';
import '../../core/widgets/app_snackbar.dart';
import 'widgets/chat_panel.dart';
import 'widgets/scoreboard_panel.dart';
import 'widgets/analytics_panel.dart';
import 'widgets/members_sheet.dart';

/// Premium event group workspace — Chat + Scoreboard tabs.
class EventGroupWorkspaceScreen extends StatefulWidget {
  final String groupId;
  const EventGroupWorkspaceScreen({super.key, required this.groupId});

  @override
  State<EventGroupWorkspaceScreen> createState() => _EventGroupWorkspaceScreenState();
}

class _EventGroupWorkspaceScreenState extends State<EventGroupWorkspaceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  Map<String, dynamic>? _group;
  List<dynamic> _members = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      EventGroupsService.getGroup(widget.groupId),
      EventGroupsService.members(widget.groupId),
    ]);
    if (!mounted) return;
    setState(() {
      _loading = false;
      final g = results[0];
      if (g['success'] == true && g['data'] is Map) {
        _group = Map<String, dynamic>.from(g['data']);
      }
      final m = results[1];
      if (m['success'] == true) {
        final data = m['data'];
        _members = data is Map ? (data['members'] ?? []) : [];
      }
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _copyInviteLink() async {
    final res = await EventGroupsService.createInvite(widget.groupId);
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final token = (res['data']['token'] ?? '').toString();
      if (token.isEmpty) {
        AppSnackbar.error(context, 'Could not create invite link');
        return;
      }
      // Mirror the web origin so links open the same group on either platform.
      final url = 'https://nuru.tz/g/$token';
      await Clipboard.setData(ClipboardData(text: url));
      if (!mounted) return;
      AppSnackbar.success(context, 'Invite link copied');
    } else {
      AppSnackbar.error(context, (res['message'] ?? 'Could not create invite link').toString());
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();
  }

  Widget _eventChip(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFEDEDF2)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: AppColors.textSecondary),
        const SizedBox(width: 5),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 200),
          child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        ),
      ]),
    );
  }

  Widget _pillTab(String? svg, String label, int index, {IconData? fallbackIcon}) {
    return AnimatedBuilder(
      animation: _tabs,
      builder: (_, __) {
        final active = _tabs.index == index;
        final color = active ? AppColors.primary : AppColors.textSecondary;
        return Tab(
          height: 38,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (svg != null)
                SvgPicture.asset(svg, width: 14, height: 14,
                    colorFilter: ColorFilter.mode(color, BlendMode.srcIn))
              else
                Icon(fallbackIcon, size: 14, color: color),
              const SizedBox(width: 6),
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final viewer = _group?['viewer'] is Map ? Map<String, dynamic>.from(_group!['viewer']) : null;
    final me = _members.cast<dynamic?>().firstWhere((m) => m is Map && m['id'] == viewer?['member_id'], orElse: () => null);
    final isAdmin = (viewer?['is_admin'] == true) || (viewer?['role'] == 'organizer') || (me != null && (me['is_admin'] == true || me['role'] == 'organizer'));
    // Live event status — derived from the current event end date so that
    // rescheduling the event forward immediately reopens the chat instead of
    // staying locked on the stale `is_closed` flag captured at creation time.
    final eventEndIso = (_group?['event'] is Map
            ? (_group!['event']['end_date'] ?? _group!['event']['start_date'])
            : null) ??
        _group?['event_end_date'] ??
        _group?['event_start_date'];
    DateTime? eventEnd;
    if (eventEndIso is String && eventEndIso.isNotEmpty) {
      try { eventEnd = DateTime.parse(eventEndIso).toLocal(); } catch (_) {}
    }
    final eventEnded = eventEnd != null && eventEnd.isBefore(DateTime.now());
    final manualClosed = _group?['is_closed'] == true;
    // Manual close only applies when there's no event date to derive from.
    final isClosed = eventEnded || (manualClosed && eventEnd == null);
    final imageUrl = _group?['image_url'] as String?;

    final eventMap = _group?['event'] is Map ? Map<String, dynamic>.from(_group!['event']) : <String, dynamic>{};
    final eventLocation = (eventMap['location'] ?? _group?['event_location'] ?? '').toString();
    String eventDateLabel = '';
    if (eventEnd != null) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      eventDateLabel = '${months[eventEnd.month - 1]} ${eventEnd.day}, ${eventEnd.year}';
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F8),
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        surfaceTintColor: AppColors.surface,
        titleSpacing: 0,
        title: _loading
            ? const SizedBox.shrink()
            : InkWell(
                onTap: () => showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => MembersSheet(
                    groupId: widget.groupId,
                    isAdmin: isAdmin,
                    onChanged: _load,
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 40, height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: imageUrl == null
                              ? LinearGradient(
                                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                                  colors: [AppColors.primarySoft, AppColors.primary.withOpacity(0.25)],
                                )
                              : null,
                          image: imageUrl != null
                              ? DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover)
                              : null,
                          boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.18), blurRadius: 8, offset: const Offset(0, 2))],
                        ),
                        child: imageUrl == null
                            ? Center(child: Text(_initials(_group?['name'] ?? '?'),
                                style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 13)))
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(children: [
                              Flexible(
                                child: Text(_group?['name'] ?? '',
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary, letterSpacing: -0.2)),
                              ),
                              if (isClosed) Padding(
                                padding: const EdgeInsets.only(left: 6),
                                child: Icon(Icons.lock_outline, size: 13, color: AppColors.textTertiary),
                              ),
                            ]),
                            const SizedBox(height: 1),
                            Row(children: [
                              if (eventEnded)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  margin: const EdgeInsets.only(right: 6),
                                  decoration: BoxDecoration(
                                    color: AppColors.textTertiary.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text('Ended',
                                      style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.textSecondary, letterSpacing: 0.5)),
                                ),
                              Text('${_members.length} member${_members.length != 1 ? 's' : ''}',
                                  style: GoogleFonts.inter(fontSize: 11.5, color: AppColors.textTertiary, fontWeight: FontWeight.w500)),
                            ]),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
        actions: [
          if (isAdmin && !isClosed)
            IconButton(
              tooltip: 'Copy invite link',
              onPressed: () => _copyInviteLink(),
              icon: SvgPicture.asset(
                'assets/icons/share-icon.svg',
                width: 20, height: 20,
                colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
              ),
            ),
          IconButton(
            tooltip: 'Members',
            onPressed: () => showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => MembersSheet(
                groupId: widget.groupId,
                isAdmin: isAdmin,
                onChanged: _load,
              ),
            ),
            icon: const Icon(Icons.people_outline),
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: Size.fromHeight((eventDateLabel.isNotEmpty || eventLocation.isNotEmpty) ? 92 : 52),
          child: Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (eventDateLabel.isNotEmpty || eventLocation.isNotEmpty) Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SizedBox(
                  height: 30,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.zero,
                    children: [
                      if (eventDateLabel.isNotEmpty) _eventChip(Icons.calendar_today_outlined, eventDateLabel),
                      if (eventDateLabel.isNotEmpty && eventLocation.isNotEmpty) const SizedBox(width: 6),
                      if (eventLocation.isNotEmpty) _eventChip(Icons.location_on_outlined, eventLocation),
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFEFF3),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: TabBar(
                  controller: _tabs,
                  indicator: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 6, offset: const Offset(0, 2))],
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.textSecondary,
                  labelStyle: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 12.5, letterSpacing: -0.1),
                  unselectedLabelStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 12.5),
                  padding: EdgeInsets.zero,
                  labelPadding: EdgeInsets.zero,
                  tabs: [
                    _pillTab('assets/icons/group-chat-icon.svg', 'Chat', 0),
                    _pillTab('assets/icons/contributors-icon.svg', 'Contributors', 1),
                    _pillTab(null, 'Analytics', 2, fallbackIcon: Icons.insights_outlined),
                  ],
                ),
              ),
            ]),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                ChatPanel(
                  groupId: widget.groupId,
                  meMemberId: me?['id'],
                  isClosed: isClosed,
                ),
                ScoreboardPanel(groupId: widget.groupId),
                AnalyticsPanel(groupId: widget.groupId),
              ],
            ),
    );
  }
}
