import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/user_services_service.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  List<dynamic> _bookings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await UserServicesService.getBookings();
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _bookings = data is List ? data : (data is Map ? (data['bookings'] ?? []) : []);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: 'Bookings'),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _bookings.isEmpty
                ? ListView(children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                    _emptyState(),
                  ])
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _bookings.length,
                    itemBuilder: (_, i) => _bookingCard(_bookings[i]),
                  ),
      ),
    );
  }

  Widget _emptyState() {
    return Column(
      children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(32)),
          child: const Center(child: Icon(Icons.calendar_today_outlined, size: 28, color: AppColors.textHint)),
        ),
        const SizedBox(height: 16),
        Text('No bookings yet', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text('Your service bookings will appear here', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
      ],
    );
  }

  Widget _bookingCard(dynamic booking) {
    final b = booking is Map<String, dynamic> ? booking : <String, dynamic>{};
    final serviceName = b['service_name']?.toString() ?? b['service']?['name']?.toString() ?? 'Service';
    final eventName = b['event_name']?.toString() ?? b['event']?['name']?.toString() ?? '';
    final status = b['status']?.toString() ?? 'pending';
    final date = b['event_date']?.toString() ?? b['created_at']?.toString() ?? '';
    final clientName = b['client_name']?.toString() ?? b['user']?['first_name']?.toString() ?? '';
    final amount = b['total_amount'] ?? b['amount'];

    Color statusColor;
    switch (status) {
      case 'accepted': case 'confirmed': statusColor = AppColors.success; break;
      case 'pending': statusColor = AppColors.warning; break;
      case 'rejected': case 'cancelled': statusColor = AppColors.error; break;
      default: statusColor = AppColors.textTertiary;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(serviceName, style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.3))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Text(status.toUpperCase(), style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor, letterSpacing: 0.5)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (eventName.isNotEmpty)
            _infoRow(Icons.calendar_today_outlined, 'Event: $eventName'),
          if (clientName.isNotEmpty)
            _infoRow(Icons.person_outline, clientName),
          if (date.isNotEmpty)
            _infoRow(Icons.access_time, date.contains('T') ? date.split('T').first : date),
          if (amount != null) ...[
            const SizedBox(height: 6),
            Text('TZS $amount', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
          ],
          if (status == 'pending') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final id = b['id']?.toString() ?? '';
                      if (id.isNotEmpty) {
                        await UserServicesService.updateBookingStatus(id, 'accepted');
                        _load();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                      child: Center(child: Text('Accept', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white))),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final id = b['id']?.toString() ?? '';
                      if (id.isNotEmpty) {
                        await UserServicesService.updateBookingStatus(id, 'rejected');
                        _load();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(10)),
                      child: Center(child: Text('Decline', style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary))),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppColors.textHint),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary, height: 1.4))),
        ],
      ),
    );
  }
}
