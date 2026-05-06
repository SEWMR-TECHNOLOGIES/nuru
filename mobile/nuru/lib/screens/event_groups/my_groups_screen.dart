import '../../core/widgets/nuru_refresh_indicator.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/event_groups_service.dart';
import 'event_group_workspace_screen.dart';

class MyGroupsScreen extends StatefulWidget {
  const MyGroupsScreen({super.key});

  @override
  State<MyGroupsScreen> createState() => _MyGroupsScreenState();
}

class _MyGroupsScreenState extends State<MyGroupsScreen> {
  List<dynamic> _groups = [];
  bool _loading = true;
  String _search = '';
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final res = await EventGroupsService.listMyGroups(search: _search.isEmpty ? null : _search);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _groups = data is Map ? (data['groups'] ?? []) : [];
      }
    });
  }

  String _timeAgo(String? iso) {
    if (iso == null) return '';
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'now';
    if (diff.inHours < 1) return '${diff.inMinutes}m';
    if (diff.inDays < 1) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${d.day}/${d.month}';
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();
  }

  @override
  Widget build(BuildContext context) {
    final unread = _groups.fold<int>(0, (a, g) => a + ((g['unread_count'] ?? 0) as int));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('My Groups', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.textPrimary)),
            Text(
              unread > 0 ? '$unread unread' : 'All your event chat workspaces',
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              onChanged: (v) {
                _search = v;
                _load();
              },
              decoration: InputDecoration(
                hintText: 'Search groups…',
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
              ),
            ),
          ),
          Expanded(
            child: NuruRefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _groups.isEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            Icon(Icons.chat_bubble_outline, size: 56, color: AppColors.textTertiary.withOpacity(0.4)),
                            const SizedBox(height: 12),
                            Center(child: Text('No groups yet', style: GoogleFonts.inter(color: AppColors.textSecondary, fontWeight: FontWeight.w600))),
                            const SizedBox(height: 4),
                            Center(child: Text('Join an event to start chatting', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary))),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: _groups.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) => _groupCard(_groups[i]),
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _groupCard(Map g) {
    final lastMsg = g['last_message'] as Map?;
    final preview = lastMsg == null
        ? 'No messages yet'
        : (lastMsg['message_type'] == 'image' ? '📷 Image' : (lastMsg['content'] ?? '').toString());
    final unread = (g['unread_count'] ?? 0) as int;
    final closed = g['is_closed'] == true;
    final imageUrl = g['image_url'] as String?;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => EventGroupWorkspaceScreen(groupId: g['id']),
          )).then((_) => _load(silent: true));
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primarySoft,
                  image: imageUrl != null
                      ? DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover)
                      : null,
                ),
                child: imageUrl == null
                    ? Center(child: Text(_initials(g['name'] ?? '?'),
                        style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.w800)))
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                        child: Text(g['name'] ?? '',
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                      ),
                      if (closed) Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: Icon(Icons.lock_outline, size: 12, color: AppColors.textTertiary),
                      ),
                      const SizedBox(width: 6),
                      Text(_timeAgo(lastMsg?['created_at'] ?? g['created_at']),
                          style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary)),
                    ]),
                    const SizedBox(height: 2),
                    Row(children: [
                      Expanded(
                        child: Text(preview,
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
                      ),
                      if (unread > 0) Container(
                        margin: const EdgeInsets.only(left: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                        constraints: const BoxConstraints(minWidth: 20),
                        child: Text(unread > 99 ? '99+' : '$unread',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Row(children: [
                      Icon(Icons.group_outlined, size: 12, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Text('${g['member_count'] ?? 0}', style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary)),
                      if (g['event_name'] != null) ...[
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text('· ${g['event_name']}',
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary)),
                        ),
                      ],
                    ]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
