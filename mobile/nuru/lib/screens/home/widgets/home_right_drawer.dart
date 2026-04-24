import 'package:cached_network_image/cached_network_image.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../events/event_detail_screen.dart';
import '../../events/event_public_view_screen.dart';
import '../../services/public_service_screen.dart';
import '../../tickets/browse_tickets_screen.dart';
import '../../tickets/my_tickets_screen.dart';
import '../../event_groups/my_groups_screen.dart';
import '../../meetings/meeting_room_screen.dart';
import '../../../core/services/social_service.dart';
import '../../../core/services/meetings_service.dart';
import '../../public_profile/public_profile_screen.dart';
import '../../../core/l10n/l10n_helper.dart';

class HomeRightDrawer extends StatelessWidget {
  final List<dynamic> myEvents;
  final List<dynamic> invitedEvents;
  final List<dynamic> committeeEvents;
  final List<dynamic> upcomingTickets;
  final List<dynamic> ticketedEvents;
  final List<dynamic> myServices;
  final List<dynamic> followSuggestions;
  final VoidCallback? onFollowChanged;

  const HomeRightDrawer({
    super.key,
    required this.myEvents,
    required this.invitedEvents,
    required this.committeeEvents,
    required this.upcomingTickets,
    required this.ticketedEvents,
    required this.myServices,
    required this.followSuggestions,
    this.onFollowChanged,
  });

  List<Map<String, dynamic>> _mergeUpcomingEvents() {
    final now = DateTime.now();
    final items = <Map<String, dynamic>>[];
    for (final e in myEvents) {
      if (_isFuture(e, now)) items.add({'event': e, 'role': 'creator'});
    }
    for (final e in invitedEvents) {
      if (_isFuture(e, now)) items.add({'event': e, 'role': 'guest'});
    }
    for (final e in committeeEvents) {
      if (_isFuture(e, now)) items.add({'event': e, 'role': 'committee'});
    }
    items.sort((a, b) {
      final da = a['event']['start_date']?.toString() ?? '';
      final db = b['event']['start_date']?.toString() ?? '';
      return da.compareTo(db);
    });
    return items;
  }

  bool _isFuture(dynamic e, DateTime now) {
    final d = e['start_date']?.toString() ?? '';
    if (d.isEmpty) return true;
    try { return DateTime.parse(d).isAfter(now); } catch (_) { return false; }
  }

