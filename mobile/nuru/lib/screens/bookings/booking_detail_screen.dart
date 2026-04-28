import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/services/user_services_service.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../widgets/cancel_booking_dialog.dart';

/// Mobile Booking Detail screen — mirrors the web `/bookings/:id` layout
/// (service header, event details, parties, status timeline, actions).
///
/// Reachable from the bookings list cards. Inline accept/decline still works
/// from the list, but this screen surfaces the full lifecycle in one place.
class BookingDetailScreen extends StatefulWidget {
  final String bookingId;
  final bool startAsVendor;
  const BookingDetailScreen({super.key, required this.bookingId, this.startAsVendor = false});

  @override
  State<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends State<BookingDetailScreen> {
  Map<String, dynamic>? _booking;
  bool _loading = true;
  String? _error;

  static const _statusStyles = <String, Color>{
    'pending': AppColors.warning,
    'accepted': AppColors.success,
    'rejected': AppColors.error,
    'completed': AppColors.blue,
    'cancelled': AppColors.textTertiary,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final res = await UserServicesService.getBookingDetail(widget.bookingId);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _booking = data is Map ? Map<String, dynamic>.from(data) : null;
        if (_booking == null) _error = 'Booking not found';
      } else {
        _error = res['message']?.toString() ?? 'Unable to load booking';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: context.tr('booking_details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _errorView()
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    children: [
                      _statusHeader(),
                      const SizedBox(height: 14),
                      _serviceCard(),
                      const SizedBox(height: 12),
                      _eventCard(),
                      const SizedBox(height: 12),
                      _partyCards(),
                      const SizedBox(height: 12),
                      _financialsCard(),
                      const SizedBox(height: 12),
                      _timelineCard(),
                      const SizedBox(height: 16),
                      _actionsRow(),
                    ],
                  ),
                ),
    );
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: AppColors.error.withOpacity(0.6)),
              const SizedBox(height: 12),
              Text(_error ?? 'Booking not found',
                  style: GoogleFonts.inter(fontSize: 14, color: AppColors.textTertiary),
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );

  // ────────────────────────────────────────────────────────────
  // Sections
  // ────────────────────────────────────────────────────────────

  Widget _statusHeader() {
    final status = (_booking?['status']?.toString() ?? 'pending').toLowerCase();
    final color = _statusStyles[status] ?? AppColors.textTertiary;
    final id = _booking?['id']?.toString() ?? '';
    final shortId = id.length >= 8 ? id.substring(0, 8) : id;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.18)),
      ),
      child: Row(
        children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
            child: Icon(_iconFor(status), color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(status.toUpperCase(),
                    style: GoogleFonts.inter(
                        fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: color)),
                const SizedBox(height: 2),
                Text('Booking #$shortId',
                    style: GoogleFonts.inter(
                        fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ],
            ),
          ),
          if (id.isNotEmpty)
            IconButton(
              tooltip: 'Copy booking ID',
              icon: const Icon(Icons.copy, size: 16, color: AppColors.textTertiary),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: id));
                AppSnackbar.success(context, 'Booking ID copied');
              },
            ),
        ],
      ),
    );
  }

  IconData _iconFor(String s) {
    switch (s) {
      case 'accepted': return Icons.check_circle_outline;
      case 'rejected': return Icons.cancel_outlined;
      case 'completed': return Icons.task_alt_outlined;
      case 'cancelled': return Icons.do_not_disturb_alt_outlined;
      default: return Icons.access_time;
    }
  }

  Widget _serviceCard() {
    final service = _booking?['service'] is Map<String, dynamic>
        ? _booking!['service'] as Map<String, dynamic>
        : <String, dynamic>{};
    final title = service['title']?.toString() ?? _booking?['service_name']?.toString() ?? 'Service';
    final category = service['category']?.toString() ?? '';
    final image = service['primary_image']?.toString()
        ?? service['image']?.toString()
        ?? service['cover_image']?.toString()
        ?? service['image_url']?.toString()
        ?? '';
    final initials = title
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => w[0])
        .take(2)
        .join()
        .toUpperCase();

    return _card(
      title: 'Service',
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 72, height: 72,
              child: image.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: image, fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _initials(initials),
                    )
                  : _initials(initials),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: GoogleFonts.inter(
                        fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    maxLines: 2, overflow: TextOverflow.ellipsis),
                if (category.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(category,
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _initials(String s) => Container(
        color: AppColors.surfaceVariant,
        alignment: Alignment.center,
        child: Text(s,
            style: GoogleFonts.inter(
                fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textTertiary)),
      );

  Widget _eventCard() {
    final eventName = _booking?['event_name']?.toString()
        ?? _booking?['event']?['name']?.toString() ?? '';
    final eventType = _booking?['event_type']?.toString() ?? '';
    final eventDate = _booking?['event_date']?.toString() ?? '';
    final venue = _booking?['venue']?.toString() ?? _booking?['location']?.toString() ?? '';
    final guestCount = _booking?['guest_count'];

    return _card(
      title: 'Event Details',
      child: Column(
        children: [
          if (eventName.isNotEmpty)
            _detailRow('assets/icons/calendar-icon.svg', eventName, sub: eventType.isEmpty ? null : eventType),
          if (eventDate.isNotEmpty)
            _detailRow('assets/icons/calendar-icon.svg', _formatDate(eventDate)),
          if (venue.isNotEmpty)
            _detailRow('assets/icons/location-icon.svg', venue),
          if (guestCount != null)
            _detailRowIcon(Icons.people_outline, '$guestCount guests expected'),
        ],
      ),
    );
  }

  Widget _partyCards() {
    final provider = _booking?['provider'] is Map<String, dynamic>
        ? _booking!['provider'] as Map<String, dynamic>
        : null;
    final client = _booking?['client'] is Map<String, dynamic>
        ? _booking!['client'] as Map<String, dynamic>
        : null;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (provider != null) Expanded(child: _partyCard('Service Provider', provider)),
        if (provider != null && client != null) const SizedBox(width: 10),
        if (client != null) Expanded(child: _partyCard('Client', client)),
      ],
    );
  }

  Widget _partyCard(String label, Map<String, dynamic> p) {
    final name = p['name']?.toString() ?? 'Unknown';
    final phone = p['phone']?.toString() ?? '';
    final email = p['email']?.toString() ?? '';
    return _card(
      title: label.toUpperCase(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name,
              style: GoogleFonts.inter(
                  fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 8),
          if (phone.isNotEmpty)
            _linkRow(Icons.phone, phone, () => launchUrl(Uri.parse('tel:$phone'))),
          if (email.isNotEmpty)
            _linkRow(Icons.mail_outline, email, () => launchUrl(Uri.parse('mailto:$email'))),
        ],
      ),
    );
  }

  Widget _financialsCard() {
    final agreed = _booking?['agreed_price'];
    final quoted = _booking?['quoted_price'];
    final deposit = _booking?['deposit_required'];
    final paid = _booking?['amount_paid'];

    if (agreed == null && quoted == null && deposit == null && paid == null) {
      return const SizedBox.shrink();
    }

    return _card(
      title: 'Financials',
      child: Column(
        children: [
          if (agreed != null) _moneyRow('Agreed price', agreed, highlight: true),
          if (quoted != null) _moneyRow('Quoted price', quoted),
          if (deposit != null) _moneyRow('Deposit required', deposit),
          if (paid != null) _moneyRow('Amount paid', paid),
        ],
      ),
    );
  }

  Widget _timelineCard() {
    final status = (_booking?['status']?.toString() ?? 'pending').toLowerCase();
    final created = _booking?['created_at']?.toString() ?? '';
    final responded = _booking?['responded_at']?.toString() ?? '';
    final completed = _booking?['completed_at']?.toString() ?? '';
    final cancelled = _booking?['cancelled_at']?.toString() ?? '';

    final steps = <_TimelineStep>[
      _TimelineStep('Requested', created.isNotEmpty ? _formatDate(created) : 'Pending', true),
      _TimelineStep(
        status == 'rejected' ? 'Declined' : 'Accepted',
        responded.isNotEmpty ? _formatDate(responded) : '—',
        status == 'accepted' || status == 'rejected' || status == 'completed',
      ),
      if (status == 'completed' || completed.isNotEmpty)
        _TimelineStep('Completed', completed.isNotEmpty ? _formatDate(completed) : '—', true),
      if (status == 'cancelled' || cancelled.isNotEmpty)
        _TimelineStep('Cancelled', cancelled.isNotEmpty ? _formatDate(cancelled) : '—', true),
    ];

    return _card(
      title: 'Status Timeline',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < steps.length; i++)
            _timelineItem(steps[i], isLast: i == steps.length - 1),
        ],
      ),
    );
  }

  Widget _timelineItem(_TimelineStep s, {required bool isLast}) {
    final color = s.done ? AppColors.success : AppColors.textHint;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 12, height: 12,
                decoration: BoxDecoration(
                  color: s.done ? color : AppColors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(color: color, width: 2),
                ),
              ),
              if (!isLast) Expanded(child: Container(width: 2, color: AppColors.border)),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.label,
                      style: GoogleFonts.inter(
                          fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(s.subtitle,
                      style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionsRow() {
    final status = (_booking?['status']?.toString() ?? 'pending').toLowerCase();
    final id = _booking?['id']?.toString() ?? '';
    if (id.isEmpty) return const SizedBox.shrink();

    if (status == 'pending' || status == 'accepted') {
      return SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () async {
            final cancelled = await showCancelBookingDialog(
                context, bookingId: id, cancellingParty: 'organiser');
            if (cancelled) await _load();
          },
          icon: const Icon(Icons.do_not_disturb_alt_outlined, color: AppColors.error),
          label: Text('Cancel booking',
              style: GoogleFonts.inter(
                  fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.error)),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            side: const BorderSide(color: AppColors.error),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  // ────────────────────────────────────────────────────────────
  // Small reusable bits
  // ────────────────────────────────────────────────────────────

  Widget _card({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: GoogleFonts.inter(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  letterSpacing: 0.6, color: AppColors.textTertiary)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _detailRow(String svgPath, String text, {String? sub}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SvgPicture.asset(svgPath, width: 16, height: 16,
              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text,
                    style: GoogleFonts.inter(
                        fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                if (sub != null) ...[
                  const SizedBox(height: 2),
                  Text(sub,
                      style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRowIcon(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.textHint),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: GoogleFonts.inter(
                    fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          ),
        ],
      ),
    );
  }

  Widget _linkRow(IconData icon, String text, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon, size: 14, color: AppColors.primary),
            const SizedBox(width: 6),
            Expanded(
              child: Text(text,
                  style: GoogleFonts.inter(
                      fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }

  Widget _moneyRow(String label, dynamic amount, {bool highlight = false}) {
    final v = amount is num ? amount : num.tryParse(amount.toString()) ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary)),
          Text('TZS ${_formatAmount(v)}',
              style: GoogleFonts.inter(
                  fontSize: highlight ? 15 : 13,
                  fontWeight: highlight ? FontWeight.w800 : FontWeight.w600,
                  color: highlight ? AppColors.primary : AppColors.textPrimary)),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${d.day} ${m[d.month - 1]} ${d.year}';
    } catch (_) {
      return iso;
    }
  }

  String _formatAmount(num n) {
    final s = n.toStringAsFixed(0);
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}

class _TimelineStep {
  final String label;
  final String subtitle;
  final bool done;
  _TimelineStep(this.label, this.subtitle, this.done);
}
