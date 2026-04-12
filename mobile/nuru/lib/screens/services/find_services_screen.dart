import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/events_service.dart';
import 'public_service_screen.dart';
import '../../core/l10n/l10n_helper.dart';

class FindServicesScreen extends StatefulWidget {
  const FindServicesScreen({super.key});

  @override
  State<FindServicesScreen> createState() => _FindServicesScreenState();
}

class _FindServicesScreenState extends State<FindServicesScreen> {
  bool _loading = true;
  List<dynamic> _services = [];
  List<dynamic> _categories = [];
  String? _selectedCategory;
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      EventsService.getServices(limit: 50, category: _selectedCategory, search: _searchQuery.isNotEmpty ? _searchQuery : null),
      EventsService.getServiceCategories(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        final svcRes = results[0];
        if (svcRes['success'] == true) {
          final data = svcRes['data'];
          _services = data is List ? data : (data is Map ? (data['services'] ?? data['items'] ?? []) : []);
        }
        final catRes = results[1];
        if (catRes['success'] == true) {
          final data = catRes['data'];
          _categories = data is List ? data : [];
        }
      });
    }
  }

  String _str(dynamic v, {String fallback = ''}) {
    if (v == null) return fallback;
    if (v is String) return v.isEmpty ? fallback : v;
    if (v is Map) return (v['name'] ?? v['title'] ?? v['label'] ?? v.values.first)?.toString() ?? fallback;
    return v.toString();
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface, elevation: 0,
        leading: IconButton(
          icon: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 22, height: 22,
            colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Find Services', style: _f(size: 18, weight: FontWeight.w700)),
        centerTitle: false,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              children: [
                Container(
                  height: 42,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                  child: TextField(
                    controller: _searchCtrl,
                    style: _f(size: 14),
                    decoration: InputDecoration(
                      hintText: 'Search by name, category, or keyword...',
                      hintStyle: _f(size: 14, color: AppColors.textHint),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      icon: SvgPicture.asset('assets/icons/search-icon.svg', width: 18, height: 18,
                        colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                    ),
                    onSubmitted: (q) { setState(() => _searchQuery = q); _load(); },
                  ),
                ),
                if (_categories.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 34,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _filterChip('All', _selectedCategory == null, () { setState(() => _selectedCategory = null); _load(); }),
                        ..._categories.map((c) {
                          final name = _str(c['name']);
                          final id = c['id']?.toString();
                          return _filterChip(name.isNotEmpty ? name : 'Category', _selectedCategory == id, () { setState(() => _selectedCategory = id); _load(); });
                        }),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Results count
          if (!_loading && _services.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('${_services.length} service providers', style: _f(size: 12, color: AppColors.textTertiary)),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _services.isEmpty
                    ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.work_off_outlined, size: 48, color: AppColors.textHint),
                        const SizedBox(height: 12),
                        Text('No services found', style: _f(size: 14, color: AppColors.textTertiary)),
                        const SizedBox(height: 4),
                        Text('Try adjusting your search or filters', style: _f(size: 12, color: AppColors.textHint)),
                      ]))
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.primary,
                        child: ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                          itemCount: _services.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, i) => _serviceCard(_services[i] as Map<String, dynamic>),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: _f(size: 12, weight: FontWeight.w600, color: selected ? Colors.white : AppColors.textSecondary)),
      ),
    );
  }

  Widget _serviceCard(Map<String, dynamic> service) {
    final serviceId = service['id']?.toString() ?? '';
    final name = _str(service['title'], fallback: _str(service['name'], fallback: 'Service'));
    final category = _str(service['service_category'], fallback: _str(service['category_name'], fallback: _str(service['service_type_name'])));
    final location = _str(service['location']);
    final rating = (service['rating'] ?? service['average_rating'] ?? 0).toDouble();
    final reviewCount = service['review_count'] ?? 0;
    final description = _str(service['short_description'], fallback: _str(service['description']));
    final images = service['images'] as List? ?? [];
    final primaryImage = service['primary_image']?.toString();
    String? cover;
    if (primaryImage != null && primaryImage.isNotEmpty) {
      cover = primaryImage;
    } else if (images.isNotEmpty) {
      final first = images[0];
      cover = first is Map ? (first['image_url'] ?? first['url'])?.toString() : first?.toString();
    }

    // Price display — match web: min_price – max_price or base_price
    String priceDisplay = '';
    final minPrice = service['min_price'] ?? service['base_price'] ?? service['starting_price'];
    final maxPrice = service['max_price'];
    if (minPrice != null && maxPrice != null) {
      priceDisplay = 'TZS ${_formatNum(minPrice)} – ${_formatNum(maxPrice)}';
    } else if (minPrice != null) {
      priceDisplay = 'From TZS ${_formatNum(minPrice)}';
    } else {
      priceDisplay = 'Price on request';
    }

    return GestureDetector(
      onTap: serviceId.isEmpty
          ? null
          : () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PublicServiceScreen(serviceId: serviceId)),
              ),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight, width: 1),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 2))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image with category badge
          if (cover != null)
            Stack(
              children: [
                Image.network(cover, height: 160, width: double.infinity, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(height: 160, color: AppColors.surfaceVariant, child: const Center(child: Icon(Icons.image_outlined, size: 32, color: AppColors.textHint)))),
                if (category.isNotEmpty)
                  Positioned(
                    bottom: 8, left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.9), borderRadius: BorderRadius.circular(6)),
                      child: Text(category, style: _f(size: 10, weight: FontWeight.w600, color: AppColors.textSecondary)),
                    ),
                  ),
              ],
            )
          else
            Container(
              height: 100, color: AppColors.surfaceVariant,
              child: Center(child: Text(name.length >= 2 ? name.substring(0, 2).toUpperCase() : name.toUpperCase(), style: _f(size: 24, weight: FontWeight.w700, color: AppColors.textHint))),
            ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title + Rating
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text(name, style: _f(size: 15, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    if (rating > 0) ...[
                      const SizedBox(width: 8),
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.star_rounded, size: 14, color: Colors.amber.shade600),
                        const SizedBox(width: 2),
                        Text('$rating', style: _f(size: 12, weight: FontWeight.w600)),
                        if (reviewCount > 0) Text(' ($reviewCount)', style: _f(size: 11, color: AppColors.textTertiary)),
                      ]),
                    ],
                  ],
                ),
                // Location
                if (location.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(children: [
                    SvgPicture.asset('assets/icons/location-icon.svg', width: 13, height: 13, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                    const SizedBox(width: 4),
                    Expanded(child: Text(location, style: _f(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                ],
                // Description
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(description, style: _f(size: 12, color: AppColors.textSecondary, height: 1.4), maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
                // Price
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.only(top: 8),
                  decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.borderLight, width: 0.5))),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(child: Text(priceDisplay, style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary))),
                      SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 16, height: 16, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        ),
      ),
    );
  }

  String _formatNum(dynamic n) {
    final num val = n is num ? n : (num.tryParse(n.toString()) ?? 0);
    if (val >= 1000000) return '${(val / 1000000).toStringAsFixed(1)}M';
    if (val >= 1000) return '${(val / 1000).toStringAsFixed(0)}K';
    return val.toStringAsFixed(0);
  }
}