  @override
  Widget build(BuildContext context) {
    final upcomingEvents = _mergeUpcomingEvents();
    return Drawer(
      width: 310,
      backgroundColor: AppColors.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(24),
          bottomLeft: Radius.circular(24),
        ),
      ),
      child: Column(
        children: [
          // ── Header ──
          Container(
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 20,
              left: 24, right: 20, bottom: 20,
            ),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 1)),
            ),
            child: Row(children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.dashboard_rounded, size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  context.trw('quick_view'),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18, fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary, height: 1.2,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.close_rounded, size: 16, color: AppColors.textSecondary),
                ),
              ),
            ]),
          ),

          // ── Content ──
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              children: [
                // Upcoming Events
                if (upcomingEvents.isNotEmpty) ...[
                  _SectionHeader(
                    icon: 'assets/icons/calendar-icon.svg',
                    title: context.trw('upcoming_events'),
                    count: upcomingEvents.length,
                  ),
                  const SizedBox(height: 12),
                  ...upcomingEvents.take(6).map((item) => _UpcomingEventCard(item: item)),
                  const SizedBox(height: 28),
                ],

                // My Meetings
                const _MyMeetingsSection(),

                // My Groups (Event Workspaces)
                _SectionHeaderAction(
                  iconData: Icons.forum_outlined,
                  title: 'My Groups',
                  action: 'View all',
                  onAction: () {
                    Navigator.pop(context);
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const MyGroupsScreen()));
                  },
                ),
                const SizedBox(height: 28),


                // My Tickets
                if (upcomingTickets.isNotEmpty) ...[
                  _SectionHeaderAction(
                    icon: 'assets/icons/ticket-icon.svg',
                    title: context.trw('my_tickets'),
                    action: context.trw('view_all'),
                    onAction: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const MyTicketsScreen()));
                    },
                  ),
                  const SizedBox(height: 12),
                  ...upcomingTickets.take(3).map((t) => _TicketCard(ticket: t)),
                  const SizedBox(height: 28),
                ],

                // Events with Tickets
                if (ticketedEvents.isNotEmpty) ...[
                  _SectionHeaderAction(
                    icon: 'assets/icons/ticket-icon.svg',
                    title: context.trw('events_with_tickets'),
                    action: context.trw('view_all'),
                    onAction: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const BrowseTicketsScreen()));
                    },
                  ),
                  const SizedBox(height: 12),
                  ...ticketedEvents.take(5).map((e) => _TicketedEventCard(event: e)),
                  const SizedBox(height: 28),
                ],

                // Service Providers
                if (myServices.isNotEmpty) ...[
                  _SectionHeader(
                    iconData: Icons.work_outline_rounded,
                    title: context.trw('service_providers'),
                    count: myServices.length,
                  ),
                  const SizedBox(height: 12),
                  _ServicesGrid(services: myServices),
                  const SizedBox(height: 28),
                ],

                // Suggested for You
                if (followSuggestions.isNotEmpty) ...[
                  _SectionHeader(
                    iconData: Icons.people_outline_rounded,
                    title: context.trw('suggested_for_you'),
                  ),
                  const SizedBox(height: 12),
                  ...followSuggestions.map((u) => _SuggestionCard(user: u, onFollowChanged: onFollowChanged)),
                ],

                // Empty state
                if (upcomingEvents.isEmpty && followSuggestions.isEmpty && upcomingTickets.isEmpty && myServices.isEmpty)
                  _EmptyState(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════
// Section Headers
// ═══════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  final String? icon;
  final IconData? iconData;
  final String title;
  final int? count;

  const _SectionHeader({this.icon, this.iconData, required this.title, this.count});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(
        width: 28, height: 28,
        decoration: BoxDecoration(
          color: AppColors.primary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: icon != null
            ? Center(child: SvgPicture.asset(icon!, width: 14, height: 14,
                colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)))
            : Icon(iconData, size: 14, color: AppColors.primary),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          title.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11, fontWeight: FontWeight.w700,
            color: AppColors.textTertiary, letterSpacing: 1.2, height: 1.0,
          ),
        ),
      ),
      if (count != null)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '$count',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary,
            ),
          ),
        ),
    ]);
  }
}

class _SectionHeaderAction extends StatelessWidget {
  final String? icon;
  final IconData? iconData;
  final String title;
  final String action;
  final VoidCallback onAction;

  const _SectionHeaderAction({
    this.icon, this.iconData, required this.title,
    required this.action, required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(
        width: 28, height: 28,
        decoration: BoxDecoration(
          color: AppColors.primary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: icon != null
              ? SvgPicture.asset(icon!, width: 14, height: 14,
                  colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))
              : Icon(iconData ?? Icons.circle_outlined, size: 14, color: AppColors.primary),
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          title.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11, fontWeight: FontWeight.w700,
            color: AppColors.textTertiary, letterSpacing: 1.2, height: 1.0,
          ),
        ),
      ),
      GestureDetector(
        onTap: onAction,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            action,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary,
            ),
          ),
        ),
      ),
    ]);
  }
}

// ═══════════════════════════════════════════════
// Event Card
// ═══════════════════════════════════════════════

