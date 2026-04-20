import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:open_filex/open_filex.dart';
import 'package:file_picker/file_picker.dart';
import 'package:excel/excel.dart' as xl;
import 'package:csv/csv.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/services/event_contributors_service.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import '../../../core/services/report_generator.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../report_preview_screen.dart';
import '../../../core/widgets/deleting_overlay.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';

const _kPaymentMethods = [
  {'id': 'cash', 'name': 'Cash'},
  {'id': 'mobile', 'name': 'Mobile Money'},
  {'id': 'bank_transfer', 'name': 'Bank Transfer'},
  {'id': 'card', 'name': 'Card'},
  {'id': 'cheque', 'name': 'Cheque'},
  {'id': 'other', 'name': 'Other'},
];

class EventContributionsTab extends StatefulWidget {
  final String eventId;
  final String? eventTitle;
  final double? eventBudget;
  final bool isCreator;
  final Map<String, dynamic>? permissions;
  const EventContributionsTab({
    super.key,
    required this.eventId,
    this.eventTitle,
    this.eventBudget,
    this.isCreator = false,
    this.permissions,
  });

  @override
  State<EventContributionsTab> createState() => _EventContributionsTabState();
}

class _EventContributionsTabState extends State<EventContributionsTab>
    with AutomaticKeepAliveClientMixin {
  List<dynamic> _eventContributors = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  bool _actionLoading = false;
  String _searchQuery = '';
  final _searchCtrl = TextEditingController();

  // Pending contributions
  List<dynamic> _pendingContributions = [];
  final Set<String> _selectedPending = {};

  // Messaging state
  bool _messagingExpanded = false;
  String _messagingCase = 'no_contribution';
  String _messageTemplate = '';
  String _paymentInfo = '';
  String _reminderContactOverride = '';
  final Set<String> _messagingSelected = {};
  bool _sendingMessages = false;

  @override
  bool get wantKeepAlive => true;

  bool get _canManage =>
      widget.permissions?['can_manage_contributions'] == true ||
      widget.permissions?['is_creator'] == true;

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.isCreator) _loadPending();
    _setDefaultTemplate();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _setDefaultTemplate() {
    _messageTemplate = _getDefaultTemplate(_messagingCase);
  }

  String _getDefaultTemplate(String caseType) {
    switch (caseType) {
      case 'no_contribution':
        return '{event_title}\nHabari {name},\nTunakukumbusha kutoa mchango wako kwa ajili ya {event_name}.\nNamba ya malipo: {payment}';
      case 'partial':
        return '{event_title}\nHabari {name},\nTunakukumbusha kumalizia mchango wako kwa ajili ya {event_name}.\nNamba ya malipo: {payment}';
      case 'completed':
        return '{event_title}\nHabari {name},\nAsante kwa kukamilisha mchango wako kwa ajili ya {event_name}. Tunathamini sana ushiriki wako.';
      default:
        return '';
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await EventsService.getEventContributors(widget.eventId);
    if (mounted)
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          _eventContributors = res['data']?['event_contributors'] ?? [];
          _summary = res['data']?['summary'] ?? {};
        }
      });
  }

  Future<void> _loadPending() async {
    final res = await EventsService.getPendingContributions(widget.eventId);
    if (mounted && res['success'] == true) {
      setState(
        () => _pendingContributions = res['data']?['contributions'] ?? [],
      );
    }
  }

  String _formatAmount(dynamic amount) {
    if (amount == null) return 'TZS 0';
    final n =
        (amount is String ? double.tryParse(amount) : amount.toDouble()) ?? 0.0;
    return 'TZS ${n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  double _toNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  List<dynamic> get _filteredContributors {
    if (_searchQuery.isEmpty) return _eventContributors;
    final q = _searchQuery.toLowerCase();
    return _eventContributors.where((ec) {
      final c = ec['contributor'] as Map<String, dynamic>?;
      return (c?['name']?.toString().toLowerCase().contains(q) ?? false) ||
          (c?['phone']?.toString().contains(q) ?? false) ||
          (c?['email']?.toString().toLowerCase().contains(q) ?? false);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading)
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );

    final totalPledged = _toNum(
      _summary['total_pledged'] ?? _summary['total_amount'],
    );
    final totalPaid = _toNum(
      _summary['total_paid'] ?? _summary['total_confirmed'],
    );
    final totalBalance = (totalPledged - totalPaid)
        .clamp(0, double.infinity)
        .toDouble();
    final budget = widget.eventBudget ?? 0;
    final filtered = _filteredContributors;

    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: () async {
            await _load();
            if (widget.isCreator) await _loadPending();
          },
          color: AppColors.primary,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // ── Summary Cards ──
              _buildSummarySection(
                totalPledged,
                totalPaid,
                totalBalance,
                budget,
              ),
              const SizedBox(height: 12),

              // ── Progress Bars ──
              if (budget > 0 || totalPledged > 0) ...[
                _buildProgressSection(totalPledged, totalPaid, budget),
                const SizedBox(height: 12),
              ],

              // ── Action Buttons ──
              _buildActionButtons(),
              const SizedBox(height: 12),

              // ── Messaging Section ──
              if (widget.isCreator &&
                  _messagingExpanded &&
                  _eventContributors.isNotEmpty) ...[
                _buildMessagingSection(),
                const SizedBox(height: 12),
              ],

              // ── Pending Contributions ──
              if (widget.isCreator && _pendingContributions.isNotEmpty) ...[
                _buildPendingSection(),
                const SizedBox(height: 12),
              ],

              // ── Search Bar ──
              _buildSearchBar(),
              const SizedBox(height: 12),

              // ── Contributors List ──
              Text(
                '${filtered.length} contributor${filtered.length != 1 ? 's' : ''}',
                style: appText(
                  size: 14,
                  weight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              if (filtered.isEmpty)
                Container(
                  padding: const EdgeInsets.all(30),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Text(
                      _searchQuery.isNotEmpty
                          ? 'No contributors match your search.'
                          : 'No contributors added yet.\nTap "Add Contributor" to get started.',
                      textAlign: TextAlign.center,
                      style: appText(size: 14, color: AppColors.textTertiary),
                    ),
                  ),
                )
              else
                ...filtered.map((ec) => _contributorTile(ec, _canManage)),
            ],
          ),
        ),
        DeletingOverlay(visible: _actionLoading, label: 'Processing...'),
      ],
    );
  }

  // ════════════════════════════════════════════════════
  // SUMMARY SECTION
  // ════════════════════════════════════════════════════

  Widget _buildSummarySection(
    double totalPledged,
    double totalPaid,
    double totalBalance,
    double budget,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Contribution Summary', style: appText(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 12),
          // Row 1: Budget (if exists) + Total Collected
          if (budget > 0) ...[
            Row(children: [
              Expanded(child: _summaryCard('Event Budget', _formatAmount(budget), Colors.blue)),
              const SizedBox(width: 10),
              Expanded(child: _summaryCard('Total Collected', _formatAmount(totalPaid), AppColors.accent)),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _summaryCard('Budget Shortfall', _formatAmount((budget - totalPaid).clamp(0, double.infinity)), AppColors.error)),
              const SizedBox(width: 10),
              Expanded(child: _summaryCard('Contributors', '${_eventContributors.length}', AppColors.textSecondary)),
            ]),
            const SizedBox(height: 10),
          ],
          // Pledged / Outstanding row
          Row(children: [
            Expanded(child: _summaryCard('Total Pledged', _formatAmount(totalPledged), const Color(0xFFd97706))),
            const SizedBox(width: 10),
            Expanded(child: _summaryCard('Outstanding', _formatAmount(totalBalance), AppColors.error)),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _summaryCard('Paid', _formatAmount(totalPaid), AppColors.accent)),
            const SizedBox(width: 10),
            if (budget > 0)
              Expanded(child: _summaryCard('Unpledged', _formatAmount((budget - totalPledged).clamp(0, double.infinity)), const Color(0xFF7c3aed)))
            else
              Expanded(child: _summaryCard('Contributors', '${_eventContributors.length}', AppColors.textSecondary)),
          ]),
        ],
      ),
    );
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: appText(size: 11, color: AppColors.textTertiary)),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: appText(size: 15, weight: FontWeight.w700, color: color),
            ),
          ),
        ],
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // PROGRESS BARS
  // ════════════════════════════════════════════════════

  Widget _buildProgressSection(
    double totalPledged,
    double totalPaid,
    double budget,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          if (budget > 0) ...[
            _progressBar(
              'Budget vs Raised',
              totalPaid,
              budget,
              AppColors.accent,
            ),
            const SizedBox(height: 12),
          ],
          if (totalPledged > 0)
            _progressBar(
              'Collection Progress',
              totalPaid,
              totalPledged,
              AppColors.primary,
            ),
        ],
      ),
    );
  }

  Widget _progressBar(String label, double current, double total, Color color) {
    final pct = total > 0 ? (current / total * 100).clamp(0, 100) : 0.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: appText(size: 12, weight: FontWeight.w600)),
            Text(
              '${_formatAmount(current)} / ${_formatAmount(total)}',
              style: appText(size: 11, color: AppColors.textTertiary),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct / 100,
            minHeight: 8,
            backgroundColor: color.withOpacity(0.12),
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${pct.toStringAsFixed(1)}%',
          style: appText(size: 11, color: color, weight: FontWeight.w600),
        ),
      ],
    );
  }

  // ════════════════════════════════════════════════════
  // ACTION BUTTONS
  // ════════════════════════════════════════════════════

  Widget _buildActionButtons() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _actionChip(
          null,
          'Report',
          () => _showReportOptions(),
          svgIcon: 'assets/icons/print-icon.svg',
        ),
        if (_canManage)
          _actionChip(
            null,
            'Add Contributor',
            _showAddContributorSheet,
            filled: true,
            svgIcon: 'assets/icons/plus-icon.svg',
          ),
        if (widget.isCreator)
          _actionChip(
            Icons.upload_rounded,
            'Bulk Upload',
            _showBulkUploadSheet,
          ),
        if (widget.isCreator && _eventContributors.isNotEmpty)
          _actionChip(
            null,
            _messagingExpanded ? 'Hide Messaging' : 'Messaging',
            () => setState(() {
              _messagingExpanded = !_messagingExpanded;
              if (_messagingExpanded) {
                // Auto-select all matching contributors when opening messaging
                _messagingSelected.clear();
                _messagingSelected.addAll(_eventContributors.where((ec) {
                  final pledge = _toNum(ec['pledge_amount']);
                  final paid = _toNum(ec['total_paid']);
                  final phone = ec['contributor']?['phone']?.toString() ?? '';
                  if (phone.isEmpty || pledge <= 0) return false;
                  switch (_messagingCase) {
                    case 'no_contribution': return paid == 0;
                    case 'partial': return paid > 0 && paid < pledge;
                    case 'completed': return paid >= pledge;
                    default: return false;
                  }
                }).map((ec) => ec['id']?.toString() ?? ''));
              }
            }),
            svgIcon: _messagingExpanded ? 'assets/icons/close-icon.svg' : 'assets/icons/chat-icon.svg',
          ),
      ],
    );
  }

  Widget _actionChip(
    IconData? icon,
    String label,
    VoidCallback onTap, {
    bool filled = false,
    String? svgIcon,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: filled ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: filled ? null : Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (svgIcon != null)
              SvgPicture.asset(
                svgIcon,
                width: 16,
                height: 16,
                colorFilter: ColorFilter.mode(
                  filled ? Colors.white : AppColors.textSecondary,
                  BlendMode.srcIn,
                ),
              )
            else if (icon != null)
              Icon(
                icon,
                size: 16,
                color: filled ? Colors.white : AppColors.textSecondary,
              ),
            const SizedBox(width: 6),
            Text(
              label,
              style: appText(
                size: 12,
                weight: FontWeight.w600,
                color: filled ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // SEARCH BAR
  // ════════════════════════════════════════════════════

  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (v) => setState(() => _searchQuery = v.trim()),
        style: appText(size: 14),
        decoration: InputDecoration(
          hintText: 'Search contributors...',
          hintStyle: appText(size: 13, color: AppColors.textHint),
          prefixIcon: Padding(
            padding: const EdgeInsets.all(12),
            child: SvgPicture.asset('assets/icons/search-icon.svg',
                width: 20, height: 20,
                colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
          ),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: SvgPicture.asset('assets/icons/close-icon.svg',
                      width: 18, height: 18,
                      colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                  onPressed: () {
                    _searchCtrl.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // CONTRIBUTOR TILE (with full action menu)
  // ════════════════════════════════════════════════════

  Widget _contributorTile(Map<String, dynamic> ec, bool canManage) {
    final contributor = ec['contributor'] as Map<String, dynamic>?;
    final name = contributor?['name'] ?? 'Unknown';
    final phone = contributor?['phone']?.toString() ?? '';
    final email = contributor?['email']?.toString() ?? '';
    final pledged = _toNum(ec['pledge_amount']);
    final paid = _toNum(ec['total_paid']);
    final balance = (pledged - paid).clamp(0, double.infinity);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                name[0].toUpperCase(),
                style: appText(
                  size: 16,
                  weight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: appText(size: 14, weight: FontWeight.w600)),
                if (phone.isNotEmpty)
                  Text(
                    phone,
                    style: appText(size: 11, color: AppColors.textTertiary),
                  ),
                if (email.isNotEmpty)
                  Text(
                    email,
                    style: appText(size: 11, color: AppColors.textTertiary),
                  ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  children: [
                    _inlineStat(
                      'Pledged',
                      _formatAmount(pledged),
                      const Color(0xFFd97706),
                    ),
                    _inlineStat('Paid', _formatAmount(paid), AppColors.accent),
                    _inlineStat(
                      'Balance',
                      _formatAmount(balance),
                      balance > 0 ? AppColors.error : AppColors.accent,
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (canManage)
            PopupMenuButton<String>(
              icon: const Icon(
                Icons.more_vert,
                size: 18,
                color: AppColors.textHint,
              ),
              onSelected: (action) => _handleContributorAction(action, ec),
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'payment',
                  child: Row(
                    children: [
                      Icon(
                        Icons.attach_money,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                      SizedBox(width: 8),
                      Text('Record Payment'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'pledge',
                  child: Row(
                    children: [
                      Icon(
                        Icons.edit,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                      SizedBox(width: 8),
                      Text('Update Pledge'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'history',
                  child: Row(
                    children: [
                      Icon(
                        Icons.history,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                      SizedBox(width: 8),
                      Text('Payment History'),
                    ],
                  ),
                ),
                if (paid > 0)
                  const PopupMenuItem(
                    value: 'thankyou',
                    child: Row(
                      children: [
                        Icon(
                          Icons.favorite,
                          size: 18,
                          color: Colors.pinkAccent,
                        ),
                        SizedBox(width: 8),
                        Text('Send Thank You'),
                      ],
                    ),
                  ),
                const PopupMenuItem(
                  value: 'share_link',
                  child: Row(
                    children: [
                      Icon(Icons.link, size: 18, color: AppColors.textSecondary),
                      SizedBox(width: 8),
                      Text('Share payment link'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'guest',
                  child: Row(
                    children: [
                      Icon(
                        Icons.person_add_alt_1,
                        size: 18,
                        color: AppColors.textSecondary,
                      ),
                      SizedBox(width: 8),
                      Text('Add as Guest'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'remove',
                  child: Row(
                    children: [
                      Icon(Icons.delete_outline, size: 18, color: Colors.red),
                      SizedBox(width: 8),
                      Text('Remove', style: TextStyle(color: Colors.red)),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _inlineStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: appText(size: 8, color: AppColors.textTertiary)),
        Text(
          value,
          style: appText(size: 11, weight: FontWeight.w700, color: color),
        ),
      ],
    );
  }

  // ════════════════════════════════════════════════════
  // CONTRIBUTOR ACTIONS
  // ════════════════════════════════════════════════════

  void _handleContributorAction(String action, Map<String, dynamic> ec) async {
    final ecId = ec['id']?.toString() ?? '';
    switch (action) {
      case 'payment':
        _showRecordPaymentSheet(ec);
        break;
      case 'pledge':
        _showUpdatePledgeSheet(ec);
        break;
      case 'history':
        _showPaymentHistory(ec);
        break;
      case 'thankyou':
        _showSendThankYou(ec);
        break;
      case 'guest':
        _addAsGuest(ecId);
        break;
      case 'share_link':
        _showShareLinkSheet(ec);
        break;
      case 'remove':
        _removeContributor(ecId);
        break;
    }
  }

  /// Bottom sheet that lets the host generate / share / SMS / revoke a guest
  /// payment link for ONE contributor. The plain token is returned by the
  /// server only once per generation — if the host closes the sheet without
  /// sharing, regenerating rotates the token (the previous URL stops working).
  Future<void> _showShareLinkSheet(Map<String, dynamic> ec) async {
    final ecId = ec['id']?.toString() ?? '';
    if (ecId.isEmpty) return;
    final contributor = (ec['contributor'] as Map?) ?? const {};
    final name = (contributor['name'] ?? 'Contributor').toString();
    final phone = (contributor['phone'] ?? '').toString();
    final balance = (ec['balance'] as num?)?.toDouble() ?? 0;
    final currency = (ec['currency'] ?? '').toString();
    final hasExisting = ec['has_share_link'] == true;

    String? url;
    String? host;
    bool smsSupported = false;
    bool busy = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            Future<void> generate({bool regenerate = false}) async {
              setSheetState(() => busy = true);
              final res = await EventContributorsService.generateShareLink(
                widget.eventId, ecId, regenerate: regenerate,
              );
              if (!mounted) return;
              setSheetState(() => busy = false);
              if (res['success'] == true) {
                final data = (res['data'] as Map?) ?? {};
                setSheetState(() {
                  url = data['url']?.toString();
                  host = data['host']?.toString();
                  smsSupported = data['sms_supported'] == true;
                });
                if (regenerate) {
                  AppSnackbar.success(
                    context,
                    'New link generated. The previous one no longer works.',
                  );
                }
              } else {
                AppSnackbar.error(
                  context, res['message']?.toString() ?? 'Could not generate link',
                );
              }
            }

            Future<void> sendSms() async {
              setSheetState(() => busy = true);
              final res = await EventContributorsService.sendShareLinkSms(
                widget.eventId, ecId,
              );
              if (!mounted) return;
              setSheetState(() => busy = false);
              if (res['success'] == true) {
                AppSnackbar.success(context, 'SMS sent to $name');
              } else {
                AppSnackbar.error(
                  context, res['message']?.toString() ?? 'Could not send SMS',
                );
              }
            }

            Future<void> revoke() async {
              setSheetState(() => busy = true);
              final res = await EventContributorsService.revokeShareLink(
                widget.eventId, ecId,
              );
              if (!mounted) return;
              setSheetState(() => busy = false);
              if (res['success'] == true) {
                AppSnackbar.success(context, 'Link disabled');
                Navigator.of(ctx).pop();
                _load();
              } else {
                AppSnackbar.error(
                  context, res['message']?.toString() ?? 'Could not revoke',
                );
              }
            }

            return Padding(
              padding: EdgeInsets.fromLTRB(
                20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 36, height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.textHint.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(children: [
                    const Icon(Icons.link, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text(
                      'Share payment link',
                      style: appText(size: 16, weight: FontWeight.w700),
                    ),
                  ]),
                  const SizedBox(height: 4),
                  Text(
                    'Generate a secure one-tap link for $name to pay without signing up.',
                    style: appText(size: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: appText(size: 14, weight: FontWeight.w600)),
                        if (phone.isNotEmpty)
                          Text(phone, style: appText(size: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Outstanding balance',
                              style: appText(size: 12, color: AppColors.textSecondary),
                            ),
                            Text(
                              '$currency ${balance.toStringAsFixed(0)}',
                              style: appText(size: 13, weight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (url == null) ...[
                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: busy ? null : () => generate(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        icon: busy
                          ? const SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.link),
                        label: Text(busy ? 'Generating…' : 'Generate payment link'),
                      ),
                    ),
                    if (hasExisting) ...[
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: busy ? null : revoke,
                        icon: const Icon(Icons.delete_outline, color: Colors.red),
                        label: const Text(
                          'Disable existing link',
                          style: TextStyle(color: Colors.red),
                        ),
                      ),
                    ],
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.divider),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(children: [
                        Expanded(
                          child: Text(
                            url!,
                            style: appText(size: 11, weight: FontWeight.w500),
                            maxLines: 2, overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          tooltip: 'Copy',
                          icon: const Icon(Icons.copy, size: 18),
                          onPressed: () async {
                            await Clipboard.setData(ClipboardData(text: url!));
                            if (mounted) AppSnackbar.success(context, 'Link copied');
                          },
                        ),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: busy ? null : () {
                            final text =
                              'Hi $name, please use this secure link to pay your contribution'
                              '${balance > 0 ? " ($currency ${balance.toStringAsFixed(0)})" : ""}'
                              ': ${url!}';
                            Share.share(text, subject: 'Payment link');
                          },
                          icon: const Icon(Icons.ios_share),
                          label: const Text('Share'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: (busy || !smsSupported || phone.isEmpty)
                            ? null : sendSms,
                          icon: const Icon(Icons.sms_outlined),
                          label: Text(smsSupported ? 'Send SMS' : 'SMS N/A'),
                        ),
                      ),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      Expanded(
                        child: TextButton.icon(
                          onPressed: busy ? null : () => generate(regenerate: true),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Regenerate'),
                        ),
                      ),
                      Expanded(
                        child: TextButton.icon(
                          onPressed: busy ? null : revoke,
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          label: const Text('Disable', style: TextStyle(color: Colors.red)),
                        ),
                      ),
                    ]),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ── Remove Contributor ──
  Future<void> _removeContributor(String ecId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove Contributor'),
        content: const Text(
          'Are you sure you want to remove this contributor from the event? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _actionLoading = true);
    final res = await EventsService.removeContributorFromEvent(
      widget.eventId,
      ecId,
    );
    if (mounted) {
      setState(() => _actionLoading = false);
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Removed');
        _load();
      } else
        AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  // ── Add as Guest ──
  Future<void> _addAsGuest(String ecId) async {
    setState(() => _actionLoading = true);
    final res = await EventsService.addContributorsAsGuests(widget.eventId, {
      'contributor_ids': [ecId],
      'send_sms': true,
    });
    if (mounted) {
      setState(() => _actionLoading = false);
      if (res['success'] == true) {
        final skipped = res['data']?['skipped'] ?? 0;
        if (skipped > 0)
          AppSnackbar.info(context, 'Already on guest list');
        else
          AppSnackbar.success(context, 'Added as guest');
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  // ════════════════════════════════════════════════════
  // PAYMENT HISTORY
  // ════════════════════════════════════════════════════

  void _showPaymentHistory(Map<String, dynamic> ec) async {
    final ecId = ec['id']?.toString() ?? '';
    final name = ec['contributor']?['name'] ?? 'Unknown';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return FutureBuilder<Map<String, dynamic>>(
              future: EventsService.getPaymentHistory(widget.eventId, ecId),
              builder: (ctx, snapshot) {
                final loading = !snapshot.hasData;
                final data = snapshot.data;
                final success = data?['success'] == true;
                final historyData = data?['data'];
                final pledgeAmt = _toNum(historyData?['pledge_amount']);
                final totalPaid = _toNum(historyData?['total_paid']);
                final payments = (historyData?['payments'] as List?) ?? [];

                return Container(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(ctx).size.height * 0.8,
                  ),
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '$name — Payment History',
                        style: appText(size: 17, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 16),
                      if (loading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(30),
                            child: CircularProgressIndicator(
                              color: AppColors.primary,
                            ),
                          ),
                        )
                      else if (!success)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(30),
                            child: Text('Failed to load history'),
                          ),
                        )
                      else ...[
                        // Summary row
                        Row(
                          children: [
                            Expanded(
                              child: _historyStatCard(
                                _formatAmount(pledgeAmt),
                                'Pledged',
                                const Color(0xFFd97706),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _historyStatCard(
                                _formatAmount(totalPaid),
                                'Paid',
                                AppColors.accent,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _historyStatCard(
                                _formatAmount(
                                  (pledgeAmt - totalPaid).clamp(
                                    0,
                                    double.infinity,
                                  ),
                                ),
                                'Balance',
                                AppColors.error,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        // Payments list
                        if (payments.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              border: Border.all(color: AppColors.border),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Text(
                                'No payments recorded yet',
                                style: appText(
                                  size: 13,
                                  color: AppColors.textTertiary,
                                ),
                              ),
                            ),
                          )
                        else
                          Flexible(
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border.all(color: AppColors.border),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: ListView.separated(
                                shrinkWrap: true,
                                itemCount: payments.length,
                                separatorBuilder: (_, __) =>
                                    const Divider(height: 1),
                                itemBuilder: (_, i) {
                                  final p = payments[i] as Map<String, dynamic>;
                                  final isPending =
                                      p['confirmation_status'] == 'pending';
                                  return Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 8,
                                                          vertical: 3,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: isPending
                                                          ? const Color(
                                                              0xFFFEF3C7,
                                                            )
                                                          : const Color(
                                                              0xFFD1FAE5,
                                                            ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            6,
                                                          ),
                                                    ),
                                                    child: Text(
                                                      isPending
                                                          ? 'Pending'
                                                          : 'Payment',
                                                      style: appText(
                                                        size: 10,
                                                        weight: FontWeight.w600,
                                                        color: isPending
                                                            ? const Color(
                                                                0xFF92400E,
                                                              )
                                                            : const Color(
                                                                0xFF065F46,
                                                              ),
                                                      ),
                                                    ),
                                                  ),
                                                  if (p['payment_method'] !=
                                                      null) ...[
                                                    const SizedBox(width: 6),
                                                    Text(
                                                      (p['payment_method']
                                                              as String)
                                                          .replaceAll('_', ' '),
                                                      style: appText(
                                                        size: 10,
                                                        color: AppColors
                                                            .textTertiary,
                                                      ),
                                                    ),
                                                  ],
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              if (p['created_at'] != null)
                                                Text(
                                                  _formatDate(p['created_at']),
                                                  style: appText(
                                                    size: 11,
                                                    color:
                                                        AppColors.textTertiary,
                                                  ),
                                                ),
                                              if (p['payment_reference'] !=
                                                      null &&
                                                  p['payment_reference']
                                                      .toString()
                                                      .isNotEmpty)
                                                Text(
                                                  'Ref: ${p['payment_reference']}',
                                                  style: appText(
                                                    size: 11,
                                                    color:
                                                        AppColors.textTertiary,
                                                  ),
                                                ),
                                              if (p['recorded_by_name'] != null)
                                                Text(
                                                  'By: ${p['recorded_by_name']}',
                                                  style: appText(
                                                    size: 11,
                                                    color:
                                                        AppColors.textTertiary,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            Text(
                                              _formatAmount(p['amount']),
                                              style: appText(
                                                size: 14,
                                                weight: FontWeight.w700,
                                                color: AppColors.accent,
                                              ),
                                            ),
                                            if (widget.isCreator) ...[
                                              const SizedBox(width: 4),
                                              GestureDetector(
                                                onTap: () async {
                                                  final confirm = await showDialog<bool>(
                                                    context: ctx,
                                                    builder: (c) => AlertDialog(
                                                      title: const Text(
                                                        'Delete Transaction',
                                                      ),
                                                      content: const Text(
                                                        'Are you sure? This cannot be undone.',
                                                      ),
                                                      actions: [
                                                        TextButton(
                                                          onPressed: () =>
                                                              Navigator.pop(
                                                                c,
                                                                false,
                                                              ),
                                                          child: const Text(
                                                            'Cancel',
                                                          ),
                                                        ),
                                                        TextButton(
                                                          onPressed: () =>
                                                              Navigator.pop(
                                                                c,
                                                                true,
                                                              ),
                                                          style:
                                                              TextButton.styleFrom(
                                                                foregroundColor:
                                                                    Colors.red,
                                                              ),
                                                          child: const Text(
                                                            'Delete',
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  );
                                                  if (confirm != true) return;
                                                  final delRes =
                                                      await EventsService.deleteTransaction(
                                                        widget.eventId,
                                                        ecId,
                                                        p['id'].toString(),
                                                      );
                                                  if (delRes['success'] ==
                                                      true) {
                                                    AppSnackbar.success(
                                                      context,
                                                      'Transaction deleted',
                                                    );
                                                    Navigator.pop(ctx);
                                                    _load();
                                                  } else {
                                                    AppSnackbar.error(
                                                      context,
                                                      delRes['message'] ??
                                                          'Failed',
                                                    );
                                                  }
                                                },
                                                child: const Icon(
                                                  Icons.delete_outline,
                                                  size: 18,
                                                  color: Colors.red,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                      ],
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _historyStatCard(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: appText(size: 13, weight: FontWeight.w700, color: color),
              maxLines: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: appText(size: 10, color: AppColors.textTertiary)),
        ],
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final dt = DateTime.parse(
        dateStr.endsWith('Z') || dateStr.contains('+')
            ? dateStr
            : '${dateStr}Z',
      ).toLocal();
      final months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return '${dt.day} ${months[dt.month - 1]} ${dt.year}, ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return dateStr;
    }
  }

  // ════════════════════════════════════════════════════
  // SEND THANK YOU
  // ════════════════════════════════════════════════════

  void _showSendThankYou(Map<String, dynamic> ec) {
    final name = ec['contributor']?['name'] ?? 'Unknown';
    final phone = ec['contributor']?['phone'] ?? '';
    final ecId = ec['id']?.toString() ?? '';
    final msgCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          bool sending = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              20,
              20,
              MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Send Thank You',
                  style: appText(size: 18, weight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  'A thank you SMS will be sent to ${phone.isNotEmpty ? phone : name}.',
                  style: appText(size: 13, color: AppColors.textTertiary),
                ),
                const SizedBox(height: 16),
                _label('Custom Message (optional)'),
                _input(
                  msgCtrl,
                  'Add a personal thank you message...',
                  maxLines: 3,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: sending
                        ? null
                        : () async {
                            setSheetState(() => sending = true);
                            final res = await EventsService.sendThankYou(
                              widget.eventId,
                              ecId,
                              {
                                if (msgCtrl.text.trim().isNotEmpty)
                                  'custom_message': msgCtrl.text.trim(),
                              },
                            );
                            if (mounted) {
                              Navigator.pop(ctx);
                              if (res['success'] == true)
                                AppSnackbar.success(context, 'Thank you sent!');
                              else
                                AppSnackbar.error(
                                  context,
                                  res['message'] ?? 'Failed to send',
                                );
                            }
                          },
                    icon: sending
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.favorite, size: 18),
                    label: Text(
                      sending ? 'Sending...' : 'Send Thank You',
                      style: appText(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.pinkAccent,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // PENDING CONTRIBUTIONS
  // ════════════════════════════════════════════════════

  Widget _buildPendingSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.verified_user,
                size: 20,
                color: Color(0xFFD97706),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Awaiting Confirmation (${_pendingContributions.length})',
                  style: appText(
                    size: 14,
                    weight: FontWeight.w700,
                    color: const Color(0xFF92400E),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Select All
          Row(
            children: [
              GestureDetector(
                onTap: () => setState(() {
                  if (_selectedPending.length == _pendingContributions.length)
                    _selectedPending.clear();
                  else
                    _selectedPending.addAll(
                      _pendingContributions.map((p) => p['id'].toString()),
                    );
                }),
                child: Text(
                  _selectedPending.length == _pendingContributions.length
                      ? 'Deselect All'
                      : 'Select All',
                  style: appText(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const Spacer(),
              if (_selectedPending.isNotEmpty) ...[
                _pendingActionButton('Reject', Colors.red, _rejectPending),
                const SizedBox(width: 8),
                _pendingActionButton(
                  'Confirm (${_selectedPending.length})',
                  AppColors.accent,
                  _confirmPending,
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          ..._pendingContributions.map((pc) {
            final id = pc['id'].toString();
            final selected = _selectedPending.contains(id);
            return GestureDetector(
              onTap: () => setState(() {
                if (selected)
                  _selectedPending.remove(id);
                else
                  _selectedPending.add(id);
              }),
              child: Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: selected ? AppColors.primary : AppColors.border,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      selected ? Icons.check_circle : Icons.circle_outlined,
                      size: 20,
                      color: selected ? AppColors.primary : AppColors.textHint,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            pc['contributor_name'] ?? 'Unknown',
                            style: appText(size: 13, weight: FontWeight.w600),
                          ),
                          if (pc['created_at'] != null)
                            Text(
                              _formatDate(pc['created_at']),
                              style: appText(
                                size: 10,
                                color: AppColors.textTertiary,
                              ),
                            ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          _formatAmount(pc['amount']),
                          style: appText(
                            size: 13,
                            weight: FontWeight.w700,
                            color: const Color(0xFFD97706),
                          ),
                        ),
                        if (pc['payment_method'] != null)
                          Text(
                            pc['payment_method'].toString(),
                            style: appText(
                              size: 10,
                              color: AppColors.textTertiary,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _pendingActionButton(String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: appText(
            size: 11,
            weight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  Future<void> _confirmPending() async {
    if (_selectedPending.isEmpty) return;
    setState(() => _actionLoading = true);
    final res = await EventsService.confirmContributions(
      widget.eventId,
      _selectedPending.toList(),
    );
    if (mounted) {
      setState(() => _actionLoading = false);
      if (res['success'] == true) {
        AppSnackbar.success(
          context,
          '${res['data']?['confirmed'] ?? 0} confirmed',
        );
        _selectedPending.clear();
        _loadPending();
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  Future<void> _rejectPending() async {
    if (_selectedPending.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Contributions'),
        content: Text(
          'Reject ${_selectedPending.length} pending contribution(s)? Contributors will be notified.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _actionLoading = true);
    final res = await EventsService.rejectContributions(
      widget.eventId,
      _selectedPending.toList(),
    );
    if (mounted) {
      setState(() => _actionLoading = false);
      if (res['success'] == true) {
        AppSnackbar.success(
          context,
          '${res['data']?['rejected'] ?? 0} rejected',
        );
        _selectedPending.clear();
        _loadPending();
        _load();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed');
      }
    }
  }

  // ════════════════════════════════════════════════════
  // MESSAGING SECTION (matches web ContributorMessaging)
  // ════════════════════════════════════════════════════

  String _resolveTemplate(String template, Map<String, dynamic> ec) {
    final name = ec['contributor']?['name'] ?? 'Contributor';
    var resolved = template
        .replaceAll('{name}', name)
        .replaceAll('{event_name}', widget.eventTitle ?? '')
        .replaceAll('{event_title}', (widget.eventTitle ?? '').toUpperCase());
    if (resolved.contains('{payment}')) {
      if (_paymentInfo.isNotEmpty) {
        resolved = resolved.replaceAll('{payment}', _paymentInfo);
      } else {
        resolved = resolved.split('\n').where((l) => !l.contains('{payment}')).join('\n');
      }
    }
    return resolved.trim();
  }

  Widget _buildMessagingSection() {
    final cases = {
      'no_contribution': {
        'label': 'No Contribution',
        'desc': 'Pledged but no payment',
        'svgIcon': 'assets/icons/info-icon.svg',
        'color': AppColors.error,
      },
      'partial': {
        'label': 'Partial',
        'desc': 'Paid partially',
        'svgIcon': 'assets/icons/clock-icon.svg',
        'color': const Color(0xFFD97706),
      },
      'completed': {
        'label': 'Completed',
        'desc': 'Fully paid',
        'svgIcon': 'assets/icons/circle-icon.svg',
        'color': AppColors.accent,
      },
    };

    // Filter contributors by case
    final caseContributors = _eventContributors.where((ec) {
      final pledge = _toNum(ec['pledge_amount']);
      final paid = _toNum(ec['total_paid']);
      final phone = ec['contributor']?['phone']?.toString() ?? '';
      if (phone.isEmpty || pledge <= 0) return false;
      switch (_messagingCase) {
        case 'no_contribution':
          return paid == 0;
        case 'partial':
          return paid > 0 && paid < pledge;
        case 'completed':
          return paid >= pledge;
        default:
          return false;
      }
    }).toList();

    final selectedTargets = caseContributors
        .where((ec) => _messagingSelected.contains(ec['id']?.toString()))
        .toList();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with SVG chat icon (matching web)
          Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: SvgPicture.asset(
                    'assets/icons/chat-icon.svg',
                    width: 18, height: 18,
                    colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Contributor Messaging', style: appText(size: 15, weight: FontWeight.w700)),
                    Text('Send targeted reminders based on contribution status',
                        style: appText(size: 11, color: AppColors.textTertiary)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Case selector
          Row(
            children: cases.entries.map((entry) {
              final key = entry.key;
              final cfg = entry.value;
              final count = _eventContributors.where((ec) {
                final pledge = _toNum(ec['pledge_amount']);
                final paid = _toNum(ec['total_paid']);
                final phone = ec['contributor']?['phone']?.toString() ?? '';
                if (phone.isEmpty || pledge <= 0) return false;
                if (key == 'no_contribution') return paid == 0;
                if (key == 'partial') return paid > 0 && paid < pledge;
                if (key == 'completed') return paid >= pledge;
                return false;
              }).length;
              final isActive = _messagingCase == key;

              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() {
                    _messagingCase = key;
                    _messageTemplate = _getDefaultTemplate(key);
                    // Auto-select all matching contributors when switching case
                    _messagingSelected.clear();
                    final matching = _eventContributors.where((ec) {
                      final pledge = _toNum(ec['pledge_amount']);
                      final paid = _toNum(ec['total_paid']);
                      final phone = ec['contributor']?['phone']?.toString() ?? '';
                      if (phone.isEmpty || pledge <= 0) return false;
                      if (key == 'no_contribution') return paid == 0;
                      if (key == 'partial') return paid > 0 && paid < pledge;
                      if (key == 'completed') return paid >= pledge;
                      return false;
                    });
                    _messagingSelected.addAll(matching.map((ec) => ec['id']?.toString() ?? ''));
                  }),
                  child: Container(
                    margin: EdgeInsets.only(right: key != 'completed' ? 6 : 0),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isActive
                          ? (cfg['color'] as Color).withOpacity(0.1)
                          : const Color(0xFFF5F7FA),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isActive ? (cfg['color'] as Color) : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        SvgPicture.asset(
                          cfg['svgIcon'] as String,
                          width: 18, height: 18,
                          colorFilter: ColorFilter.mode(cfg['color'] as Color, BlendMode.srcIn),
                        ),
                        const SizedBox(height: 4),
                        Text(cfg['label'] as String,
                            style: appText(size: 9, weight: FontWeight.w600),
                            maxLines: 1, textAlign: TextAlign.center),
                        Text('$count',
                            style: appText(size: 12, weight: FontWeight.w700, color: cfg['color'] as Color)),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),

          // Recipients
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Recipients (${selectedTargets.length} of ${caseContributors.length})',
                  style: appText(size: 12, weight: FontWeight.w600)),
              if (caseContributors.isNotEmpty)
                GestureDetector(
                  onTap: () => setState(() {
                    if (_messagingSelected.length == caseContributors.length) {
                      _messagingSelected.clear();
                    } else {
                      _messagingSelected.clear();
                      _messagingSelected.addAll(caseContributors.map((ec) => ec['id']?.toString() ?? ''));
                    }
                  }),
                  child: Text(
                    _messagingSelected.length == caseContributors.length ? 'Deselect All' : 'Select All',
                    style: appText(size: 11, weight: FontWeight.w600, color: AppColors.primary),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          if (caseContributors.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 140),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: caseContributors.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final ec = caseContributors[i];
                  final ecId = ec['id']?.toString() ?? '';
                  final isSelected = _messagingSelected.contains(ecId);
                  return GestureDetector(
                    onTap: () => setState(() {
                      if (_messagingSelected.contains(ecId))
                        _messagingSelected.remove(ecId);
                      else
                        _messagingSelected.add(ecId);
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      color: isSelected
                          ? AppColors.primary.withOpacity(0.06) : Colors.transparent,
                      child: Row(
                        children: [
                          Icon(
                            isSelected ? Icons.check_circle : Icons.circle_outlined,
                            size: 18,
                            color: isSelected ? AppColors.primary : AppColors.textHint,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(ec['contributor']?['name'] ?? '',
                                    style: appText(size: 12, weight: FontWeight.w600)),
                                Text(ec['contributor']?['phone'] ?? '',
                                    style: appText(size: 10, color: AppColors.textTertiary)),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('Pledged: ${_formatAmount(ec['pledge_amount'])}',
                                  style: appText(size: 10, color: AppColors.textTertiary)),
                              Text('Paid: ${_formatAmount(ec['total_paid'])}',
                                  style: appText(size: 10, color: AppColors.textTertiary)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text('No contributors with phone numbers match this category.',
                  style: appText(size: 12, color: AppColors.textTertiary)),
            ),
          const SizedBox(height: 12),

          // Payment info
          _label('Payment Info (for {payment} variable)'),
          _input(
            TextEditingController(text: _paymentInfo),
            'e.g. M-Pesa: 0712345678 (John Doe)',
            onChanged: (v) => _paymentInfo = v,
          ),
          Text('Leave empty to omit the payment line from the message entirely.',
              style: appText(size: 10, color: AppColors.textTertiary)),
          const SizedBox(height: 12),

          // Reminder contact phone override
          _label('Contact phone for this send (optional)'),
          _input(
            TextEditingController(text: _reminderContactOverride),
            'Defaults to event reminder contact, then your number',
            onChanged: (v) => _reminderContactOverride = v,
          ),
          Text("Recipients will see this number if they need to reach you about their contribution.",
              style: appText(size: 10, color: AppColors.textTertiary)),
          const SizedBox(height: 12),

          // Message template (editable)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _label('Message Template'),
              GestureDetector(
                onTap: () => setState(() {
                  _messageTemplate = _getDefaultTemplate(_messagingCase);
                }),
                child: Text('Reset', style: appText(size: 11, weight: FontWeight.w600, color: AppColors.primary)),
              ),
            ],
          ),
          TextField(
            controller: TextEditingController(text: _messageTemplate),
            onChanged: (v) => _messageTemplate = v,
            maxLines: 5,
            minLines: 3,
            style: appText(size: 12, color: AppColors.textPrimary, height: 1.5),
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFFF5F7FA),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: AppColors.primary)),
              contentPadding: const EdgeInsets.all(12),
              hintText: 'Edit your message template...',
              hintStyle: appText(size: 12, color: AppColors.textHint),
            ),
          ),
          Text('Variables: {name}, {event_name}, {event_title}, {payment}',
              style: appText(size: 10, color: AppColors.textTertiary)),
          const SizedBox(height: 12),

          // Preview + Send buttons (matching web layout)
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: selectedTargets.isEmpty ? null : () => _showMessagePreview(selectedTargets),
                  icon: const Icon(Icons.visibility_outlined, size: 16),
                  label: Text('Preview (${selectedTargets.length})',
                      style: appText(size: 12, weight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: (selectedTargets.isEmpty || _sendingMessages)
                      ? null
                      : () => _sendBulkMessage(selectedTargets),
                  icon: _sendingMessages
                      ? const SizedBox(width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : SvgPicture.asset('assets/icons/send-icon.svg', width: 16, height: 16,
                          colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                  label: Text(
                    _sendingMessages ? 'Sending...' : 'Send (${selectedTargets.length})',
                    style: appText(size: 12, weight: FontWeight.w700, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Message Preview (matching web's preview dialog) ──
  void _showMessagePreview(List<dynamic> targets) {
    final sampleEc = targets.isNotEmpty ? targets.first : null;
    final sampleMessage = sampleEc != null ? _resolveTemplate(_messageTemplate, sampleEc) : '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.8),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4,
                decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(children: [
              const Icon(Icons.visibility_outlined, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text('Message Preview', style: appText(size: 17, weight: FontWeight.w700)),
            ]),
            const SizedBox(height: 12),
            Text('${targets.length} recipient${targets.length != 1 ? 's' : ''}',
                style: appText(size: 12, color: AppColors.textTertiary)),
            const SizedBox(height: 12),
            // Sample message
            if (sampleEc != null) ...[
              Text('Sample message for: ${sampleEc['contributor']?['name'] ?? 'Unknown'}',
                  style: appText(size: 11, weight: FontWeight.w600, color: AppColors.textSecondary)),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F7FA),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(sampleMessage,
                    style: appText(size: 12, color: AppColors.textPrimary, height: 1.5)),
              ),
              const SizedBox(height: 12),
            ],
            // All recipients
            Text('All recipients:', style: appText(size: 11, weight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            Flexible(
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: targets.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final ec = targets[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      child: Row(children: [
                        Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ec['contributor']?['name'] ?? '',
                                style: appText(size: 12, weight: FontWeight.w600)),
                            Text(ec['contributor']?['phone'] ?? '',
                                style: appText(size: 10, color: AppColors.textTertiary)),
                          ],
                        )),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('Pledged: ${_formatAmount(ec['pledge_amount'])}',
                              style: appText(size: 10, color: AppColors.textTertiary)),
                          Text('Paid: ${_formatAmount(ec['total_paid'])}',
                              style: appText(size: 10, color: AppColors.textTertiary)),
                        ]),
                      ]),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text('Close', style: appText(size: 13, weight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _sendBulkMessage(targets);
                  },
                  icon: SvgPicture.asset('assets/icons/send-icon.svg', width: 16, height: 16,
                      colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                  label: Text('Confirm & Send', style: appText(size: 13, weight: FontWeight.w700, color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Future<void> _sendBulkMessage(List<dynamic> targets) async {
    setState(() => _sendingMessages = true);
    final res = await EventsService.sendBulkReminder(widget.eventId, {
      'case_type': _messagingCase,
      'message_template': _messageTemplate,
      if (_paymentInfo.isNotEmpty) 'payment_info': _paymentInfo,
      if (_reminderContactOverride.trim().isNotEmpty)
        'contact_phone': _reminderContactOverride.trim(),
      'contributor_ids': targets
          .map((ec) => ec['id']?.toString())
          .where((id) => id != null)
          .toList(),
    });
    if (mounted) {
      setState(() => _sendingMessages = false);
      if (res['success'] == true) {
        final sent = res['data']?['sent'] ?? 0;
        final failed = res['data']?['failed'] ?? 0;
        final errors = (res['data']?['errors'] as List?)?.map((e) => e.toString()).toList() ?? [];
        _showSendResults(sent, failed, errors);
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to send');
      }
    }
  }

  // ── Send Results Dialog (matching web's result dialog) ──
  void _showSendResults(int sent, int failed, List<String> errors) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Send Results', style: appText(size: 17, weight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(children: [
                    Text('$sent', style: appText(size: 22, weight: FontWeight.w800, color: AppColors.accent)),
                    Text('Sent', style: appText(size: 11, color: AppColors.textTertiary)),
                  ]),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(children: [
                    Text('$failed', style: appText(size: 22, weight: FontWeight.w800, color: AppColors.error)),
                    Text('Failed', style: appText(size: 11, color: AppColors.textTertiary)),
                  ]),
                ),
              ),
            ]),
            if (errors.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.error.withOpacity(0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Errors:', style: appText(size: 11, weight: FontWeight.w600, color: AppColors.error)),
                    const SizedBox(height: 4),
                    ...errors.take(5).map((e) => Text(e,
                        style: appText(size: 10, color: AppColors.error.withOpacity(0.8)))),
                    if (errors.length > 5)
                      Text('...and ${errors.length - 5} more',
                          style: appText(size: 10, color: AppColors.textTertiary)),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Close', style: appText(size: 13, weight: FontWeight.w600, color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // ADD CONTRIBUTOR (New + Address Book)
  // ════════════════════════════════════════════════════
  // BULK UPLOAD (matches web version)
  // ════════════════════════════════════════════════════

  String _formatTanzanianPhone(String raw) {
    String phone = raw.replaceAll(RegExp(r'[\s\-\+]'), '');
    if (phone.startsWith('0') && phone.length == 10) phone = phone.substring(1);
    if (RegExp(r'^[67]').hasMatch(phone)) phone = '255$phone';
    if (RegExp(r'^255[67]\d{8}$').hasMatch(phone)) return phone;
    throw Exception('Invalid phone: $raw');
  }

  void _showBulkUploadSheet() {
    String bulkMode = 'targets';
    List<Map<String, dynamic>> bulkRows = [];
    String bulkFileName = '';
    List<String> bulkErrors = [];
    bool bulkUploading = false;
    bool bulkSendSms = false;
    Map<String, dynamic>? bulkResult;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          Future<void> pickAndParseFile() async {
            final result = await FilePicker.platform.pickFiles(
              type: FileType.custom,
              allowedExtensions: ['xlsx', 'xls', 'csv'],
            );
            if (result == null || result.files.isEmpty) return;
            final file = result.files.first;
            setSheetState(() {
              bulkFileName = file.name;
              bulkErrors = [];
              bulkRows = [];
              bulkResult = null;
            });

            try {
              final bytes = file.path != null ? File(file.path!).readAsBytesSync() : file.bytes;
              if (bytes == null) {
                setSheetState(() => bulkErrors = ['Could not read file']);
                return;
              }

              List<List<dynamic>> rows = [];
              if (file.name.endsWith('.csv')) {
                final csvString = String.fromCharCodes(bytes);
                rows = const CsvToListConverter().convert(csvString);
              } else {
                final excel = xl.Excel.decodeBytes(bytes as List<int>);
                final sheet = excel.tables[excel.tables.keys.first];
                if (sheet == null) {
                  setSheetState(() => bulkErrors = ['No sheet found in file']);
                  return;
                }
                for (final row in sheet.rows) {
                  rows.add(row.map((cell) => cell?.value?.toString() ?? '').toList());
                }
              }

              if (rows.length < 2) {
                setSheetState(() => bulkErrors = ['File must have a header row and at least one data row']);
                return;
              }

              final parsed = <Map<String, dynamic>>[];
              final parseErrors = <String>[];

              for (int i = 1; i < rows.length; i++) {
                final row = rows[i];
                final name = row.length > 1 ? row[1].toString().trim() : '';
                final phoneRaw = row.length > 2 ? row[2].toString().trim() : '';
                final amountRaw = row.length > 3 ? row[3].toString().trim() : '0';

                if (name.isEmpty && phoneRaw.isEmpty) continue;
                if (name.isEmpty) { parseErrors.add('Row ${i + 1}: Name is missing'); continue; }
                if (phoneRaw.isEmpty) { parseErrors.add('Row ${i + 1}: Phone is missing for $name'); continue; }

                String phone;
                try {
                  phone = _formatTanzanianPhone(phoneRaw);
                } catch (_) {
                  parseErrors.add('Row ${i + 1}: Invalid phone "$phoneRaw" for $name');
                  continue;
                }

                final amount = double.tryParse(amountRaw.replaceAll(',', '')) ?? 0;
                if (amount < 0) { parseErrors.add('Row ${i + 1}: Invalid amount for $name'); continue; }

                parsed.add({'name': name, 'phone': phone, 'amount': amount});
              }

              setSheetState(() {
                bulkRows = parsed;
                if (parseErrors.isNotEmpty) bulkErrors = parseErrors;
              });
            } catch (_) {
              setSheetState(() => bulkErrors = ['We couldn\'t parse this file. Please use a valid .xlsx or .csv file.']);
            }
          }

          Future<void> uploadBulk() async {
            if (bulkRows.isEmpty) return;
            setSheetState(() { bulkUploading = true; bulkResult = null; });
            final res = await EventsService.bulkAddContributors(widget.eventId, {
              'contributors': bulkRows,
              'send_sms': bulkSendSms,
              'mode': bulkMode,
            });
            if (ctx.mounted) {
              setSheetState(() => bulkUploading = false);
              if (res['success'] == true) {
                setSheetState(() {
                  bulkResult = res['data'] is Map ? (res['data'] as Map).cast<String, dynamic>() : {'processed': 0, 'errors_count': 0};
                  bulkRows = [];
                  bulkFileName = '';
                  bulkErrors = [];
                });
                AppSnackbar.success(context, '${bulkResult?['processed'] ?? 0} contributors processed');
                _load();
              } else {
                AppSnackbar.error(context, res['message'] ?? 'We couldn\'t process the upload. Please try again.');
              }
            }
          }

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 20),
                  Text('Bulk Upload Contributors', style: appText(size: 18, weight: FontWeight.w700)),
                  const SizedBox(height: 16),

                  // Mode selector
                  _label('Upload Mode'),
                  Container(
                    decoration: BoxDecoration(color: const Color(0xFFF5F7FA), borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.all(3),
                    child: Row(children: [
                      _tabButton('Set Pledge Targets', bulkMode == 'targets', () => setSheetState(() => bulkMode = 'targets')),
                      const SizedBox(width: 4),
                      _tabButton('Record Contributions', bulkMode == 'contributions', () => setSheetState(() => bulkMode = 'contributions')),
                    ]),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    bulkMode == 'targets'
                        ? 'Set or update pledge targets for multiple contributors at once.'
                        : 'Record actual payments for multiple contributors at once.',
                    style: appText(size: 11, color: AppColors.textTertiary),
                  ),
                  const SizedBox(height: 14),

                  // Template info
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                      color: const Color(0xFFF5F7FA),
                    ),
                    child: Row(children: [
                      const Icon(Icons.table_chart_rounded, size: 28, color: AppColors.primary),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('File Format', style: appText(size: 13, weight: FontWeight.w600)),
                        Text('Columns: S/N, Name, Phone (255 format), Amount', style: appText(size: 10, color: AppColors.textTertiary)),
                      ])),
                    ]),
                  ),
                  const SizedBox(height: 14),

                  // File picker button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: pickAndParseFile,
                      icon: const Icon(Icons.upload_file_rounded, size: 18),
                      label: Text(bulkFileName.isEmpty ? 'Choose File (.xlsx, .csv)' : bulkFileName,
                          style: appText(size: 13, weight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: BorderSide(color: AppColors.primary.withOpacity(0.4)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Parsed rows preview
                  if (bulkRows.isNotEmpty) ...[
                    Row(children: [
                      const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF16A34A)),
                      const SizedBox(width: 6),
                      Text('${bulkRows.length} valid rows', style: appText(size: 13, weight: FontWeight.w600, color: const Color(0xFF16A34A))),
                    ]),
                    const SizedBox(height: 8),
                    Container(
                      constraints: const BoxConstraints(maxHeight: 150),
                      decoration: BoxDecoration(border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: bulkRows.length > 20 ? 21 : bulkRows.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, i) {
                          if (i == 20) {
                            return Padding(
                              padding: const EdgeInsets.all(8),
                              child: Center(child: Text('...and ${bulkRows.length - 20} more', style: appText(size: 11, color: AppColors.textTertiary))),
                            );
                          }
                          final r = bulkRows[i];
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            child: Row(children: [
                              SizedBox(width: 24, child: Text('${i + 1}', style: appText(size: 10, color: AppColors.textTertiary))),
                              Expanded(child: Text(r['name'] ?? '', style: appText(size: 11, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                              const SizedBox(width: 6),
                              Text(r['phone'] ?? '', style: appText(size: 10, color: AppColors.textTertiary)),
                              const SizedBox(width: 6),
                              Text(_formatAmount(r['amount']), style: appText(size: 10, weight: FontWeight.w600, color: AppColors.primary)),
                            ]),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // Parse errors
                  if (bulkErrors.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.error.withOpacity(0.2)),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Icon(Icons.warning_rounded, size: 14, color: AppColors.error),
                          const SizedBox(width: 4),
                          Text('Parsing Issues', style: appText(size: 11, weight: FontWeight.w600, color: AppColors.error)),
                        ]),
                        const SizedBox(height: 4),
                        ...bulkErrors.take(5).map((e) => Text('◈ $e', style: appText(size: 10, color: AppColors.error.withOpacity(0.8)))),
                        if (bulkErrors.length > 5)
                          Text('...and ${bulkErrors.length - 5} more', style: appText(size: 10, color: AppColors.textTertiary)),
                      ]),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // SMS toggle
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border), color: const Color(0xFFF5F7FA)),
                    child: Row(children: [
                      SizedBox(
                        width: 24, height: 24,
                        child: Checkbox(
                          value: bulkSendSms,
                          onChanged: (v) => setSheetState(() => bulkSendSms = v ?? false),
                          activeColor: AppColors.primary,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Send notifications', style: appText(size: 13, weight: FontWeight.w600)),
                        Text(
                          bulkSendSms
                              ? 'WhatsApp/SMS will be sent to each contributor.'
                              : 'No messages will be sent. You can notify them later.',
                          style: appText(size: 10, color: AppColors.textTertiary),
                        ),
                      ])),
                    ]),
                  ),
                  const SizedBox(height: 14),

                  // Upload result
                  if (bulkResult != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          const Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF16A34A)),
                          const SizedBox(width: 6),
                          Text('Upload Complete', style: appText(size: 13, weight: FontWeight.w600, color: const Color(0xFF16A34A))),
                        ]),
                        const SizedBox(height: 4),
                        Text('${bulkResult!['processed'] ?? 0} contributors processed, ${bulkResult!['errors_count'] ?? 0} errors',
                            style: appText(size: 11, color: const Color(0xFF16A34A))),
                      ]),
                    ),
                    const SizedBox(height: 10),
                  ],

                  // Buttons
                  Row(children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          side: const BorderSide(color: AppColors.border),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: Text(bulkResult != null ? 'Close' : 'Cancel', style: appText(size: 13, weight: FontWeight.w600)),
                      ),
                    ),
                    if (bulkResult == null) ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: (bulkUploading || bulkRows.isEmpty) ? null : () => uploadBulk(),
                          icon: bulkUploading
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.upload_rounded, size: 16),
                          label: Text(
                            bulkUploading ? 'Uploading...' : 'Upload ${bulkRows.length} Contributors',
                            style: appText(size: 12, weight: FontWeight.w700, color: Colors.white),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ]),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // ADD CONTRIBUTOR (New + Address Book)
  // ════════════════════════════════════════════════════

  void _showAddContributorSheet() {
    int tabIndex = 1;
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final pledgeCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    List<dynamic> searchResults = [];
    bool searchLoading = false;
    bool initialLoadDone = false;
    String? selectedExistingId;
    final searchCtrl = TextEditingController();
    final existPledgeCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
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

          if (!initialLoadDone) {
            initialLoadDone = true;
            searchAddressBook('');
          }

          Future<void> submit() async {
            Map<String, dynamic> data;
            if (tabIndex == 0) {
              if (nameCtrl.text.trim().isEmpty) {
                AppSnackbar.error(ctx, 'Name is required');
                return;
              }
              if (phoneCtrl.text.trim().isEmpty) {
                AppSnackbar.error(ctx, 'Phone is required');
                return;
              }
              data = {
                'name': nameCtrl.text.trim(),
                'email': emailCtrl.text.trim().isEmpty
                    ? null
                    : emailCtrl.text.trim(),
                'phone': phoneCtrl.text.trim(),
                'pledge_amount': double.tryParse(pledgeCtrl.text.trim()) ?? 0,
                'notes': notesCtrl.text.trim().isEmpty
                    ? null
                    : notesCtrl.text.trim(),
              };
            } else {
              if (selectedExistingId == null) {
                AppSnackbar.error(ctx, 'Select a contributor');
                return;
              }
              data = {
                'contributor_id': selectedExistingId,
                'pledge_amount':
                    double.tryParse(existPledgeCtrl.text.trim()) ?? 0,
              };
            }
            Navigator.pop(ctx);
            setState(() => _actionLoading = true);
            final res = await EventsService.addContributorToEvent(
              widget.eventId,
              data,
            );
            if (mounted) {
              setState(() => _actionLoading = false);
              if (res['success'] == true) {
                AppSnackbar.success(context, 'Contributor added');
                _load();
              } else
                AppSnackbar.error(
                  context,
                  res['message'] ?? 'Failed to add contributor',
                );
            }
          }

          return Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              20,
              20,
              MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Add Contributor',
                    style: appText(size: 18, weight: FontWeight.w700),
                  ),
                  const SizedBox(height: 16),
                  // Tab selector
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F7FA),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.all(3),
                    child: Row(
                      children: [
                        _tabButton(
                          'New Contributor',
                          tabIndex == 0,
                          () => setSheetState(() => tabIndex = 0),
                        ),
                        const SizedBox(width: 4),
                        _tabButton('Address Book', tabIndex == 1, () {
                          setSheetState(() => tabIndex = 1);
                          if (searchResults.isEmpty) searchAddressBook('');
                        }),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  if (tabIndex == 0) ...[
                    _label('Name *'),
                    _input(nameCtrl, 'Full name'),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _label('Email'),
                              _input(
                                emailCtrl,
                                'email@example.com',
                                keyboard: TextInputType.emailAddress,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _label('Phone *'),
                              _input(
                                phoneCtrl,
                                '+255...',
                                keyboard: TextInputType.phone,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _label('Pledge Amount (TZS)'),
                    _input(
                      pledgeCtrl,
                      'e.g. 20,000',
                      keyboard: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    _label('Notes'),
                    _input(notesCtrl, 'Optional notes...', maxLines: 2),
                  ] else ...[
                    _label('Search Your Contributors'),
                    TextField(
                      controller: searchCtrl,
                      onChanged: (v) => searchAddressBook(v),
                      style: appText(size: 14),
                      decoration: InputDecoration(
                        hintText: 'Search by name, email, or phone...',
                        hintStyle: appText(size: 13, color: AppColors.textHint),
                        prefixIcon: const Icon(Icons.search, size: 18),
                        filled: true,
                        fillColor: const Color(0xFFF5F7FA),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (searchLoading)
                      const Padding(
                        padding: EdgeInsets.all(12),
                        child: Center(
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        ),
                      )
                    else if (searchResults.isNotEmpty)
                      Container(
                        constraints: const BoxConstraints(maxHeight: 200),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: searchResults.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final c = searchResults[i];
                            final isSelected = selectedExistingId == c['id'];
                            return GestureDetector(
                              onTap: () => setSheetState(
                                () => selectedExistingId = c['id'],
                              ),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                color: isSelected
                                    ? AppColors.primary.withOpacity(0.08)
                                    : Colors.transparent,
                                child: Row(
                                  children: [
                                    Icon(
                                      isSelected
                                          ? Icons.check_circle
                                          : Icons.circle_outlined,
                                      size: 18,
                                      color: isSelected
                                          ? AppColors.primary
                                          : AppColors.textHint,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            c['name'] ?? '',
                                            style: appText(
                                              size: 14,
                                              weight: FontWeight.w600,
                                            ),
                                          ),
                                          Text(
                                            [c['email'], c['phone']]
                                                .where(
                                                  (e) =>
                                                      e != null &&
                                                      e.toString().isNotEmpty,
                                                )
                                                .join(' · '),
                                            style: appText(
                                              size: 11,
                                              color: AppColors.textTertiary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          'No contributors found',
                          style: appText(
                            size: 13,
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ),
                    if (selectedExistingId != null) ...[
                      const SizedBox(height: 14),
                      _label('Pledge Amount (TZS)'),
                      _input(
                        existPledgeCtrl,
                        'e.g. 20,000',
                        keyboard: TextInputType.number,
                      ),
                    ],
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      child: Text(
                        'Add Contributor',
                        style: appText(
                          size: 15,
                          weight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
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
            boxShadow: active
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 4,
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: Text(
              text,
              style: appText(
                size: 13,
                weight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? AppColors.primary : AppColors.textTertiary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // RECORD PAYMENT
  // ════════════════════════════════════════════════════

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
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Record Payment',
                style: appText(size: 18, weight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                name,
                style: appText(size: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Text(
                'Pledge: ${_formatAmount(pledged)} · Paid: ${_formatAmount(paid)} · Balance: ${_formatAmount(balance)}',
                style: appText(size: 12, color: AppColors.textTertiary),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _label('Amount (TZS) *'),
                        _input(amtCtrl, '0', keyboard: TextInputType.number),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _label('Payment Method'),
                        Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F7FA),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: method,
                              isExpanded: true,
                              style: appText(size: 14),
                              items: _kPaymentMethods
                                  .map(
                                    (m) => DropdownMenuItem(
                                      value: m['id'] as String,
                                      child: Text(
                                        m['name'] as String,
                                        style: appText(size: 14),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) {
                                if (v != null) setSheetState(() => method = v);
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _label('Payment Reference'),
              _input(refCtrl, 'Transaction ID...'),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () async {
                    if (amtCtrl.text.trim().isEmpty ||
                        (double.tryParse(amtCtrl.text.trim()) ?? 0) <= 0) {
                      AppSnackbar.error(ctx, 'Enter a valid amount');
                      return;
                    }
                    Navigator.pop(ctx);
                    setState(() => _actionLoading = true);
                    final res = await EventsService.recordContributorPayment(
                      widget.eventId,
                      ec['id'].toString(),
                      {
                        'amount': double.tryParse(amtCtrl.text.trim()) ?? 0,
                        'payment_method': method,
                        if (refCtrl.text.trim().isNotEmpty)
                          'payment_reference': refCtrl.text.trim(),
                      },
                    );
                    if (mounted) {
                      setState(() => _actionLoading = false);
                      if (res['success'] == true) {
                        AppSnackbar.success(context, 'Payment recorded');
                        _load();
                      } else
                        AppSnackbar.error(context, res['message'] ?? 'Failed');
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  child: Text(
                    'Record Payment',
                    style: appText(
                      size: 15,
                      weight: FontWeight.w700,
                      color: Colors.white,
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

  // ════════════════════════════════════════════════════
  // UPDATE PLEDGE
  // ════════════════════════════════════════════════════

  void _showUpdatePledgeSheet(Map<String, dynamic> ec) {
    final pledgeCtrl = TextEditingController(
      text: _toNum(ec['pledge_amount']).toStringAsFixed(0),
    );
    final name = ec['contributor']?['name'] ?? 'Unknown';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Update Pledge',
              style: appText(size: 18, weight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              name,
              style: appText(size: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 18),
            _label('Pledge Amount (TZS)'),
            _input(pledgeCtrl, '0', keyboard: TextInputType.number),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  setState(() => _actionLoading = true);
                  final res = await EventsService.updateEventContributor(
                    widget.eventId,
                    ec['id'].toString(),
                    {
                      'pledge_amount':
                          double.tryParse(pledgeCtrl.text.trim()) ?? 0,
                    },
                  );
                  if (mounted) {
                    setState(() => _actionLoading = false);
                    if (res['success'] == true) {
                      AppSnackbar.success(context, 'Pledge updated');
                      _load();
                    } else
                      AppSnackbar.error(context, res['message'] ?? 'Failed');
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: Text(
                  'Update Pledge',
                  style: appText(
                    size: 15,
                    weight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ════════════════════════════════════════════════════
  // DOWNLOAD REPORT
  // ════════════════════════════════════════════════════

  void _showReportOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Download Report',
              style: appText(size: 18, weight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _downloadReport('pdf');
                    },
                    icon: const Icon(Icons.picture_as_pdf_rounded, size: 16),
                    label: Text(
                      'PDF',
                      style: appText(size: 13, weight: FontWeight.w600),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _downloadReport('xlsx');
                    },
                    icon: const Icon(Icons.table_chart_rounded, size: 16),
                    label: Text(
                      'Excel',
                      style: appText(size: 13, weight: FontWeight.w600),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.accent,
                      side: BorderSide(color: AppColors.accent),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Future<void> _downloadReport(String format) async {
    AppSnackbar.success(
      context,
      'Generating ${format == 'xlsx' ? 'Excel' : 'PDF'} report...',
    );
    try {
      final res = await ReportGenerator.generateContributionsReport(
        widget.eventId,
        format: format,
        contributions: _eventContributors,
        summary: _summary,
        eventBudget: widget.eventBudget,
        eventTitle: widget.eventTitle,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        if (format == 'pdf' && res['bytes'] != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ReportPreviewScreen(
                title: 'Contribution Report',
                pdfBytes: res['bytes'] as Uint8List,
                filePath: res['path'] as String,
              ),
            ),
          );
        } else if (res['path'] != null) {
          await OpenFilex.open(res['path'] as String);
          if (mounted) AppSnackbar.success(context, 'Report opened');
        }
      } else {
        AppSnackbar.error(
          context,
          res['message'] ?? 'Failed to generate report',
        );
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to generate report');
    }
  }

  // ════════════════════════════════════════════════════
  // SHARED WIDGETS
  // ════════════════════════════════════════════════════

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: appText(
        size: 12,
        weight: FontWeight.w600,
        color: AppColors.textSecondary,
      ),
    ),
  );

  Widget _input(
    TextEditingController ctrl,
    String hint, {
    TextInputType keyboard = TextInputType.text,
    int maxLines = 1,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: ctrl,
      keyboardType: keyboard,
      maxLines: maxLines,
      onChanged: onChanged,
      style: appText(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: appText(size: 13, color: AppColors.textHint),
        filled: true,
        fillColor: const Color(0xFFF5F7FA),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
    );
  }
}
