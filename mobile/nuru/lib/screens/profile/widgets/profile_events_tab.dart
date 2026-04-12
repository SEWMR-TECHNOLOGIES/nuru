import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../events/event_detail_screen.dart';
import '../../../core/l10n/l10n_helper.dart';

class ProfileEventsTab extends StatelessWidget {
  final List<dynamic> events;
  final bool isLoading;

  const ProfileEventsTab({super.key, required this.events, this.isLoading = false});

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          height: 80, margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
        ),
      );
    }
    if (events.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset('assets/icons/calendar-icon.svg', width: 32, height: 32,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        const SizedBox(height: 14),
        Text('No events yet', style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text('Create your first event', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
      ]));
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      itemCount: events.length,
      itemBuilder: (_, i) {
        final e = events[i] is Map<String, dynamic> ? events[i] as Map<String, dynamic> : <String, dynamic>{};
        final title = e['title']?.toString() ?? 'Untitled';
        final date = e['start_date']?.toString() ?? '';
        final cover = e['cover_image'] as String?;
        final status = e['status']?.toString() ?? 'draft';
        return GestureDetector(
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => EventDetailScreen(eventId: e['id'].toString(), initialData: e, knownRole: 'creator'),
          )),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderLight, width: 1)),
            child: Row(children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                clipBehavior: Clip.antiAlias,
                child: cover != null
                    ? Image.network(cover, width: 56, height: 56, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _calendarIcon())
                    : _calendarIcon(),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                if (date.isNotEmpty) Text(_formatDateShort(date), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
              ])),
              _statusBadge(status),
            ]),
          ),
        );
      },
    );
  }

  Widget _calendarIcon() {
    return Center(child: SvgPicture.asset('assets/icons/calendar-icon.svg', width: 22, height: 22,
      colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)));
  }

  Widget _statusBadge(String status) {
    final colors = {'draft': AppColors.textTertiary, 'published': AppColors.accent, 'confirmed': AppColors.accent, 'cancelled': AppColors.error, 'completed': AppColors.blue};
    final c = colors[status] ?? AppColors.textTertiary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
      child: Text(status[0].toUpperCase() + status.substring(1), style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w600, color: c)),
    );
  }

  String _formatDateShort(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) { return dateStr; }
  }
}