class _UpcomingEventCard extends StatelessWidget {
  final Map<String, dynamic> item;
  const _UpcomingEventCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final e = item['event'] as Map<String, dynamic>;
    final role = item['role'] as String;
    final title = e['title'] ?? e['name'] ?? 'Untitled';
    final date = e['start_date'] ?? '';
    final cover = e['cover_image'] as String?;
    final location = e['location']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () {
          Navigator.pop(context);
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => role == 'guest'
                ? EventPublicViewScreen(eventId: e['id'].toString(), initialData: e)
                : EventDetailScreen(eventId: e['id'].toString(), initialData: e, knownRole: role),
          ));
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderLight, width: 1),
            boxShadow: const [
              BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
            ],
          ),
          child: Row(children: [
            _Thumbnail(imageUrl: cover, fallbackSvg: 'assets/icons/calendar-icon.svg', size: 48, radius: 12),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  title.toString(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary, height: 1.3,
                  ),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(children: [
                  const Icon(Icons.schedule_rounded, size: 11, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Text(
                    _formatDateShort(date.toString()),
                    style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary, height: 1.2),
                  ),
                ]),
                if (location.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(children: [
                    const Icon(Icons.place_outlined, size: 11, color: AppColors.textTertiary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        location,
                        style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary, height: 1.2),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ]),
                ],
              ]),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: role == 'creator'
                    ? AppColors.primary.withOpacity(0.08)
                    : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                role,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 9, fontWeight: FontWeight.w600,
                  color: role == 'creator' ? AppColors.primary : AppColors.textTertiary,
                  height: 1.0,
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════
// Ticket Cards
// ═══════════════════════════════════════════════

class _TicketCard extends StatelessWidget {
  final dynamic ticket;
  const _TicketCard({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final t = ticket is Map<String, dynamic> ? ticket : <String, dynamic>{};
    final event = t['event'] is Map<String, dynamic> ? t['event'] as Map<String, dynamic> : t;
    final eventName = event['name']?.toString() ?? t['event_name']?.toString() ?? 'Event';
    final coverImage = event['cover_image']?.toString() ?? '';
    final startDate = event['start_date']?.toString() ?? '';
    final ticketCode = t['ticket_code']?.toString() ?? '';
    final status = t['status']?.toString() ?? 'pending';
    final quantity = t['quantity'] ?? 1;
    DateTime? d;
    try { d = DateTime.parse(startDate); } catch (_) {}
    final isToday = d != null && d.year == DateTime.now().year && d.month == DateTime.now().month && d.day == DateTime.now().day;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () {
          Navigator.pop(context);
          final eventId = event['id']?.toString();
          if (eventId != null && eventId.isNotEmpty) {
            Navigator.push(context, MaterialPageRoute(builder: (_) => EventPublicViewScreen(eventId: eventId)));
          }
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderLight, width: 1),
          ),
          child: Row(children: [
            Stack(children: [
              _Thumbnail(
                imageUrl: coverImage.isNotEmpty ? coverImage : null,
                fallbackSvg: 'assets/icons/ticket-icon.svg',
                size: 44, radius: 10,
              ),
              if (isToday)
                Positioned(top: 0, right: 0,
                  child: Container(
                    width: 10, height: 10,
                    decoration: BoxDecoration(
                      color: AppColors.success, shape: BoxShape.circle,
                      border: Border.all(color: AppColors.surface, width: 2),
                    ),
                  ),
                ),
            ]),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  eventName, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  isToday ? context.trw('today') : (d != null ? _formatDateShort(startDate) : 'Date TBD'),
                  style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary),
                ),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 4, children: [
                  if (ticketCode.isNotEmpty) _CodeBadge(code: ticketCode),
                  _StatusBadge(status: status),
                  if (quantity > 1)
                    Text('×$quantity', style: GoogleFonts.plusJakartaSans(fontSize: 9, color: AppColors.textTertiary)),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _TicketedEventCard extends StatelessWidget {
  final dynamic event;
  const _TicketedEventCard({required this.event});

  @override
  Widget build(BuildContext context) {
    final e = event is Map<String, dynamic> ? event : <String, dynamic>{};
    final coverImage = e['cover_image']?.toString() ?? '';
    final eventName = e['name']?.toString() ?? e['title']?.toString() ?? 'Event';
    final startDate = e['start_date']?.toString() ?? '';
    final minPrice = e['min_price'];
    final soldOut = (e['total_available'] ?? 0) <= 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () {
          Navigator.pop(context);
          final eventId = e['id']?.toString();
          if (eventId != null && eventId.isNotEmpty) {
            Navigator.push(context, MaterialPageRoute(builder: (_) => EventPublicViewScreen(eventId: eventId)));
          }
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderLight, width: 1),
          ),
          child: Row(children: [
            _Thumbnail(
              imageUrl: coverImage.isNotEmpty ? coverImage : null,
              fallbackSvg: 'assets/icons/ticket-icon.svg',
              size: 48, radius: 12,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  eventName,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.3),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                if (startDate.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _formatDateShort(startDate),
                    style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary, height: 1.2),
                  ),
                ],
                const SizedBox(height: 6),
                Row(children: [
                  if (minPrice != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceVariant,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${context.trw('from')} ${_formatCompactMoney(minPrice)}',
                        style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                    ),
                  if (soldOut) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        context.trw('sold_out'),
                        style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.error),
                      ),
                    ),
                  ],
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════
// Services Grid
// ═══════════════════════════════════════════════

class _ServicesGrid extends StatelessWidget {
  final List<dynamic> services;
  const _ServicesGrid({required this.services});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12, runSpacing: 16,
      children: services.take(4).map((service) {
        final s = service is Map<String, dynamic> ? service : <String, dynamic>{};
        final title = s['title']?.toString() ?? s['name']?.toString() ?? 'Service';
        final initials = title.split(' ').map((w) => w.isNotEmpty ? w[0] : '').join('').toUpperCase();
        final imgUrl = _extractServiceImage(s);
        return GestureDetector(
          onTap: () {
            final svcId = s['id']?.toString();
            Navigator.pop(context);
            if (svcId != null && svcId.isNotEmpty) {
              Navigator.push(context, MaterialPageRoute(builder: (_) => PublicServiceScreen(serviceId: svcId)));
            }
          },
          child: SizedBox(
            width: 120,
            child: Column(children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.borderLight, width: 1),
                ),
                clipBehavior: Clip.antiAlias,
                child: imgUrl != null
                    ? Image.network(imgUrl, width: 56, height: 56, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Center(child: Text(initials,
                          style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary))))
                    : Center(child: Text(initials,
                        style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary))),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
                textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
              ),
            ]),
          ),
        );
      }).toList(),
    );
  }
}

