import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/api_service.dart';
import '../../core/services/user_services_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/l10n/l10n_helper.dart';

/// Full-page Edit Service screen — matches web EditService.tsx
class EditServiceScreen extends StatefulWidget {
  final Map<String, dynamic> service;
  const EditServiceScreen({super.key, required this.service});

  @override
  State<EditServiceScreen> createState() => _EditServiceScreenState();
}

class _EditServiceScreenState extends State<EditServiceScreen> {
  late TextEditingController _titleCtrl;
  late TextEditingController _descCtrl;
  late TextEditingController _minPriceCtrl;
  late TextEditingController _maxPriceCtrl;
  late TextEditingController _locationCtrl;

  String _status = 'active';
  String _availability = 'available';
  bool _submitting = false;

  List<dynamic> _categories = [];
  List<dynamic> _serviceTypes = [];
  String _selectedCategoryId = '';
  String _selectedTypeId = '';
  bool _loadingRefs = true;

  // Images
  List<String> _existingImages = [];
  List<File> _newImages = [];

  // Intro media
  List<dynamic> _introMedia = [];
  bool _uploadingMedia = false;

  // Track original values for KYC reset detection
  late String _originalTitle;
  late String _originalCategoryId;
  late String _originalTypeId;

  static String get _baseUrl => ApiService.baseUrl;

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  void initState() {
    super.initState();
    final s = widget.service;
    _titleCtrl = TextEditingController(text: (s['title'] ?? s['name'] ?? '').toString());
    _descCtrl = TextEditingController(text: (s['description'] ?? '').toString());
    _minPriceCtrl = TextEditingController(text: (s['min_price'] ?? s['starting_price'] ?? s['price'] ?? '').toString());
    _maxPriceCtrl = TextEditingController(text: (s['max_price'] ?? '').toString());
    _locationCtrl = TextEditingController(text: (s['location'] ?? '').toString());
    _status = (s['status']?.toString() ?? 'active').toLowerCase();
    _availability = (s['availability']?.toString() ?? 'available').toLowerCase();
    _selectedCategoryId = (s['service_category_id'] ?? s['service_category']?['id'] ?? '').toString();
    _selectedTypeId = (s['service_type_id'] ?? s['service_type']?['id'] ?? '').toString();
    _originalTitle = _titleCtrl.text;
    _originalCategoryId = _selectedCategoryId;
    _originalTypeId = _selectedTypeId;
    _existingImages = _extractImages(s);
    _loadReferences();
    _loadIntroMedia();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _minPriceCtrl.dispose();
    _maxPriceCtrl.dispose();
    _locationCtrl.dispose();
    super.dispose();
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

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, String>> _authOnlyHeaders() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> _loadReferences() async {
    setState(() => _loadingRefs = true);
    final catRes = await UserServicesService.getServiceCategories();
    if (catRes['success'] == true) {
      final d = catRes['data'];
      _categories = d is List ? d : (d is Map ? (d['categories'] ?? []) : []);
    }
    if (_selectedCategoryId.isNotEmpty) {
      await _loadTypes(_selectedCategoryId);
    }
    if (mounted) setState(() => _loadingRefs = false);
  }

  Future<void> _loadTypes(String catId) async {
    if (catId.isEmpty) return;
    final res = await UserServicesService.getServiceTypesByCategory(catId);
    if (res['success'] == true && mounted) {
      final d = res['data'];
      setState(() => _serviceTypes = d is List ? d : []);
    }
  }

  Future<void> _loadIntroMedia() async {
    final serviceId = widget.service['id']?.toString() ?? '';
    if (serviceId.isEmpty) return;
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-services/$serviceId/intro-media'), headers: await _headers());
      if (res.statusCode == 200 && mounted) {
        final data = jsonDecode(res.body);
        final media = data is Map ? (data['data'] ?? data['intro_media'] ?? []) : (data is List ? data : []);
        setState(() => _introMedia = media is List ? media : []);
      }
    } catch (_) {}
  }

