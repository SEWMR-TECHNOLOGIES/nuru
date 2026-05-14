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
import '../../core/utils/event_groups_cache.dart';

/// Premium event group workspace — Chat / Contributors / Analytics tabs.
///
/// Visual: header with title + subtitle, hero card showing the event, then a
/// pill-tab row. Body switches between the three panels. Every existing
/// handler (invite link, members sheet, isClosed lock, admin checks) is kept.
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
    // Seed from cache so the screen renders instantly on re-entry — the
    // background fetch below then refreshes silently.
    final cachedGroup = EventGroupsCache.getGroup(widget.groupId);
    final cachedMembers = EventGroupsCache.getMembers(widget.groupId);
    if (cachedGroup != null) {
      _group = cachedGroup;
      _members = cachedMembers ?? [];
      _loading = false;
    }
    _load(silent: cachedGroup != null);
  }

  Future<void> _load({bool silent = false}) async {
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
        EventGroupsCache.putGroup(widget.groupId, _group!);
      }
      final m = results[1];
      if (m['success'] == true) {
        final data = m['data'];
        _members = data is Map ? (data['members'] ?? []) : [];
        EventGroupsCache.putMembers(widget.groupId, _members);
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

  bool _membersOpen = false;

  void _openMembers({required bool isAdmin}) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _membersOpen = true);
  }

  void _closeMembers() {
    setState(() => _membersOpen = false);
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();
  }

  // ─── Tab pill (label only, no icons) ───
  Widget _pillTab(String label, int index) {
    return AnimatedBuilder(
      animation: _tabs,
      builder: (_, __) {
        final active = _tabs.index == index;
        final fg = active ? Colors.white : AppColors.primary;
        return GestureDetector(
          onTap: () => _tabs.animateTo(index),
          behavior: HitTestBehavior.opaque,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            decoration: BoxDecoration(
              color: active ? AppColors.primary : Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppColors.primary.withOpacity(active ? 0 : 0.55), width: 1.2),
              boxShadow: active
                  ? [BoxShadow(color: AppColors.primary.withOpacity(0.30), blurRadius: 12, offset: const Offset(0, 4))]
                  : null,
            ),
            child: Text(label,
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700, fontSize: 13, color: fg, letterSpacing: -0.1)),
          ),
        );
      },
    );
  }

  // ─── Header right-side icon button (no circle border per mockup) ───
  Widget _headerIcon({required Widget child, required VoidCallback onTap, String? tooltip}) {
    final btn = Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Container(
          width: 36, height: 36,
          alignment: Alignment.center,
          child: child,
        ),
      ),
    );
    return tooltip == null ? btn : Tooltip(message: tooltip, child: btn);
  }

  void _openNotifications() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2)))),
            Text('Notifications',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            Text('You\'re all caught up — no new notifications for this group.',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary)),
          ]),
        ),
      ),
    );
  }

  void _showOverflowMenu({required bool isAdmin, required bool isClosed}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
            if (isAdmin && !isClosed)
              ListTile(
                leading: SvgPicture.asset('assets/icons/share-icon.svg',
                    width: 20, height: 20,
                    colorFilter: ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                title: Text('Copy invite link', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                onTap: () { Navigator.pop(context); _copyInviteLink(); },
              ),
            ListTile(
              leading: SvgPicture.asset('assets/icons/contributors-icon.svg',
                  width: 20, height: 20,
                  colorFilter: ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
              title: Text('Members', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () { Navigator.pop(context); _openMembers(isAdmin: isAdmin); },
            ),
            ListTile(
              leading: const Icon(Icons.refresh, color: AppColors.textPrimary),
              title: Text('Refresh', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () { Navigator.pop(context); _load(); },
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final viewer = _group?['viewer'] is Map ? Map<String, dynamic>.from(_group!['viewer']) : null;
    final me = _members.cast<dynamic?>().firstWhere(
        (m) => m is Map && m['id'] == viewer?['member_id'],
        orElse: () => null);
    final isAdmin = (viewer?['is_admin'] == true) ||
        (viewer?['role'] == 'organizer') ||
        (me != null && (me['is_admin'] == true || me['role'] == 'organizer'));
    // Live event status — derived from the current event end date so that
    // rescheduling the event forward immediately reopens the chat.
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
    final isClosed = eventEnded || (manualClosed && eventEnd == null);

    final groupName = (_group?['name'] ?? '').toString();
    final imageUrl = _group?['image_url'] as String?;
    final eventMap = _group?['event'] is Map ? Map<String, dynamic>.from(_group!['event']) : <String, dynamic>{};
    final eventName = (eventMap['name'] ?? eventMap['title'] ?? groupName).toString();
    String eventDateLabel = '';
    if (eventEnd != null) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      eventDateLabel = '${eventEnd.day} ${months[eventEnd.month - 1]} ${eventEnd.year}';
    }
    final memberCount = _members.length;
    final adminCount = _members.where((m) => m is Map && (m['is_admin'] == true || m['role'] == 'organizer')).length;
    final memberSubtitle = '$memberCount member${memberCount != 1 ? 's' : ''}'
        + (adminCount > 0 ? '  •  $adminCount admin${adminCount != 1 ? 's' : ''}' : '');

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(children: [
                // ─── Header row ───
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 12, 4),
                  child: Row(children: [
                    IconButton(
                      onPressed: () => Navigator.maybePop(context),
                      icon: SvgPicture.asset('assets/icons/arrow-left-icon.svg',
                          width: 22, height: 22,
                          colorFilter: ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                    ),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Flexible(
                            child: Text(groupName.isNotEmpty ? groupName : 'Event group',
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                    fontSize: 16, fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary, letterSpacing: -0.3)),
                          ),
                          if (isClosed) Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: Icon(Icons.lock_outline, size: 13, color: AppColors.textTertiary),
                          ),
                        ]),
                        const SizedBox(height: 1),
                        Text('Event group',
                            style: GoogleFonts.inter(
                                fontSize: 11, color: AppColors.textTertiary, fontWeight: FontWeight.w500)),
                      ]),
                    ),
                    _headerIcon(
                      tooltip: 'Notifications',
                      onTap: _openNotifications,
                      child: SvgPicture.asset('assets/icons/bell-icon.svg',
                          width: 20, height: 20,
                          colorFilter: ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                    ),
                    const SizedBox(width: 2),
                    _headerIcon(
                      tooltip: 'More',
                      onTap: () => _showOverflowMenu(isAdmin: isAdmin, isClosed: isClosed),
                      child: Icon(Icons.more_horiz_rounded, size: 22, color: AppColors.textPrimary),
                    ),
                  ]),
                ),
                const SizedBox(height: 4),

                // ─── Hero card ───
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.borderLight),
                      boxShadow: AppColors.subtleShadow,
                    ),
                    child: Row(children: [
                      Container(
                        width: 56, height: 56,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          gradient: imageUrl == null
                              ? LinearGradient(
                                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                                  colors: [AppColors.primarySoft, AppColors.primary.withOpacity(0.22)],
                                )
                              : null,
                          image: imageUrl != null
                              ? DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover)
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: imageUrl == null
                            ? Text(_initials(eventName.isNotEmpty ? eventName : 'E'),
                                style: GoogleFonts.inter(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16))
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(eventName,
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w800, fontSize: 15,
                                  color: AppColors.textPrimary, letterSpacing: -0.2)),
                          if (eventDateLabel.isNotEmpty) Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(children: [
                              SvgPicture.asset('assets/icons/calendar-icon.svg',
                                  width: 12, height: 12,
                                  colorFilter: ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(eventDateLabel,
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.inter(
                                        fontSize: 12, color: AppColors.textSecondary,
                                        fontWeight: FontWeight.w600)),
                              ),
                            ]),
                          ),
                          const SizedBox(height: 2),
                          Text(memberSubtitle,
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                  fontSize: 11.5, color: AppColors.textTertiary,
                                  fontWeight: FontWeight.w500)),
                        ]),
                      ),
                      const SizedBox(width: 8),
                      // Members pill button
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(22),
                          onTap: () => _openMembers(isAdmin: isAdmin),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(color: AppColors.primary, width: 1.2),
                            ),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              SvgPicture.asset('assets/icons/users-icon.svg',
                                  width: 14, height: 14,
                                  colorFilter: ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                              const SizedBox(width: 6),
                              Text('Members',
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w500, fontSize: 12.5,
                                      color: AppColors.primary)),
                            ]),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),

                // ─── Pill tabs (no icons) ───
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                  child: Row(children: [
                    _pillTab('Chat', 0),
                    const SizedBox(width: 8),
                    _pillTab('Contributors', 1),
                    const SizedBox(width: 8),
                    _pillTab('Analytics', 2),
                  ]),
                ),

                // ─── Body ───
                Expanded(
                  child: Stack(children: [
                    AnimatedBuilder(
                      animation: _tabs,
                      builder: (_, __) => IndexedStack(
                        index: _tabs.index,
                        children: [
                          ChatPanel(
                            groupId: widget.groupId,
                            meMemberId: me is Map ? me['id'] : null,
                            isClosed: isClosed,
                          ),
                          ScoreboardPanel(groupId: widget.groupId),
                          AnalyticsPanel(groupId: widget.groupId),
                        ],
                      ),
                    ),
                    // ─── Members side panel — floating overlay (~62% width) ───
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 240),
                      curve: Curves.easeOutCubic,
                      top: 0,
                      bottom: 0,
                      right: _membersOpen
                          ? 0
                          : -(MediaQuery.of(context).size.width * 0.62),
                      width: MediaQuery.of(context).size.width * 0.62,
                      child: Material(
                        color: Colors.transparent,
                        elevation: 0,
                        child: Container(
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.only(topLeft: Radius.circular(22)),
                            boxShadow: [
                              BoxShadow(color: Color(0x1A000000), blurRadius: 24, offset: Offset(-6, 0)),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: _membersOpen
                              ? MembersSheet(
                                  groupId: widget.groupId,
                                  isAdmin: isAdmin,
                                  onChanged: _load,
                                  embedded: true,
                                  onClose: _closeMembers,
                                )
                              : const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ]),
                ),
                // Persistent composer mock on Contributors / Analytics tabs —
                // tapping it jumps to the Chat tab so the message input is
                // never visually missing across the workspace.
                AnimatedBuilder(
                  animation: _tabs,
                  builder: (_, __) {
                    if (_tabs.index == 0) return const SizedBox.shrink();
                    return _composerMock();
                  },
                ),
              ]),
      ),
    );
  }

  Widget _composerMock() {
    const navy = Color(0xFF0A1C40);
    const hintBlueGrey = Color(0xFF8E9BB0);
    final sendGold = AppColors.primary;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 12 + MediaQuery.of(context).padding.bottom),
      child: GestureDetector(
        onTap: () => _tabs.animateTo(0),
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: AppColors.border, width: 1),
            boxShadow: const [
              BoxShadow(color: Color(0x14000000), blurRadius: 22, offset: Offset(0, 6)),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(8, 6, 6, 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Padding(
              padding: const EdgeInsets.all(10),
              child: SvgPicture.asset('assets/icons/attach-icon.svg',
                  width: 22, height: 22,
                  colorFilter: const ColorFilter.mode(navy, BlendMode.srcIn)),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
                child: Text('Message the group...',
                    style: GoogleFonts.inter(
                        fontSize: 15.5, color: hintBlueGrey, fontWeight: FontWeight.w500)),
              ),
            ),
            const SizedBox(width: 4),
            Container(
              width: 54, height: 54,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: sendGold.withOpacity(0.55),
              ),
              alignment: Alignment.center,
              child: SvgPicture.asset('assets/icons/send-icon.svg',
                  width: 22, height: 22,
                  colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
            ),
          ]),
        ),
      ),
    );
  }
}