// ═══════════════════════════════════════════════
// Suggestion Card
// ═══════════════════════════════════════════════

class _SuggestionCard extends StatefulWidget {
  final dynamic user;
  final VoidCallback? onFollowChanged;
  const _SuggestionCard({required this.user, this.onFollowChanged});

  @override
  State<_SuggestionCard> createState() => _SuggestionCardState();
}

class _SuggestionCardState extends State<_SuggestionCard> {
  bool _followed = false;
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final firstName = user['first_name'] ?? '';
    final lastName = user['last_name'] ?? '';
    final fullName = '$firstName $lastName'.trim();
    final username = user['username'] ?? '';
    final avatar = (user['avatar'] ?? user['profile_picture_url'] ?? user['avatar_url']) as String?;
    final bio = user['bio'] as String? ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () {
          final uid = user['id']?.toString() ?? '';
          if (uid.isEmpty) return;
          Navigator.pop(context);
          Navigator.push(context, MaterialPageRoute(builder: (_) => PublicProfileScreen(userId: uid)));
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.borderLight, width: 1),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          child: Row(
            children: [
              // Avatar
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: avatar == null || avatar.isEmpty
                      ? LinearGradient(
                          colors: [AppColors.primary.withOpacity(0.15), AppColors.primary.withOpacity(0.05)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                ),
                clipBehavior: Clip.antiAlias,
                child: avatar != null && avatar.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: avatar, fit: BoxFit.cover, width: 48, height: 48,
                        errorWidget: (_, __, ___) => _SmallAvatar(name: fullName),
                      )
                    : Center(
                        child: Text(
                          fullName.isNotEmpty ? fullName[0].toUpperCase() : '?',
                          style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primary),
                        ),
                      ),
              ),
              const SizedBox(width: 14),
              // Name + username + bio
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fullName.isNotEmpty ? fullName : '@$username',
                      style: GoogleFonts.plusJakartaSans(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                    if (username.isNotEmpty && fullName.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '@$username',
                          style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary, height: 1.2),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    if (bio.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Text(
                          bio,
                          style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textSecondary, height: 1.3),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Follow button
              GestureDetector(
                onTap: _loading || _followed ? null : () async {
                  final id = user['id']?.toString() ?? '';
                  if (id.isEmpty) return;
                  setState(() => _loading = true);
                  await SocialService.followUser(id);
                  if (mounted) setState(() { _loading = false; _followed = true; });
                  widget.onFollowChanged?.call();
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: _followed ? AppColors.surfaceVariant : AppColors.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: _loading
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(
                          _followed ? context.trw('following') : context.trw('follow'),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12, fontWeight: FontWeight.w700,
                            color: _followed ? AppColors.textSecondary : Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            color: AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(Icons.dashboard_outlined, size: 28, color: AppColors.textHint),
        ),
        const SizedBox(height: 16),
        Text(
          context.trw('all_caught_up'),
          style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.2),
        ),
        const SizedBox(height: 6),
        Text(
          context.trw('nothing_here_yet'),
          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary, height: 1.3),
        ),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════
// My Meetings Section (stateful)
// ═══════════════════════════════════════════════

class _MyMeetingsSection extends StatefulWidget {
  const _MyMeetingsSection();

  @override
  State<_MyMeetingsSection> createState() => _MyMeetingsSectionState();
}

class _MyMeetingsSectionState extends State<_MyMeetingsSection> {
  List<Map<String, dynamic>> _meetings = [];
  bool _loaded = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await MeetingsService().myMeetings();
      if (res['success'] == true && res['data'] != null) {
        final all = List<Map<String, dynamic>>.from(res['data']);
        final active = all.where((m) => m['status'] != 'ended').take(5).toList();
        if (mounted) setState(() { _meetings = active; _loaded = true; });
      } else {
        if (mounted) setState(() => _loaded = true);
      }
    } catch (_) {
      if (mounted) setState(() => _loaded = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _meetings.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header with meeting icon
        Row(children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: SvgPicture.asset(
                'assets/icons/video_chat_icon.svg',
                width: 14, height: 14,
                colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              context.trw('my_meetings').toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: AppColors.textTertiary, letterSpacing: 1.2, height: 1.0,
              ),
            ),
          ),
        ]),
        const SizedBox(height: 12),

        ..._meetings.map((m) {
          final isLive = m['status'] == 'in_progress';
          final title = m['title'] ?? 'Meeting';
          final eventName = m['event_name'] ?? '';
          final scheduledAt = m['scheduled_at'];
          final participantCount = m['participant_count'] ?? 0;
          String dateStr = '';
          String timeStr = '';
          if (scheduledAt != null) {
            try {
              final dt = DateTime.parse(scheduledAt).toLocal();
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              dateStr = '${months[dt.month - 1]} ${dt.day}';
              timeStr = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
            } catch (_) {}
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GestureDetector(
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => MeetingRoomScreen(
                    eventId: m['event_id']?.toString() ?? '',
                    meetingId: m['id']?.toString() ?? '',
                    roomId: m['room_id']?.toString() ?? '',
                  ),
                ));
              },
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isLive ? const Color(0x0A22C55E) : AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isLive ? const Color(0x4D22C55E) : AppColors.borderLight,
                    width: isLive ? 1.5 : 1,
                  ),
                  boxShadow: isLive
                      ? [const BoxShadow(color: Color(0x0D22C55E), blurRadius: 12, offset: Offset(0, 4))]
                      : null,
                ),
                child: Row(children: [
                  Container(
                    width: 42, height: 42,
                    decoration: BoxDecoration(
                      color: isLive ? const Color(0x1A22C55E) : AppColors.primary.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: SvgPicture.asset(
                        'assets/icons/video_chat_icon.svg',
                        width: 20, height: 20,
                        colorFilter: ColorFilter.mode(
                          isLive ? const Color(0xFF22C55E) : AppColors.primary,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Flexible(
                          child: Text(
                            title,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13, fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary, height: 1.3,
                            ),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isLive) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF22C55E),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'LIVE',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ]),
                      if (eventName.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          eventName,
                          style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textTertiary, height: 1.3),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 6),
                      Row(children: [
                        const Icon(Icons.schedule_rounded, size: 10, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(
                          '$dateStr · $timeStr',
                          style: GoogleFonts.plusJakartaSans(fontSize: 9, color: AppColors.textTertiary),
                        ),
                        const SizedBox(width: 12),
                        const Icon(Icons.people_outline_rounded, size: 10, color: AppColors.textTertiary),
                        const SizedBox(width: 3),
                        Text(
                          '$participantCount',
                          style: GoogleFonts.plusJakartaSans(fontSize: 9, color: AppColors.textTertiary),
                        ),
                      ]),
                    ]),
                  ),
                ]),
              ),
            ),
          );
        }),
        const SizedBox(height: 28),
      ],
    );
  }
}

