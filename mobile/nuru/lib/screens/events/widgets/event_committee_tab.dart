import '../../../core/widgets/nuru_refresh_indicator.dart';
import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/report_generator.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../report_preview_screen.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';

/// Mirrors web EventCommittee.tsx — user search, role picker, permissions, edit/remove
class EventCommitteeTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTitle;

  const EventCommitteeTab({super.key, required this.eventId, this.permissions, this.eventTitle});

  @override
  State<EventCommitteeTab> createState() => _EventCommitteeTabState();
}

class _EventCommitteeTabState extends State<EventCommitteeTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> _members = [];
  bool _loading = true;

  bool get _canManage => widget.permissions?['can_manage_committee'] == true || widget.permissions?['is_creator'] == true;

  @override
  bool get wantKeepAlive => true;

  static const List<Map<String, String>> _roles = [
    {'id': 'coordinator', 'name': 'Event Coordinator', 'desc': 'Oversees all event planning and execution'},
    {'id': 'finance', 'name': 'Finance Manager', 'desc': 'Manages budget, contributions and payments'},
    {'id': 'guest_manager', 'name': 'Guest Manager', 'desc': 'Handles guest list and invitations'},
    {'id': 'vendor_liaison', 'name': 'Vendor Liaison', 'desc': 'Coordinates with service providers'},
    {'id': 'decorator', 'name': 'Decor Coordinator', 'desc': 'Manages decorations and setup'},
    {'id': 'catering', 'name': 'Catering Manager', 'desc': 'Handles food and beverages'},
    {'id': 'entertainment', 'name': 'Entertainment Lead', 'desc': 'Manages music, MC and activities'},
    {'id': 'logistics', 'name': 'Logistics Coordinator', 'desc': 'Handles transport and venue setup'},
    {'id': 'custom', 'name': 'Custom Role', 'desc': 'Define a custom role'},
  ];

  static const List<Map<String, String>> _availablePermissions = [
    {'id': 'manage_guests', 'label': 'Manage Guests', 'desc': 'Add, edit, remove guests'},
    {'id': 'send_invitations', 'label': 'Send Invitations', 'desc': 'Send invitations to guests'},
    {'id': 'checkin_guests', 'label': 'Check-in Guests', 'desc': 'Check in guests at event'},
    {'id': 'view_contributions', 'label': 'View Contributions', 'desc': 'See contribution details'},
    {'id': 'manage_contributions', 'label': 'Manage Contributions', 'desc': 'Record and edit contributions'},
    {'id': 'manage_budget', 'label': 'Manage Budget', 'desc': 'Edit budget items'},
    {'id': 'manage_schedule', 'label': 'Manage Schedule', 'desc': 'Edit event schedule'},
    {'id': 'manage_vendors', 'label': 'Manage Vendors', 'desc': 'Handle service bookings'},
    {'id': 'edit_event', 'label': 'Edit Event Details', 'desc': 'Change event information'},
    {'id': 'view_expenses', 'label': 'View Expenses', 'desc': 'See expense reports'},
    {'id': 'manage_expenses', 'label': 'Manage Expenses', 'desc': 'Record and edit expenses'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getCommittee(widget.eventId);
    if (mounted) setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _members = data is List ? data : (data is Map ? (data['members'] ?? data['items'] ?? []) : []);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    return NuruRefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: _members.isEmpty ? _emptyState() : _memberList(),
    );
  }

  Widget _emptyState() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 60),
        Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(20)),
            child: const Icon(Icons.people_outline_rounded, size: 28, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text('No committee members yet', style: appText(size: 15, weight: FontWeight.w600, color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          Text('Add team members to help plan your event', style: appText(size: 13, color: AppColors.textTertiary), textAlign: TextAlign.center),
          if (_canManage) ...[
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => _showAddMemberSheet(),
              icon: const Icon(Icons.person_add_rounded, size: 18),
              label: Text('Add First Member', style: appText(size: 14, weight: FontWeight.w600, color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ])),
      ],
    );
  }

  Widget _memberList() {
    return Stack(children: [
      ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        children: [
          // Report button
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: OutlinedButton.icon(
              onPressed: _generateReport,
              icon: const Icon(Icons.description_rounded, size: 16),
              label: Text('Committee Report', style: appText(size: 12, weight: FontWeight.w600)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          ..._members.map((m) => _memberCard(m as Map<String, dynamic>)),
        ],
      ),
      if (_canManage)
        Positioned(
          right: 16, bottom: 24,
          child: FloatingActionButton.extended(
            onPressed: _showAddMemberSheet,
            backgroundColor: AppColors.primary, foregroundColor: Colors.white,
            icon: const Icon(Icons.person_add_rounded, size: 20),
            label: Text('Add Member', style: appText(size: 13, weight: FontWeight.w700, color: Colors.white)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
    ]);
  }

  Widget _memberCard(Map<String, dynamic> member) {
    final name = '${member['first_name'] ?? member['name'] ?? ''} ${member['last_name'] ?? ''}'.trim();
    final role = (member['role'] ?? member['committee_role'] ?? '').toString();
    final email = member['email']?.toString();
    final phone = member['phone']?.toString();
    final avatar = member['avatar']?.toString();
    final status = (member['status'] ?? 'active').toString();
    final memberId = member['id']?.toString() ?? '';

    // Normalize permissions
    final perms = member['permissions'];
    List<String> permList = [];
    if (perms is List) {
      permList = perms.cast<String>();
    } else if (perms is Map) {
      perms.forEach((k, v) { if (v == true) permList.add(k.toString()); });
    }

    final statusColor = status == 'active' ? const Color(0xFF16A34A) : status == 'invited' ? const Color(0xFFCA8A04) : AppColors.error;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CircleAvatar(
            radius: 22, backgroundColor: AppColors.primarySoft,
            backgroundImage: avatar != null ? NetworkImage(avatar) : null,
            child: avatar == null ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: appText(size: 16, weight: FontWeight.w700, color: AppColors.primary)) : null,
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name.isNotEmpty ? name : 'Unknown', style: appText(size: 14, weight: FontWeight.w600)),
            if (role.isNotEmpty) Text(role, style: appText(size: 12, color: AppColors.primary, weight: FontWeight.w600)),
          ])),
          if (_canManage)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20, color: AppColors.textHint),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              onSelected: (val) {
                if (val == 'edit') _showEditMemberSheet(member);
                if (val == 'remove') _confirmRemove(memberId, name);
                if (val == 'resend') _resendInvite(memberId);
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: ListTile(dense: true, leading: Icon(Icons.edit, size: 18), title: Text('Edit'))),
                if (status == 'invited')
                  const PopupMenuItem(value: 'resend', child: ListTile(dense: true, leading: Icon(Icons.send, size: 18), title: Text('Resend Invite'))),
                PopupMenuItem(value: 'remove', child: ListTile(dense: true, leading: Icon(Icons.delete, size: 18, color: AppColors.error), title: Text('Remove', style: TextStyle(color: AppColors.error)))),
              ],
            ),
        ]),
        const SizedBox(height: 10),
        // Contact info
        if (email != null && email.isNotEmpty)
          _contactRow(Icons.email_outlined, email),
        if (phone != null && phone.isNotEmpty)
          _contactRow(Icons.phone_outlined, phone),
        const SizedBox(height: 8),
        // Status + permissions
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Text(status[0].toUpperCase() + status.substring(1), style: appText(size: 10, weight: FontWeight.w700, color: statusColor)),
          ),
          const SizedBox(width: 8),
          if (permList.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(8)),
              child: Text('${permList.length} permission${permList.length != 1 ? 's' : ''}', style: appText(size: 10, weight: FontWeight.w600, color: AppColors.primary)),
            ),
        ]),
      ]),
    );
  }

  Widget _contactRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(children: [
        Icon(icon, size: 14, color: AppColors.textHint),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: appText(size: 12, color: AppColors.textTertiary), overflow: TextOverflow.ellipsis)),
      ]),
    );
  }

  // ADD MEMBER — matches web: user search, role picker, permissions

  void _showAddMemberSheet() {
    Map<String, dynamic>? selectedUser;
    String searchQuery = '';
    List<dynamic> searchResults = [];
    bool searching = false;
    String selectedRoleId = '';
    String customRole = '';
    List<String> selectedPerms = [];
    bool sendInvitation = true;
    Timer? debounce;
    bool submitting = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          void searchUsers(String q) {
            debounce?.cancel();
            if (q.trim().length < 2) { setSheetState(() { searchResults = []; searching = false; }); return; }
            setSheetState(() => searching = true);
              debounce = Timer(const Duration(milliseconds: 400), () async {
              final res = await EventsService.searchUsers(q.trim());
              if (ctx.mounted) setSheetState(() {
                searching = false;
                if (res['success'] == true) {
                  final data = res['data'];
                  final rawList = data is List ? data : (data is Map ? (data['items'] ?? data['users'] ?? data['results'] ?? []) : []);
                  // Normalize user fields — API may return full_name instead of first_name/last_name
                  searchResults = (rawList is List ? rawList : []).map((u) {
                    if (u is! Map) return u;
                    final m = Map<String, dynamic>.from(u);
                    // Ensure first_name / last_name exist (split full_name if needed)
                    if ((m['first_name'] == null || m['first_name'] == '') && m['full_name'] != null) {
                      final parts = (m['full_name'] as String).split(' ');
                      m['first_name'] = parts.first;
                      m['last_name'] = parts.length > 1 ? parts.sublist(1).join(' ') : '';
                    }
                    return m;
                  }).toList();
                } else {
                  searchResults = [];
                }
              });
            });
          }

          return DraggableScrollableSheet(
            expand: false, initialChildSize: 0.85, maxChildSize: 0.95, minChildSize: 0.5,
            builder: (_, scrollCtrl) => Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
              child: ListView(controller: scrollCtrl, children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                Text('Add Committee Member', style: appText(size: 18, weight: FontWeight.w700)),
                const SizedBox(height: 20),

                // User search
                Text('Search User *', style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 8),
                if (selectedUser != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 18, backgroundColor: AppColors.primary.withOpacity(0.2),
                        backgroundImage: selectedUser!['avatar'] != null ? NetworkImage(selectedUser!['avatar']) : null,
                        child: selectedUser!['avatar'] == null ? Text((selectedUser!['first_name'] ?? 'U')[0].toUpperCase(), style: appText(size: 14, weight: FontWeight.w700, color: AppColors.primary)) : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${selectedUser!['first_name'] ?? ''} ${selectedUser!['last_name'] ?? ''}'.trim(), style: appText(size: 14, weight: FontWeight.w600)),
                        if (selectedUser!['email'] != null) Text(selectedUser!['email'], style: appText(size: 11, color: AppColors.textTertiary)),
                      ])),
                      GestureDetector(
                        onTap: () => setSheetState(() { selectedUser = null; searchQuery = ''; searchResults = []; }),
                        child: Text('Change', style: appText(size: 12, weight: FontWeight.w600, color: AppColors.primary)),
                      ),
                    ]),
                  )
                else ...[
                  TextField(
                    onChanged: (v) { searchQuery = v; searchUsers(v); },
                    style: appText(size: 14),
                    decoration: InputDecoration(
                      hintText: 'Search by name, email or phone...', hintStyle: appText(size: 13, color: AppColors.textHint),
                      prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textHint),
                      suffixIcon: searching ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))) : null,
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: const Color(0xFFE5E7EB), width: 1)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                  if (searchResults.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      constraints: const BoxConstraints(maxHeight: 180),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: searchResults.length,
                        itemBuilder: (_, i) {
                          final u = searchResults[i] as Map<String, dynamic>;
                          final name = (u['full_name'] ?? '${u['first_name'] ?? ''} ${u['last_name'] ?? ''}'.trim()).toString();
                          final subtitle = [
                            if (u['username'] != null && u['username'] != '') '@${u['username']}',
                            if (u['email'] != null && u['email'] != '') u['email'],
                            if (u['phone'] != null && u['phone'] != '') u['phone'],
                          ].join(' · ');
                          return ListTile(
                            dense: true,
                            leading: CircleAvatar(radius: 16, backgroundColor: AppColors.primarySoft,
                              backgroundImage: u['avatar'] != null ? NetworkImage(u['avatar']) : null,
                              child: u['avatar'] == null ? Text((name.isNotEmpty ? name[0] : 'U').toUpperCase(), style: appText(size: 12, weight: FontWeight.w700, color: AppColors.primary)) : null,
                            ),
                            title: Text(name.isNotEmpty ? name : 'Unknown User', style: appText(size: 13, weight: FontWeight.w600)),
                            subtitle: subtitle.isNotEmpty ? Text(subtitle, style: appText(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis) : null,
                            onTap: () => setSheetState(() { selectedUser = u; searchResults = []; }),
                          );
                        },
                      ),
                    ),
                ],

                const SizedBox(height: 18),

                // Role picker
                Text('Role *', style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                  child: DropdownButtonFormField<String>(
                    value: selectedRoleId.isEmpty ? null : selectedRoleId,
                    decoration: InputDecoration(
                      border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      hintText: 'Select a role', hintStyle: appText(size: 14, color: AppColors.textHint),
                    ),
                    style: appText(size: 14),
                    isExpanded: true,
                    itemHeight: null,
                    items: _roles.map((r) => DropdownMenuItem(value: r['id'], child: Text(r['name']!, style: appText(size: 13, weight: FontWeight.w600)))).toList(),
                    onChanged: (v) => setSheetState(() => selectedRoleId = v ?? ''),
                  ),
                ),

                if (selectedRoleId == 'custom') ...[
                  const SizedBox(height: 10),
                  TextField(
                    onChanged: (v) => customRole = v,
                    style: appText(size: 14),
                    decoration: InputDecoration(
                      hintText: 'Enter custom role name', hintStyle: appText(size: 13, color: AppColors.textHint),
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: const Color(0xFFE5E7EB), width: 1)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ],

                const SizedBox(height: 18),

                // Permissions
                Text('Permissions', style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                  child: Column(
                    children: _availablePermissions.map((p) => CheckboxListTile(
                      dense: true, controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      activeColor: AppColors.primary,
                      value: selectedPerms.contains(p['id']),
                      onChanged: (v) => setSheetState(() {
                        if (v == true) { selectedPerms.add(p['id']!); } else { selectedPerms.remove(p['id']); }
                      }),
                      title: Text(p['label']!, style: appText(size: 13, weight: FontWeight.w600)),
                      subtitle: Text(p['desc']!, style: appText(size: 10, color: AppColors.textTertiary)),
                    )).toList(),
                  ),
                ),

                const SizedBox(height: 14),

                // Send invitation toggle
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppColors.primary,
                  value: sendInvitation,
                  onChanged: (v) => setSheetState(() => sendInvitation = v),
                  title: Text('Send invitation to join committee', style: appText(size: 13, weight: FontWeight.w600)),
                ),

                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity, height: 50,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, disabledBackgroundColor: AppColors.primary.withOpacity(0.5), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                    onPressed: submitting || selectedUser == null || selectedRoleId.isEmpty ? null : () async {
                      setSheetState(() => submitting = true);
                      final roleName = selectedRoleId == 'custom' ? customRole : _roles.firstWhere((r) => r['id'] == selectedRoleId, orElse: () => {'name': selectedRoleId})['name']!;
                      final res = await EventsService.addCommitteeMember(widget.eventId, {
                        'user_id': selectedUser!['id'],
                        'name': '${selectedUser!['first_name'] ?? ''} ${selectedUser!['last_name'] ?? ''}'.trim(),
                        'email': selectedUser!['email'],
                        'phone': selectedUser!['phone'],
                        'role': roleName,
                        'permissions': selectedPerms,
                        'send_invitation': sendInvitation,
                      });
                      if (ctx.mounted) Navigator.pop(ctx);
                      if (mounted) {
                        if (res['success'] == true) { AppSnackbar.success(context, 'Committee member added'); _load(); }
                        else { AppSnackbar.error(context, res['message'] ?? 'Failed to add member'); }
                      }
                    },
                    child: submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text('Add Member', style: appText(size: 15, weight: FontWeight.w700, color: Colors.white)),
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

  // EDIT MEMBER — role + permissions update

  void _showEditMemberSheet(Map<String, dynamic> member) {
    final name = '${member['first_name'] ?? member['name'] ?? ''} ${member['last_name'] ?? ''}'.trim();
    final currentRole = (member['role'] ?? '').toString();
    String selectedRoleId = _roles.any((r) => r['name'] == currentRole)
        ? _roles.firstWhere((r) => r['name'] == currentRole)['id']!
        : 'custom';
    String customRole = selectedRoleId == 'custom' ? currentRole : '';

    final perms = member['permissions'];
    List<String> selectedPerms = [];
    if (perms is List) { selectedPerms = List<String>.from(perms); }
    else if (perms is Map) { perms.forEach((k, v) { if (v == true) selectedPerms.add(k.toString()); }); }

    bool submitting = false;

    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => DraggableScrollableSheet(
          expand: false, initialChildSize: 0.7, maxChildSize: 0.9, minChildSize: 0.4,
          builder: (_, scrollCtrl) => Padding(
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: ListView(controller: scrollCtrl, children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Text('Edit — $name', style: appText(size: 18, weight: FontWeight.w700)),
              const SizedBox(height: 20),

              Text('Role *', style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                child: DropdownButtonFormField<String>(
                  value: selectedRoleId,
                  decoration: InputDecoration(border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4)),
                  style: appText(size: 14), isExpanded: true,
                  items: _roles.map((r) => DropdownMenuItem(value: r['id'], child: Text(r['name']!, style: appText(size: 13, weight: FontWeight.w600)))).toList(),
                  onChanged: (v) => setSheetState(() => selectedRoleId = v ?? ''),
                ),
              ),

              if (selectedRoleId == 'custom') ...[
                const SizedBox(height: 10),
                TextField(
                  controller: TextEditingController(text: customRole),
                  onChanged: (v) => customRole = v,
                  style: appText(size: 14),
                  decoration: InputDecoration(
                    hintText: 'Custom role name', filled: true, fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: const Color(0xFFE5E7EB), width: 1)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ],

              const SizedBox(height: 18),
              Text('Permissions', style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                child: Column(
                  children: _availablePermissions.map((p) => CheckboxListTile(
                    dense: true, controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero, activeColor: AppColors.primary,
                    value: selectedPerms.contains(p['id']),
                    onChanged: (v) => setSheetState(() { if (v == true) selectedPerms.add(p['id']!); else selectedPerms.remove(p['id']); }),
                    title: Text(p['label']!, style: appText(size: 13, weight: FontWeight.w600)),
                  )).toList(),
                ),
              ),

              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity, height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                  onPressed: submitting ? null : () async {
                    setSheetState(() => submitting = true);
                    final roleName = selectedRoleId == 'custom' ? customRole : _roles.firstWhere((r) => r['id'] == selectedRoleId, orElse: () => {'name': selectedRoleId})['name']!;
                    final res = await EventsService.updateCommitteeMember(widget.eventId, member['id'].toString(), {
                      'role': roleName,
                      'permissions': selectedPerms,
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                    if (mounted) {
                      if (res['success'] == true) { AppSnackbar.success(context, 'Member updated'); _load(); }
                      else { AppSnackbar.error(context, res['message'] ?? 'Failed to update'); }
                    }
                  },
                  child: submitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Save Changes', style: appText(size: 15, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  void _confirmRemove(String memberId, String name) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Remove Member', style: appText(size: 18, weight: FontWeight.w700)),
        content: Text('Remove ${name.isNotEmpty ? name : 'this member'} from the committee?', style: appText(size: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Cancel', style: appText(size: 14, color: AppColors.textTertiary))),
          TextButton(onPressed: () async {
            Navigator.pop(ctx);
            final res = await EventsService.removeCommitteeMember(widget.eventId, memberId);
            if (mounted) {
              if (res['success'] == true) { AppSnackbar.success(context, 'Member removed'); _load(); }
              else { AppSnackbar.error(context, res['message'] ?? 'Failed'); }
            }
          }, child: Text('Remove', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.error))),
        ],
      ),
    );
  }

  Future<void> _resendInvite(String memberId) async {
    final res = await EventsService.resendCommitteeInvitation(widget.eventId, memberId);
    if (mounted) {
      if (res['success'] == true) AppSnackbar.success(context, 'Invitation resent');
      else AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  Future<void> _generateReport() async {
    AppSnackbar.success(context, 'Generating committee report...');
    final res = await ReportGenerator.generateCommitteeReport(
      widget.eventId, format: 'pdf', members: _members, eventTitle: widget.eventTitle,
    );
    if (!mounted) return;
    if (res['success'] == true && res['bytes'] != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => ReportPreviewScreen(
        title: 'Committee Report', pdfBytes: res['bytes'] as Uint8List, filePath: res['path'] as String?,
      )));
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }
}
