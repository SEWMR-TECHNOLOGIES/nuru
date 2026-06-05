import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/event_extras_service.dart';
import '../../../core/utils/money_format.dart';
import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/widgets/app_snackbar.dart';

/// Event Sponsors tab — organiser invites vendor services as sponsors and tracks
/// accept / decline responses. All values come from the backend, nothing is hardcoded.
class EventSponsorsTab extends StatefulWidget {
  final String eventId;
  final bool isCreator;
  const EventSponsorsTab({super.key, required this.eventId, required this.isCreator});

  @override
  State<EventSponsorsTab> createState() => _EventSponsorsTabState();
}

class _EventSponsorsTabState extends State<EventSponsorsTab> with AutomaticKeepAliveClientMixin {
  bool _loading = true;
  List<Map<String, dynamic>> _items = const [];
  Map<String, dynamic> _summary = const {};

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getSponsors(widget.eventId);
    if (!mounted) return;
    final data = res['data'];
    if (res['success'] == true && data is Map) {
      final items = (data['items'] as List? ?? const [])
          .whereType<Map>()
          .map((m) => m.cast<String, dynamic>())
          .toList();
      setState(() {
        _items = items;
        _summary = (data['summary'] is Map) ? (data['summary'] as Map).cast<String, dynamic>() : const {};
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  Future<void> _cancel(String id) async {
    final res = await EventsService.cancelSponsor(widget.eventId, id);
    if (!mounted) return;
    if (res['success'] == true) {
      AppSnackbar.success(context, 'Sponsor invitation removed');
      _load();
    } else {
      AppSnackbar.error(context, res['message']?.toString() ?? 'Could not remove');
    }
  }

  void _openInvite() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => _InviteSheet(eventId: widget.eventId, onInvited: _load),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return NuruRefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Event Sponsors', style: appText(size: 16, weight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Invite vendors to support your event', style: appText(size: 12, color: AppColors.textTertiary)),
            ])),
            if (widget.isCreator)
              ElevatedButton.icon(
                onPressed: _openInvite,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary, foregroundColor: Colors.white, elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.add, size: 18),
                label: Text('Invite', style: appText(size: 13, weight: FontWeight.w700, color: Colors.white)),
              ),
          ]),
          const SizedBox(height: 14),
          _summaryStrip(),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
          else if (_items.isEmpty)
            _emptyState()
          else
            ..._items.map(_sponsorCard),
        ],
      ),
    );
  }

  Widget _summaryStrip() {
    final total = _summary['total'] ?? _items.length;
    final accepted = _summary['accepted'] ?? 0;
    final pending = _summary['pending'] ?? 0;
    final contributionTotal = (_summary['contribution_total'] is num) ? (_summary['contribution_total'] as num).toDouble() : 0.0;
    return Row(children: [
      Expanded(child: _statChip('Total', '$total')),
      const SizedBox(width: 8),
      Expanded(child: _statChip('Accepted', '$accepted')),
      const SizedBox(width: 8),
      Expanded(child: _statChip('Pending', '$pending')),
      const SizedBox(width: 8),
      Expanded(child: _statChip('Pledged', '${getActiveCurrency()} ${contributionTotal.toStringAsFixed(0)}')),
    ]);
  }

  Widget _statChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderLight)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
          child: Text(value, style: appText(size: 14, weight: FontWeight.w800))),
        const SizedBox(height: 2),
        Text(label, style: appText(size: 10, color: AppColors.textTertiary, weight: FontWeight.w600)),
      ]),
    );
  }

  Widget _emptyState() => Container(
    padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.borderLight)),
    child: Column(children: [
      Icon(Icons.handshake_outlined, size: 40, color: AppColors.textTertiary),
      const SizedBox(height: 10),
      Text('No sponsors yet', style: appText(size: 14, weight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text('Invite vendors to sponsor your event', style: appText(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
    ]),
  );

  Widget _sponsorCard(Map<String, dynamic> s) {
    final svc = (s['service'] is Map) ? (s['service'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final vendor = (s['vendor'] is Map) ? (s['vendor'] as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final status = (s['status'] ?? 'pending').toString();
    final amount = s['contribution_amount'];
    final amountStr = (amount is num) ? '${getActiveCurrency()} ${amount.toStringAsFixed(0)}' : null;

    Color sColor; String sLabel;
    switch (status) {
      case 'accepted': sColor = const Color(0xFF16A34A); sLabel = 'Accepted'; break;
      case 'declined': sColor = const Color(0xFFDC2626); sLabel = 'Declined'; break;
      case 'cancelled': sColor = AppColors.textTertiary; sLabel = 'Cancelled'; break;
      default: sColor = const Color(0xFFF5B400); sLabel = 'Pending';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.borderLight)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 56, height: 56,
            child: (svc['image'] is String && (svc['image'] as String).isNotEmpty)
              ? Image.network(svc['image'], fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.surfaceVariant))
              : Container(color: AppColors.surfaceVariant, child: const Icon(Icons.storefront_outlined, color: Colors.white)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text((svc['title'] ?? 'Service').toString(), style: appText(size: 14, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text((vendor['name'] ?? '').toString(), style: appText(size: 12, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 8),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: sColor.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
              child: Text(sLabel, style: appText(size: 10, weight: FontWeight.w700, color: sColor)),
            ),
            if (amountStr != null) ...[
              const SizedBox(width: 8),
              Text(amountStr, style: appText(size: 12, weight: FontWeight.w700)),
            ],
          ]),
        ])),
        if (widget.isCreator)
          IconButton(onPressed: () => _cancel(s['id'].toString()), icon: const Icon(Icons.close, size: 18, color: AppColors.textTertiary)),
      ]),
    );
  }
}

