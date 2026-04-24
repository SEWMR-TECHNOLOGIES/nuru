import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/social_service.dart';
import '../../events/event_detail_screen.dart';
import '../../services/my_services_screen.dart';
import '../../removed/removed_content_screen.dart';
import '../../public_profile/public_profile_screen.dart';
import '../../events/event_public_view_screen.dart';
import 'shared_widgets.dart';
import '../../../core/l10n/l10n_helper.dart';
import '../../../core/utils/haptics.dart';
import '../../../core/widgets/swipe_action_tile.dart';
import '../../../core/widgets/empty_state_illustration.dart';

class HomeNotificationsTab extends StatefulWidget {
  final List<dynamic> notifications;
  final int unreadCount;
  final bool isLoading;
  final VoidCallback onRefresh;
  final ValueChanged<int>? onTabChanged;
  /// Called (debounced) when the user types in the search field.
  /// Parent should re-fetch notifications using the query.
  final ValueChanged<String>? onSearch;

  const HomeNotificationsTab({
    super.key,
    required this.notifications,
    this.unreadCount = 0,
    this.isLoading = false,
    required this.onRefresh,
    this.onTabChanged,
    this.onSearch,
  });

  @override
  State<HomeNotificationsTab> createState() => _HomeNotificationsTabState();
}

