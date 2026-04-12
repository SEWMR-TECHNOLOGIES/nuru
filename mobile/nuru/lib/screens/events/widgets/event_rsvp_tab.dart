import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/report_generator.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../report_preview_screen.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';

/// RSVP tab — shows RSVP stats and guest responses, mirroring web EventRSVP.tsx
class EventRsvpTab extends StatefulWidget {
  final String eventId;
  const EventRsvpTab({super.key, required this.eventId});

  @override
  State<EventRsvpTab> createState() => _EventRsvpTabState();
}

class _EventRsvpTabState extends State<EventRsvpTab>
    with AutomaticKeepAliveClientMixin {
  List<dynamic> _guests = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  String _filter = 'all';
  final _searchCtrl = TextEditingController();

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getGuests(
      widget.eventId,
      rsvpStatus: _filter == 'all' ? null : _filter,
      search: _searchCtrl.text.trim().isEmpty ? null : _searchCtrl.text.trim(),
    );
    if (mounted)
      setState(() {
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
    final stats = {
      'attending': _summary['confirmed'] ?? 0,
      'declined': _summary['declined'] ?? 0,
      'pending': _summary['pending'] ?? 0,
      'maybe': _summary['maybe'] ?? 0,
      'total': _summary['total'] ?? 0,
      'checked_in': _summary['checked_in'] ?? 0,
    };

    return Column(
      children: [
        // Stats cards
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              _statCard('Attending', stats['attending'], AppColors.accent),
              _statCard('Declined', stats['declined'], AppColors.error),
              _statCard('Pending', stats['pending'], AppColors.warning),
              _statCard('Maybe', stats['maybe'], AppColors.blue),
              _statCard('Total', stats['total'], AppColors.textPrimary),
            ],
          ),
        ),

        // Report button
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _generateReport,
              icon: const Icon(Icons.description_rounded, size: 16),
              label: Text(
                'RSVP Report',
                style: appText(size: 12, weight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
        ),

        // Search
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (_) => _load(),
            style: appText(size: 14),
            decoration: InputDecoration(
              hintText: 'Search RSVPs...',
              hintStyle: appText(size: 13, color: AppColors.textHint),
              prefixIcon: const Icon(
                Icons.search_rounded,
                size: 20,
                color: AppColors.textHint,
              ),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),

        // Filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: ['all', 'confirmed', 'pending', 'declined', 'maybe']
                .map(
                  (f) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () {
                        setState(() => _filter = f);
                        _load();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: _filter == f
                              ? AppColors.primary
                              : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: _filter == f
                                ? AppColors.primary
                                : AppColors.border,
                          ),
                        ),
                        child: Text(
                          f[0].toUpperCase() + f.substring(1),
                          style: appText(
                            size: 12,
                            weight: FontWeight.w600,
                            color: _filter == f
                                ? Colors.white
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ),

        // List
        Expanded(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : _guests.isEmpty
              ? Center(
                  child: Text(
                    'No RSVP responses yet',
                    style: appText(size: 14, color: AppColors.textTertiary),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _guests.length,
                    itemBuilder: (_, i) => _rsvpTile(_guests[i]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _rsvpTile(Map<String, dynamic> g) {
    final name = extractStr(
      g['name'],
      fallback: extractStr(g['full_name'], fallback: 'Guest'),
    );
    final rsvp = extractStr(g['rsvp_status'], fallback: 'pending');
    final phone = g['phone']?.toString() ?? '';
    final email = g['email']?.toString() ?? '';
    final rsvpColor =
        {
          'confirmed': AppColors.accent,
          'pending': AppColors.warning,
          'declined': AppColors.error,
          'maybe': AppColors.blue,
        }[rsvp] ??
        AppColors.textTertiary;
    final rsvpIcon =
        {
          'confirmed': Icons.check_circle_rounded,
          'pending': Icons.access_time_rounded,
          'declined': Icons.cancel_rounded,
          'maybe': Icons.help_outline_rounded,
        }[rsvp] ??
        Icons.help_outline_rounded;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: rsvpColor.withOpacity(0.1),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: appText(
                size: 16,
                weight: FontWeight.w700,
                color: rsvpColor,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: appText(size: 14, weight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(rsvpIcon, size: 14, color: rsvpColor),
                    const SizedBox(width: 4),
                    Text(
                      rsvp[0].toUpperCase() + rsvp.substring(1),
                      style: appText(
                        size: 12,
                        weight: FontWeight.w600,
                        color: rsvpColor,
                      ),
                    ),
                    if (phone.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          phone,
                          style: appText(
                            size: 11,
                            color: AppColors.textTertiary,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
                if (email.isNotEmpty)
                  Text(
                    email,
                    style: appText(size: 11, color: AppColors.textTertiary),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCard(String label, dynamic count, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(
            '${count ?? 0}',
            style: appText(size: 20, weight: FontWeight.w800, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: appText(size: 11, weight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }

  Future<void> _generateReport() async {
    AppSnackbar.success(context, 'Generating RSVP report...');
    final res = await ReportGenerator.generateRsvpReport(
      widget.eventId,
      format: 'pdf',
      guests: _guests,
    );
    if (!mounted) return;
    if (res['success'] == true && res['bytes'] != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ReportPreviewScreen(
            title: 'RSVP Report',
            pdfBytes: res['bytes'] as Uint8List,
            filePath: res['path'] as String?,
          ),
        ),
      );
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }
}
