import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/expanding_search_action.dart';
import '../../core/services/api_service.dart';
import '../../core/services/user_services_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/agreement_gate.dart';
import '../photos/my_photo_libraries_screen.dart';
import 'service_detail_screen.dart';
import 'add_service_screen.dart';
import 'edit_service_screen.dart';
import 'manage_photos_screen.dart';
import 'manage_intro_clip_screen.dart';
import 'public_service_screen.dart';
import 'service_verification_screen.dart';
import '../../core/l10n/l10n_helper.dart';
import '../migration/migration_banner.dart';

class MyServicesScreen extends StatefulWidget {
  const MyServicesScreen({super.key});

  @override
  State<MyServicesScreen> createState() => _MyServicesScreenState();
}

class _MyServicesScreenState extends State<MyServicesScreen> {
  List<dynamic> _services = [];
  List<dynamic> _recentReviews = [];
  Map<String, dynamic> _summary = {};
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await UserServicesService.getMyServices(search: _search.isEmpty ? null : _search);
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          final data = res['data'];
          if (data is List) {
            _services = data;
          } else if (data is Map) {
            _services = data['services'] ?? [];
            _recentReviews = data['recent_reviews'] ?? [];
            _summary = data['summary'] is Map<String, dynamic> ? data['summary'] as Map<String, dynamic> : {};
          } else {
            _services = [];
          }
        }
      });
    }
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  String _fmtPrice(dynamic p) {
    if (p == null) return 'Price on request';
    final n = (p is num) ? p.toInt() : (int.tryParse(p.toString().replaceAll(RegExp(r'[^\d]'), '')) ?? 0);
    if (n == 0) return 'Price on request';
    return 'TZS ${n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  static String get _baseUrl => ApiService.baseUrl;

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F3F8),
      appBar: NuruSubPageAppBar(
        title: context.tr('my_services'),
        actions: [
          ExpandingSearchAction(
            value: _search,
            hintText: 'Search services…',
            onChanged: (v) {
              setState(() => _search = v);
              _load();
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final ok = await AgreementGate.checkAndPrompt(context, 'vendor_agreement');
          if (!ok || !mounted) return;
          final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => const AddServiceScreen()));
          if (result == true) _load();
        },
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: Text('Add Service', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13)),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : _services.isEmpty
                ? ListView(children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                    _emptyState(),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    children: [
                      const MigrationBanner(surface: MigrationSurface.services, margin: EdgeInsets.only(bottom: 12)),
                      // Stats Row — matches web
                      _statsRow(),
                      const SizedBox(height: 16),
                      // Service Cards
                      ..._services.map((s) => _serviceCard(s)),
                      // Recent Reviews
                      if (_recentReviews.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        _recentReviewsSection(),
                      ],
                    ],
                  ),
      ),
    );
  }

  Widget _statsRow() {
    final avgRating = _summary['average_rating'] ?? 0;
    final totalReviews = _summary['total_reviews'] ?? _services.fold<int>(0, (s, x) => s + ((x is Map ? x['review_count'] ?? 0 : 0) as int));
    final completedEvents = _services.fold<int>(0, (s, x) => s + ((x is Map ? x['completed_events'] ?? 0 : 0) as int));

    return Row(children: [
      Expanded(child: _statCard('Services', '${_services.length}', AppColors.primary, Icons.work_outline_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _statCard('Avg Rating', avgRating is num && avgRating > 0 ? avgRating.toStringAsFixed(1) : '–', const Color(0xFFCA8A04), Icons.star_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _statCard('Reviews', '$totalReviews', AppColors.blue, Icons.people_outline_rounded)),
      const SizedBox(width: 8),
      Expanded(child: _statCard('Events', '$completedEvents', AppColors.success, Icons.check_circle_outline_rounded)),
    ]);
  }

  Widget _statCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(height: 8),
        Text(value, style: _f(size: 18, weight: FontWeight.w800)),
        Text(label, style: _f(size: 10, color: AppColors.textTertiary, weight: FontWeight.w600)),
      ]),
    );
  }

  Widget _emptyState() {
    return Column(children: [
      Container(
        width: 72, height: 72,
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [AppColors.primarySoft, AppColors.primary.withOpacity(0.15)]),
          borderRadius: BorderRadius.circular(36),
        ),
        child: const Center(child: Icon(Icons.work_outline_rounded, size: 32, color: AppColors.primary)),
      ),
      const SizedBox(height: 16),
      Text('No services yet', style: _f(size: 18, weight: FontWeight.w700)),
      const SizedBox(height: 6),
      Text('Create a service to start receiving bookings',
          style: _f(size: 13, color: AppColors.textTertiary), textAlign: TextAlign.center),
    ]);
  }

  Widget _serviceCard(dynamic service) {
    final s = service is Map<String, dynamic> ? service : <String, dynamic>{};
    final serviceId = s['id']?.toString() ?? '';
    final name = s['title']?.toString() ?? s['name']?.toString() ?? 'Service';
    final category = s['service_category']?['name']?.toString() ?? s['service_type_name']?.toString() ?? s['category']?.toString() ?? '';
    final serviceTypeSlug = (s['service_type_slug'] ?? s['service_category']?['slug'] ?? s['service_type']?['slug'] ?? '').toString().toLowerCase();
    final isPhotographyService = serviceTypeSlug.contains('photo') || category.toLowerCase().contains('photo');
    final rating = s['average_rating'] ?? s['rating'] ?? 0;
    final reviewCount = s['review_count'] ?? s['reviews_count'] ?? s['total_reviews'] ?? 0;
    final isVerified = s['is_verified'] == true || s['verification_status'] == 'verified';
    final isPending = (s['verification_status']?.toString() ?? '') == 'pending';
    final verificationProgress = s['verification_progress'] ?? 0;
    final status = s['status']?.toString() ?? 'active';
    final images = _extractImages(s);
    final price = s['min_price'] ?? s['starting_price'] ?? s['price'];
    final maxPrice = s['max_price'];
    final description = s['description']?.toString() ?? s['short_description']?.toString() ?? '';
    final completedEvents = s['completed_events'] ?? 0;
    final location = s['location']?.toString() ?? '';
    final availability = s['availability']?.toString() ?? 'available';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 16, offset: const Offset(0, 4))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Portfolio Image Strip — matching web grid
        if (images.isNotEmpty)
          _imageStrip(images, name, isVerified, isPending, serviceId),

        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Image strip action buttons
            if (images.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    _svgActionBtn('View', 'assets/icons/view-icon.svg', () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailScreen(serviceId: serviceId)));
                    }),
                    const SizedBox(width: 6),
                    if (!isVerified) ...[
                    _svgActionBtn('Edit', 'assets/icons/settings-icon.svg', () async {
                      final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => EditServiceScreen(service: s)));
                      if (result == true) _load();
                    }),
                      const SizedBox(width: 6),
                    ],
                    if (isVerified) ...[
                      _svgActionBtn('Package', 'assets/icons/package-icon.svg', () => _addPackageSheet(serviceId)),
                      const SizedBox(width: 6),
                    ],
                    _svgActionBtn('Photos', 'assets/icons/photos-icon.svg', () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => ManagePhotosScreen(
                        serviceId: serviceId,
                        serviceName: name,
                      )));
                    }),
                    const SizedBox(width: 6),
                    _svgActionBtn('Intro Clip', 'assets/icons/video-icon.svg', () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => ManageIntroClipScreen(
                        serviceId: serviceId,
                        serviceName: name,
                      )));
                    }),
                  ]),
                ),
              ),

            // Title + badges
            Text(name, style: _f(size: 18, weight: FontWeight.w700), maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              if (category.isNotEmpty) _badge(category, AppColors.primary.withOpacity(0.08), AppColors.primary),
              _badge(availability, availability == 'available' ? AppColors.success.withOpacity(0.1) : AppColors.warning.withOpacity(0.1),
                  availability == 'available' ? AppColors.success : AppColors.warning),
            ]),
            const SizedBox(height: 10),

            // Stats row
            Wrap(spacing: 12, runSpacing: 6, children: [
              if (rating is num && rating > 0)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  ...List.generate(5, (i) => Icon(
                    i < (rating as num).round() ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 14, color: i < (rating as num).round() ? Colors.amber : AppColors.textHint,
                  )),
                  const SizedBox(width: 4),
                  Text('${(rating as num).toStringAsFixed(1)}', style: _f(size: 12, weight: FontWeight.w700)),
                  Text(' ($reviewCount)', style: _f(size: 11, color: AppColors.textTertiary)),
                ]),
              if (completedEvents is num && completedEvents > 0)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.check_circle_outline_rounded, size: 14, color: AppColors.success),
                  const SizedBox(width: 3),
                  Text('$completedEvents events', style: _f(size: 12, color: AppColors.textTertiary)),
                ]),
              if (location.isNotEmpty)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textTertiary),
                  const SizedBox(width: 3),
                  Text(location, style: _f(size: 12, color: AppColors.textTertiary), overflow: TextOverflow.ellipsis),
                ]),
            ]),

            if (description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(description, style: _f(size: 13, color: AppColors.textSecondary, height: 1.4), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],

            // Price
            const SizedBox(height: 10),
            if (price != null)
              Text(
                maxPrice != null ? '${_fmtPrice(price)} – ${_fmtPrice(maxPrice)}' : 'From ${_fmtPrice(price)}',
                style: _f(size: 15, weight: FontWeight.w700, color: AppColors.primary),
              ),

            // Verification Progress (matches web)
            if (!isVerified) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.warning.withOpacity(0.2)),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text('Activation Progress', style: _f(size: 11, weight: FontWeight.w700, color: AppColors.warning)),
                    Text('$verificationProgress%', style: _f(size: 11, weight: FontWeight.w800, color: AppColors.warning)),
                  ]),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (verificationProgress is num ? verificationProgress.toDouble() : 0.0) / 100.0,
                      backgroundColor: AppColors.warning.withOpacity(0.15),
                      valueColor: const AlwaysStoppedAnimation(AppColors.warning),
                      minHeight: 6,
                    ),
                  ),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceVerificationScreen(serviceId: serviceId))),
                    child: Text(
                      verificationProgress > 0 ? 'Continue Activation →' : 'Activate Service →',
                      style: _f(size: 11, weight: FontWeight.w700, color: AppColors.warning),
                    ),
                  ),
                ]),
              ),
            ],

            // Quick Actions — Bookings, My Events, Photo Libraries
            const SizedBox(height: 12),
            Wrap(spacing: 6, runSpacing: 6, children: [
              _svgActionPill(label: 'My Events', svgAsset: 'assets/icons/calendar-icon.svg', onTap: () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailScreen(serviceId: serviceId)));
              }),
              if (isPhotographyService && isVerified)
                _svgActionPill(
                  label: 'Photo Libraries',
                  svgAsset: 'assets/icons/photos-icon.svg',
                  color: const Color(0xFF7C3AED),
                  onTap: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => MyPhotoLibrariesScreen(serviceId: serviceId, title: '$name · Photos'),
                  )),
                ),
              _svgActionPill(label: 'Manage', svgAsset: 'assets/icons/settings-icon.svg', onTap: () => _openManageSheet(s)),
            ]),
          ]),
        ),
      ]),
    );
  }

  Widget _imageStrip(List<String> images, String name, bool isVerified, bool isPending, String serviceId) {
    final displayImages = images.take(4).toList();
    return Stack(children: [
      SizedBox(
        height: 180,
        child: displayImages.length == 1
            ? CachedNetworkImage(imageUrl: displayImages[0], width: double.infinity, height: 180, fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(height: 180, color: AppColors.surfaceVariant))
            : displayImages.length == 2
                ? Row(children: displayImages.map((img) => Expanded(child: Padding(
                    padding: const EdgeInsets.only(right: 1),
                    child: CachedNetworkImage(imageUrl: img, height: 180, fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant)),
                  ))).toList())
                : displayImages.length == 3
                    ? Row(children: displayImages.map((img) => Expanded(child: Padding(
                        padding: const EdgeInsets.only(right: 1),
                        child: CachedNetworkImage(imageUrl: img, height: 180, fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant)),
                      ))).toList())
                    : Row(children: [
                        Expanded(flex: 2, child: CachedNetworkImage(imageUrl: displayImages[0], height: 180, fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant))),
                        const SizedBox(width: 1),
                        Expanded(child: Column(children: [
                          Expanded(child: CachedNetworkImage(imageUrl: displayImages[1], width: double.infinity, fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant))),
                          const SizedBox(height: 1),
                          Expanded(child: Stack(children: [
                            CachedNetworkImage(imageUrl: displayImages[2], width: double.infinity, fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant)),
                            if (images.length > 4)
                              Container(color: Colors.black.withOpacity(0.5), alignment: Alignment.center,
                                child: Text('+${images.length - 4}', style: _f(size: 16, weight: FontWeight.w800, color: Colors.white))),
                          ])),
                        ])),
                      ]),
      ),
      // Gradient overlay
      Positioned.fill(child: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(
          begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Colors.transparent, Colors.transparent, Colors.black54],
        )),
      )),
      // Status badges
      if (isPending)
        Positioned(top: 10, left: 10, child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: AppColors.warning.withOpacity(0.9), borderRadius: BorderRadius.circular(8)),
          child: Text('Pending Activation', style: _f(size: 10, weight: FontWeight.w700, color: Colors.white)),
        )),
      if (images.length > 4)
        Positioned(bottom: 10, right: 10, child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
          child: Text('+${images.length - 4} more', style: _f(size: 10, weight: FontWeight.w600, color: Colors.white)),
        )),
    ]);
  }

  Widget _smallActionBtn(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4)],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 5),
          Text(label, style: _f(size: 11, weight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _svgActionBtn(String label, String svgAsset, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4)],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SvgPicture.asset(svgAsset, width: 14, height: 14,
            colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)),
          const SizedBox(width: 5),
          Text(label, style: _f(size: 11, weight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _iconActionBtn(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4)],
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 5),
          Text(label, style: _f(size: 11, weight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _svgActionPill({required String label, required String svgAsset, VoidCallback? onTap, Color color = AppColors.textPrimary}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          SvgPicture.asset(svgAsset, width: 14, height: 14,
            colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
          const SizedBox(width: 5),
          Text(label, style: _f(size: 11, weight: FontWeight.w600, color: color)),
        ]),
      ),
    );
  }

  Widget _badge(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: _f(size: 10, weight: FontWeight.w600, color: fg)),
    );
  }

  Widget _actionPill({required String label, required IconData icon, VoidCallback? onTap, Color color = AppColors.textPrimary}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(label, style: _f(size: 11, weight: FontWeight.w600, color: color)),
        ]),
      ),
    );
  }

  List<String> _extractImages(Map<String, dynamic> s) {
    final result = <String>[];
    final images = s['images'];
    if (images is List) {
      for (final img in images) {
        if (img is String && img.isNotEmpty) result.add(img);
        if (img is Map) {
          final url = img['url']?.toString() ?? img['image_url']?.toString() ?? img['file_url']?.toString() ?? '';
          if (url.isNotEmpty) result.add(url);
        }
      }
    }
    if (result.isEmpty) {
      final primary = s['primary_image'];
      if (primary is String && primary.isNotEmpty) result.add(primary);
      if (primary is Map) {
        final url = primary['thumbnail_url']?.toString() ?? primary['url']?.toString() ?? '';
        if (url.isNotEmpty) result.add(url);
      }
    }
    return result;
  }

  // Recent Reviews Section
  Widget _recentReviewsSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.star_rounded, size: 18, color: Colors.amber),
          const SizedBox(width: 6),
          Text('Recent Reviews', style: _f(size: 15, weight: FontWeight.w700)),
        ]),
        const SizedBox(height: 12),
        ..._recentReviews.take(5).map((r) {
          final review = r is Map<String, dynamic> ? r : <String, dynamic>{};
          final name = review['user_name']?.toString() ?? 'User';
          final rating = review['rating'] ?? 0;
          final comment = review['comment']?.toString() ?? '';
          final serviceTitle = review['service_title']?.toString() ?? '';
          final date = review['created_at']?.toString() ?? '';

          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.primary.withOpacity(0.1),
                child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'U', style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text(name, style: _f(size: 13, weight: FontWeight.w600)),
                  const SizedBox(width: 6),
                  ...List.generate(5, (i) => Icon(
                    i < (rating is num ? rating.round() : 0) ? Icons.star_rounded : Icons.star_outline_rounded,
                    size: 12, color: Colors.amber,
                  )),
                ]),
                if (serviceTitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4)),
                    child: Text(serviceTitle, style: _f(size: 10, color: AppColors.textTertiary)),
                  ),
                ],
                if (comment.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(comment, style: _f(size: 12, color: AppColors.textSecondary), maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ])),
            ]),
          );
        }),
      ]),
    );
  }

  // ─── Add Package Sheet ───
  Future<void> _addPackageSheet(String serviceId) async {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final featuresCtrl = TextEditingController();
    bool submitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 14),
                Text('Add Service Package', style: _f(size: 18, weight: FontWeight.w700)),
                const SizedBox(height: 12),
                _sheetField(nameCtrl, 'Package Name', 'e.g. Basic, Premium, Gold'),
                const SizedBox(height: 10),
                _sheetField(descCtrl, 'Description', 'Brief description...', maxLines: 2),
                const SizedBox(height: 10),
                _sheetField(priceCtrl, 'Price (TZS)', 'e.g. 150000', keyboardType: TextInputType.number),
                const SizedBox(height: 10),
                _sheetField(featuresCtrl, 'Features (comma-separated)', 'e.g. 5 hours, 200 photos, Gallery', maxLines: 2),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity, height: 46,
                  child: ElevatedButton(
                    onPressed: submitting ? null : () async {
                      if (nameCtrl.text.trim().isEmpty) { AppSnackbar.error(context, 'Package name required'); return; }
                      if (priceCtrl.text.trim().isEmpty) { AppSnackbar.error(context, 'Price required'); return; }
                      setSheet(() => submitting = true);
                      try {
                        final headers = await _headers();
                        final res = await http.post(
                          Uri.parse('$_baseUrl/user-services/$serviceId/packages'),
                          headers: headers,
                          body: jsonEncode({
                            'name': nameCtrl.text.trim(),
                            'description': descCtrl.text.trim(),
                            'price': num.tryParse(priceCtrl.text.trim()) ?? 0,
                            'features': featuresCtrl.text.split(',').map((f) => f.trim()).where((f) => f.isNotEmpty).toList(),
                          }),
                        );
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                          if (mounted) { Navigator.pop(ctx); AppSnackbar.success(context, 'Package added!'); _load(); }
                        } else {
                          setSheet(() => submitting = false);
                          AppSnackbar.error(context, 'Failed to add package');
                        }
                      } catch (e) {
                        setSheet(() => submitting = false);
                        AppSnackbar.error(context, 'Failed to add package');
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    child: submitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('Save Package', style: _f(size: 13, weight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
    nameCtrl.dispose(); descCtrl.dispose(); priceCtrl.dispose(); featuresCtrl.dispose();
  }

  Widget _sheetField(TextEditingController ctrl, String label, String hint, {int maxLines = 1, TextInputType keyboardType = TextInputType.text}) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: AppColors.surfaceVariant,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      ),
    );
  }

  // ─── Manage Sheet ───
  Future<void> _openManageSheet(Map<String, dynamic> service) async {
    final serviceId = service['id']?.toString() ?? '';
    if (serviceId.isEmpty) return;
    final verificationStatus = (service['verification_status']?.toString() ?? '').toLowerCase();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 14),
            ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              tileColor: AppColors.surfaceVariant,
              leading: SvgPicture.asset('assets/icons/settings-icon.svg', width: 20, height: 20,
                colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
              title: Text('Edit Service', style: _f(size: 14, weight: FontWeight.w600)),
              onTap: () async {
                Navigator.pop(ctx);
                final result = await Navigator.push(context, MaterialPageRoute(builder: (_) => EditServiceScreen(service: service)));
                if (result == true) _load();
              },
            ),
            if (verificationStatus != 'verified') ...[
              const SizedBox(height: 8),
              ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: AppColors.primarySoft,
                leading: const Icon(Icons.verified_user_outlined, color: AppColors.primary),
                title: Text('Complete KYC Verification', style: _f(size: 14, weight: FontWeight.w600, color: AppColors.primary)),
                onTap: () { Navigator.pop(ctx); Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceVerificationScreen(serviceId: service['id']?.toString() ?? ''))); },
              ),
            ],
            const SizedBox(height: 8),
            ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              tileColor: AppColors.error.withOpacity(0.08),
              leading: const Icon(Icons.delete_outline_rounded, color: AppColors.error),
              title: Text('Delete Service', style: _f(size: 14, weight: FontWeight.w600, color: AppColors.error)),
              onTap: () { Navigator.pop(ctx); _confirmDeleteService(serviceId); },
            ),
          ]),
        ),
      ),
    );
  }

  Future<void> _confirmDeleteService(String serviceId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete service?', style: _f(size: 17, weight: FontWeight.w700)),
        content: Text('This action cannot be undone.', style: _f(size: 13, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Cancel', style: _f(size: 13, color: AppColors.textSecondary))),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text('Delete', style: _f(size: 13, color: AppColors.error, weight: FontWeight.w700))),
        ],
      ),
    );
    if (confirmed != true) return;
    final res = await UserServicesService.deleteService(serviceId);
    if (!mounted) return;
    if (res['success'] == true) { AppSnackbar.success(context, 'Service deleted'); _load(); }
    else { AppSnackbar.error(context, res['message']?.toString() ?? 'Unable to delete service'); }
  }
}
