import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/events_service.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/l10n/l10n_helper.dart';

class EventServicesTab extends StatefulWidget {
  final String eventId;
  final Map<String, dynamic>? permissions;
  final String? eventTypeId;

  const EventServicesTab({super.key, required this.eventId, this.permissions, this.eventTypeId});

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

    return RefreshIndicator(
      onRefresh: _loadAssigned,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Row(children: [
            Expanded(child: Text('Event Services', style: appText(size: 16, weight: FontWeight.w700))),
            if (_canManage)
              GestureDetector(
                onTap: _toggleSearch,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: _showSearch ? AppColors.primary : AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(_showSearch ? Icons.close : Icons.add_rounded, size: 16, color: _showSearch ? Colors.white : AppColors.primary),
                    const SizedBox(width: 4),
                    Text(_showSearch ? 'Close' : 'Add Service', style: appText(size: 12, weight: FontWeight.w600, color: _showSearch ? Colors.white : AppColors.primary)),
                  ]),
                ),
              ),
          ]),
          const SizedBox(height: 12),

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
                Text('Find Service Providers', style: appText(size: 14, weight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Search and add services to your event', style: appText(size: 12, color: AppColors.textTertiary)),
                const SizedBox(height: 12),
                TextField(
                  controller: _searchCtrl,
                  onChanged: _searchServices,
                  style: appText(size: 14),
                  decoration: InputDecoration(
                    hintText: 'Search services...', hintStyle: appText(size: 13, color: AppColors.textHint),
                    prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textHint),
                    suffixIcon: _searching
                        ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
                        : null,
                    filled: true, fillColor: const Color(0xFFF5F7FA),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
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

          // Assigned services
          if (_assignedServices.isNotEmpty) ...[
            Text('Assigned Services (${_assignedServices.length})', style: appText(size: 14, weight: FontWeight.w600, color: AppColors.textSecondary)),
            const SizedBox(height: 10),
            ..._assignedServices.map((s) => _assignedServiceCard(s as Map<String, dynamic>)),
          ] else
            _emptyState(),

          const SizedBox(height: 80),
        ],
      ),
    );
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
          child: const Icon(Icons.storefront_rounded, size: 28, color: AppColors.primary),
        ),
        const SizedBox(height: 16),
        Text('No services assigned', style: appText(size: 16, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(
          _canManage ? 'Tap "Add Service" to search and assign service providers' : 'No service providers assigned yet',
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
    final price = service['price_display'] ?? (service['min_price'] != null ? 'TZS ${_formatNum(service['min_price'])}' : null);

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
                const Icon(Icons.star, size: 12, color: Color(0xFFFBBF24)),
                const SizedBox(width: 2),
                Text(double.tryParse(rating.toString())?.toStringAsFixed(1) ?? '$rating', style: appText(size: 10, weight: FontWeight.w600)),
                const SizedBox(width: 8),
              ],
              if (location.isNotEmpty) ...[
                const Icon(Icons.location_on_outlined, size: 11, color: AppColors.textHint),
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
                  child: const Icon(Icons.check, size: 14, color: Colors.white),
                )
              : GestureDetector(
                  onTap: isAdding ? null : () => _addServiceToEvent(service),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(color: AppColors.primarySoft, shape: BoxShape.circle),
                    child: isAdding
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                        : const Icon(Icons.add, size: 14, color: AppColors.primary),
                  ),
                ),
        ),
      ]),
    );
  }

  Widget _assignedServiceCard(Map<String, dynamic> service) {
    // The API nests service details under service['service'] — mirror the web's extraction
    final nested = service['service'] as Map<String, dynamic>? ?? {};
    final name = (service['service_name'] ?? nested['title'] ?? service['title'] ?? service['provider_name'] ?? 'Service').toString();
    final providerName = (service['provider_name'] ?? service['provider']?['name'] ?? nested['provider_name'] ?? '').toString();
    final category = (nested['category'] ?? nested['service_type_name'] ?? service['service_category']?['name'] ?? service['category'] ?? '').toString();
    final status = (service['service_status'] ?? service['status'] ?? 'pending').toString();
    final price = service['agreed_price'] ?? service['quoted_price'];
    final serviceId = service['id']?.toString() ?? '';
    final isRemoving = _removingIds.contains(serviceId);
    final rating = service['rating'] ?? nested['rating'] ?? service['provider']?['rating'];
    // Image: check nested service object first (matches web), then top-level, then provider_service
    final imgUrl = _getAssignedServiceImage(service);

    Color statusBg;
    Color statusFg;
    switch (status) {
      case 'completed':
        statusBg = const Color(0xFFDCFCE7);
        statusFg = const Color(0xFF16A34A);
        break;
      case 'confirmed': case 'assigned':
        statusBg = const Color(0xFFDBEAFE);
        statusFg = const Color(0xFF2563EB);
        break;
      case 'in_progress':
        statusBg = const Color(0xFFFEF3C7);
        statusFg = const Color(0xFFCA8A04);
        break;
      case 'cancelled':
        statusBg = const Color(0xFFFEE2E2);
        statusFg = const Color(0xFFDC2626);
        break;
      default:
        statusBg = const Color(0xFFF3F4F6);
        statusFg = const Color(0xFF6B7280);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(children: [
        // Service image thumbnail
        ClipRRect(
          borderRadius: const BorderRadius.horizontal(left: Radius.circular(14)),
          child: SizedBox(
            width: 90, height: 90,
            child: imgUrl != null
                ? Image.network(imgUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _imagePlaceholder())
                : _imagePlaceholder(),
          ),
        ),

        // Details
        Expanded(child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            // Name + status row
            Row(children: [
              Expanded(child: Text(name, style: appText(size: 13, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(6)),
                child: Text(
                  status.replaceAll('_', ' ').split(' ').map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '').join(' '),
                  style: appText(size: 9, weight: FontWeight.w700, color: statusFg),
                ),
              ),
            ]),
            const SizedBox(height: 3),

            // Provider + category
            if (providerName.isNotEmpty || category.isNotEmpty)
              Text(
                [if (providerName.isNotEmpty) providerName, if (category.isNotEmpty) category].join(' · '),
                style: appText(size: 11, color: AppColors.textTertiary),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),

            const SizedBox(height: 4),

            // Price + rating row
            Row(children: [
              if (price != null)
                Text('TZS ${_formatNum(price)}', style: appText(size: 12, weight: FontWeight.w800, color: AppColors.primary)),
              if (price != null && rating != null) const SizedBox(width: 8),
              if (rating != null) ...[
                const Icon(Icons.star_rounded, size: 12, color: Color(0xFFF59E0B)),
                const SizedBox(width: 2),
                Text(double.tryParse(rating.toString())?.toStringAsFixed(1) ?? '$rating', style: appText(size: 11, weight: FontWeight.w600)),
              ],
              const Spacer(),
              if (_canManage)
                GestureDetector(
                  onTap: isRemoving ? null : () => _confirmRemoveService(service),
                  child: isRemoving
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.error))
                      : Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.error.withOpacity(0.7)),
                ),
            ]),
          ]),
        )),
      ]),
    );
  }

  Widget _imagePlaceholder() => Container(color: const Color(0xFFF5F7FA), child: const Center(child: Icon(Icons.image_outlined, size: 24, color: AppColors.textHint)));

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
