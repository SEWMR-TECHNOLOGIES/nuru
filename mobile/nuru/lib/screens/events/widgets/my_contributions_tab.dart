import 'package:nuru/core/utils/money_format.dart' show getActiveCurrency;
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/services/event_contributors_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/event_image.dart';
import '../../wallet/make_payment_screen.dart';

/// Premium "My Contributions" tab — events where the logged-in user is listed
/// as a contributor. Each card shows pledge / paid / balance + a Pay button
/// that opens the same gateway-driven checkout flow used on web.
class MyContributionsTab extends StatefulWidget {
  const MyContributionsTab({super.key});
  @override
  State<MyContributionsTab> createState() => _MyContributionsTabState();
}

class _MyContributionsTabState extends State<MyContributionsTab> {
  bool _loading = true;
  String? _error;
  List<dynamic> _events = [];
  String _searchTerm = '';
  Timer? _debounce;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _debounce?.cancel(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final res = await EventContributorsService.getMyContributions(
      search: _searchTerm.isEmpty ? null : _searchTerm,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _events = (res['data']?['events'] as List?) ?? [];
        _loading = false;
      });
    } else {
      setState(() { _error = res['message']?.toString() ?? 'Failed to load'; _loading = false; });
    }
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      setState(() => _searchTerm = v);
      _load();
    });
  }

  Widget _searchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: TextField(
        onChanged: _onSearchChanged,
        style: GoogleFonts.inter(fontSize: 14),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search contributing events…',
          hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary),
          prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppColors.textTertiary),
          filled: true,
          fillColor: AppColors.surfaceVariant,
          contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(22), borderSide: BorderSide.none),
        ),
      ),
    );
  }

  String _fmt(num n) => NumberFormat('#,##0').format(n);

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _searchBar(),
        if (_loading)
          const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator())
        else if (_error != null)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.error_outline, color: Colors.red.shade400, size: 40),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: _load, icon: const Icon(Icons.refresh, size: 16), label: const Text('Retry')),
            ]),
          )
        else if (_events.isEmpty)
          Padding(
            padding: const EdgeInsets.all(40),
            child: Column(children: [
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                child: Icon(Icons.volunteer_activism, color: AppColors.primary, size: 32),
              ),
              const SizedBox(height: 16),
              Text(_searchTerm.isEmpty ? 'No contributions yet' : 'No matches',
                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                _searchTerm.isEmpty
                    ? 'When an organiser adds you as a contributor to their event, it will appear here so you can pay your pledge in one tap.'
                    : 'No contributing events match "$_searchTerm".',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary, height: 1.4),
              ),
            ]),
          )
        else
          ..._events.map((e) => Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                child: _card(e as Map<String, dynamic>),
              )),
      ],
    );
  }

  Widget _card(Map<String, dynamic> ev) {
    final currency = ev['currency']?.toString() ?? getActiveCurrency();
    final pledge = (ev['pledge_amount'] as num?)?.toDouble() ?? 0;
    final paid = (ev['total_paid'] as num?)?.toDouble() ?? 0;
    final pending = (ev['pending_amount'] as num?)?.toDouble() ?? 0;
    final balance = (ev['balance'] as num?)?.toDouble() ?? 0;
    final pct = pledge > 0 ? (paid / pledge).clamp(0.0, 1.0) : 0.0;
    final isComplete = pledge > 0 && balance == 0 && pending == 0;
    final cover = ev['event_cover_image_url']?.toString();
    final name = ev['event_name']?.toString() ?? 'Event';
    final org = ev['organizer_name']?.toString();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 16, offset: const Offset(0, 4))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Cover
        Stack(children: [
          Container(
            height: 110, width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft, end: Alignment.bottomRight,
                colors: [AppColors.primary.withOpacity(0.5), AppColors.primary.withOpacity(0.2)],
              ),
              image: DecorationImage(
                image: cover != null && cover.isNotEmpty
                    ? NetworkImage(cover) as ImageProvider
                    : const AssetImage(kNuruEventDefaultAsset),
                fit: BoxFit.cover,
              ),
            ),
          ),
          Container(
            height: 110,
            decoration: const BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
                colors: [Colors.transparent, Color(0x99000000)]),
            ),
          ),
          Positioned(left: 14, right: 14, bottom: 10, child: Text(name,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700))),
          if (isComplete)
            Positioned(top: 10, right: 10, child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.green.shade600, borderRadius: BorderRadius.circular(10)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_circle, color: Colors.white, size: 12),
                const SizedBox(width: 4),
                Text('Complete', style: GoogleFonts.inter(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
              ]),
            )),
        ]),
        // Body
        Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: _stat('Pledged', '$currency ${_fmt(pledge)}', null)),
              const SizedBox(width: 8),
              Expanded(child: _stat('Paid', '$currency ${_fmt(paid)}', Colors.green.shade600)),
              const SizedBox(width: 8),
              Expanded(child: _stat('Balance', '$currency ${_fmt(balance)}', balance > 0 ? Colors.amber.shade700 : null)),
            ]),
            if (pledge > 0) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(value: pct, minHeight: 6,
                  backgroundColor: AppColors.primary.withOpacity(0.1),
                  valueColor: AlwaysStoppedAnimation(AppColors.primary)),
              ),
              const SizedBox(height: 6),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('${(pct * 100).round()}% complete',
                  style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)),
                if (pending > 0)
                  Text('$currency ${_fmt(pending)} pending',
                    style: GoogleFonts.inter(fontSize: 11, color: Colors.amber.shade700, fontWeight: FontWeight.w600)),
              ]),
            ],
            if (org != null && org.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text('Organised by $org',
                style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)),
            ],
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, child: ElevatedButton.icon(
              onPressed: isComplete ? null : () => _openPaySheet(ev),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              icon: const Icon(Icons.volunteer_activism, size: 16),
              label: Text(isComplete
                  ? 'Fully paid'
                  : balance > 0 ? 'Pay $currency ${_fmt(balance)}' : 'Make a contribution',
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
            )),
          ]),
        ),
      ]),
    );
  }

  Widget _stat(String label, String value, Color? color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(),
        style: GoogleFonts.inter(fontSize: 9, color: AppColors.textTertiary, letterSpacing: 0.5, fontWeight: FontWeight.w600)),
      const SizedBox(height: 2),
      Text(value, maxLines: 1, overflow: TextOverflow.ellipsis,
        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: color ?? AppColors.textPrimary)),
    ]),
  );

  void _openPaySheet(Map<String, dynamic> ev) {
    final balance = (ev['balance'] as num?)?.toDouble() ?? 0;
    final eventId = ev['event_id']?.toString();
    final eventName = ev['event_name']?.toString() ?? 'Event contribution';
    final eventCover = ev['event_cover_image_url']?.toString();
    if (eventId == null || eventId.isEmpty) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MakePaymentScreen(
          targetType: 'event_contribution',
          targetId: eventId,
          amount: balance > 0 ? balance : null,
          amountEditable: true,
          allowBank: false,
          title: 'Pay contribution',
          description: 'For $eventName',
          summaryImageUrl: eventCover,
          summaryMeta: eventName,
          showFee: true,
          onSuccess: (_) => _load(),
        ),
      ),
    );
  }
}

