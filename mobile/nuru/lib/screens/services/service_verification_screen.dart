import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/api_service.dart';
import '../../core/widgets/app_snackbar.dart';

/// Service Verification / KYC document upload — matches web ServiceVerification.tsx
/// Shows KYC requirements and allows uploading documents for each
class ServiceVerificationScreen extends StatefulWidget {
  final String serviceId;
  final String serviceType;
  const ServiceVerificationScreen({super.key, required this.serviceId, this.serviceType = ''});

  @override
  State<ServiceVerificationScreen> createState() => _ServiceVerificationScreenState();
}

class _ServiceVerificationScreenState extends State<ServiceVerificationScreen> {
  static String get _baseUrl => ApiService.baseUrl;
  bool _loading = true;
  bool _submitting = false;
  List<Map<String, dynamic>> _items = [];
  final _picker = ImagePicker();

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  void initState() {
    super.initState();
    _loadKyc();
  }

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> _loadKyc() async {
    setState(() => _loading = true);
    try {
      final headers = await _headers();
      headers['Content-Type'] = 'application/json';
      final res = await http.get(Uri.parse('$_baseUrl/user-services/${widget.serviceId}/kyc'), headers: headers);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final body = jsonDecode(res.body);
        final data = body['data'] ?? body;
        final list = data is List ? data : (data is Map ? (data['requirements'] ?? data['items'] ?? []) : []);
        setState(() {
          _items = (list as List).map((k) {
            final kyc = k is Map<String, dynamic> ? k : <String, dynamic>{};
            return <String, dynamic>{
              'id': kyc['id']?.toString() ?? '',
              'name': kyc['name']?.toString() ?? 'Document',
              'description': kyc['description']?.toString() ?? '',
              'is_mandatory': kyc['is_mandatory'] == true,
              'status': kyc['status']?.toString(),
              'remarks': kyc['remarks']?.toString(),
              'files': <File>[],
            };
          }).toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  int get _verifiedCount => _items.where((i) => i['status'] == 'verified').length;
  double get _progress => _items.isNotEmpty ? (_verifiedCount / _items.length) * 100 : 0;

  Future<void> _pickFile(int index) async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 2048);
    if (picked == null) return;
    setState(() {
      (_items[index]['files'] as List<File>).add(File(picked.path));
    });
    AppSnackbar.success(context, 'File added');
  }

  void _removeFile(int itemIdx, int fileIdx) {
    setState(() {
      (_items[itemIdx]['files'] as List<File>).removeAt(fileIdx);
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);

    try {
      final headers = await _headers();
      for (final item in _items) {
        final files = item['files'] as List<File>;
        final status = item['status']?.toString();
        if (files.isEmpty) continue;
        if (status == 'verified' || status == 'pending') continue;

        for (final file in files) {
          final req = http.MultipartRequest('POST', Uri.parse('$_baseUrl/user-services/${widget.serviceId}/kyc'));
          headers.forEach((k, v) => req.headers[k] = v);
          req.fields['kyc_requirement_id'] = item['id'].toString();
          req.files.add(await http.MultipartFile.fromPath('file', file.path));
          final res = await req.send();
          if (res.statusCode < 200 || res.statusCode >= 300) {
            AppSnackbar.error(context, 'Failed to upload ${item['name']}');
            setState(() => _submitting = false);
            return;
          }
        }
      }
      AppSnackbar.success(context, 'Documents submitted! Your service will be activated once reviewed.');
      await _loadKyc();
    } catch (e) {
      AppSnackbar.error(context, 'Upload failed');
    }
    if (mounted) setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F3F8),
      appBar: NuruSubPageAppBar(title: 'Activate Your Service'),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : RefreshIndicator(
              onRefresh: _loadKyc,
              color: AppColors.primary,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                // Info banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SvgPicture.asset('assets/icons/info-icon.svg', width: 18, height: 18,
                      colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Why is this needed?', style: _f(size: 13, weight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('Nuru holds money in escrow, handles disputes, and pays vendors after confirmation. Business verification ensures your service meets the standards required for payouts and bookings.',
                          style: _f(size: 12, color: AppColors.textSecondary, height: 1.4)),
                    ])),
                  ]),
                ),
                const SizedBox(height: 14),

                // Progress
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8)]),
                  child: Column(children: [
                    Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text('Verification Progress', style: _f(size: 13, weight: FontWeight.w700)),
                      Text('$_verifiedCount of ${_items.length} verified', style: _f(size: 11, color: AppColors.textTertiary)),
                    ]),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: _progress / 100,
                        backgroundColor: AppColors.surfaceVariant,
                        valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: _verifiedCount == _items.length && _items.isNotEmpty
                          ? Row(children: [
                              const Icon(Icons.check_circle_rounded, size: 14, color: AppColors.success),
                              const SizedBox(width: 4),
                              Text('All items verified!', style: _f(size: 11, weight: FontWeight.w600, color: AppColors.success)),
                            ])
                          : Text('${_progress.round()}% verified', style: _f(size: 11, color: AppColors.textTertiary)),
                    ),
                  ]),
                ),
                const SizedBox(height: 14),

                // KYC Items
                ..._items.asMap().entries.map((e) => _kycItemCard(e.key, e.value)),

                // Submit button
                if (_items.any((i) => (i['files'] as List<File>).isNotEmpty))
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: SizedBox(
                      width: double.infinity, height: 48,
                      child: ElevatedButton(
                        onPressed: _submitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: _submitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text('Submit Documents', style: _f(size: 14, weight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                  ),

                const SizedBox(height: 80),
              ]),
            ),
    );
  }

  Widget _kycItemCard(int index, Map<String, dynamic> item) {
    final status = item['status']?.toString();
    final isVerified = status == 'verified';
    final isPending = status == 'pending';
    final isRejected = status == 'rejected';
    final isMandatory = item['is_mandatory'] == true;
    final files = item['files'] as List<File>;
    final remarks = item['remarks']?.toString();

    Color statusColor = AppColors.textTertiary;
    String statusLabel = 'Not submitted';
    if (isVerified) { statusColor = AppColors.success; statusLabel = 'Verified'; }
    else if (isPending) { statusColor = AppColors.warning; statusLabel = 'Pending review'; }
    else if (isRejected) { statusColor = AppColors.error; statusLabel = 'Rejected'; }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isVerified ? AppColors.success.withOpacity(0.3) : isRejected ? AppColors.error.withOpacity(0.3) : AppColors.borderLight),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6)],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 28, height: 28,
            decoration: BoxDecoration(
              color: isVerified ? AppColors.success.withOpacity(0.1) : isPending ? AppColors.warning.withOpacity(0.1) : AppColors.surfaceVariant,
              shape: BoxShape.circle,
            ),
            child: Icon(
              isVerified ? Icons.check_circle_rounded : isPending ? Icons.schedule_rounded : Icons.circle_outlined,
              size: 14,
              color: isVerified ? AppColors.success : isPending ? AppColors.warning : AppColors.textHint,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(item['name']?.toString() ?? 'Document', style: _f(size: 13, weight: FontWeight.w700))),
              if (isMandatory && !isVerified && !isPending)
                Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(color: AppColors.error.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                  child: Text('Required', style: _f(size: 9, weight: FontWeight.w600, color: AppColors.error))),
            ]),
            Text(statusLabel, style: _f(size: 10, color: statusColor, weight: FontWeight.w600)),
          ])),
        ]),
        if ((item['description']?.toString() ?? '').isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(item['description'].toString(), style: _f(size: 11, color: AppColors.textTertiary, height: 1.4)),
        ],
        if (isRejected && remarks != null && remarks.isNotEmpty) ...[
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: AppColors.error.withOpacity(0.06), borderRadius: BorderRadius.circular(8)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.info_outline, size: 14, color: AppColors.error),
              const SizedBox(width: 6),
              Expanded(child: Text(remarks, style: _f(size: 11, color: AppColors.error))),
            ]),
          ),
        ],
        // File list
        if (files.isNotEmpty) ...[
          const SizedBox(height: 8),
          ...files.asMap().entries.map((fe) => Container(
            margin: const EdgeInsets.only(bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(8)),
            child: Row(children: [
              const Icon(Icons.insert_drive_file_outlined, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(child: Text(fe.value.path.split('/').last, style: _f(size: 11, color: AppColors.textSecondary), overflow: TextOverflow.ellipsis)),
              GestureDetector(
                onTap: () => _removeFile(index, fe.key),
                child: const Icon(Icons.close_rounded, size: 16, color: AppColors.error),
              ),
            ]),
          )),
        ],
        // Upload button (only if not verified/pending)
        if (!isVerified && !isPending) ...[
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => _pickFile(index),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.primary.withOpacity(0.3), style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(10),
                color: AppColors.primary.withOpacity(0.03),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.upload_file_rounded, size: 16, color: AppColors.primary),
                const SizedBox(width: 6),
                Text('Upload Document', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.primary)),
              ]),
            ),
          ),
        ],
      ]),
    );
  }
}
