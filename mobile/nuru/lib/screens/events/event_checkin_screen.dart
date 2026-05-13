import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';
import 'widgets/event_checkin_tab.dart';

/// Standalone host for [EventCheckinTab] so the QR check-in flow can be
/// opened directly from the My Events list when an event is happening
/// today, without forcing the user to navigate into the full event
/// detail screen first.
class EventCheckinScreen extends StatelessWidget {
  final String eventId;
  final String? eventTitle;
  final String? eventDate;
  final String? eventLocation;
  final Map<String, dynamic>? permissions;

  const EventCheckinScreen({
    super.key,
    required this.eventId,
    this.eventTitle,
    this.eventDate,
    this.eventLocation,
    this.permissions,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(eventTitle ?? 'Check-in', style: appText(size: 16, weight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
      body: EventCheckinTab(
        eventId: eventId,
        permissions: permissions,
        eventTitle: eventTitle,
        eventDate: eventDate,
        eventLocation: eventLocation,
      ),
    );
  }
}
