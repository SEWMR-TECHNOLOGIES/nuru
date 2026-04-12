import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/photo_libraries_service.dart';
import '../../core/services/user_services_service.dart';
import 'photo_library_screen.dart';
import '../../core/theme/text_styles.dart';
import '../../core/l10n/l10n_helper.dart';

/// My Photo Libraries — lists all libraries across user's services
class MyPhotoLibrariesScreen extends StatefulWidget {
  final String? serviceId;
  final String? eventId;
  final String title;

  const MyPhotoLibrariesScreen({
    super.key,
    this.serviceId,
    this.eventId,
    this.title = 'Photo Libraries',
  });

  @override
  State<MyPhotoLibrariesScreen> createState() => _MyPhotoLibrariesScreenState();
}

class _MyPhotoLibrariesScreenState extends State<MyPhotoLibrariesScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _libraries = [];
  String? _error;
  double _storageUsedMb = 0;
  double _storageLimitMb = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });

    if (widget.eventId != null) {
      final libRes = await PhotoLibrariesService.getEventLibraries(widget.eventId!);
      if (!mounted) return;
      if (libRes['success'] != true) {
        setState(() { _loading = false; _error = libRes['message']?.toString() ?? 'Unable to load event libraries'; });
        return;
      }
      setState(() {
        _loading = false;
        _libraries = _extractLibraries(libRes);
        _hydrateStorageSummary(libRes, fallbackLibraries: _libraries);
      });
      return;
    }

    if (widget.serviceId != null) {
      final libRes = await PhotoLibrariesService.getServiceLibraries(widget.serviceId!);
      if (!mounted) return;
      if (libRes['success'] != true) {
        setState(() { _loading = false; _error = libRes['message']?.toString() ?? 'Unable to load libraries'; });
        return;
      }
      setState(() {
        _loading = false;
        _libraries = _extractLibraries(libRes);
        _hydrateStorageSummary(libRes, fallbackLibraries: _libraries);
      });
      return;
    }

    // First get user's services, then get libraries for each
    final servicesRes = await UserServicesService.getMyServices();
    if (!mounted) return;

    if (servicesRes['success'] != true) {
      setState(() { _loading = false; _error = 'Unable to load services'; });
      return;
    }

    final services = servicesRes['data'] is List ? servicesRes['data'] as List
        : (servicesRes['data'] is Map ? (servicesRes['data']['services'] ?? []) : []);

    final allLibraries = <Map<String, dynamic>>[];

    for (final svc in services) {
      if (!_isPhotographyService(svc)) continue;
      final svcId = svc['id']?.toString();
      if (svcId == null) continue;
      final libRes = await PhotoLibrariesService.getServiceLibraries(svcId);
      if (libRes['success'] == true) {
        final libs = _extractLibraries(libRes);
        for (final lib in libs) {
          if (lib is Map<String, dynamic>) {
            allLibraries.add({...lib, '_service_name': svc['title'] ?? svc['name'] ?? 'Service'});
          }
        }
      }
    }

    if (mounted) {
      setState(() {
        _loading = false;
        _libraries = allLibraries;
        _hydrateStorageSummary(null, fallbackLibraries: allLibraries);
      });
    }
  }

  void _hydrateStorageSummary(Map<String, dynamic>? response, {required List<Map<String, dynamic>> fallbackLibraries}) {
    final data = response?['data'];
    if (data is Map) {
      final used = data['storage_used_mb'] ?? data['total_size_mb'] ?? 0;
      final limit = data['storage_limit_mb'] ?? 0;
      _storageUsedMb = _toDouble(used);
      _storageLimitMb = _toDouble(limit);
      if (_storageLimitMb > 0 || _storageUsedMb > 0) return;
    }

    final serviceIds = <String>{};
    double usedTotal = 0;
    double limitTotal = 0;
    for (final lib in fallbackLibraries) {
      usedTotal += _toDouble(lib['total_size_mb']) > 0
          ? _toDouble(lib['total_size_mb'])
          : (_toDouble(lib['total_size_bytes']) / (1024 * 1024));
      final sid = lib['user_service_id']?.toString();
      if (sid != null && sid.isNotEmpty && serviceIds.add(sid)) {
        limitTotal += _toDouble(lib['storage_limit_mb']) > 0 ? _toDouble(lib['storage_limit_mb']) : 200;
      }
    }
    _storageUsedMb = usedTotal;
    _storageLimitMb = limitTotal;
  }

  bool _isPhotographyService(dynamic service) {
    final s = service is Map<String, dynamic> ? service : <String, dynamic>{};
    final slug = (s['service_type_slug'] ?? s['service_type']?['slug'] ?? '').toString().toLowerCase();
    final name = (s['service_type_name'] ?? s['category'] ?? s['service_type']?['name'] ?? '').toString().toLowerCase();
    return slug.contains('photo') || name.contains('photo');
  }

  List<Map<String, dynamic>> _extractLibraries(Map<String, dynamic> response) {
    final raw = response['data'];
    dynamic source;
    if (raw is Map) {
      source = raw['libraries'] ?? raw['items'];
    } else if (raw is List) {
      source = raw;
    } else if (response['libraries'] is List) {
      source = response['libraries'];
    }

    if (source is! List) return [];
    return source.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.7), borderRadius: BorderRadius.circular(12)),
                    child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 20, height: 20,
                      colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.title, style: appText(size: 20, weight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('${_libraries.length} libraries', style: appText(size: 12, color: AppColors.textTertiary)),
                ])),
              ]),
            ),
            if (_storageUsedMb > 0 || _storageLimitMb > 0)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.borderLight),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text('Storage Allocation', style: appText(size: 12, weight: FontWeight.w700)),
                      const Spacer(),
                      Text(
                        _storageLimitMb > 0
                            ? '${_fmtMb(_storageUsedMb)} / ${_fmtMb(_storageLimitMb)}'
                            : _fmtMb(_storageUsedMb),
                        style: appText(size: 11, color: AppColors.textTertiary),
                      ),
                    ]),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: _storageLimitMb > 0 ? (_storageUsedMb / _storageLimitMb).clamp(0.0, 1.0) : 0.0,
                        minHeight: 5,
                        backgroundColor: AppColors.borderLight,
                        valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                      ),
                    ),
                  ]),
                ),
              ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : _error != null
                      ? Center(child: Text(_error!, style: appText(size: 14, color: AppColors.textTertiary)))
                      : _libraries.isEmpty
                          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                              SvgPicture.asset('assets/icons/camera-icon.svg', width: 48, height: 48,
                                colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                              const SizedBox(height: 16),
                              Text('No photo libraries yet', style: appText(size: 16, weight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text('Create a library from your service events', style: appText(size: 13, color: AppColors.textTertiary)),
                            ]))
                          : RefreshIndicator(
                              onRefresh: _load,
                              color: AppColors.primary,
                              child: ListView.builder(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                                itemCount: _libraries.length,
                                itemBuilder: (_, i) => _libraryCard(_libraries[i]),
                              ),
                            ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _libraryCard(Map<String, dynamic> lib) {
    final name = lib['name']?.toString() ?? 'Library';
    final photoCount = lib['photo_count'] ?? 0;
    final eventName = lib['event']?['name'] ?? '';
    final storagePercent = lib['storage_used_percent'] ?? 0;
    final photos = lib['photos'] as List? ?? [];
    final privacy = (lib['privacy']?.toString() ?? 'event_creator_only').toLowerCase();
    final totalSizeMb = _toDouble(lib['total_size_mb']) > 0
        ? _toDouble(lib['total_size_mb'])
        : (_toDouble(lib['total_size_bytes']) / (1024 * 1024));
    final double storageLimitMb = _toDouble(lib['storage_limit_mb']) > 0 ? _toDouble(lib['storage_limit_mb']) : 200.0;

    return GestureDetector(
      onTap: () {
        final id = lib['id']?.toString();
        if (id != null) {
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => PhotoLibraryScreen(libraryId: id, libraryName: name),
          ));
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderLight, width: 1),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Preview image
          Container(
            height: 132,
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            clipBehavior: Clip.antiAlias,
            child: _libraryPreview(photos),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: appText(size: 15, weight: FontWeight.w700)),
              const SizedBox(height: 4),
              Row(children: [
                Text('$photoCount photos', style: appText(size: 12, color: AppColors.textTertiary)),
                if (eventName.isNotEmpty) ...[
                  Text(' · ', style: appText(size: 12, color: AppColors.textHint)),
                  Flexible(child: Text(eventName, style: appText(size: 12, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ],
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: privacy == 'public' ? AppColors.success.withOpacity(0.12) : AppColors.textHint.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    privacy == 'public' ? 'Public' : 'Private',
                    style: appText(size: 10, weight: FontWeight.w700, color: privacy == 'public' ? AppColors.success : AppColors.textSecondary),
                  ),
                ),
                const Spacer(),
                Text('${_fmtMb(totalSizeMb)} / ${_fmtMb(storageLimitMb)}', style: appText(size: 11, color: AppColors.textTertiary)),
              ]),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: (storagePercent is num ? storagePercent.toDouble() : 0.0) / 100,
                  minHeight: 4, backgroundColor: AppColors.borderLight,
                  valueColor: AlwaysStoppedAnimation(storagePercent > 80 ? AppColors.error : AppColors.primary),
                ),
              ),
              const SizedBox(height: 4),
              Text('$storagePercent% storage used', style: appText(size: 10, color: AppColors.textHint)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _libraryPreview(List photos) {
    if (photos.isEmpty) {
      return Center(
        child: SvgPicture.asset('assets/icons/camera-icon.svg', width: 32, height: 32,
            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
      );
    }

    final urls = photos
        .take(3)
        .map((p) => p is Map ? p['url']?.toString() : p?.toString())
        .whereType<String>()
        .where((u) => u.isNotEmpty)
        .toList();

    if (urls.isEmpty) {
      return Center(
        child: SvgPicture.asset('assets/icons/camera-icon.svg', width: 32, height: 32,
            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
      );
    }

    if (urls.length == 1) {
      return Image.network(urls.first, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink());
    }

    return Row(
      children: [
        Expanded(
          flex: 2,
          child: Image.network(urls.first, fit: BoxFit.cover, height: double.infinity, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
        ),
        const SizedBox(width: 2),
        Expanded(
          child: Column(
            children: [
              Expanded(
                child: urls.length > 1
                    ? Image.network(urls[1], fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, __, ___) => const SizedBox.shrink())
                    : Container(color: AppColors.surfaceVariant),
              ),
              const SizedBox(height: 2),
              Expanded(
                child: urls.length > 2
                    ? Image.network(urls[2], fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, __, ___) => const SizedBox.shrink())
                    : Container(color: AppColors.surfaceVariant),
              ),
            ],
          ),
        ),
      ],
    );
  }

  double _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  String _fmtMb(double mb) => '${mb.toStringAsFixed(mb >= 100 ? 0 : 1)}MB';
}