class _InviteSheet extends StatefulWidget {
  final String eventId; final VoidCallback onInvited;
  const _InviteSheet({required this.eventId, required this.onInvited});
  @override State<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends State<_InviteSheet> {
  final _searchCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _results = const [];
  bool _searching = false;
  bool _sending = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  void _onSearch(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      if (q.trim().isEmpty) { setState(() => _results = const []); return; }
      setState(() => _searching = true);
      final res = await EventExtrasService.searchServicesPublic(q.trim());
      if (!mounted) return;
      final data = res['data'];
      List<Map<String, dynamic>> list = const [];
      if (data is Map && data['services'] is List) {
        list = (data['services'] as List).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();
      } else if (data is List) {
        list = data.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();
      }
      setState(() { _results = list; _searching = false; });
    });
  }

  Future<void> _invite(Map<String, dynamic> svc) async {
    if (_sending) return;
    setState(() => _sending = true);
    final amt = double.tryParse(_amountCtrl.text.trim());
    final res = await EventsService.inviteSponsor(widget.eventId, {
      'user_service_id': svc['id'],
      if (amt != null) 'contribution_amount': amt,
    });
    if (!mounted) return;
    setState(() => _sending = false);
    if (res['success'] == true) {
      Navigator.pop(context);
      AppSnackbar.success(context, 'Sponsor invitation sent');
      widget.onInvited();
    } else {
      AppSnackbar.error(context, res['message']?.toString() ?? 'Could not invite');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(4)))),
              const SizedBox(height: 14),
              Text('Invite Sponsor', style: appText(size: 16, weight: FontWeight.w800)),
              const SizedBox(height: 12),
              TextField(
                controller: _searchCtrl,
                autocorrect: false, enableSuggestions: false,
                decoration: InputDecoration(
                  hintText: 'Search vendor services...',
                  prefixIcon: const Icon(Icons.search, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderLight)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                onChanged: _onSearch,
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  hintText: 'Optional sponsorship amount',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderLight)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: _searching
                  ? const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
                  : (_results.isEmpty
                    ? Padding(padding: const EdgeInsets.all(20), child: Text(_searchCtrl.text.isEmpty ? 'Start typing to search vendors' : 'No services found', style: appText(size: 12, color: AppColors.textTertiary)))
                    : ListView.builder(
                        shrinkWrap: true,
                        itemCount: _results.length,
                        itemBuilder: (_, i) {
                          final s = _results[i];
                          final img = s['primary_image']?.toString() ?? s['image_url']?.toString();
                          return InkWell(
                            onTap: () => _invite(s),
                            borderRadius: BorderRadius.circular(12),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                              child: Row(children: [
                                ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 40, height: 40, child: (img != null && img.isNotEmpty) ? Image.network(img, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.surfaceVariant)) : Container(color: AppColors.surfaceVariant))),
                                const SizedBox(width: 10),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                                  Text((s['title'] ?? '').toString(), style: appText(size: 13, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  Text((s['category'] ?? s['service_type_name'] ?? '').toString(), style: appText(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                                ])),
                                const Icon(Icons.chevron_right, color: AppColors.textTertiary),
                              ]),
                            ),
                          );
                        },
                      )),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
