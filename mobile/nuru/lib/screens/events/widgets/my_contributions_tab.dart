import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/services/event_contributors_service.dart';
import '../../../core/theme/app_colors.dart';

/// Premium "My Contributions" tab — events where the logged-in user is listed
/// as a contributor. Each card shows pledge / paid / balance + a Pay button
/// that submits a pending self-contribution awaiting organiser approval.
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
        style: GoogleFonts.plusJakartaSans(fontSize: 14),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search contributing events…',
          hintStyle: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary),
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
                style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                _searchTerm.isEmpty
                    ? 'When an organiser adds you as a contributor to their event, it will appear here so you can pay your pledge in one tap.'
                    : 'No contributing events match "$_searchTerm".',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary, height: 1.4),
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
    final currency = ev['currency']?.toString() ?? 'TZS';
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
              image: cover != null && cover.isNotEmpty
                  ? DecorationImage(image: NetworkImage(cover), fit: BoxFit.cover)
                  : null,
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
            style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700))),
          if (isComplete)
            Positioned(top: 10, right: 10, child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.green.shade600, borderRadius: BorderRadius.circular(10)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_circle, color: Colors.white, size: 12),
                const SizedBox(width: 4),
                Text('Complete', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
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
                  style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
                if (pending > 0)
                  Text('$currency ${_fmt(pending)} pending',
                    style: GoogleFonts.plusJakartaSans(fontSize: 11, color: Colors.amber.shade700, fontWeight: FontWeight.w600)),
              ]),
            ],
            if (org != null && org.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text('Organised by $org',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
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
                style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600)),
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
        style: GoogleFonts.plusJakartaSans(fontSize: 9, color: AppColors.textTertiary, letterSpacing: 0.5, fontWeight: FontWeight.w600)),
      const SizedBox(height: 2),
      Text(value, maxLines: 1, overflow: TextOverflow.ellipsis,
        style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700, color: color ?? AppColors.textPrimary)),
    ]),
  );

  void _openPaySheet(Map<String, dynamic> ev) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaySheet(ev: ev, onSubmitted: _load),
    );
  }
}

class _PaySheet extends StatefulWidget {
  final Map<String, dynamic> ev;
  final VoidCallback onSubmitted;
  const _PaySheet({required this.ev, required this.onSubmitted});
  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  final _amountCtrl = TextEditingController();
  final _refCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  bool _busy = false;

  String get _currency => widget.ev['currency']?.toString() ?? 'TZS';
  double get _balance => (widget.ev['balance'] as num?)?.toDouble() ?? 0;

  Future<void> _submit() async {
    final amt = double.tryParse(_amountCtrl.text.replaceAll(RegExp(r'[^\d.]'), ''));
    if (amt == null || amt <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter an amount greater than zero')));
      return;
    }
    setState(() => _busy = true);
    final res = await EventContributorsService.selfContribute(widget.ev['event_id']?.toString() ?? '', {
      'amount': amt,
      if (_refCtrl.text.trim().isNotEmpty) 'payment_reference': _refCtrl.text.trim(),
      if (_noteCtrl.text.trim().isNotEmpty) 'note': _noteCtrl.text.trim(),
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (res['success'] == true) {
      Navigator.pop(context);
      widget.onSubmitted();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Contribution submitted — waiting for organiser approval.'),
        backgroundColor: Colors.green,
      ));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res['message']?.toString() ?? 'Failed to submit'),
        backgroundColor: Colors.red,
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
          Row(children: [
            Container(width: 40, height: 40,
              decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
              child: Icon(Icons.volunteer_activism, color: AppColors.primary, size: 20)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Pay contribution',
                style: GoogleFonts.plusJakartaSans(fontSize: 17, fontWeight: FontWeight.w700)),
              if (_balance > 0)
                Text('Outstanding $_currency ${NumberFormat('#,##0').format(_balance)}',
                  style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
            ])),
          ]),
          const SizedBox(height: 20),
          Text('Amount ($_currency)', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(controller: _amountCtrl, keyboardType: TextInputType.number, autofocus: true,
            style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: '50000', filled: true, fillColor: AppColors.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            )),
          const SizedBox(height: 14),
          Text('Payment reference (optional)', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(controller: _refCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. M-Pesa code QFT3K2L8', filled: true, fillColor: AppColors.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            )),
          const SizedBox(height: 14),
          Text('Note to organiser (optional)', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(controller: _noteCtrl, maxLines: 2,
            decoration: InputDecoration(
              hintText: 'e.g. Paid via family pool', filled: true, fillColor: AppColors.surface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            )),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withOpacity(0.2)),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.info_outline, size: 16, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(child: Text(
                'Marked as pending. Organiser confirms once they receive the money. You\'ll get a notification.',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textPrimary, height: 1.4))),
            ]),
          ),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: _busy ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary, foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('Submit for approval',
                    style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700)),
          )),
        ]),
      ),
    );
  }
}
