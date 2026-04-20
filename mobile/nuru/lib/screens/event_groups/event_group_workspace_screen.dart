import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/event_groups_service.dart';
import 'widgets/chat_panel.dart';
import 'widgets/scoreboard_panel.dart';
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
    _tabs = TabController(length: 2, vsync: this);
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

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final viewer = _group?['viewer'] is Map ? Map<String, dynamic>.from(_group!['viewer']) : null;
    final me = _members.cast<dynamic?>().firstWhere((m) => m is Map && m['id'] == viewer?['member_id'], orElse: () => null);
    final isAdmin = (viewer?['is_admin'] == true) || (viewer?['role'] == 'organizer') || (me != null && (me['is_admin'] == true || me['role'] == 'organizer'));
    final isClosed = _group?['is_closed'] == true;
    final imageUrl = _group?['image_url'] as String?;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        titleSpacing: 0,
        title: _loading
            ? const SizedBox.shrink()
            : Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primarySoft,
                      image: imageUrl != null
                          ? DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover)
                          : null,
                    ),
                    child: imageUrl == null
                        ? Center(child: Text(_initials(_group?['name'] ?? '?'),
                            style: GoogleFonts.plusJakartaSans(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12)))
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(children: [
                          Flexible(
                            child: Text(_group?['name'] ?? '',
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
                          ),
                          if (isClosed) Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: Icon(Icons.lock_outline, size: 12, color: AppColors.textTertiary),
                          ),
                        ]),
                        Text('${_members.length} member${_members.length != 1 ? 's' : ''}',
                            style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary)),
                      ],
                    ),
                  ),
                ],
              ),
        actions: [
          IconButton(
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
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [
            Tab(icon: Icon(Icons.chat_bubble_outline, size: 16), text: 'Chat'),
            Tab(icon: Icon(Icons.emoji_events_outlined, size: 16), text: 'Scoreboard'),
          ],
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
              ],
            ),
    );
  }
}
