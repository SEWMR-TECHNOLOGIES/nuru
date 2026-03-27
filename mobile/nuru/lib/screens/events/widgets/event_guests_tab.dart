import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/widgets/app_snackbar.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.2}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

class EventGuestsTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  const EventGuestsTab({super.key, required this.eventId, this.permissions});

  @override
  State<EventGuestsTab> createState() => _EventGuestsTabState();
}

class _EventGuestsTabState extends State<EventGuestsTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> _guests = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  String _filter = 'all';
  final _searchCtrl = TextEditingController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getGuests(widget.eventId, rsvpStatus: _filter == 'all' ? null : _filter, search: _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim());
    if (mounted) setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _guests = data?['guests'] ?? [];
        _summary = data?['summary'] ?? {};
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final canManage = widget.permissions?['can_manage_guests'] == true || widget.permissions?['is_creator'] == true;

    return Column(
      children: [
        // Summary chips
        if (_summary.isNotEmpty)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(children: [
              _chip('Total', _summary['total'], AppColors.textPrimary),
              _chip('Confirmed', _summary['confirmed'], AppColors.accent),
              _chip('Pending', _summary['pending'], AppColors.warning),
              _chip('Declined', _summary['declined'], AppColors.error),
              _chip('Checked In', _summary['checked_in'], AppColors.blue),
            ]),
          ),
        // Search
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _searchCtrl,
                onChanged: (_) => _load(),
                style: _f(size: 14),
                decoration: InputDecoration(
                  hintText: 'Search guests...',
                  hintStyle: _f(size: 13, color: AppColors.textHint),
                  prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textHint),
                  filled: true, fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
            if (canManage) ...[
              const SizedBox(width: 10),
              GestureDetector(
                onTap: _showAddGuestSheet,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.person_add_rounded, size: 20, color: Colors.white),
                ),
              ),
            ],
          ]),
        ),
        // Filter
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: ['all', 'confirmed', 'pending', 'declined', 'maybe'].map((f) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () { setState(() => _filter = f); _load(); },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: _filter == f ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _filter == f ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(f[0].toUpperCase() + f.substring(1), style: _f(size: 12, weight: FontWeight.w600, color: _filter == f ? Colors.white : AppColors.textSecondary)),
                ),
              ),
            )).toList(),
          ),
        ),
        // List
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _guests.isEmpty
                  ? Center(child: Text('No guests yet', style: _f(size: 14, color: AppColors.textTertiary)))
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: _guests.length,
                        itemBuilder: (_, i) => _guestTile(_guests[i], canManage),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _guestTile(Map<String, dynamic> g, bool canManage) {
    final name = g['name']?.toString() ?? g['full_name']?.toString() ?? 'Guest';
    final rsvp = (g['rsvp_status'] ?? 'pending').toString();
    final checkedIn = g['checked_in'] == true;
    final phone = g['phone']?.toString() ?? '';
    final table = g['table_number']?.toString() ?? '';

    final rsvpColor = {'confirmed': AppColors.accent, 'pending': AppColors.warning, 'declined': AppColors.error, 'maybe': AppColors.blue}[rsvp] ?? AppColors.textTertiary;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border.withOpacity(0.4))),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: rsvpColor.withOpacity(0.1), shape: BoxShape.circle),
            child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: _f(size: 16, weight: FontWeight.w700, color: rsvpColor))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Flexible(child: Text(name, style: _f(size: 14, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (checkedIn) ...[const SizedBox(width: 6), Icon(Icons.check_circle, size: 14, color: AppColors.accent)],
              ]),
              Wrap(spacing: 8, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: rsvpColor.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                  child: Text(rsvp, style: _f(size: 10, weight: FontWeight.w700, color: rsvpColor)),
                ),
                if (phone.isNotEmpty) Text(phone, style: _f(size: 11, color: AppColors.textTertiary)),
                if (table.isNotEmpty) Text('Table $table', style: _f(size: 11, color: AppColors.textTertiary)),
              ]),
            ],
          )),
          if (canManage)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded, size: 18, color: AppColors.textHint),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              onSelected: (v) => _handleGuestAction(v, g),
              itemBuilder: (_) => [
                if (!checkedIn) const PopupMenuItem(value: 'checkin', child: Text('Check In')),
                if (checkedIn) const PopupMenuItem(value: 'undo_checkin', child: Text('Undo Check-in')),
                const PopupMenuItem(value: 'invite', child: Text('Send Invitation')),
                const PopupMenuItem(value: 'delete', child: Text('Remove')),
              ],
            ),
        ],
      ),
    );
  }

  Future<void> _handleGuestAction(String action, Map<String, dynamic> guest) async {
    final guestId = guest['id']?.toString() ?? '';
    if (guestId.isEmpty) return;

    Map<String, dynamic> res;
    switch (action) {
      case 'checkin':
        res = await EventsService.checkinGuest(widget.eventId, guestId);
        break;
      case 'undo_checkin':
        res = await EventsService.undoCheckin(widget.eventId, guestId);
        break;
      case 'invite':
        res = await EventsService.sendInvitation(widget.eventId, guestId);
        break;
      case 'delete':
        res = await EventsService.deleteGuest(widget.eventId, guestId);
        break;
      default:
        return;
    }
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, action == 'checkin' ? 'Checked in' : action == 'invite' ? 'Invitation sent' : 'Done');
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  /// Add guest using USER SEARCH — mirrors web UserSearchInput
  void _showAddGuestSheet() {
    final searchCtrl = TextEditingController();
    List<dynamic> searchResults = [];
    bool searching = false;
    Map<String, dynamic>? selectedUser;
    Timer? debounce;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 20),
                Text('Add Guest', style: _f(size: 18, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text('Search for a Nuru user to add as guest', style: _f(size: 13, color: AppColors.textTertiary)),
                const SizedBox(height: 16),

                // Search input
                TextField(
                  controller: searchCtrl,
                  autofocus: true,
                  style: _f(size: 14),
                  decoration: InputDecoration(
                    hintText: 'Search by name, email, or phone...',
                    hintStyle: _f(size: 13, color: AppColors.textHint),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textHint),
                    filled: true, fillColor: const Color(0xFFF5F7FA),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onChanged: (q) {
                    debounce?.cancel();
                    if (q.trim().length < 2) { setModalState(() { searchResults = []; selectedUser = null; }); return; }
                    debounce = Timer(const Duration(milliseconds: 400), () async {
                      setModalState(() => searching = true);
                      final res = await EventsService.searchUsers(q.trim());
                      if (ctx.mounted) {
                         setModalState(() {
                           searching = false;
                           if (res['success'] == true) {
                             final data = res['data'];
                             final rawList = data is List ? data : (data is Map ? (data['items'] ?? data['users'] ?? []) : []);
                             searchResults = (rawList is List ? rawList : []).map((u) {
                               if (u is! Map) return u;
                               final m = Map<String, dynamic>.from(u);
                               if ((m['first_name'] == null || m['first_name'] == '') && m['full_name'] != null) {
                                 final parts = (m['full_name'] as String).split(' ');
                                 m['first_name'] = parts.first;
                                 m['last_name'] = parts.length > 1 ? parts.sublist(1).join(' ') : '';
                               }
                               return m;
                             }).toList();
                           }
                         });
                      }
                    });
                  },
                ),
                const SizedBox(height: 12),

                // Search results
                if (searching)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))),

                if (!searching && searchResults.isEmpty && searchCtrl.text.length >= 2)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Center(child: Text('No users found', style: _f(size: 13, color: AppColors.textTertiary))),
                  ),

                if (selectedUser != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 18, backgroundColor: AppColors.primary.withOpacity(0.15),
                        child: Text(
                          '${selectedUser!['first_name']?.toString() ?? ''}'.isNotEmpty
                              ? selectedUser!['first_name'].toString()[0].toUpperCase()
                              : '?',
                          style: _f(size: 14, weight: FontWeight.w700, color: AppColors.primary),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${selectedUser!['first_name'] ?? ''} ${selectedUser!['last_name'] ?? ''}'.trim(), style: _f(size: 14, weight: FontWeight.w600)),
                        if (selectedUser!['email'] != null) Text(selectedUser!['email'].toString(), style: _f(size: 11, color: AppColors.textTertiary)),
                      ])),
                      GestureDetector(
                        onTap: () => setModalState(() => selectedUser = null),
                        child: const Icon(Icons.close_rounded, size: 18, color: AppColors.textHint),
                      ),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity, height: 50,
                    child: ElevatedButton(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        final data = <String, dynamic>{
                          'guest_type': 'user',
                          'user_id': selectedUser!['id'].toString(),
                          'name': '${selectedUser!['first_name'] ?? ''} ${selectedUser!['last_name'] ?? ''}'.trim(),
                          'rsvp_status': 'pending',
                        };
                        if (selectedUser!['email'] != null) data['email'] = selectedUser!['email'].toString();
                        if (selectedUser!['phone'] != null) data['phone'] = selectedUser!['phone'].toString();
                        final res = await EventsService.addGuest(widget.eventId, data);
                        if (mounted) {
                          if (res['success'] == true) { AppSnackbar.success(context, 'Guest added'); _load(); }
                          else AppSnackbar.error(context, res['message'] ?? 'Failed');
                        }
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                      child: Text('Add as Guest', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                ],

                if (selectedUser == null && searchResults.isNotEmpty)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 300),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: searchResults.length,
                      itemBuilder: (_, i) {
                        final user = searchResults[i] as Map<String, dynamic>;
                        final fullName = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
                        final name = user['full_name']?.toString() ?? (fullName.isNotEmpty ? fullName : user['username']?.toString() ?? 'Unknown');
                        final subtitleParts = <String>[
                          if (user['username'] != null && user['username'] != '') '@${user['username']}',
                          if (user['email'] != null && user['email'] != '') user['email'].toString(),
                          if (user['phone'] != null && user['phone'] != '') user['phone'].toString(),
                        ];
                        final subtitle = subtitleParts.join(' · ');
                        final avatar = user['avatar']?.toString();
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            radius: 20, backgroundColor: AppColors.surfaceVariant,
                            backgroundImage: avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
                            child: (avatar == null || avatar.isEmpty) ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: _f(size: 14, weight: FontWeight.w700, color: AppColors.textTertiary)) : null,
                          ),
                          title: Text(name, style: _f(size: 14, weight: FontWeight.w600)),
                          subtitle: subtitle.isNotEmpty ? Text(subtitle, style: _f(size: 11, color: AppColors.textTertiary)) : null,
                          onTap: () => setModalState(() => selectedUser = user),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _chip(String label, dynamic count, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(20)),
      child: Text('$label: ${count ?? 0}', style: _f(size: 11, weight: FontWeight.w700, color: color)),
    );
  }
}
