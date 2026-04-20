import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/event_groups_service.dart';

class MembersSheet extends StatefulWidget {
  final String groupId;
  final bool isAdmin;
  final VoidCallback? onChanged;
  const MembersSheet({super.key, required this.groupId, required this.isAdmin, this.onChanged});

  @override
  State<MembersSheet> createState() => _MembersSheetState();
}

class _MembersSheetState extends State<MembersSheet> {
  List<dynamic> _members = [];
  bool _loading = true;
  bool _syncing = false;
  String _search = '';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventGroupsService.members(widget.groupId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        _members = res['data'] is Map ? (res['data']['members'] ?? []) : [];
      }
    });
  }

  Future<void> _sync() async {
    setState(() => _syncing = true);
    await EventGroupsService.syncMembers(widget.groupId);
    setState(() => _syncing = false);
    await _load();
    widget.onChanged?.call();
  }

  Future<void> _copyInvite(Map m) async {
    final res = await EventGroupsService.createInvite(widget.groupId,
        contributorId: m['contributor_id'], phone: m['guest_phone'], name: m['display_name']);
    if (res['success'] == true && res['data'] is Map) {
      final token = res['data']['token'];
      // mobile uses the web origin — let users paste/share the link
      final url = 'https://nuru-pay-spark.lovable.app/g/$token';
      await Clipboard.setData(ClipboardData(text: url));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Invite link copied')));
      }
    }
  }

  String _initials(String n) =>
      n.trim().split(RegExp(r'\s+')).take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();

  @override
  Widget build(BuildContext context) {
    final filtered = _members.where((m) =>
        _search.isEmpty || (m['display_name'] ?? '').toString().toLowerCase().contains(_search.toLowerCase())).toList();
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 36, height: 4, margin: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Row(children: [
            Text('Members (${_members.length})',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 16)),
            const Spacer(),
            if (widget.isAdmin)
              TextButton.icon(
                onPressed: _syncing ? null : _sync,
                icon: _syncing
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.refresh, size: 16),
                label: const Text('Sync'),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search members…',
              prefixIcon: const Icon(Icons.search, size: 18),
              isDense: true,
              filled: true, fillColor: AppColors.surfaceVariant,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 16),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final m = filtered[i];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primarySoft,
                        backgroundImage: m['avatar_url'] != null ? NetworkImage(m['avatar_url']) : null,
                        child: m['avatar_url'] == null
                            ? Text(_initials(m['display_name'] ?? '?'),
                                style: GoogleFonts.plusJakartaSans(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 12))
                            : null,
                      ),
                      title: Text(m['display_name'] ?? '',
                          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 14)),
                      subtitle: Wrap(spacing: 4, children: [
                        if (m['role'] != null) _chip(m['role'], AppColors.textSecondary),
                        if (m['is_admin'] == true) _chip('admin', AppColors.primary, filled: true),
                        if (m['user_id'] == null) _chip('guest', AppColors.textTertiary),
                      ]),
                      trailing: widget.isAdmin
                          ? IconButton(
                              tooltip: 'Copy invite link',
                              icon: const Icon(Icons.link, size: 18),
                              onPressed: () => _copyInvite(m),
                            )
                          : null,
                    );
                  },
                ),
        ),
      ]),
    );
  }

  Widget _chip(String label, Color c, {bool filled = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: filled ? c.withOpacity(0.15) : Colors.transparent,
        border: Border.all(color: c.withOpacity(filled ? 0.3 : 0.4)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label,
          style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w600, color: c)),
    );
  }
}
