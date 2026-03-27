import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/user_services_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../messages/messages_screen.dart';

/// Public Service Detail — matches web PublicServiceDetail.tsx
class PublicServiceScreen extends StatefulWidget {
  final String serviceId;
  const PublicServiceScreen({super.key, required this.serviceId});

  @override
  State<PublicServiceScreen> createState() => _PublicServiceScreenState();
}

class _PublicServiceScreenState extends State<PublicServiceScreen> {
  static String get _baseUrl => ApiService.baseUrl;
  bool _loading = true;
  bool _booking = false;
  Map<String, dynamic> _service = {};
  List<dynamic> _packages = [];
  List<dynamic> _reviews = [];
  List<dynamic> _bookedDates = [];
  List<dynamic> _introMedia = [];
  bool _calendarLoading = true;
  bool _reviewsLoading = false;
  DateTime _currentMonth = DateTime.now();

  // Review form
  int _reviewRating = 0;
  final _reviewCtrl = TextEditingController();
  bool _submittingReview = false;

  TextStyle _f({
    required double size,
    FontWeight weight = FontWeight.w500,
    Color color = AppColors.textPrimary,
    double height = 1.3,
  }) => GoogleFonts.plusJakartaSans(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
  );

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reviewCtrl.dispose();
    super.dispose();
  }

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final headers = await _headers();
      // Use public endpoint: /services/:id  (same as web PublicServiceDetail)
      final res = await http.get(
        Uri.parse('$_baseUrl/services/${widget.serviceId}'),
        headers: headers,
      );
      if (!mounted) return;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final body = jsonDecode(res.body);
        final data = body['data'] ?? body;
        Map<String, dynamic> svc = {};
        if (data is Map<String, dynamic>) {
          svc = (data['service'] is Map<String, dynamic>)
              ? data['service'] as Map<String, dynamic>
              : data;
        }
        setState(() {
          _loading = false;
          _service = svc;
          _packages = svc['packages'] is List ? svc['packages'] as List : [];
          _introMedia = svc['intro_media'] is List
              ? svc['intro_media'] as List
              : [];
        });
      } else {
        // Fallback to user-services endpoint
        final res2 = await UserServicesService.getServiceDetail(
          widget.serviceId,
        );
        if (!mounted) return;
        final data = res2['data'];
        Map<String, dynamic> svc = {};
        if (res2['success'] == true && data is Map<String, dynamic>) {
          svc = (data['service'] is Map<String, dynamic>)
              ? data['service'] as Map<String, dynamic>
              : data;
        }
        setState(() {
          _loading = false;
          _service = svc;
          _packages = svc['packages'] is List ? svc['packages'] as List : [];
          _introMedia = svc['intro_media'] is List
              ? svc['intro_media'] as List
              : [];
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
    _loadCalendar();
    _loadReviews();
  }

  Future<void> _loadCalendar() async {
    setState(() => _calendarLoading = true);
    try {
      final headers = await _headers();
      final res = await http.get(
        Uri.parse('$_baseUrl/services/${widget.serviceId}/calendar'),
        headers: headers,
      );
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = jsonDecode(res.body);
        final d = data['data'] ?? data;
        setState(() => _bookedDates = d['booked_dates'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _calendarLoading = false);
  }

  Future<void> _loadReviews([int page = 1]) async {
    setState(() => _reviewsLoading = true);
    try {
      final headers = await _headers();
      final res = await http.get(
        Uri.parse(
          '$_baseUrl/services/${widget.serviceId}/reviews?page=$page&limit=10',
        ),
        headers: headers,
      );
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final data = jsonDecode(res.body);
        final d = data['data'] ?? data;
        setState(() => _reviews = d['reviews'] ?? []);
      }
    } catch (_) {}
    if (mounted) setState(() => _reviewsLoading = false);
  }

  Future<void> _messageProvider() async {
    final s = _service;
    final provider = s['provider'] is Map<String, dynamic>
        ? s['provider'] as Map<String, dynamic>
        : (s['user'] is Map<String, dynamic>
              ? s['user'] as Map<String, dynamic>
              : <String, dynamic>{});
    final providerId =
        provider['id']?.toString() ??
        s['user_id']?.toString() ??
        s['provider_id']?.toString() ??
        '';
    if (providerId.isEmpty) {
      AppSnackbar.error(context, 'Provider info missing');
      return;
    }

    setState(() => _booking = true);
    final serviceTitle =
        s['title']?.toString() ?? s['name']?.toString() ?? 'service';
    final res = await MessagesService.startConversation(
      recipientId: providerId,
      serviceId: widget.serviceId,
      message:
          'Hi, I\'m interested in your service "$serviceTitle". I\'d like to discuss booking details.',
    );
    if (!mounted) return;
    setState(() => _booking = false);

    if (res['success'] == true) {
      final data = res['data'];
      final convId =
          (data is Map ? (data['id'] ?? data['conversation_id']) : null)
              ?.toString();
      final first = provider['first_name']?.toString() ?? '';
      final last = provider['last_name']?.toString() ?? '';
      final name = '$first $last'.trim().isNotEmpty
          ? '$first $last'.trim()
          : (provider['name']?.toString() ?? 'Provider');
      if (convId != null && convId.isNotEmpty) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatDetailScreen(
              conversationId: convId,
              name: name,
              avatar: provider['avatar']?.toString(),
            ),
          ),
        );
      }
    } else {
      AppSnackbar.error(context, res['message'] ?? 'Unable to start chat');
    }
  }

  Future<void> _submitReview() async {
    if (_reviewRating == 0) {
      AppSnackbar.error(context, 'Please select a rating');
      return;
    }
    if (_reviewCtrl.text.trim().length < 10) {
      AppSnackbar.error(context, 'Review must be at least 10 characters');
      return;
    }
    setState(() => _submittingReview = true);
    try {
      final headers = await _headers();
      final res = await http.post(
        Uri.parse('$_baseUrl/services/${widget.serviceId}/reviews'),
        headers: headers,
        body: jsonEncode({
          'rating': _reviewRating,
          'comment': _reviewCtrl.text.trim(),
        }),
      );
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AppSnackbar.success(context, 'Review submitted!');
        setState(() {
          _reviewRating = 0;
          _reviewCtrl.clear();
        });
        _loadReviews();
      } else {
        AppSnackbar.error(context, 'Failed to submit review');
      }
    } catch (_) {
      AppSnackbar.error(context, 'Failed to submit review');
    }
    if (mounted) setState(() => _submittingReview = false);
  }

  List<String> _getImages() {
    final images = <String>[];
    final imgs = _service['images'];
    if (imgs is List) {
      for (final img in imgs) {
        if (img is String && img.isNotEmpty) images.add(img);
        if (img is Map) {
          final url =
              img['url']?.toString() ?? img['image_url']?.toString() ?? '';
          if (url.isNotEmpty) images.add(url);
        }
      }
    }
    if (images.isEmpty) {
      final p = _service['primary_image'];
      if (p is String && p.isNotEmpty) images.add(p);
      if (p is Map) {
        final url = p['url']?.toString() ?? '';
        if (url.isNotEmpty) images.add(url);
      }
    }
    return images;
  }

  /// Format price with comma separators, no decimals
  String _fmtPrice(dynamic p) {
    if (p == null) return 'Price on request';
    final n = (p is num)
        ? p.toInt()
        : (int.tryParse(p.toString().replaceAll(RegExp(r'[^\d]'), '')) ?? 0);
    if (n == 0) return 'Price on request';
    return 'TZS ${n.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  String _formatPriceDisplay() {
    final min =
        _service['min_price'] ??
        _service['starting_price'] ??
        _service['price'];
    if (min != null) return 'From ${_fmtPrice(min)}';
    return 'Price on request';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          elevation: 0,
          leading: IconButton(
            icon: SvgPicture.asset(
              'assets/icons/chevron-left-icon.svg',
              width: 22,
              height: 22,
              colorFilter: const ColorFilter.mode(
                AppColors.textPrimary,
                BlendMode.srcIn,
              ),
            ),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final s = _service;
    final title = s['title']?.toString() ?? s['name']?.toString() ?? 'Service';
    final category =
        (s['service_category'] is Map
            ? (s['service_category'] as Map<String, dynamic>)['name']
                  ?.toString()
            : null) ??
        s['category_name']?.toString() ??
        '';
    final description = s['description']?.toString() ?? '';
    final location = s['location']?.toString() ?? '';
    final rating = (s['rating'] ?? s['average_rating'] ?? 0);
    final reviewCount =
        s['review_count'] ?? s['reviews_count'] ?? _reviews.length;
    final images = _getImages();
    final availability = s['availability']?.toString() ?? 'available';

    // Provider info
    final provider = s['provider'] is Map
        ? s['provider'] as Map
        : (s['user'] is Map ? s['user'] as Map : {});
    final ownerName = (() {
      final first = provider['first_name']?.toString() ?? '';
      final last = provider['last_name']?.toString() ?? '';
      final full = '$first $last'.trim();
      return full.isNotEmpty
          ? full
          : (s['owner_name']?.toString() ?? provider['name']?.toString());
    })();
    final ownerAvatar =
        s['owner_avatar']?.toString() ?? provider['avatar']?.toString();

    return Scaffold(
      backgroundColor: const Color(0xFFF0F3F8),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            // Hero
            SliverToBoxAdapter(
              child: _heroGallery(images, title, category, location),
            ),

            // Provider + Rating + Stats strip
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Column(
                  children: [
                    // Provider card
                    if (ownerName != null && ownerName.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: AppColors.primary.withOpacity(
                                0.1,
                              ),
                              backgroundImage:
                                  ownerAvatar != null && ownerAvatar.isNotEmpty
                                  ? NetworkImage(ownerAvatar)
                                  : null,
                              child: ownerAvatar == null || ownerAvatar.isEmpty
                                  ? Text(
                                      ownerName
                                          .split(' ')
                                          .map((n) => n.isNotEmpty ? n[0] : '')
                                          .join()
                                          .toUpperCase()
                                          .substring(
                                            0,
                                            ownerName.split(' ').length > 1
                                                ? 2
                                                : 1,
                                          ),
                                      style: _f(
                                        size: 14,
                                        weight: FontWeight.w700,
                                        color: AppColors.primary,
                                      ),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Service Provider',
                                    style: _f(
                                      size: 10,
                                      color: AppColors.textTertiary,
                                    ),
                                  ),
                                  Text(
                                    ownerName,
                                    style: _f(
                                      size: 14,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Rating + Quick stats
                    Row(
                      children: [
                        // Rating card
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Overall Rating',
                                  style: _f(
                                    size: 10,
                                    color: AppColors.textTertiary,
                                    weight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Text(
                                      rating is num && rating > 0
                                          ? (rating as num).toStringAsFixed(1)
                                          : '0.0',
                                      style: _f(
                                        size: 28,
                                        weight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: List.generate(
                                              5,
                                              (i) => Icon(
                                                i <
                                                        (rating is num
                                                            ? (rating as num)
                                                                  .round()
                                                            : 0)
                                                    ? Icons.star_rounded
                                                    : Icons
                                                          .star_outline_rounded,
                                                size: 14,
                                                color: Colors.amber,
                                              ),
                                            ),
                                          ),
                                          Text(
                                            '$reviewCount reviews',
                                            style: _f(
                                              size: 10,
                                              color: AppColors.textTertiary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Stats card
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'On Nuru',
                                            style: _f(
                                              size: 9,
                                              color: AppColors.textTertiary,
                                              weight: FontWeight.w600,
                                            ),
                                          ),
                                          Text(
                                            _timeOnPlatform(
                                              s['created_at']?.toString(),
                                            ),
                                            style: _f(
                                              size: 14,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Events Done',
                                            style: _f(
                                              size: 9,
                                              color: AppColors.textTertiary,
                                              weight: FontWeight.w600,
                                            ),
                                          ),
                                          Text(
                                            '${s['completed_events'] ?? 0}',
                                            style: _f(
                                              size: 14,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Starting',
                                            style: _f(
                                              size: 9,
                                              color: AppColors.textTertiary,
                                              weight: FontWeight.w600,
                                            ),
                                          ),
                                          Text(
                                            _formatPriceDisplay(),
                                            style: _f(
                                              size: 10,
                                              weight: FontWeight.w700,
                                              color: AppColors.primary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            'Status',
                                            style: _f(
                                              size: 9,
                                              color: AppColors.textTertiary,
                                              weight: FontWeight.w600,
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: availability == 'available'
                                                  ? AppColors.success
                                                        .withOpacity(0.1)
                                                  : AppColors.warning
                                                        .withOpacity(0.1),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Container(
                                                  width: 5,
                                                  height: 5,
                                                  decoration: BoxDecoration(
                                                    color:
                                                        availability ==
                                                            'available'
                                                        ? AppColors.success
                                                        : AppColors.warning,
                                                    shape: BoxShape.circle,
                                                  ),
                                                ),
                                                const SizedBox(width: 4),
                                                Flexible(
                                                  child: Text(
                                                    availability,
                                                    style: _f(
                                                      size: 9,
                                                      weight: FontWeight.w600,
                                                      color:
                                                          availability ==
                                                              'available'
                                                          ? AppColors.success
                                                          : AppColors.warning,
                                                    ),
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // About
            if (description.isNotEmpty)
              SliverToBoxAdapter(
                child: _sectionWrapper(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'About This Service',
                        style: _f(size: 15, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        description,
                        style: _f(
                          size: 13,
                          color: AppColors.textSecondary,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Intro Media
            if (_introMedia.isNotEmpty)
              SliverToBoxAdapter(
                child: _sectionWrapper(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          SvgPicture.asset(
                            'assets/icons/play-icon.svg',
                            width: 18,
                            height: 18,
                            colorFilter: const ColorFilter.mode(
                              AppColors.primary,
                              BlendMode.srcIn,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Introduction',
                            style: _f(size: 15, weight: FontWeight.w700),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      ..._introMedia.map((media) {
                        final type = media['media_type']?.toString() ?? '';
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: SvgPicture.asset(
                                    'assets/icons/play-icon.svg',
                                    width: 20,
                                    height: 20,
                                    colorFilter: const ColorFilter.mode(
                                      AppColors.primary,
                                      BlendMode.srcIn,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                type == 'video'
                                    ? 'Video Introduction'
                                    : 'Audio Introduction',
                                style: _f(size: 13, weight: FontWeight.w600),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ),

            // Calendar
            SliverToBoxAdapter(child: _calendarSection()),

            // Write Review
            SliverToBoxAdapter(child: _writeReviewSection()),

            // Reviews
            SliverToBoxAdapter(child: _reviewsSection()),

            // Packages
            if (_packages.isNotEmpty)
              SliverToBoxAdapter(child: _packagesSection()),

            // Trust badges
            SliverToBoxAdapter(child: _trustBadges(s)),

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
      // Book CTA
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          decoration: const BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Starting from',
                          style: _f(size: 11, color: Colors.white70),
                        ),
                        Text(
                          _formatPriceDisplay(),
                          style: _f(
                            size: 16,
                            weight: FontWeight.w800,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _booking ? null : _messageProvider,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                    child: _booking
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          )
                        : Text(
                            'Book This Service',
                            style: _f(
                              size: 13,
                              weight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                'No payment until confirmed',
                style: _f(size: 10, color: Colors.white60),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroGallery(
    List<String> images,
    String title,
    String category,
    String location,
  ) {
    if (images.isEmpty) {
      return Container(
        height: 240,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primary.withOpacity(0.15),
              AppColors.primary.withOpacity(0.05),
            ],
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              Positioned(top: 8, left: 8, child: _backBtn()),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.work_outline,
                        size: 30,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(title, style: _f(size: 24, weight: FontWeight.w800)),
                    if (category.isNotEmpty)
                      Text(
                        category,
                        style: _f(size: 13, color: AppColors.textTertiary),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Stack(
      children: [
        SizedBox(
          height: 320,
          width: double.infinity,
          child: images.length == 1
              ? CachedNetworkImage(
                  imageUrl: images[0],
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) =>
                      Container(color: AppColors.surfaceVariant),
                )
              : PageView.builder(
                  itemCount: images.length,
                  itemBuilder: (_, i) => CachedNetworkImage(
                    imageUrl: images[i],
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) =>
                        Container(color: AppColors.surfaceVariant),
                  ),
                ),
        ),
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.transparent,
                  Colors.black87,
                ],
              ),
            ),
          ),
        ),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _backBtn(),
                  if (images.length > 1)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black45,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'View all ${images.length}',
                        style: _f(
                          size: 10,
                          weight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 20,
          left: 16,
          right: 16,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (category.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    category,
                    style: _f(
                      size: 10,
                      weight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              Text(
                title,
                style: _f(
                  size: 26,
                  weight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              if (location.isNotEmpty) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    SvgPicture.asset(
                      'assets/icons/location-icon.svg',
                      width: 14,
                      height: 14,
                      colorFilter: const ColorFilter.mode(
                        Colors.white70,
                        BlendMode.srcIn,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(location, style: _f(size: 12, color: Colors.white70)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// Only use chevron-left SVG — no arrow icons
  Widget _backBtn() => GestureDetector(
    onTap: () => Navigator.pop(context),
    child: Container(
      width: 36,
      height: 36,
      decoration: const BoxDecoration(
        color: Colors.black38,
        shape: BoxShape.circle,
      ),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: SvgPicture.asset(
          'assets/icons/chevron-left-icon.svg',
          width: 20,
          height: 20,
          colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
        ),
      ),
    ),
  );

  Widget _sectionWrapper({required Widget child}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8),
          ],
        ),
        child: child,
      ),
    );
  }

  Widget _calendarSection() {
    final year = _currentMonth.year;
    final month = _currentMonth.month;
    final firstDay = DateTime(year, month, 1).weekday % 7;
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final today = DateTime.now();
    final months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    final dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8),
          ],
        ),
        child: _calendarLoading
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(30),
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            : Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(5),
                          child: SvgPicture.asset(
                            'assets/icons/calendar-icon.svg',
                            colorFilter: const ColorFilter.mode(
                              AppColors.primary,
                              BlendMode.srcIn,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Availability',
                              style: _f(size: 15, weight: FontWeight.w700),
                            ),
                            Text(
                              'Green dates are open for booking',
                              style: _f(
                                size: 10,
                                color: AppColors.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      GestureDetector(
                        onTap: () => setState(
                          () => _currentMonth = DateTime(year, month - 1),
                        ),
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.borderLight),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(5),
                            child: SvgPicture.asset(
                              'assets/icons/chevron-left-icon.svg',
                              colorFilter: const ColorFilter.mode(
                                AppColors.textPrimary,
                                BlendMode.srcIn,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Text(
                        '${months[month - 1]} $year',
                        style: _f(size: 14, weight: FontWeight.w700),
                      ),
                      GestureDetector(
                        onTap: () => setState(
                          () => _currentMonth = DateTime(year, month + 1),
                        ),
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.borderLight),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(5),
                            child: SvgPicture.asset(
                              'assets/icons/chevron-right-icon.svg',
                              colorFilter: const ColorFilter.mode(
                                AppColors.textPrimary,
                                BlendMode.srcIn,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: dayLabels
                        .map(
                          (d) => Expanded(
                            child: Center(
                              child: Text(
                                d,
                                style: _f(
                                  size: 10,
                                  weight: FontWeight.w600,
                                  color: AppColors.textTertiary,
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 4),
                  ...List.generate(6, (week) {
                    return Row(
                      children: List.generate(7, (dow) {
                        final idx = week * 7 + dow;
                        final dayNum = idx - firstDay + 1;
                        if (dayNum < 1 || dayNum > daysInMonth)
                          return const Expanded(child: SizedBox(height: 36));
                        final dateStr =
                            '${year.toString()}-${month.toString().padLeft(2, '0')}-${dayNum.toString().padLeft(2, '0')}';
                        final isToday =
                            today.year == year &&
                            today.month == month &&
                            today.day == dayNum;
                        final isPast = DateTime(year, month, dayNum).isBefore(
                          DateTime(today.year, today.month, today.day),
                        );
                        final isBooked = _bookedDates.any(
                          (b) => b['date'] == dateStr,
                        );

                        return Expanded(
                          child: Container(
                            height: 36,
                            margin: const EdgeInsets.all(1),
                            decoration: BoxDecoration(
                              color: isToday
                                  ? AppColors.primary.withOpacity(0.1)
                                  : isBooked
                                  ? const Color(0xFFFEE2E2)
                                  : !isPast
                                  ? const Color(0xFFF0FDF4)
                                  : null,
                              borderRadius: BorderRadius.circular(8),
                              border: isToday
                                  ? Border.all(
                                      color: AppColors.primary,
                                      width: 2,
                                    )
                                  : null,
                            ),
                            child: Center(
                              child: Text(
                                '$dayNum',
                                style: _f(
                                  size: 12,
                                  weight: FontWeight.w600,
                                  color: isToday
                                      ? AppColors.primary
                                      : isBooked
                                      ? const Color(0xFFDC2626)
                                      : isPast
                                      ? AppColors.textHint
                                      : const Color(0xFF15803D),
                                ),
                              ),
                            ),
                          ),
                        );
                      }),
                    );
                  }),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _legendDot(
                        'Available',
                        const Color(0xFFF0FDF4),
                        border: true,
                      ),
                      const SizedBox(width: 10),
                      _legendDot(
                        'Booked',
                        const Color(0xFFFEE2E2),
                        border: true,
                      ),
                      const SizedBox(width: 10),
                      _legendDot(
                        'Today',
                        AppColors.primary.withOpacity(0.1),
                        border: true,
                        borderColor: AppColors.primary,
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }

  Widget _legendDot(
    String label,
    Color color, {
    bool border = false,
    Color? borderColor,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
            border: border
                ? Border.all(color: borderColor ?? AppColors.borderLight)
                : null,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: _f(size: 10, color: AppColors.textTertiary)),
      ],
    );
  }

  Widget _writeReviewSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.rate_review_outlined,
                    size: 14,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Write a Review',
                        style: _f(size: 14, weight: FontWeight.w700),
                      ),
                      Text(
                        'Only available if this service was on your event',
                        style: _f(size: 10, color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('Your Rating', style: _f(size: 12, weight: FontWeight.w600)),
            const SizedBox(height: 6),
            Row(
              children: List.generate(
                5,
                (i) => GestureDetector(
                  onTap: () => setState(() => _reviewRating = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Icon(
                      i < _reviewRating
                          ? Icons.star_rounded
                          : Icons.star_outline_rounded,
                      size: 28,
                      color: i < _reviewRating
                          ? Colors.amber
                          : AppColors.textHint,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _reviewCtrl,
              maxLines: 4,
              maxLength: 2000,
              style: _f(size: 13),
              decoration: InputDecoration(
                hintText: 'Share your experience (min 10 characters)...',
                hintStyle: _f(size: 13, color: AppColors.textHint),
                filled: true,
                fillColor: AppColors.surfaceVariant,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton.icon(
                onPressed:
                    _submittingReview ||
                        _reviewRating == 0 ||
                        _reviewCtrl.text.trim().length < 10
                    ? null
                    : _submitReview,
                icon: _submittingReview
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 16),
                label: Text(
                  _submittingReview ? 'Submitting...' : 'Submit Review',
                  style: _f(
                    size: 13,
                    weight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.primary.withOpacity(0.4),
                  disabledForegroundColor: Colors.white70,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _reviewsSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.people_outline_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Client Reviews',
                      style: _f(size: 14, weight: FontWeight.w700),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.borderLight),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${_service['review_count'] ?? _reviews.length}',
                    style: _f(
                      size: 11,
                      weight: FontWeight.w600,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_reviewsLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (_reviews.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Icon(
                        Icons.star_outline_rounded,
                        size: 36,
                        color: AppColors.textHint.withOpacity(0.3),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'No reviews yet. Be the first!',
                        style: _f(size: 12, color: AppColors.textTertiary),
                      ),
                    ],
                  ),
                ),
              )
            else
              ..._reviews.map((r) {
                final review = r is Map<String, dynamic>
                    ? r
                    : <String, dynamic>{};
                final name = review['user_name']?.toString() ?? 'Anonymous';
                final ratingVal = review['rating'] ?? 0;
                final comment = review['comment']?.toString() ?? '';
                final date = review['created_at']?.toString() ?? '';
                final avatar = review['user_avatar']?.toString();

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: AppColors.primary.withOpacity(0.1),
                        backgroundImage: avatar != null && avatar.isNotEmpty
                            ? NetworkImage(avatar)
                            : null,
                        child: avatar == null || avatar.isEmpty
                            ? Text(
                                name.isNotEmpty ? name[0].toUpperCase() : 'A',
                                style: _f(
                                  size: 11,
                                  weight: FontWeight.w700,
                                  color: AppColors.primary,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: _f(
                                          size: 13,
                                          weight: FontWeight.w600,
                                        ),
                                      ),
                                      if (date.isNotEmpty)
                                        Text(
                                          _formatDate(date),
                                          style: _f(
                                            size: 10,
                                            color: AppColors.textTertiary,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Row(
                                  children: List.generate(
                                    5,
                                    (i) => Icon(
                                      i <
                                              (ratingVal is num
                                                  ? ratingVal.round()
                                                  : 0)
                                          ? Icons.star_rounded
                                          : Icons.star_outline_rounded,
                                      size: 14,
                                      color: Colors.amber,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (comment.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                comment,
                                style: _f(
                                  size: 12,
                                  color: AppColors.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _packagesSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Service Packages',
              style: _f(size: 14, weight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            ..._packages.asMap().entries.map((e) {
              final idx = e.key;
              final pkg = e.value is Map<String, dynamic>
                  ? e.value as Map<String, dynamic>
                  : <String, dynamic>{};
              final features = pkg['features'] is List
                  ? (pkg['features'] as List)
                  : [];
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: idx == 0
                      ? AppColors.primary.withOpacity(0.03)
                      : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              Flexible(
                                child: Text(
                                  pkg['name']?.toString() ?? 'Package',
                                  style: _f(size: 13, weight: FontWeight.w700),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (idx == 0) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 1,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    'Most Popular',
                                    style: _f(
                                      size: 9,
                                      weight: FontWeight.w700,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Text(
                          _fmtPrice(pkg['price']),
                          style: _f(
                            size: 13,
                            weight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    if ((pkg['description']?.toString() ?? '').isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        pkg['description'].toString(),
                        style: _f(size: 11, color: AppColors.textTertiary),
                      ),
                    ],
                    if (features.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      ...features.map(
                        (f) => Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.check_circle_rounded,
                                size: 14,
                                color: AppColors.success,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  f.toString(),
                                  style: _f(
                                    size: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _trustBadges(Map<String, dynamic> s) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8),
          ],
        ),
        child: Column(
          children: [
            _trustRow(
              'assets/icons/shield-icon.svg',
              AppColors.success,
              'Verified & trusted on Nuru',
            ),
            const SizedBox(height: 10),
            _trustRow(
              'assets/icons/verified-icon.svg',
              AppColors.primary,
              _timeOnPlatformFull(s['created_at']?.toString()),
            ),
            const SizedBox(height: 10),
            _trustRow(
              'assets/icons/calendar-icon.svg',
              AppColors.blue,
              'Responds quickly to booking requests',
            ),
          ],
        ),
      ),
    );
  }

  Widget _trustRow(String svgAsset, Color color, String text) {
    return Row(
      children: [
        SvgPicture.asset(
          svgAsset,
          width: 18,
          height: 18,
          colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: _f(size: 12, color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }

  String _timeOnPlatform(String? created) {
    if (created == null || created.isEmpty) return 'New';
    final days = DateTime.now().difference(DateTime.parse(created)).inDays;
    if (days < 1) return 'Today';
    if (days < 30) return '${days}d';
    final m = days ~/ 30;
    if (m < 12) return '${m}mo';
    return '${m ~/ 12}yr';
  }

  String _timeOnPlatformFull(String? created) {
    if (created == null || created.isEmpty) return 'Member of Nuru';
    final days = DateTime.now().difference(DateTime.parse(created)).inDays;
    if (days < 1) return 'Joined Nuru today';
    if (days < 30) return '$days days on Nuru';
    final m = days ~/ 30;
    if (m < 12) return '$m ${m == 1 ? 'month' : 'months'} on Nuru';
    final years = m ~/ 12;
    return '$years ${years == 1 ? 'year' : 'years'} on Nuru';
  }

  String _formatDate(String date) {
    try {
      final d = DateTime.parse(date);
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
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return date;
    }
  }
}
