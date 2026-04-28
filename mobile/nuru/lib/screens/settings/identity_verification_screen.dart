import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/services/api_service.dart';
import '../../core/l10n/l10n_helper.dart';

/// Identity Verification screen — allows uploading ID documents
class IdentityVerificationScreen extends StatefulWidget {
  const IdentityVerificationScreen({super.key});

  @override
  State<IdentityVerificationScreen> createState() => _IdentityVerificationScreenState();
}

class _IdentityVerificationScreenState extends State<IdentityVerificationScreen> {
  String _status = 'not_submitted'; // not_submitted, pending, approved, rejected
  bool _loading = true;
  bool _submitting = false;
  String? _idFrontPath;
  String? _idBackPath;
  String _idType = 'national_id';
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    setState(() => _loading = true);
    final res = await ApiService.get('/users/profile');
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true && res['data'] is Map) {
          final d = res['data'] as Map<String, dynamic>;
          if (d['is_identity_verified'] == true) {
            _status = 'approved';
          } else if (d['verification_status'] != null) {
            _status = d['verification_status'].toString();
          }
        }
      });
    }
  }

  Future<void> _pickImage(bool isFront) async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 85);
    if (picked != null && mounted) {
      setState(() {
        if (isFront) _idFrontPath = picked.path;
        else _idBackPath = picked.path;
      });
    }
  }

  Future<void> _submit() async {
    if (_idFrontPath == null) {
      AppSnackbar.error(context, 'Please upload the front of your ID');
      return;
    }
    setState(() => _submitting = true);
    // In production this would upload files via multipart; for now simulate
    final res = await ApiService.post('/users/verify-identity', {
      'id_type': _idType,
      'front_image': _idFrontPath,
      'back_image': _idBackPath,
    });
    if (mounted) {
      setState(() => _submitting = false);
      if (res['success'] == true) {
        setState(() => _status = 'pending');
        AppSnackbar.success(context, 'Verification submitted for review');
      } else {
        AppSnackbar.error(context, res['message'] ?? 'Submission failed');
      }
    }
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE8EEF5),
      appBar: NuruSubPageAppBar(title: context.tr('identity_verification')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
              children: [
                // Status banner
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: _statusColor.withOpacity(0.3)),
                  ),
                  child: Row(children: [
                    Icon(_statusIcon, color: _statusColor, size: 24),
                    const SizedBox(width: 12),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_statusTitle, style: _f(size: 14, weight: FontWeight.w700, color: _statusColor)),
                        const SizedBox(height: 2),
                        Text(_statusDesc, style: _f(size: 12, color: AppColors.textSecondary)),
                      ],
                    )),
                  ]),
                ),

                if (_status == 'not_submitted' || _status == 'rejected') ...[
                  const SizedBox(height: 24),
                  Text('Document Type', style: _f(size: 14, weight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  _idTypeSelector(),
                  const SizedBox(height: 20),

                  Text('Upload Documents', style: _f(size: 14, weight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: _uploadCard('Front', _idFrontPath, () => _pickImage(true))),
                    const SizedBox(width: 12),
                    Expanded(child: _uploadCard('Back (optional)', _idBackPath, () => _pickImage(false))),
                  ]),

                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.primary),
                      const SizedBox(width: 10),
                      Expanded(child: Text(
                        'Your documents are encrypted and stored securely. Verification typically takes 1-3 business days.',
                        style: _f(size: 12, color: AppColors.primary, height: 1.4),
                      )),
                    ]),
                  ),

                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: _submitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text('Submit for Verification', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  Widget _idTypeSelector() {
    return Wrap(spacing: 8, runSpacing: 8, children: [
      _typeChip('National ID', 'national_id'),
      _typeChip('Passport', 'passport'),
      _typeChip('Driver\'s License', 'drivers_license'),
    ]);
  }

  Widget _typeChip(String label, String value) {
    final selected = _idType == value;
    return GestureDetector(
      onTap: () => setState(() => _idType = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? AppColors.primary : AppColors.borderLight),
        ),
        child: Text(label, style: _f(size: 13, weight: FontWeight.w600, color: selected ? Colors.white : AppColors.textPrimary)),
      ),
    );
  }

  Widget _uploadCard(String label, String? path, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 140,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: path != null ? AppColors.primary : AppColors.borderLight, width: path != null ? 2 : 1),
        ),
        clipBehavior: Clip.antiAlias,
        child: path != null
            ? Stack(children: [
                Image.file(File(path), width: double.infinity, height: 140, fit: BoxFit.cover),
                Positioned(top: 6, right: 6, child: Container(
                  width: 24, height: 24,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.check_rounded, size: 14, color: Colors.white),
                )),
              ])
            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.cloud_upload_outlined, size: 28, color: AppColors.textHint),
                const SizedBox(height: 6),
                Text(label, style: _f(size: 11, color: AppColors.textTertiary), textAlign: TextAlign.center),
              ]),
      ),
    );
  }

  Color get _statusColor {
    switch (_status) {
      case 'approved': return AppColors.success;
      case 'pending': return Colors.orange;
      case 'rejected': return AppColors.error;
      default: return AppColors.textTertiary;
    }
  }

  IconData get _statusIcon {
    switch (_status) {
      case 'approved': return Icons.verified_user_rounded;
      case 'pending': return Icons.hourglass_top_rounded;
      case 'rejected': return Icons.cancel_rounded;
      default: return Icons.shield_outlined;
    }
  }

  String get _statusTitle {
    switch (_status) {
      case 'approved': return 'Verified';
      case 'pending': return 'Pending Review';
      case 'rejected': return 'Rejected';
      default: return 'Not Verified';
    }
  }

  String get _statusDesc {
    switch (_status) {
      case 'approved': return 'Your identity has been verified successfully';
      case 'pending': return 'Your documents are being reviewed by our team';
      case 'rejected': return 'Please re-submit with clearer documents';
      default: return 'Verify your identity to build trust and unlock features';
    }
  }
}
