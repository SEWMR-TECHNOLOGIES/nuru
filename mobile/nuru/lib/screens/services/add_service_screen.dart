import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/user_services_service.dart';
import '../../core/services/api_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/agreement_gate.dart';
import 'service_verification_screen.dart';
import '../../core/l10n/l10n_helper.dart';

class AddServiceScreen extends StatefulWidget {
  const AddServiceScreen({super.key});

  @override
  State<AddServiceScreen> createState() => _AddServiceScreenState();
}

class _AddServiceScreenState extends State<AddServiceScreen> {
  static String get _baseUrl => ApiService.baseUrl;
  static const int _maxImageCount = 10;
  static const int _maxImageBytes = 5 * 1024 * 1024;

  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _minPriceCtrl = TextEditingController();
  final _maxPriceCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();

  List<dynamic> _categories = [];
  List<dynamic> _serviceTypes = [];
  String _selectedCategoryId = '';
  String _selectedTypeId = '';
  bool _loadingCategories = true;
  bool _loadingTypes = false;
  bool _submitting = false;

  final List<XFile> _images = [];
  bool _agreementChecked = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
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

  Future<void> _loadCategories() async {
    final res = await UserServicesService.getServiceCategories();
    if (mounted) {
      setState(() {
        _loadingCategories = false;
        if (res['success'] == true) {
          final d = res['data'];
          _categories = d is List ? d : [];
        }
      });
    }
  }

  Future<void> _loadTypes(String categoryId) async {
    if (categoryId.isEmpty) return;
    setState(() => _loadingTypes = true);
    final res = await UserServicesService.getServiceTypesByCategory(categoryId);
    if (mounted) {
      setState(() {
        _loadingTypes = false;
        if (res['success'] == true) {
          final d = res['data'];
          _serviceTypes = d is List ? d : [];
        } else {
          _serviceTypes = [];
        }
      });
    }
  }

