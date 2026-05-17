import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/utils/money_format.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';
import 'log_offline_payment_sheet.dart';

class EventServicesTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTypeId;
  final String? eventCoverImage;

  const EventServicesTab({super.key, required this.eventId, this.permissions, this.eventTypeId, this.eventCoverImage});

  @override
  State<EventServicesTab> createState() => _EventServicesTabState();
}

class _EventServicesTabState extends State<EventServicesTab> with AutomaticKeepAliveClientMixin {
  List<dynamic> _assignedServices = [];
  List<dynamic> _searchResults = [];
  bool _loading = true;
  bool _searching = false;
  bool _showSearch = false;
  String _searchQuery = '';
  Timer? _debounce;
  final Set<String> _addingIds = {};
  final Set<String> _removingIds = {};
  final TextEditingController _searchCtrl = TextEditingController();

  bool get _canManage => widget.permissions?['can_manage_vendors'] == true || widget.permissions?['is_creator'] == true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadAssigned();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAssigned() async {
    setState(() => _loading = true);
    final res = await EventsService.getEventServices(widget.eventId);
    if (mounted) setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _assignedServices = data is List ? data : (data is Map ? (data['services'] ?? data['items'] ?? []) : []);
      }
    });
  }

  void _toggleSearch() {
    setState(() {
      _showSearch = !_showSearch;
      if (!_showSearch) {
        // Clear search state when closing
        _searchCtrl.clear();
        _searchQuery = '';
        _searchResults = [];
        _searching = false;
        _debounce?.cancel();
      }
    });
  }

  void _searchServices(String q) {
    _debounce?.cancel();
    setState(() => _searchQuery = q);
    if (q.trim().length < 2) { setState(() { _searchResults = []; _searching = false; }); return; }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      final res = await EventsService.searchServicesPublic(q.trim(), eventTypeId: widget.eventTypeId);
      if (mounted) setState(() {
        _searching = false;
        if (res['success'] == true) {
          final data = res['data'];
          _searchResults = data is List ? data : (data is Map ? (data['services'] ?? []) : []);
        }
      });
    });
  }

  Future<void> _addServiceToEvent(Map<String, dynamic> service) async {
    final serviceId = service['id']?.toString() ?? '';
    if (serviceId.isEmpty) return;
    setState(() => _addingIds.add(serviceId));

    // Match web: send provider_service_id + provider_user_id
    final providerUserId = service['provider']?['id']?.toString() ?? service['provider_user_id']?.toString() ?? service['user_id']?.toString();
    final payload = <String, dynamic>{
      'provider_service_id': serviceId,
      if (providerUserId != null) 'provider_user_id': providerUserId,
      if (service['min_price'] != null) 'quoted_price': service['min_price'],
    };

    final res = await EventsService.addEventService(widget.eventId, payload);
    if (mounted) {
      setState(() => _addingIds.remove(serviceId));
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Service added to event');
        _loadAssigned();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to add service');
      }
    }
  }

  Future<void> _confirmRemoveService(Map<String, dynamic> service) async {
    final name = (service['service_name'] ?? service['title'] ?? service['provider_name'] ?? 'Service').toString();
    final serviceId = service['id']?.toString() ?? '';
    if (serviceId.isEmpty) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Remove Service', style: appText(size: 16, weight: FontWeight.w700)),
        content: Text('Remove "$name" from this event? This cannot be undone.', style: appText(size: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: appText(size: 14, color: AppColors.textTertiary))),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Remove', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.error)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    setState(() => _removingIds.add(serviceId));
    final res = await EventsService.removeEventService(widget.eventId, serviceId);
    if (mounted) {
      setState(() => _removingIds.remove(serviceId));
      if (res['success'] == true) {
        AppSnackbar.success(context, 'Service removed');
        _loadAssigned();
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Failed to remove');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) return const Center(child: CircularProgressIndicator(color: AppColors.primary));

    final total = _assignedServices.length;
    int countStatus(List<String> ss) => _assignedServices.where((s) {
      final st = ((s as Map)['service_status'] ?? s['status'] ?? '').toString();
      return ss.contains(st);
    }).length;
    final confirmed = countStatus(['confirmed', 'assigned', 'in_progress', 'completed']);
    final pending = countStatus(['pending', '']);
    final completed = countStatus(['completed']);
    final progress = total > 0 ? confirmed / total : 0.0;

    return NuruRefreshIndicator(
      onRefresh: _loadAssigned,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
        children: [
          // Assigned services hero — cream card with circular ring + event image fade
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFBF6EC),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 3))],
              ),
              child: Stack(children: [
                // Event image on right with cream fade
                if (widget.eventCoverImage != null && widget.eventCoverImage!.isNotEmpty)
                  Positioned.fill(
                    child: Row(children: [
                      const Spacer(flex: 5),
                      Expanded(
                        flex: 5,
                        child: ShaderMask(
                          blendMode: BlendMode.dstIn,
                          shaderCallback: (rect) => const LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [Colors.transparent, Colors.white, Colors.white],
                            stops: [0.0, 0.35, 1.0],
                          ).createShader(rect),
                          child: Image.network(
                            widget.eventCoverImage!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                          ),
                        ),
                      ),
                    ]),
                  ),
                // Foreground content
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                    Container(
                      width: 38, height: 38,
                      decoration: const BoxDecoration(color: Color(0xFFD4AF37), shape: BoxShape.circle),
                      child: const AppIcon('bag', size: 18, color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('Assigned Services',
                        style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
                      const SizedBox(height: 2),
                      Text('$confirmed',
                        style: appText(size: 34, weight: FontWeight.w800, color: AppColors.textPrimary, height: 1.0)),
                      const SizedBox(height: 4),
                      Text('of $total services assigned',
                        style: appText(size: 11, color: AppColors.textTertiary)),
                    ]),
                    const SizedBox(width: 6),
                    Expanded(child: Align(
                      alignment: Alignment.center,
                      child: SizedBox(
                        width: 92, height: 92,
                        child: Stack(alignment: Alignment.center, children: [
                          SizedBox(
                            width: 92, height: 92,
                            child: CircularProgressIndicator(
                              value: progress,
                              strokeWidth: 6,
                              backgroundColor: const Color(0xFFF1E6CE),
                              valueColor: const AlwaysStoppedAnimation(Color(0xFFD4AF37)),
                            ),
                          ),
                          Column(mainAxisSize: MainAxisSize.min, children: [
                            Text('${(progress * 100).toStringAsFixed(0)}%',
                              style: appText(size: 19, weight: FontWeight.w800, color: AppColors.textPrimary, height: 1.0)),
                            const SizedBox(height: 2),
                            Text('Assigned',
                              style: appText(size: 9, color: AppColors.textTertiary, weight: FontWeight.w600)),
                          ]),
                        ]),
                      ),
                    )),
                  ]),
                ),
                // Bottom tagline
                Positioned(
                  left: 18, right: 18, bottom: 12,
                  child: Row(children: [
                    const AppIcon('leaf', size: 13, color: Color(0xFFD4AF37)),
                    const SizedBox(width: 6),
                    Flexible(child: Text("You're building something beautiful.",
                      style: appText(size: 11, color: AppColors.textSecondary, weight: FontWeight.w500),
                      maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                ),
                // Reserve bottom space for tagline
                const SizedBox(height: 140, width: double.infinity),
              ]),
            ),
          ),
          const SizedBox(height: 16),

          // Action row
          if (_canManage)
            GestureDetector(
              onTap: _toggleSearch,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: _showSearch ? AppColors.primary : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _showSearch ? AppColors.primary : AppColors.borderLight),
                  boxShadow: _showSearch ? null : [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 6, offset: const Offset(0, 2))],
                ),
                child: Row(children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: _showSearch ? Colors.white.withOpacity(0.18) : AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: AppIcon(_showSearch ? 'close' : 'search', size: 16,
                      color: _showSearch ? Colors.white : AppColors.primary),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_showSearch ? 'Close search' : 'Find service providers',
                      style: appText(size: 13, weight: FontWeight.w700, color: _showSearch ? Colors.white : AppColors.textPrimary)),
                    Text(_showSearch ? 'Hide the search panel' : 'Browse and add vendors to this event',
                      style: appText(size: 11, color: _showSearch ? Colors.white.withOpacity(0.7) : AppColors.textTertiary)),
                  ])),
                  AppIcon(_showSearch ? 'chevron-down' : 'chevron-right',
                    size: 18, color: _showSearch ? Colors.white : AppColors.textTertiary),
                ]),
              ),
            ),
          if (_canManage) const SizedBox(height: 14),

          // Search panel
          if (_showSearch) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.primary.withOpacity(0.2)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                TextField(
                  controller: _searchCtrl,
                  onChanged: _searchServices,
                  style: appText(size: 14),
                  decoration: InputDecoration(
                    hintText: 'Search services...', hintStyle: appText(size: 13, color: AppColors.textHint),
                    prefixIcon: const Padding(padding: EdgeInsets.all(12), child: AppIcon('search', size: 16, color: AppColors.textHint)),
                    suffixIcon: _searching
                        ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
                        : null,
                    filled: true, fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE5E7EB), width: 1)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
                if (_searchResults.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  ..._searchResults.map((s) => _searchResultCard(s as Map<String, dynamic>)),
                ],
                if (!_searching && _searchQuery.length >= 2 && _searchResults.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text('No services found. Try different search terms.', style: appText(size: 12, color: AppColors.textTertiary), textAlign: TextAlign.center),
                  ),
              ]),
            ),
            const SizedBox(height: 16),
          ],

          // Assigned services list
          if (_assignedServices.isNotEmpty) ...[
            Row(children: [
              Text('Assigned vendors', style: appText(size: 13, weight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.3)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(20)),
                child: Text('${_assignedServices.length}', style: appText(size: 10, weight: FontWeight.w700, color: AppColors.primary)),
              ),
            ]),
            const SizedBox(height: 10),
            ..._assignedServices.map((s) => _assignedServiceCard(s as Map<String, dynamic>)),
          ] else
            _emptyState(),
        ],
      ),
    );
  }

  Widget _heroPill(String value, String label) {
    return Expanded(child: Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.14),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(children: [
        Text(value, style: appText(size: 15, weight: FontWeight.w800, color: Colors.white)),
        Text(label, style: appText(size: 9, color: Colors.white.withOpacity(0.75), weight: FontWeight.w600, letterSpacing: 0.5)),
      ]),
    ));
  }

  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
      child: Column(children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [AppColors.primary.withOpacity(0.1), AppColors.primary.withOpacity(0.05)]),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const AppIcon('package', size: 26, color: AppColors.primary),
        ),
        const SizedBox(height: 16),
        Text('No services assigned', style: appText(size: 16, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(
          _canManage ? 'Find vendors above to assign service providers' : 'No service providers assigned yet',
          style: appText(size: 13, color: AppColors.textTertiary), textAlign: TextAlign.center,
        ),
      ]),
    );
  }

  Widget _searchResultCard(Map<String, dynamic> service) {
    final title = (service['title'] ?? service['name'] ?? 'Service').toString();
    final category = service['service_category']?['name']?.toString() ?? service['category']?.toString() ?? '';
    final location = service['location']?.toString() ?? '';
    final rating = service['rating'];
    final imgUrl = _getServiceImage(service);
    final serviceId = service['id']?.toString() ?? '';
    final isAdding = _addingIds.contains(serviceId);
    final alreadyAdded = _assignedServices.any((s) =>
        s['service_id']?.toString() == serviceId ||
        s['provider_service_id']?.toString() == serviceId ||
        s['provider_user_service_id']?.toString() == serviceId);
    final price = service['price_display'] ?? (service['min_price'] != null ? '${getActiveCurrency()} ${_formatNum(service['min_price'])}' : null);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: alreadyAdded ? AppColors.primary.withOpacity(0.04) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: alreadyAdded ? AppColors.primary.withOpacity(0.3) : AppColors.border),
      ),
      child: Row(children: [
        ClipRRect(
          borderRadius: const BorderRadius.horizontal(left: Radius.circular(14)),
          child: SizedBox(
            width: 80, height: 80,
            child: imgUrl != null
                ? Image.network(imgUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _imagePlaceholder())
                : _imagePlaceholder(),
          ),
        ),
        Expanded(child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: appText(size: 13, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
            if (category.isNotEmpty) Text(category, style: appText(size: 10, color: AppColors.textTertiary)),
            const SizedBox(height: 4),
            Row(children: [
              if (rating != null) ...[
                const AppIcon('star', size: 12, color: Color(0xFFFBBF24)),
                const SizedBox(width: 2),
                Text(double.tryParse(rating.toString())?.toStringAsFixed(1) ?? '$rating', style: appText(size: 10, weight: FontWeight.w600)),
                const SizedBox(width: 8),
              ],
              if (location.isNotEmpty) ...[
                const AppIcon('location', size: 11, color: AppColors.textHint),
                const SizedBox(width: 2),
                Flexible(child: Text(location, style: appText(size: 10, color: AppColors.textTertiary), overflow: TextOverflow.ellipsis)),
              ],
            ]),
            if (price != null) Text(price.toString(), style: appText(size: 12, weight: FontWeight.w700, color: AppColors.primary)),
          ]),
        )),
        Padding(
          padding: const EdgeInsets.only(right: 10),
          child: alreadyAdded
              ? Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const AppIcon('double-check', size: 12, color: Colors.white),
                )
              : GestureDetector(
                  onTap: isAdding ? null : () => _addServiceToEvent(service),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
                    child: isAdding
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                        : const AppIcon('plus', size: 14, color: AppColors.primary),
                  ),
                ),
        ),
      ]),
    );
  }

  Widget _assignedServiceCard(Map<String, dynamic> service) {
    final nested = service['service'] as Map<String, dynamic>? ?? {};
    final name = (service['service_name'] ?? nested['title'] ?? service['title'] ?? service['provider_name'] ?? 'Service').toString();
    final providerName = (service['provider_name'] ?? service['provider']?['name'] ?? nested['provider_name'] ?? '').toString();
    final category = (nested['category'] ?? nested['service_type_name'] ?? service['service_category']?['name'] ?? service['category'] ?? '').toString();
    final status = (service['service_status'] ?? service['status'] ?? 'pending').toString();
    final price = service['agreed_price'] ?? service['quoted_price'];
    final serviceId = service['id']?.toString() ?? '';
    final isRemoving = _removingIds.contains(serviceId);
    final imgUrl = _getAssignedServiceImage(service);

    // (category icon badge removed per design)


    final isAssignedLike = ['confirmed', 'assigned', 'in_progress'].contains(status);

    // Always white card; no dark theme
    final Color titleColor = AppColors.textPrimary;
    final Color subColor = AppColors.textTertiary;
    final Color priceColor = const Color(0xFFD4AF37);

    // Status pill
    Color statusBg; Color statusFg; String statusIcon;
    if (status == 'completed') { statusBg = const Color(0xFFDCFCE7); statusFg = const Color(0xFF16A34A); statusIcon = 'verified'; }
    else if (isAssignedLike) { statusBg = const Color(0xFFDCFCE7); statusFg = const Color(0xFF16A34A); statusIcon = 'verified'; }
    else if (status == 'cancelled') { statusBg = const Color(0xFFFEE2E2); statusFg = const Color(0xFFDC2626); statusIcon = 'close-circle'; }
    else { statusBg = const Color(0xFFFBE7C7); statusFg = const Color(0xFFB8860B); statusIcon = 'clock'; }
    final statusLabel = status.isEmpty ? 'Pending' : status.replaceAll('_', ' ').split(' ').map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '').join(' ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Image with cream fade overlay on the right edge
        SizedBox(
          width: 130,
          child: Stack(children: [
            Positioned.fill(
              child: imgUrl != null
                  ? Image.network(imgUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _imagePlaceholder())
                  : _imagePlaceholder(),
            ),
            // Cream fade — image fades into card on the right
            Positioned.fill(
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [Colors.transparent, Colors.transparent, Color(0xFFFBF6EC)],
                    stops: [0.0, 0.55, 1.0],
                  ),
                ),
              ),
            ),
          ]),
        ),

        // Details
        Expanded(child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(name, style: appText(size: 15, weight: FontWeight.w800, color: titleColor), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                if (providerName.isNotEmpty)
                  Text(providerName, style: appText(size: 12, color: subColor, weight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                if (category.isNotEmpty)
                  Text(category, style: appText(size: 11, color: subColor), maxLines: 1, overflow: TextOverflow.ellipsis),
              ])),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AppIcon(statusIcon, size: 11, color: statusFg),
                  const SizedBox(width: 4),
                  Text(statusLabel, style: appText(size: 10, weight: FontWeight.w700, color: statusFg)),
                ]),
              ),
            ]),
            const SizedBox(height: 8),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(child: price != null
                ? Text('${getActiveCurrency()} ${_formatNum(price)}',
                    style: appText(size: 15, weight: FontWeight.w800, color: priceColor))
                : const SizedBox.shrink()),
              GestureDetector(
                onTap: _canManage && !['assigned', 'in_progress', 'completed'].contains(status)
                  ? (isRemoving ? null : () => _confirmRemoveService(service))
                  : null,
                child: const AppIcon('more-vertical', size: 18, color: AppColors.textHint),
              ),
            ]),
            if (_canManage && status == 'assigned' && serviceId.isNotEmpty) ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _openLogPayment(service),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(children: [
                    const AppIcon('card', size: 14, color: Color(0xFF16A34A)),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Log offline payment',
                      style: appText(size: 12, weight: FontWeight.w700, color: const Color(0xFF16A34A)))),
                    const AppIcon('chevron-right', size: 14, color: Color(0xFF16A34A)),
                  ]),
                ),
              ),
            ],
          ]),
        )),
      ])),
    );
  }

  void _openLogPayment(Map<String, dynamic> service) {
    final nested = service['service'] as Map<String, dynamic>? ?? {};
    final vendor = (service['provider_name'] ?? service['provider']?['name'] ?? nested['provider_name'] ?? nested['title'] ?? 'Vendor').toString();
    final title = (service['service_name'] ?? nested['title'] ?? service['title'] ?? 'Service').toString();
    final agreed = service['agreed_price'] ?? service['quoted_price'];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => LogOfflinePaymentSheet(
        eventId: widget.eventId,
        eventServiceId: service['id'].toString(),
        vendorName: vendor,
        serviceTitle: title,
        agreedPrice: agreed is num ? agreed : num.tryParse(agreed?.toString() ?? ''),
        onLogged: _loadAssigned,
      ),
    );
  }

  Widget _imagePlaceholder() => Container(color: Colors.white, child: const Center(child: AppIcon('image', size: 22, color: AppColors.textHint)));

  /// Extract image URL from assigned service data — mirrors web's extraction logic.
  /// The API nests the original service under service['service'] with keys like image, primary_image, images[], gallery_images[].
  String? _getAssignedServiceImage(Map<String, dynamic> s) {
    // 1. Check nested service object (web pattern: service.service.image)
    final nested = s['service'];
    if (nested is Map<String, dynamic>) {
      final fromNested = _extractImageFromMap(nested);
      if (fromNested != null) return fromNested;
    }
    // 2. Check provider_service nested object
    final provSvc = s['provider_service'];
    if (provSvc is Map<String, dynamic>) {
      final fromProv = _extractImageFromMap(provSvc);
      if (fromProv != null) return fromProv;
    }
    // 3. Check top-level keys
    return _extractImageFromMap(s);
  }

  /// Try all known image key patterns from a single map
  String? _extractImageFromMap(Map<String, dynamic> m) {
    // Single string fields
    for (final key in ['image', 'primary_image', 'cover_image', 'image_url']) {
      final val = m[key];
      if (val is String && val.isNotEmpty) return val;
      if (val is Map) {
        final url = val['thumbnail_url'] ?? val['url'];
        if (url is String && url.isNotEmpty) return url;
      }
    }
    // Array fields
    for (final key in ['images', 'gallery_images']) {
      if (m[key] is List && (m[key] as List).isNotEmpty) {
        final first = (m[key] as List)[0];
        if (first is String && first.isNotEmpty) return first;
        if (first is Map) {
          final url = first['url'] ?? first['image_url'] ?? first['file_url'] ?? first['thumbnail_url'];
          if (url is String && url.isNotEmpty) return url;
        }
      }
    }
    return null;
  }

  /// Used by search results
  String? _getServiceImage(Map<String, dynamic> s) => _extractImageFromMap(s);

  String _formatNum(dynamic n) {
    final num val = n is num ? n : (num.tryParse(n.toString()) ?? 0);
    return val.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }
}
