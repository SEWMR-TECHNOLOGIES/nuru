import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/events_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/l10n/l10n_helper.dart';

/// Full-screen modern QR code display for event check-in
class InvitationQRScreen extends StatefulWidget {
  final String eventId;
  const InvitationQRScreen({super.key, required this.eventId});

  @override
  State<InvitationQRScreen> createState() => _InvitationQRScreenState();
}

class _InvitationQRScreenState extends State<InvitationQRScreen> {
  bool _loading = true;
  String? _error;
  String _qrValue = '';
  String _eventTitle = '';
  String _guestName = '';
  String _eventDate = '';
  String _venue = '';

  @override
  void initState() {
    super.initState();
    _loadQR();
  }

  Future<void> _loadQR() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await EventsService.getInvitationCard(widget.eventId);
      if (!mounted) return;
      final data = res['data'] ?? res;
      final success = res['success'] == true || data['guest'] != null;
      if (success) {
        final guest = data['guest'] is Map ? data['guest'] : {};
        final event = data['event'] is Map ? data['event'] : {};
        setState(() {
          _qrValue = guest['attendee_id']?.toString() ??
              data['invitation_code']?.toString() ??
              data['qr_code_data']?.toString() ??
              widget.eventId;
          _eventTitle = event['title']?.toString() ?? 'Event';
          _guestName = guest['name']?.toString() ?? '';
          _eventDate = event['start_date']?.toString() ?? '';
          _venue = event['venue']?.toString() ?? event['location']?.toString() ?? '';
        });
      } else {
        setState(() => _error = res['message']?.toString() ?? 'Failed to load QR');
      }
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to load invitation QR');
    }
    if (mounted) setState(() => _loading = false);
  }

  String _formatDate(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final d = DateTime.parse(dateStr);
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      final dayName = days[d.weekday % 7];
      final time = '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
      return '$dayName, ${d.day} ${months[d.month - 1]} ${d.year}, $time';
    } catch (_) { return dateStr; }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Colors.white))
            : _error != null
                ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(_error!, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: Colors.white70)),
                    const SizedBox(height: 12),
                    TextButton(onPressed: _loadQR, child: Text('Retry', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w600))),
                  ]))
                : Column(children: [
                    // Top bar
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      child: Row(children: [
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Colors.white, size: 24),
                          onPressed: () => Navigator.pop(context),
                        ),
                        const Spacer(),
                        Text('Check-in QR', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                        const Spacer(),
                        const SizedBox(width: 48),
                      ]),
                    ),

                    const Spacer(),

                    // Event title
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(children: [
                        Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.qr_code_2_rounded, color: Colors.white, size: 28),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _eventTitle,
                          style: GoogleFonts.plusJakartaSans(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white, height: 1.2),
                          textAlign: TextAlign.center,
                        ),
                        if (_guestName.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(_guestName, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: Colors.white70)),
                        ],
                      ]),
                    ),

                    const SizedBox(height: 24),

                    // QR Code card
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 40),
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 30, offset: const Offset(0, 10))],
                      ),
                      child: Column(children: [
                        QrImageView(
                          data: _qrValue,
                          version: QrVersions.auto,
                          size: 200,
                          backgroundColor: Colors.white,
                          errorCorrectionLevel: QrErrorCorrectLevel.H,
                          embeddedImage: const AssetImage('assets/images/nuru-logo-square.png'),
                          embeddedImageStyle: const QrEmbeddedImageStyle(size: Size(38, 38)),
                          errorStateBuilder: (ctx, err) => Center(
                            child: Text('QR Error', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.error)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Scan for check-in',
                          style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary, fontWeight: FontWeight.w500),
                        ),
                      ]),
                    ),

                    const SizedBox(height: 24),

                    // Event details
                    if (_formatDate(_eventDate).isNotEmpty || _venue.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: Column(children: [
                          if (_formatDate(_eventDate).isNotEmpty)
                            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                              SvgPicture.asset('assets/icons/calendar-icon.svg', width: 14, height: 14,
                                  colorFilter: const ColorFilter.mode(Colors.white70, BlendMode.srcIn)),
                              const SizedBox(width: 6),
                              Flexible(child: Text(_formatDate(_eventDate), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: Colors.white70), textAlign: TextAlign.center)),
                            ]),
                          if (_venue.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                              SvgPicture.asset('assets/icons/location-icon.svg', width: 14, height: 14,
                                  colorFilter: const ColorFilter.mode(Colors.white70, BlendMode.srcIn)),
                              const SizedBox(width: 6),
                              Flexible(child: Text(_venue, style: GoogleFonts.plusJakartaSans(fontSize: 13, color: Colors.white70), textAlign: TextAlign.center)),
                            ]),
                          ],
                        ]),
                      ),

                    const Spacer(),

                    Padding(
                      padding: const EdgeInsets.fromLTRB(32, 0, 32, 16),
                      child: Text(
                        'Present this QR code at the event entrance for check-in',
                        style: GoogleFonts.plusJakartaSans(fontSize: 11, color: Colors.white54),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ]),
      ),
    );
  }
}