class _HomeNotificationsTabState extends State<HomeNotificationsTab> {
  String _search = '';
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    setState(() => _search = v);
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => widget.onSearch?.call(v));
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => widget.onRefresh(),
      color: AppColors.primary,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
        children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Notifications', style: GoogleFonts.plusJakartaSans(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5, height: 1.1)),
              if (widget.unreadCount > 0) ...[
                const SizedBox(height: 4),
                Text('${widget.unreadCount} unread', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary, height: 1.2)),
              ],
            ])),
            if (widget.notifications.isNotEmpty)
              GestureDetector(
                onTap: () async {
                  Haptics.medium();
                  await SocialService.markAllNotificationsRead();
                  widget.onRefresh();
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(8)),
                  child: Text('Mark all read', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary, height: 1.2)),
                ),
              ),
          ]),
          const SizedBox(height: 12),
          // Search bar (debounced server-side)
          Container(
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderLight, width: 0.5),
            ),
            child: TextField(
              onChanged: _onSearchChanged,
              style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search notifications…',
                hintStyle: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textHint),
                prefixIcon: Padding(
                  padding: const EdgeInsets.all(11),
                  child: SvgPicture.asset('assets/icons/search-icon.svg', width: 16, height: 16,
                      colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                ),
                suffixIcon: _search.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textHint),
                        onPressed: () { _onSearchChanged(''); },
                      )
                    : null,
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 11),
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (widget.isLoading)
            ...List.generate(5, (_) => const Padding(padding: EdgeInsets.only(bottom: 10), child: ShimmerCard(height: 72)))
          else if (widget.notifications.isEmpty)
            const EmptyStateIllustration(
              variant: 'messages',
              title: 'No notifications yet',
              subtitle: "We'll let you know the moment something happens.",
            )
          else
            ..._buildGroupedNotifications(context),
        ],
      ),
    );
  }

  /// Group notifications by relative day buckets:
  /// Today · Yesterday · This week · Earlier
  List<Widget> _buildGroupedNotifications(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final weekStart = today.subtract(Duration(days: now.weekday - 1));

    final buckets = <String, List<Map<String, dynamic>>>{
      'Today': [],
      'Yesterday': [],
      'This week': [],
      'Earlier': [],
    };

    for (final n in widget.notifications) {
      final data = n is Map<String, dynamic> ? n : <String, dynamic>{};
      final ts = data['created_at']?.toString() ?? '';
      DateTime? d;
      try { d = DateTime.parse(ts).toLocal(); } catch (_) {}
      String key;
      if (d == null) {
        key = 'Earlier';
      } else {
        final day = DateTime(d.year, d.month, d.day);
        if (day == today) {
          key = 'Today';
        } else if (day == yesterday) {
          key = 'Yesterday';
        } else if (!day.isBefore(weekStart)) {
          key = 'This week';
        } else {
          key = 'Earlier';
        }
      }
      buckets[key]!.add(data);
    }

    final widgets = <Widget>[];
    buckets.forEach((label, items) {
      if (items.isEmpty) return;
      widgets.add(Padding(
        padding: const EdgeInsets.fromLTRB(2, 8, 2, 8),
        child: Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: AppColors.textTertiary,
            letterSpacing: 1.2,
          ),
        ),
      ));
      for (final data in items) {
        final id = (data['id'] ?? data.hashCode).toString();
        widgets.add(SwipeActionTile(
          dismissKey: ValueKey('notif-$id'),
          leadingIcon: Icons.mark_email_read_outlined,
          leadingLabel: 'Mark read',
          onArchive: () async {
            if (data['is_read'] != true && data['read'] != true && data['id'] != null) {
              await SocialService.markNotificationRead(data['id'].toString());
              widget.onRefresh();
            }
            return false;
          },
          child: _notificationItem(context, data),
        ));
      }
    });
    return widgets;
  }

  Widget _emptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 64, height: 64,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(32)),
          child: Center(child: SvgPicture.asset('assets/icons/bell-icon.svg', width: 28, height: 28,
            colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)))),
        const SizedBox(height: 16),
        Text('No notifications yet', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.3)),
        const SizedBox(height: 6),
        Text("We'll notify you when something happens", style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary, height: 1.4)),
      ]),
    );
  }

  Widget _notificationItem(BuildContext context, Map<String, dynamic> data) {
    final message = (data['message'] ?? data['text'] ?? '').toString();
    final isRead = data['is_read'] == true || data['read'] == true;
    final createdAt = data['created_at']?.toString() ?? '';
    final type = data['type']?.toString() ?? '';
    final actor = data['actor'] is Map<String, dynamic> ? data['actor'] as Map<String, dynamic> : null;
    final isSystem = actor == null || (actor['is_system'] == true);
    final actorAvatar = actor?['avatar']?.toString();
    final actorName = _getActorName(actor);
    final actorInitials = _getActorInitials(actor);

    return GestureDetector(
      onTap: () async {
        final id = data['id']?.toString();
        if (id != null && !isRead) await SocialService.markNotificationRead(id);
        widget.onRefresh();
        _navigateForNotification(context, data);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 2),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: isRead ? Colors.transparent : AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 44, height: 44, child: Stack(clipBehavior: Clip.none, children: [
            if (isSystem)
              Container(width: 40, height: 40,
                decoration: BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle,
                  border: Border.all(color: AppColors.primary.withOpacity(0.2), width: 1)),
                child: Center(child: SvgPicture.asset('assets/icons/bell-icon.svg', width: 20, height: 20,
                  colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))))
            else
              Container(width: 40, height: 40,
                decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
                clipBehavior: Clip.antiAlias,
                child: actorAvatar != null && actorAvatar.isNotEmpty
                    ? CachedNetworkImage(imageUrl: actorAvatar, fit: BoxFit.cover, width: 40, height: 40,
                        errorWidget: (_, __, ___) => Center(child: Text(actorInitials, style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textTertiary))))
                    : Center(child: Text(actorInitials, style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textTertiary)))),
            Positioned(bottom: -2, right: -2,
              child: Container(width: 20, height: 20,
                decoration: BoxDecoration(color: AppColors.surface, shape: BoxShape.circle,
                  border: Border.all(color: AppColors.borderLight, width: 1)),
                child: Center(child: _iconBadge(type)))),
          ])),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            RichText(maxLines: 3, overflow: TextOverflow.ellipsis,
              text: TextSpan(children: [
                if (!isSystem) TextSpan(text: '$actorName ',
                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.4)),
                TextSpan(text: message,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
              ])),
            if (createdAt.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(_timeAgo(createdAt), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textHint, height: 1.0)),
            ],
          ])),
          if (!isRead) Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
        ]),
      ),
    );
  }

  Widget _iconBadge(String type) {
    switch (type) {
      case 'glow': return const Text('❤️', style: TextStyle(fontSize: 11));
      case 'comment': case 'echo': return const Icon(Icons.chat_bubble_outline_rounded, size: 12, color: Colors.blue);
      case 'follow': return const Icon(Icons.person_add_outlined, size: 12, color: Colors.green);
      case 'circle_add': case 'circle_request': case 'circle_accepted': return const Icon(Icons.group_outlined, size: 12, color: Colors.green);
      case 'event_invite': case 'committee_invite': case 'rsvp_received':
        return SvgPicture.asset('assets/icons/calendar-icon.svg', width: 12, height: 12, colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn));
      case 'booking_request': case 'booking_accepted': case 'booking_rejected': return const Icon(Icons.work_outline_rounded, size: 12, color: Colors.orange);
      case 'contribution_received': return const Icon(Icons.check_circle_outline_rounded, size: 12, color: Colors.green);
      case 'content_removed': case 'post_removed': case 'moment_removed': return const Icon(Icons.warning_amber_rounded, size: 12, color: Colors.red);
      case 'identity_verified': case 'kyc_approved': return const Icon(Icons.verified_user_outlined, size: 12, color: Colors.green);
      case 'password_changed': case 'password_reset': return const Icon(Icons.lock_outline_rounded, size: 12, color: AppColors.primary);
      default: return SvgPicture.asset('assets/icons/bell-icon.svg', width: 12, height: 12, colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn));
    }
  }

  void _navigateForNotification(BuildContext context, Map<String, dynamic> data) {
    final type = data['type']?.toString() ?? '';
    final refId = data['reference_id']?.toString() ?? data['event_id']?.toString() ?? data['post_id']?.toString() ?? '';
    final actorId = (data['actor'] is Map ? data['actor']['id'] : null)?.toString();
    final roleHintRaw = (data['role'] ?? data['viewer_role'] ?? data['my_role'])?.toString().toLowerCase();
    final knownRole = roleHintRaw == 'creator' || roleHintRaw == 'organizer' || roleHintRaw == 'owner'
        ? 'creator' : (roleHintRaw == 'committee' || roleHintRaw == 'member' ? 'committee' : null);
    if (refId.isEmpty && actorId == null) return;
    if (['event_invite'].contains(type) && refId.isNotEmpty) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => EventPublicViewScreen(eventId: refId)));
    } else if (['committee_invite', 'rsvp_received', 'event_update'].contains(type) && refId.isNotEmpty) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => EventDetailScreen(eventId: refId, knownRole: knownRole)));
    } else if (['follow', 'circle_add', 'circle_request', 'circle_accepted'].contains(type) && actorId != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => PublicProfileScreen(userId: actorId)));
    } else if (['glow', 'comment', 'echo', 'mention'].contains(type) && refId.isNotEmpty) {
      widget.onTabChanged?.call(0);
    } else if (['booking_request', 'booking_accepted', 'booking_rejected'].contains(type)) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const MyServicesScreen()));
    } else if (['content_removed', 'post_removed', 'moment_removed'].contains(type)) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const RemovedContentScreen()));
    } else if (actorId != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => PublicProfileScreen(userId: actorId)));
    }
  }

  String _getActorInitials(Map<String, dynamic>? actor) {
    if (actor == null) return 'N';
    final f = (actor['first_name'] ?? '').toString();
    final l = (actor['last_name'] ?? '').toString();
    final initials = '${f.isNotEmpty ? f[0] : ''}${l.isNotEmpty ? l[0] : ''}'.toUpperCase();
    return initials.isNotEmpty ? initials : 'N';
  }

  String _getActorName(Map<String, dynamic>? actor) {
    if (actor == null) return 'Nuru';
    final f = actor['first_name']?.toString() ?? '';
    final l = actor['last_name']?.toString() ?? '';
    final full = '$f $l'.trim();
    return full.isNotEmpty ? full : actor['name']?.toString() ?? 'Nuru';
  }

  String _timeAgo(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      final diff = DateTime.now().difference(d);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${(diff.inDays / 7).floor()}w ago';
    } catch (_) { return ''; }
  }
}
