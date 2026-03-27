import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:open_filex/open_filex.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/report_generator.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../report_preview_screen.dart';
import '../../../core/widgets/deleting_overlay.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.2}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

const _kPaymentMethods = [
  {'id': 'cash', 'name': 'Cash'},
  {'id': 'mpesa', 'name': 'M-Pesa'},
  {'id': 'tigopesa', 'name': 'Tigo Pesa'},
  {'id': 'airtelmoney', 'name': 'Airtel Money'},
  {'id': 'bank_transfer', 'name': 'Bank Transfer'},
  {'id': 'other', 'name': 'Other'},
];

class EventContributionsTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  const EventContributionsTab({super.key, required this.eventId, this.permissions});

  @override
  State<EventContributionsTab> createState() => _EventContributionsTabState();
}

class _EventContributionsTabState extends State<EventContributionsTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> _eventContributors = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  bool _actionLoading = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getEventContributors(widget.eventId);
    if (mounted) setState(() {
      _loading = false;
      if (res['success'] == true) {
        _eventContributors = res['data']?['event_contributors'] ?? [];
        _summary = res['data']?['summary'] ?? {};
      }
    });
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return 'TZS 0';
    final n = (amount is String ? double.tryParse(amount) : amount.toDouble()) ?? 0.0;
    return 'TZS ${n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final canManage = widget.permissions?['can_manage_contributions'] == true || widget.permissions?['is_creator'] == true;

    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    final totalPledged = _toNum(_summary['total_pledged'] ?? _summary['total_amount']);
    final totalPaid = _toNum(_summary['total_paid'] ?? _summary['total_confirmed']);
    final totalBalance = (totalPledged - totalPaid).clamp(0, double.infinity);

    return Stack(children: [
      RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Summary card
            Container(
              padding: const EdgeInsets.all(18),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Contributions', style: _f(size: 15, weight: FontWeight.w700)),
                  const SizedBox(height: 14),
                  Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_formatAmount(totalPaid), style: _f(size: 22, weight: FontWeight.w800, color: AppColors.primary)),
                      Text('collected', style: _f(size: 12, color: AppColors.textTertiary)),
                    ])),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('${_eventContributors.length}', style: _f(size: 18, weight: FontWeight.w700)),
                      Text('contributors', style: _f(size: 12, color: AppColors.textTertiary)),
                    ]),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: _miniStat(_formatAmount(totalPledged), 'Pledged')),
                    Container(width: 1, height: 30, color: AppColors.border),
                    Expanded(child: _miniStat(_formatAmount(totalPaid), 'Paid')),
                    Container(width: 1, height: 30, color: AppColors.border),
                    Expanded(child: _miniStat(_formatAmount(totalBalance), 'Pending Pledge')),
                  ]),
                ],
              ),
            ),

            // Download Reports
            Container(
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Download Report', style: _f(size: 13, weight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _downloadReport('pdf'),
                        icon: const Icon(Icons.picture_as_pdf_rounded, size: 16),
                        label: Text('PDF', style: _f(size: 12, weight: FontWeight.w600)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _downloadReport('xlsx'),
                        icon: const Icon(Icons.table_chart_rounded, size: 16),
                        label: Text('Excel', style: _f(size: 12, weight: FontWeight.w600)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.accent,
                          side: BorderSide(color: AppColors.accent),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ]),
                ],
              ),
            ),

            Row(children: [
              Expanded(child: Text('${_eventContributors.length} contributors', style: _f(size: 14, weight: FontWeight.w600, color: AppColors.textSecondary))),
              if (canManage)
                GestureDetector(
                  onTap: _showAddContributorSheet,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
                    child: Text('+ Add Contributor', style: _f(size: 12, weight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
            ]),
            const SizedBox(height: 12),

            if (_eventContributors.isEmpty)
              Container(
                padding: const EdgeInsets.all(30),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: Center(child: Text('No contributors added yet.\nTap "Add Contributor" to get started.', textAlign: TextAlign.center, style: _f(size: 14, color: AppColors.textTertiary))),
              )
            else
              ..._eventContributors.map((ec) => _contributorTile(ec, canManage)),
          ],
        ),
      ),
      DeletingOverlay(visible: _actionLoading),
    ]);
  }

  Widget _miniStat(String value, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(children: [
        Text(value, style: _f(size: 13, weight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label, style: _f(size: 9, color: AppColors.textTertiary)),
      ]),
    );
  }

  Widget _contributorTile(Map<String, dynamic> ec, bool canManage) {
    final contributor = ec['contributor'] as Map<String, dynamic>?;
    final name = contributor?['name'] ?? 'Unknown';
    final phone = contributor?['phone']?.toString() ?? '';
    final pledged = _toNum(ec['pledge_amount']);
    final paid = _toNum(ec['total_paid']);
    final balance = (pledged - paid).clamp(0, double.infinity);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
            child: Center(child: Text(name[0].toUpperCase(), style: _f(size: 16, weight: FontWeight.w700, color: AppColors.primary))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: _f(size: 14, weight: FontWeight.w600)),
              if (phone.isNotEmpty)
                Text(phone, style: _f(size: 11, color: AppColors.textTertiary)),
              const SizedBox(height: 4),
              Row(children: [
                _inlineStat('Pledged', _formatAmount(pledged), const Color(0xFF7c3aed)),
                const SizedBox(width: 10),
                _inlineStat('Paid', _formatAmount(paid), AppColors.accent),
                const SizedBox(width: 10),
                _inlineStat('Balance', _formatAmount(balance), balance > 0 ? AppColors.error : AppColors.accent),
              ]),
            ],
          )),
          if (canManage)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 18, color: AppColors.textHint),
              onSelected: (action) async {
                final ecId = ec['id']?.toString() ?? '';
                if (action == 'payment') _showRecordPaymentSheet(ec);
                if (action == 'pledge') _showUpdatePledgeSheet(ec);
                if (action == 'remove') {
                  setState(() => _actionLoading = true);
                  final res = await EventsService.removeContributorFromEvent(widget.eventId, ecId);
                  if (mounted) {
                    setState(() => _actionLoading = false);
                    if (res['success'] == true) { AppSnackbar.success(context, 'Removed'); _load(); }
                    else AppSnackbar.error(context, res['message'] ?? 'Failed');
                  }
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'payment', child: Text('Record Payment')),
                const PopupMenuItem(value: 'pledge', child: Text('Update Pledge')),
                const PopupMenuItem(value: 'remove', child: Text('Remove', style: TextStyle(color: Colors.red))),
              ],
            ),
        ],
      ),
    );
  }

  Widget _inlineStat(String label, String value, Color color) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: _f(size: 8, color: AppColors.textTertiary)),
      Text(value, style: _f(size: 11, weight: FontWeight.w700, color: color)),
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD CONTRIBUTOR - Matches web: "New" + "From Address Book" tabs
  // ═══════════════════════════════════════════════════════════════════════════

  void _showAddContributorSheet() {
    int tabIndex = 0; // 0 = New, 1 = From Address Book
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final pledgeCtrl = TextEditingController();
    final notesCtrl = TextEditingController();

    // Address book state
    List<dynamic> searchResults = [];
    bool searchLoading = false;
    String? selectedExistingId;
    final searchCtrl = TextEditingController();
    final existPledgeCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          Future<void> searchAddressBook(String query) async {
            setSheetState(() => searchLoading = true);
            final res = await EventsService.getUserContributors(search: query);
            if (res['success'] == true) {
              setSheetState(() {
                searchResults = res['data']?['contributors'] ?? [];
                searchLoading = false;
              });
            } else {
              setSheetState(() => searchLoading = false);
            }
          }

          Future<void> submit() async {
            Map<String, dynamic> data;
            if (tabIndex == 0) {
              // New contributor
              if (nameCtrl.text.trim().isEmpty) { AppSnackbar.error(ctx, 'Name is required'); return; }
              if (phoneCtrl.text.trim().isEmpty) { AppSnackbar.error(ctx, 'Phone is required'); return; }
              data = {
                'name': nameCtrl.text.trim(),
                'email': emailCtrl.text.trim().isEmpty ? null : emailCtrl.text.trim(),
                'phone': phoneCtrl.text.trim(),
                'pledge_amount': double.tryParse(pledgeCtrl.text.trim()) ?? 0,
                'notes': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
              };
            } else {
              // From address book
              if (selectedExistingId == null) { AppSnackbar.error(ctx, 'Select a contributor'); return; }
              data = {
                'contributor_id': selectedExistingId,
                'pledge_amount': double.tryParse(existPledgeCtrl.text.trim()) ?? 0,
              };
            }
            Navigator.pop(ctx);
            setState(() => _actionLoading = true);
            final res = await EventsService.addContributorToEvent(widget.eventId, data);
            if (mounted) {
              setState(() => _actionLoading = false);
              if (res['success'] == true) { AppSnackbar.success(context, 'Contributor added'); _load(); }
              else AppSnackbar.error(context, res['message'] ?? 'Failed to add contributor');
            }
          }

          return Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 20),
                  Text('Add Contributor', style: _f(size: 18, weight: FontWeight.w700)),
                  const SizedBox(height: 16),

                  // Tab selector
                  Container(
                    decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.all(3),
                    child: Row(children: [
                      _tabButton('New Contributor', tabIndex == 0, () => setSheetState(() => tabIndex = 0)),
                      const SizedBox(width: 4),
                      _tabButton('Address Book', tabIndex == 1, () {
                        setSheetState(() => tabIndex = 1);
                        if (searchResults.isEmpty) searchAddressBook('');
                      }),
                    ]),
                  ),
                  const SizedBox(height: 18),

                  if (tabIndex == 0) ...[
                    // New contributor form
                    _label('Name *'),
                    _input(nameCtrl, 'Full name'),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _label('Email'),
                        _input(emailCtrl, 'email@example.com', keyboard: TextInputType.emailAddress),
                      ])),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _label('Phone *'),
                        _input(phoneCtrl, '+255...', keyboard: TextInputType.phone),
                      ])),
                    ]),
                    const SizedBox(height: 12),
                    _label('Pledge Amount (TZS)'),
                    _input(pledgeCtrl, 'e.g. 20,000', keyboard: TextInputType.number),
                    const SizedBox(height: 12),
                    _label('Notes'),
                    _input(notesCtrl, 'Optional notes...', maxLines: 2),
                  ] else ...[
                    // From address book
                    _label('Search Your Contributors'),
                    TextField(
                      controller: searchCtrl,
                      onChanged: (v) => searchAddressBook(v),
                      style: _f(size: 14),
                      decoration: InputDecoration(
                        hintText: 'Search by name, email, or phone...',
                        hintStyle: _f(size: 13, color: AppColors.textHint),
                        prefixIcon: const Icon(Icons.search, size: 18),
                        filled: true, fillColor: const Color(0xFFF5F7FA),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (searchLoading)
                      const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
                    else if (searchResults.isNotEmpty)
                      Container(
                        constraints: const BoxConstraints(maxHeight: 200),
                        decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(12)),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: searchResults.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final c = searchResults[i];
                            final isSelected = selectedExistingId == c['id'];
                            return GestureDetector(
                              onTap: () => setSheetState(() => selectedExistingId = c['id']),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                color: isSelected ? AppColors.primary.withOpacity(0.08) : Colors.transparent,
                                child: Row(children: [
                                  if (isSelected) const Icon(Icons.check_circle, size: 18, color: AppColors.primary) else const Icon(Icons.circle_outlined, size: 18, color: AppColors.textHint),
                                  const SizedBox(width: 10),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(c['name'] ?? '', style: _f(size: 14, weight: FontWeight.w600)),
                                    Text([c['email'], c['phone']].where((e) => e != null && e.toString().isNotEmpty).join(' · '), style: _f(size: 11, color: AppColors.textTertiary)),
                                  ])),
                                ]),
                              ),
                            );
                          },
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text('No contributors found', style: _f(size: 13, color: AppColors.textTertiary)),
                      ),
                    if (selectedExistingId != null) ...[
                      const SizedBox(height: 14),
                      _label('Pledge Amount (TZS)'),
                      _input(existPledgeCtrl, 'e.g. 20,000', keyboard: TextInputType.number),
                    ],
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity, height: 50,
                    child: ElevatedButton(
                      onPressed: submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                        elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                      ),
                      child: Text('Add Contributor', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _tabButton(String text, bool active, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: active ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: active ? [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 4)] : null,
          ),
          child: Center(child: Text(text, style: _f(size: 13, weight: active ? FontWeight.w700 : FontWeight.w500, color: active ? AppColors.primary : AppColors.textTertiary))),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORD PAYMENT - Matches web
  // ═══════════════════════════════════════════════════════════════════════════

  void _showRecordPaymentSheet(Map<String, dynamic> ec) {
    final amtCtrl = TextEditingController();
    final refCtrl = TextEditingController();
    String method = 'cash';
    final name = ec['contributor']?['name'] ?? 'Unknown';
    final pledged = _toNum(ec['pledge_amount']);
    final paid = _toNum(ec['total_paid']);
    final balance = (pledged - paid).clamp(0, double.infinity);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 20),
              Text('Record Payment', style: _f(size: 18, weight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(name, style: _f(size: 14, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Text('Pledge: ${_formatAmount(pledged)} · Paid: ${_formatAmount(paid)} · Balance: ${_formatAmount(balance)}', style: _f(size: 12, color: AppColors.textTertiary)),
              const SizedBox(height: 18),
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _label('Amount (TZS) *'),
                  _input(amtCtrl, '0', keyboard: TextInputType.number),
                ])),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _label('Payment Method'),
                  Container(
                    decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: method,
                        isExpanded: true,
                        style: _f(size: 14),
                        items: _kPaymentMethods.map((m) => DropdownMenuItem(value: m['id'] as String, child: Text(m['name'] as String, style: _f(size: 14)))).toList(),
                        onChanged: (v) { if (v != null) setSheetState(() => method = v); },
                      ),
                    ),
                  ),
                ])),
              ]),
              const SizedBox(height: 12),
              _label('Payment Reference'),
              _input(refCtrl, 'Transaction ID...'),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity, height: 50,
                child: ElevatedButton(
                  onPressed: () async {
                    if (amtCtrl.text.trim().isEmpty || (double.tryParse(amtCtrl.text.trim()) ?? 0) <= 0) {
                      AppSnackbar.error(ctx, 'Enter a valid amount');
                      return;
                    }
                    Navigator.pop(ctx);
                    setState(() => _actionLoading = true);
                    final res = await EventsService.recordContributorPayment(widget.eventId, ec['id'].toString(), {
                      'amount': double.tryParse(amtCtrl.text.trim()) ?? 0,
                      'payment_method': method,
                      if (refCtrl.text.trim().isNotEmpty) 'payment_reference': refCtrl.text.trim(),
                    });
                    if (mounted) {
                      setState(() => _actionLoading = false);
                      if (res['success'] == true) { AppSnackbar.success(context, 'Payment recorded'); _load(); }
                      else AppSnackbar.error(context, res['message'] ?? 'Failed');
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                  child: Text('Record Payment', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE PLEDGE
  // ═══════════════════════════════════════════════════════════════════════════

  void _showUpdatePledgeSheet(Map<String, dynamic> ec) {
    final pledgeCtrl = TextEditingController(text: _toNum(ec['pledge_amount']).toStringAsFixed(0));
    final name = ec['contributor']?['name'] ?? 'Unknown';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            Text('Update Pledge', style: _f(size: 18, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(name, style: _f(size: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 18),
            _label('Pledge Amount (TZS)'),
            _input(pledgeCtrl, '0', keyboard: TextInputType.number),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity, height: 50,
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  setState(() => _actionLoading = true);
                  final res = await EventsService.updateEventContributor(widget.eventId, ec['id'].toString(), {
                    'pledge_amount': double.tryParse(pledgeCtrl.text.trim()) ?? 0,
                  });
                  if (mounted) {
                    setState(() => _actionLoading = false);
                    if (res['success'] == true) { AppSnackbar.success(context, 'Pledge updated'); _load(); }
                    else AppSnackbar.error(context, res['message'] ?? 'Failed');
                  }
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                child: Text('Update Pledge', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _downloadReport(String format) async {
    AppSnackbar.success(context, 'Generating ${format == 'xlsx' ? 'Excel' : 'PDF'} report...');
    try {
      final res = await ReportGenerator.generateContributionsReport(
        widget.eventId,
        format: format,
        contributions: _eventContributors,
        summary: _summary,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => ReportPreviewScreen(
              title: 'Contribution Report',
              pdfBytes: res['bytes'] as Uint8List,
              filePath: res['path'] as String,
            ),
          ));
        } else if (res['path'] != null) {
          await OpenFilex.open(res['path'] as String);
          if (mounted) AppSnackbar.success(context, 'Report opened');
        }
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to generate report');
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to generate report');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
  );

  Widget _input(TextEditingController ctrl, String hint, {TextInputType keyboard = TextInputType.text, int maxLines = 1}) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      maxLines: maxLines,
      style: _f(size: 14),
      decoration: InputDecoration(
        hintText: hint, hintStyle: _f(size: 13, color: AppColors.textHint),
        filled: true, fillColor: const Color(0xFFF5F7FA),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }

  double _toNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }
}

double _toNum(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}