// ═══════════════════════════════════════════════
// Shared Widgets
// ═══════════════════════════════════════════════

class _Thumbnail extends StatelessWidget {
  final String? imageUrl;
  final String fallbackSvg;
  final double size;
  final double radius;

  const _Thumbnail({this.imageUrl, required this.fallbackSvg, required this.size, this.radius = 10});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: AppColors.borderLight, width: 0.5),
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl != null
          ? CachedNetworkImage(
              imageUrl: imageUrl!, width: size, height: size, fit: BoxFit.cover,
              errorWidget: (_, __, ___) => Center(child: SvgPicture.asset(fallbackSvg, width: 18, height: 18,
                colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
            )
          : Center(child: SvgPicture.asset(fallbackSvg, width: 18, height: 18,
              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
    );
  }
}

class _SmallAvatar extends StatelessWidget {
  final String name;
  const _SmallAvatar({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40, height: 40, color: AppColors.surfaceVariant,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textSecondary, height: 1.0),
        ),
      ),
    );
  }
}

class _CodeBadge extends StatelessWidget {
  final String code;
  const _CodeBadge({required this.code});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        code,
        style: GoogleFonts.jetBrainsMono(fontSize: 9, fontWeight: FontWeight.w500, color: AppColors.textPrimary, letterSpacing: 0.5),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        border: Border.all(color: AppColors.borderLight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        status,
        style: GoogleFonts.plusJakartaSans(fontSize: 9, color: AppColors.textTertiary),
      ),
    );
  }
}

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

String _formatDateShort(String dateStr) {
  try {
    final d = DateTime.parse(dateStr);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  } catch (_) { return dateStr; }
}

String _formatCompactMoney(dynamic amount) {
  if (amount == null) return '';
  final n = (amount is String ? double.tryParse(amount) : amount.toDouble()) ?? 0.0;
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(0)}K';
  return n.toStringAsFixed(0);
}

String? _extractServiceImage(Map<String, dynamic> s) {
  final primary = s['primary_image'];
  if (primary is Map) return primary['thumbnail_url']?.toString() ?? primary['url']?.toString();
  if (primary is String && primary.isNotEmpty) return primary;
  final images = s['images'];
  if (images is List && images.isNotEmpty) {
    final first = images.first;
    if (first is Map) return first['thumbnail_url']?.toString() ?? first['url']?.toString();
    if (first is String) return first;
  }
  return s['cover_image']?.toString() ?? s['image_url']?.toString();
}
