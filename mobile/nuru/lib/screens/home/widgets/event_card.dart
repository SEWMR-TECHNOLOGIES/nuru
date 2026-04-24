import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/theme/app_colors.dart';
import '../../events/invitation_qr_screen.dart';

/// Clean event card — modern white with subtle border, no heavy shadows
class EventCard extends StatelessWidget {
  final Map<String, dynamic> event;
  final String? role;
  final VoidCallback? onTap;

  const EventCard({super.key, required this.event, this.role, this.onTap});

  @override
  Widget build(BuildContext context) {
    final title = event['title'] ?? event['name'] ?? 'Untitled Event';
    final status = (event['status'] ?? 'draft').toString();
    final startDate = event['start_date'] ?? '';
    final location = event['location'] ?? event['venue'] ?? '';
    final coverImage = event['cover_image'] as String?;
    final guestCount =
        (event['guest_count'] ?? event['expected_guests'] ?? 0) as int;
    final confirmedGuests = (event['confirmed_guest_count'] ?? 0) as int;
    final budget = event['budget'];
    final currency = event['currency'] ?? 'TZS';
    final eventType =
        (event['event_type'] is Map ? event['event_type']['name'] : null) ??
        event['eventType'] ??
        '';
    final description = event['description'] ?? '';

    final images = _getImages(event);
    final statusCfg = _statusConfig(status);
    final countdown = _getCountdown(startDate);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderLight, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Image section ──
            SizedBox(
              height: 140,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (images.isNotEmpty)
                    Image.network(
                      images[0],
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _imagePlaceholder(),
                    )
                  else
                    _imagePlaceholder(),

                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusCfg['color'] as Color,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusCfg['label'] as String,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          letterSpacing: 0.3,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),

                  if (eventType.isNotEmpty)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          eventType.toString(),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                            height: 1.0,
                          ),
                        ),
                      ),
                    ),

                  if (role != null)
                    Positioned(
                      bottom: 0,
                      left: 0,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: role == 'creator'
                              ? AppColors.primary
                              : role == 'committee'
                              ? AppColors.warning
                              : AppColors.blue,
                          borderRadius: const BorderRadius.only(
                            topRight: Radius.circular(6),
                          ),
                        ),
                        child: Text(
                          role == 'creator'
                              ? 'My Event'
                              : role == 'committee'
                              ? 'Committee'
                              : 'Invited',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                            letterSpacing: 0.3,
                            height: 1.0,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // ── Card body ──
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title.toString(),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.2,
                            height: 1.3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      SvgPicture.asset(
                        'assets/icons/chevron-right-icon.svg',
                        width: 16,
                        height: 16,
                        colorFilter: const ColorFilter.mode(
                          AppColors.textHint,
                          BlendMode.srcIn,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 8),

                  Wrap(
                    spacing: 12,
                    runSpacing: 4,
                    children: [
                      if (countdown != null)
                        _metaChip(
                          'assets/icons/clock-icon.svg',
                          countdown['text']!,
                          isPast: countdown['isPast'] == 'true',
                        ),
                      if (_formatDate(startDate.toString()).isNotEmpty)
                        _metaItem(
                          'assets/icons/calendar-icon.svg',
                          _formatDate(startDate.toString()),
                        ),
                      if (location.isNotEmpty)
                        _metaItem(
                          'assets/icons/location-icon.svg',
                          location.toString(),
                        ),
                    ],
                  ),

                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      description.toString(),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        color: AppColors.textTertiary,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],

                  // Show QR button for invited events
                  if (role == 'guest') ...[
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () {
                        final eventId = event['id']?.toString() ?? '';
                        if (eventId.isNotEmpty) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  InvitationQRScreen(eventId: eventId),
                            ),
                          );
                        }
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: AppColors.primary.withOpacity(0.2),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.qr_code_2_rounded,
                              size: 16,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Show Invitation QR',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: const BoxDecoration(
                      border: Border(
                        top: BorderSide(color: AppColors.borderLight, width: 1),
                      ),
                    ),
                    child: Row(
                      children: [
                        _statCell('Expected', '$guestCount'),
                        Container(
                          width: 1,
                          height: 24,
                          color: AppColors.borderLight,
                        ),
                        _statCell('Confirmed', '$confirmedGuests'),
                        Container(
                          width: 1,
                          height: 24,
                          color: AppColors.borderLight,
                        ),
                        _statCell('Budget', _formatBudget(budget, currency)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _imagePlaceholder() => Container(
    color: AppColors.surfaceVariant,
    child: const Center(
      child: SizedBox(
        width: 32,
        height: 32,
        child: Icon(
          Icons.calendar_month_outlined,
          color: AppColors.textHint,
          size: 32,
        ),
      ),
    ),
  );

  Widget _metaItem(String svgAsset, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.asset(
          svgAsset,
          width: 13,
          height: 13,
          colorFilter: const ColorFilter.mode(
            AppColors.textTertiary,
            BlendMode.srcIn,
          ),
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: AppColors.textTertiary,
              height: 1.4,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _metaChip(String svgAsset, String text, {bool isPast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isPast ? AppColors.surfaceVariant : AppColors.primarySoft,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.asset(
            svgAsset,
            width: 11,
            height: 11,
            colorFilter: ColorFilter.mode(
              isPast ? AppColors.textTertiary : AppColors.primary,
              BlendMode.srcIn,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: isPast ? AppColors.textTertiary : AppColors.primary,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCell(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 9,
              color: AppColors.textTertiary,
              letterSpacing: 0.3,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  static List<String> _getImages(Map<String, dynamic> e) {
    final gallery = e['gallery_images'] as List?;
    if (gallery != null && gallery.isNotEmpty)
      return gallery.cast<String>().take(4).toList();
    final images = e['images'] as List?;
    if (images != null && images.isNotEmpty) {
      final featured = images.firstWhere(
        (i) => i['is_featured'] == true,
        orElse: () => images.first,
      );
      return [featured['image_url'] ?? featured['url'] ?? ''];
    }
    final cover = e['cover_image'] as String?;
    if (cover != null && cover.isNotEmpty) return [cover];
    return [];
  }

  static Map<String, dynamic> _statusConfig(String status) {
    switch (status) {
      case 'published':
        return {'color': AppColors.primary, 'label': 'Published'};
      case 'confirmed':
        return {'color': AppColors.accent, 'label': 'Confirmed'};
      case 'cancelled':
        return {'color': AppColors.error, 'label': 'Cancelled'};
      case 'completed':
        return {'color': AppColors.info, 'label': 'Completed'};
      default:
        return {'color': AppColors.warning, 'label': 'Draft'};
    }
  }

  static String _formatDate(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final d = DateTime.parse(dateStr);
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return '${d.day} ${months[d.month - 1]} ${d.year}';
    } catch (_) {
      return dateStr;
    }
  }

  static Map<String, String>? _getCountdown(String dateStr) {
    if (dateStr.isEmpty) return null;
    try {
      final d = DateTime.parse(dateStr);
      final now = DateTime.now();
      final diff = d.difference(now);
      if (diff.isNegative) {
        final days = diff.inDays.abs();
        if (days == 0) return {'text': 'Today', 'isPast': 'false'};
        return {'text': '${days}d ago', 'isPast': 'true'};
      }
      if (diff.inDays == 0) return {'text': 'Today', 'isPast': 'false'};
      if (diff.inDays == 1) return {'text': 'Tomorrow', 'isPast': 'false'};
      if (diff.inDays < 7)
        return {'text': '${diff.inDays} days left', 'isPast': 'false'};
      if (diff.inDays < 30)
        return {
          'text': '${(diff.inDays / 7).floor()} weeks left',
          'isPast': 'false',
        };
      return {
        'text': '${(diff.inDays / 30).floor()} months left',
        'isPast': 'false',
      };
    } catch (_) {
      return null;
    }
  }

  static String _formatBudget(dynamic budget, String currency) {
    if (budget == null) return '--';
    final amount = budget is num
        ? budget
        : num.tryParse(budget.toString().replaceAll(RegExp(r'[^0-9.]'), '')) ??
              0;
    if (amount == 0) return '--';
    if (amount >= 1000000) return '${(amount / 1000000).toStringAsFixed(1)}M';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(0)}K';
    return amount.toStringAsFixed(0);
  }
}