  Future<void> _pickImages() async {
    if (_images.length >= _maxImageCount) {
      AppSnackbar.info(context, 'You can upload up to 10 images');
      return;
    }

    try {
      final picker = ImagePicker();
      final picked = await picker.pickMultiImage(maxWidth: 1600, imageQuality: 85);
      if (!mounted || picked.isEmpty) return;

      final remaining = _maxImageCount - _images.length;
      final accepted = <XFile>[];
      var oversized = 0;

      for (final file in picked) {
        if (accepted.length >= remaining) break;
        final bytes = await File(file.path).length();
        if (bytes > _maxImageBytes) {
          oversized++;
          continue;
        }
        accepted.add(file);
      }

      if (accepted.isNotEmpty) {
        setState(() => _images.addAll(accepted));
      }

      if (oversized > 0) {
        AppSnackbar.info(
          context,
          'Some images were skipped because they exceed 5MB.',
        );
      }

      if (picked.length > accepted.length && oversized == 0) {
        AppSnackbar.info(context, 'You can upload up to 10 images');
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to pick images');
    }
  }

  void _removeImage(int index) {
    setState(() => _images.removeAt(index));
  }

  String _formatPrice(String value) {
    final numbers = value.replaceAll(RegExp(r'[^\d]'), '');
    return numbers.replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Service title is required');
      return;
    }
    if (_selectedCategoryId.isEmpty) {
      AppSnackbar.error(context, 'Please select a category');
      return;
    }
    if (_selectedTypeId.isEmpty) {
      AppSnackbar.error(context, 'Please select a service type');
      return;
    }
    if (_descCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Description is required');
      return;
    }
    if (_minPriceCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Minimum price is required');
      return;
    }
    if (_maxPriceCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Maximum price is required');
      return;
    }

    final minPrice = double.tryParse(_minPriceCtrl.text.trim().replaceAll(',', '')) ?? 0;
    final maxPrice = double.tryParse(_maxPriceCtrl.text.trim().replaceAll(',', '')) ?? 0;

    if (minPrice <= 0) {
      AppSnackbar.error(context, 'Minimum price must be greater than 0');
      return;
    }
    if (maxPrice <= 0) {
      AppSnackbar.error(context, 'Maximum price must be greater than 0');
      return;
    }
    if (maxPrice < minPrice) {
      AppSnackbar.error(context, 'Maximum price must be greater than or equal to minimum price');
      return;
    }

    setState(() => _submitting = true);
    try {
      final uri = Uri.parse('$_baseUrl/user-services/');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _headers());

      request.fields['title'] = _titleCtrl.text.trim();
      request.fields['description'] = _descCtrl.text.trim();
      request.fields['category_id'] = _selectedCategoryId;
      request.fields['service_type_id'] = _selectedTypeId;
      request.fields['min_price'] = _minPriceCtrl.text.trim().replaceAll(',', '');
      request.fields['max_price'] = _maxPriceCtrl.text.trim().replaceAll(',', '');
      if (_locationCtrl.text.trim().isNotEmpty) {
        request.fields['location'] = _locationCtrl.text.trim();
      }

      for (final img in _images) {
        request.files.add(await http.MultipartFile.fromPath('images', img.path));
      }

      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      final result = jsonDecode(body);

      if (!mounted) return;

      if (result['success'] == true) {
        AppSnackbar.success(context, result['message'] ?? 'Service created! Now activate it.');
        final serviceId = result['data']?['id']?.toString();
        if (serviceId != null) {
          Navigator.pushReplacement(context, MaterialPageRoute(
            builder: (_) => ServiceVerificationScreen(serviceId: serviceId),
          ));
        } else {
          Navigator.pop(context, true);
        }
      } else {
        AppSnackbar.error(context, result['message']?.toString() ?? 'Failed to create service');
        setState(() => _submitting = false);
      }
    } catch (e) {
      if (mounted) {
        AppSnackbar.error(context, 'Failed to create service');
        setState(() => _submitting = false);
      }
    }
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        backgroundColor: const Color(0xFFF0F3F8),
        appBar: NuruSubPageAppBar(title: context.tr('add_service')),
        body: _loadingCategories
            ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
            : SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // ── Basic Information ──
                  _sectionCard('Basic Information', [
                    _fieldLabel('Service Title *'),
                    _textField(_titleCtrl, 'e.g., Professional Wedding Photography'),
                    const SizedBox(height: 14),
                    _fieldLabel('Category *'),
                    _dropdown(
                      value: _categories.any((c) => c['id']?.toString() == _selectedCategoryId) ? _selectedCategoryId : null,
                      hint: 'Select a category',
                      items: _categories.map<DropdownMenuItem<String>>((c) => DropdownMenuItem(
                        value: c['id']?.toString() ?? '',
                        child: Text(c['name']?.toString() ?? '', style: _f(size: 14)),
                      )).toList(),
                      onChanged: (v) {
                        setState(() {
                          _selectedCategoryId = v ?? '';
                          _selectedTypeId = '';
                          _serviceTypes = [];
                        });
                        _loadTypes(v ?? '');
                      },
                    ),
                    const SizedBox(height: 14),
                    _fieldLabel('Service Type *'),
                    _loadingTypes
                        ? Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(children: [
                              const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2)),
                              const SizedBox(width: 8),
                              Text('Loading types...', style: _f(size: 13, color: AppColors.textTertiary)),
                            ]),
                          )
                        : _dropdown(
                            value: _serviceTypes.any((t) => t['id']?.toString() == _selectedTypeId) ? _selectedTypeId : null,
                            hint: _selectedCategoryId.isEmpty ? 'Select a category first' : 'Select a service type',
                            items: _serviceTypes.map<DropdownMenuItem<String>>((t) => DropdownMenuItem(
                              value: t['id']?.toString() ?? '',
                              child: Text(t['name']?.toString() ?? '', style: _f(size: 14)),
                            )).toList(),
                            onChanged: _selectedCategoryId.isEmpty ? null : (v) => setState(() => _selectedTypeId = v ?? ''),
                          ),
                    const SizedBox(height: 14),
                    _fieldLabel('Description *'),
                    _textField(_descCtrl, 'Describe your service, experience, and what makes you unique...', maxLines: 4),
                  ]),
                  const SizedBox(height: 16),

                  // ── Pricing & Location ──
                  _sectionCard('Pricing & Location', [
                    Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _fieldLabel('Min Price (TZS) *'),
                        _textField(_minPriceCtrl, 'e.g., 300,000', keyboardType: TextInputType.number, onChanged: (v) {
                          final formatted = _formatPrice(v);
                          if (formatted != v) _minPriceCtrl.value = TextEditingValue(text: formatted, selection: TextSelection.collapsed(offset: formatted.length));
                        }),
                      ])),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _fieldLabel('Max Price (TZS) *'),
                        _textField(_maxPriceCtrl, 'e.g., 2,500,000', keyboardType: TextInputType.number, onChanged: (v) {
                          final formatted = _formatPrice(v);
                          if (formatted != v) _maxPriceCtrl.value = TextEditingValue(text: formatted, selection: TextSelection.collapsed(offset: formatted.length));
                        }),
                      ])),
                    ]),
                    const SizedBox(height: 14),
                    _fieldLabel('Service Location'),
                    _textField(_locationCtrl, 'e.g., Dar es Salaam, Mikocheni'),
                  ]),
                  const SizedBox(height: 16),

                  // ── Service Images ──
                  _sectionCard('Service Images', [
                    if (_images.isNotEmpty) ...[
                      SizedBox(
                        height: 100,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _images.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (_, i) => Stack(children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(File(_images[i].path), width: 100, height: 100, fit: BoxFit.cover),
                            ),
                            Positioned(top: 4, right: 4, child: GestureDetector(
                              onTap: () => _removeImage(i),
                              child: Container(
                                width: 22, height: 22,
                                decoration: BoxDecoration(color: AppColors.error, borderRadius: BorderRadius.circular(11)),
                                child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                              ),
                            )),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    GestureDetector(
                      onTap: _pickImages,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 28),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.borderLight, width: 2, strokeAlign: BorderSide.strokeAlignCenter),
                          borderRadius: BorderRadius.circular(14),
                          color: AppColors.surfaceVariant,
                        ),
                        child: Column(children: [
                          Icon(Icons.cloud_upload_outlined, size: 36, color: AppColors.textTertiary),
                          const SizedBox(height: 8),
                          Text('Tap to upload images', style: _f(size: 13, color: AppColors.textTertiary)),
                          Text('PNG, JPG, or WEBP (max 5MB)', style: _f(size: 11, color: AppColors.textHint)),
                        ]),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 24),

                  // ── Submit Buttons ──
                  Row(children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _submitting ? null : () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          side: const BorderSide(color: AppColors.borderLight),
                        ),
                        child: Text('Cancel', style: _f(size: 14, weight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: _submitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Text('Add Service', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                  ]),
                ]),
              ),
    );
  }

  // ── UI Helpers ──

  Widget _sectionCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: _f(size: 16, weight: FontWeight.w700)),
        const SizedBox(height: 14),
        ...children,
      ]),
    );
  }

  Widget _fieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(label, style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
    );
  }

  Widget _textField(TextEditingController ctrl, String hint, {int maxLines = 1, TextInputType keyboardType = TextInputType.text, ValueChanged<String>? onChanged}) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboardType,
      onChanged: onChanged,
      style: _f(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: _f(size: 14, color: AppColors.textHint),
        filled: true,
        fillColor: AppColors.surfaceVariant,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  Widget _dropdown({String? value, required String hint, required List<DropdownMenuItem<String>> items, ValueChanged<String?>? onChanged}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          hint: Text(hint, style: _f(size: 14, color: AppColors.textHint)),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}