  Future<void> _pickImages() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(maxWidth: 1200, imageQuality: 85);
    if (picked.isNotEmpty && mounted) {
      final accepted = <File>[];
      for (final f in picked) {
        final file = File(f.path);
        final bytes = await file.length();
        if (bytes > 5 * 1024 * 1024) continue;
        accepted.add(file);
      }
      if (accepted.isEmpty && picked.isNotEmpty && mounted) {
        AppSnackbar.info(context, 'Images must be 5MB or smaller');
      }
      if (accepted.isNotEmpty && mounted) {
        setState(() => _newImages.addAll(accepted));
      }
    }
  }

  Future<void> _uploadIntroMedia() async {
    final serviceId = widget.service['id']?.toString() ?? '';
    final picker = ImagePicker();
    final picked = await picker.pickVideo(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _uploadingMedia = true);
    try {
      final uri = Uri.parse('$_baseUrl/user-services/$serviceId/intro-media');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.fields['media_type'] = 'video';
      request.files.add(await http.MultipartFile.fromPath('media', picked.path));
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      if (streamedRes.statusCode >= 200 && streamedRes.statusCode < 300) {
        if (mounted) {
          AppSnackbar.success(context, 'Intro clip uploaded');
          _loadIntroMedia();
        }
      } else {
        if (mounted) AppSnackbar.error(context, 'Failed to upload intro clip');
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to upload intro clip');
    } finally {
      if (mounted) setState(() => _uploadingMedia = false);
    }
  }

  Future<void> _deleteIntroMedia(String mediaId) async {
    final serviceId = widget.service['id']?.toString() ?? '';
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-services/$serviceId/intro-media/$mediaId'), headers: await _headers());
      if (res.statusCode >= 200 && res.statusCode < 300 && mounted) {
        AppSnackbar.success(context, 'Intro clip removed');
        _loadIntroMedia();
      }
    } catch (_) {}
  }

  Future<void> _save() async {
    final serviceId = widget.service['id']?.toString() ?? '';
    if (serviceId.isEmpty) return;

    if (_titleCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Service title is required');
      return;
    }
    if (_descCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Description is required');
      return;
    }

    final minNum = num.tryParse(_minPriceCtrl.text.trim().replaceAll(',', ''));
    final maxNum = num.tryParse(_maxPriceCtrl.text.trim().replaceAll(',', ''));
    if (minNum != null && maxNum != null && maxNum < minNum) {
      AppSnackbar.error(context, 'Max price must be ≥ min price');
      return;
    }

    setState(() => _submitting = true);

    // Use FormData for update (matches web which uses putFormData)
    try {
      final uri = Uri.parse('$_baseUrl/services/$serviceId');
      final request = http.MultipartRequest('PUT', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.fields['title'] = _titleCtrl.text.trim();
      request.fields['description'] = _descCtrl.text.trim();
      request.fields['status'] = _status;
      request.fields['availability'] = _availability;
      request.fields['location'] = _locationCtrl.text.trim();

      final minNum = num.tryParse(_minPriceCtrl.text.trim().replaceAll(',', ''));
      final maxNum = num.tryParse(_maxPriceCtrl.text.trim().replaceAll(',', ''));
      if (minNum != null) request.fields['min_price'] = '$minNum';
      if (maxNum != null) request.fields['max_price'] = '$maxNum';
      if (_selectedCategoryId.isNotEmpty) request.fields['service_category_id'] = _selectedCategoryId;
      if (_selectedTypeId.isNotEmpty) request.fields['service_type_id'] = _selectedTypeId;

      // Detect key field changes for KYC reset
      final keyChanged = _titleCtrl.text.trim() != _originalTitle ||
          _selectedCategoryId != _originalCategoryId ||
          _selectedTypeId != _originalTypeId;
      if (keyChanged) request.fields['reset_verification'] = 'true';

      // Add new images
      for (final img in _newImages) {
        request.files.add(await http.MultipartFile.fromPath('images', img.path));
      }

      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      final resData = jsonDecode(body);

      if (mounted) {
        if (streamedRes.statusCode >= 200 && streamedRes.statusCode < 300) {
          AppSnackbar.success(context, keyChanged ? 'Service updated — please re-verify' : 'Service updated');
          Navigator.pop(context, true);
        } else {
          AppSnackbar.error(context, resData['message']?.toString() ?? 'Unable to update service');
        }
      }
    } catch (e) {
      if (mounted) AppSnackbar.error(context, 'Unable to update service');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F3F8),
      appBar: NuruSubPageAppBar(title: context.tr('edit_service')),
      body: _loadingRefs
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Title
                _label('Service Title'),
                _field(_titleCtrl, 'e.g. Professional Photography'),
                const SizedBox(height: 16),

                // Category
                _label('Service Category'),
                _dropdown(
                  value: _categories.any((c) => c['id']?.toString() == _selectedCategoryId) ? _selectedCategoryId : null,
                  hint: 'Select a category',
                  items: _categories.map<DropdownMenuItem<String>>((c) => DropdownMenuItem(
                    value: c['id']?.toString() ?? '',
                    child: Text(c['name']?.toString() ?? '', style: _f(size: 14)),
                  )).toList(),
                  onChanged: (v) async {
                    setState(() { _selectedCategoryId = v ?? ''; _selectedTypeId = ''; });
                    await _loadTypes(v ?? '');
                  },
                ),
                const SizedBox(height: 16),

                // Type
                _label('Service Type'),
                _dropdown(
                  value: _serviceTypes.any((t) => t['id']?.toString() == _selectedTypeId) ? _selectedTypeId : null,
                  hint: 'Select a type',
                  items: _serviceTypes.map<DropdownMenuItem<String>>((t) => DropdownMenuItem(
                    value: t['id']?.toString() ?? '',
                    child: Text(t['name']?.toString() ?? '', style: _f(size: 14)),
                  )).toList(),
                  onChanged: (v) => setState(() => _selectedTypeId = v ?? ''),
                ),
                const SizedBox(height: 16),

                // Description
                _label('Description'),
                _field(_descCtrl, 'Describe your service...', maxLines: 5),
                const SizedBox(height: 16),

                // Price row
                _label('Pricing (TZS)'),
                Row(children: [
                  Expanded(child: _field(_minPriceCtrl, 'Min price', keyboardType: TextInputType.number)),
                  const SizedBox(width: 12),
                  Expanded(child: _field(_maxPriceCtrl, 'Max price', keyboardType: TextInputType.number)),
                ]),
                const SizedBox(height: 16),

                // Location
                _label('Location'),
                _field(_locationCtrl, 'e.g. Dar es Salaam'),
                const SizedBox(height: 16),

                // Status
                _label('Status'),
                _dropdown(
                  value: _status,
                  hint: 'Select status',
                  items: const [
                    DropdownMenuItem(value: 'active', child: Text('Active')),
                    DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                  ],
                  onChanged: (v) => setState(() => _status = v ?? 'active'),
                ),
                const SizedBox(height: 16),

                // Availability
                _label('Availability'),
                _dropdown(
                  value: _availability,
                  hint: 'Select availability',
                  items: const [
                    DropdownMenuItem(value: 'available', child: Text('Available')),
                    DropdownMenuItem(value: 'busy', child: Text('Busy')),
                    DropdownMenuItem(value: 'unavailable', child: Text('Unavailable')),
                  ],
                  onChanged: (v) => setState(() => _availability = v ?? 'available'),
                ),
                const SizedBox(height: 24),

                // ── Service Images ──
                _sectionHeader('Service Images', 'assets/icons/photos-icon.svg'),
                const SizedBox(height: 10),
                if (_existingImages.isNotEmpty || _newImages.isNotEmpty)
                  SizedBox(
                    height: 100,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        ..._existingImages.map((url) => _imageThumb(networkUrl: url)),
                        ..._newImages.map((file) => _imageThumb(file: file, onRemove: () => setState(() => _newImages.remove(file)))),
                        _addImageBtn(),
                      ],
                    ),
                  )
                else
                  _addImageBtn(),
                const SizedBox(height: 24),

                // ── Intro Clip ──
                _sectionHeader('Intro Clip', 'assets/icons/video-icon.svg'),
                const SizedBox(height: 10),
                if (_introMedia.isNotEmpty)
                  ..._introMedia.map((m) {
                    final mediaId = m is Map ? m['id']?.toString() ?? '' : '';
                    final mediaType = m is Map ? (m['media_type']?.toString() ?? 'video') : 'video';
                    final mediaUrl = m is Map ? (m['media_url']?.toString() ?? '') : '';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: Row(children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(10)),
                          child: Center(child: SvgPicture.asset('assets/icons/video-icon.svg', width: 18, height: 18,
                            colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(mediaType == 'video' ? 'Video Clip' : 'Audio Clip', style: _f(size: 13, weight: FontWeight.w600)),
                          if (mediaUrl.isNotEmpty)
                            Text(mediaUrl.split('/').last, style: _f(size: 11, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ])),
                        GestureDetector(
                          onTap: () => _deleteIntroMedia(mediaId),
                          child: Container(
                            width: 32, height: 32,
                            decoration: BoxDecoration(color: AppColors.error.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                            child: const Icon(Icons.delete_outline_rounded, size: 16, color: AppColors.error),
                          ),
                        ),
                      ]),
                    );
                  }),
                GestureDetector(
                  onTap: _uploadingMedia ? null : _uploadIntroMedia,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.borderLight, style: BorderStyle.solid),
                    ),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      if (_uploadingMedia)
                        const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                      else
                        SvgPicture.asset('assets/icons/video-icon.svg', width: 20, height: 20,
                          colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                      const SizedBox(width: 8),
                      Text(_uploadingMedia ? 'Uploading...' : 'Upload Intro Clip', style: _f(size: 13, weight: FontWeight.w600, color: AppColors.primary)),
                    ]),
                  ),
                ),
                const SizedBox(height: 32),

                // Save button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text('Save Changes', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                  ),
                ),
              ]),
            ),
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: _f(size: 13, weight: FontWeight.w600)),
  );

  Widget _field(TextEditingController ctrl, String hint, {int maxLines = 1, TextInputType keyboardType = TextInputType.text}) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboardType,
      style: _f(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: _f(size: 14, color: AppColors.textHint),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderLight)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: AppColors.borderLight)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }

  Widget _dropdown({String? value, required String hint, required List<DropdownMenuItem<String>> items, required ValueChanged<String?> onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          hint: Text(hint, style: _f(size: 14, color: AppColors.textHint)),
          items: items,
          onChanged: _submitting ? null : onChanged,
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, String svgAsset) {
    return Row(children: [
      SvgPicture.asset(svgAsset, width: 18, height: 18, colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
      const SizedBox(width: 8),
      Text(title, style: _f(size: 15, weight: FontWeight.w700)),
    ]);
  }

  Widget _imageThumb({String? networkUrl, File? file, VoidCallback? onRemove}) {
    return Container(
      width: 90, height: 90,
      margin: const EdgeInsets.only(right: 8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.borderLight)),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        if (networkUrl != null)
          Image.network(networkUrl, width: 90, height: 90, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.surfaceVariant)),
        if (file != null)
          Image.file(file, width: 90, height: 90, fit: BoxFit.cover),
        if (onRemove != null)
          Positioned(top: 4, right: 4, child: GestureDetector(
            onTap: onRemove,
            child: Container(
              width: 22, height: 22,
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(11)),
              child: const Icon(Icons.close, size: 14, color: Colors.white),
            ),
          )),
      ]),
    );
  }

  Widget _addImageBtn() {
    return GestureDetector(
      onTap: _pickImages,
      child: Container(
        width: 90, height: 90,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.borderLight, style: BorderStyle.solid),
        ),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          SvgPicture.asset('assets/icons/photos-icon.svg', width: 22, height: 22,
            colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
          const SizedBox(height: 4),
          Text('Add', style: _f(size: 10, weight: FontWeight.w600, color: AppColors.primary)),
        ]),
      ),
    );
  }
}
