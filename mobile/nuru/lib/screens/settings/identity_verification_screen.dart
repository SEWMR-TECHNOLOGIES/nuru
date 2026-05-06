import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/services/event_extras_service.dart';
import '../../core/l10n/l10n_helper.dart';

/// Identity Verification — premium redesign mirroring web flow.
class IdentityVerificationScreen extends StatefulWidget {
  const IdentityVerificationScreen({super.key});

  @override
  State<IdentityVerificationScreen> createState() => _IdentityVerificationScreenState();
}

enum _Slot { idFront, idBack, selfie }

class _IdentityVerificationScreenState extends State<IdentityVerificationScreen> {
  static const _maxBytes = 5 * 1024 * 1024;
  static const _allowedExt = {'jpg', 'jpeg', 'png', 'webp'};

  String _status = 'unverified';
  String? _rejectionReason;
  bool _loading = true;
  bool _submitting = false;

  String? _idFrontPath;
  String? _idBackPath;
  String? _selfiePath;
  final _docNumberCtrl = TextEditingController();

  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _docNumberCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    setState(() => _loading = true);
    final res = await EventExtrasService.getVerificationStatus();
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true && res['data'] is Map) {
        final d = res['data'] as Map<String, dynamic>;
        _status = (d['status'] ?? 'unverified').toString();
        _rejectionReason = d['rejection_reason']?.toString();
      }
    });
  }

  Future<void> _pickFor(_Slot slot) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 44, height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(4)),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Upload from', style: _f(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
              ),
            ),
            _sheetTile(Icons.photo_camera_rounded, 'Take photo', 'Use your camera', () => Navigator.pop(context, ImageSource.camera)),
            const SizedBox(height: 4),
            _sheetTile(Icons.photo_library_rounded, 'Choose from gallery', 'Pick a saved image', () => Navigator.pop(context, ImageSource.gallery)),
          ]),
        ),
      ),
    );
    if (source == null) return;

    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        imageQuality: 88,
      );
      if (picked == null || !mounted) return;

      final file = File(picked.path);
      final size = await file.length();
      if (size > _maxBytes) {
        AppSnackbar.error(context, 'File must be 5MB or smaller');
        return;
      }
      final ext = picked.path.split('.').last.toLowerCase();
      if (!_allowedExt.contains(ext)) {
        AppSnackbar.error(context, 'Only JPG, PNG, or WEBP images are allowed');
        return;
      }

      setState(() {
        switch (slot) {
          case _Slot.idFront: _idFrontPath = picked.path; break;
          case _Slot.idBack: _idBackPath = picked.path; break;
          case _Slot.selfie: _selfiePath = picked.path; break;
        }
      });
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Unable to pick image');
    }
  }

  Widget _sheetTile(IconData icon, String label, String subtitle, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: _f(size: 14.5, weight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(subtitle, style: _f(size: 12, color: AppColors.textTertiary)),
          ])),
          const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary),
        ]),
      ),
    );
  }

  Future<void> _submit() async {
    if (_idFrontPath == null) {
      AppSnackbar.error(context, 'Please upload the front of your ID');
      return;
    }
    setState(() => _submitting = true);
    final res = await EventExtrasService.submitVerification(
      documentNumber: _docNumberCtrl.text,
      idFrontPath: _idFrontPath!,
      idBackPath: _idBackPath,
      selfiePath: _selfiePath,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (res['success'] == true) {
      setState(() {
        _status = 'pending';
        _idFrontPath = null;
        _idBackPath = null;
        _selfiePath = null;
        _docNumberCtrl.clear();
      });
      AppSnackbar.success(context, 'Verification submitted for review');
    } else {
      final errors = (res['data'] is Map) ? (res['data']['errors'] as Map?) : null;
      final firstErr = errors?.values.first?.toString();
      AppSnackbar.error(context, firstErr ?? res['message']?.toString() ?? 'Submission failed');
    }
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color, height: height);

  bool get _canEdit => _status == 'unverified' || _status == 'rejected';

  int get _completedCount {
    int c = 0;
    if (_idFrontPath != null) c++;
    if (_idBackPath != null) c++;
    if (_selfiePath != null) c++;
    return c;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: NuruSubPageAppBar(title: context.tr('identity_verification')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
              children: [
                _heroCard(),
                if (_status == 'rejected' && (_rejectionReason ?? '').isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.error.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.error.withOpacity(0.18)),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.error),
                      const SizedBox(width: 10),
                      Expanded(child: Text(
                        _rejectionReason!,
                        style: _f(size: 12.5, color: AppColors.error, height: 1.4),
                      )),
                    ]),
                  ),
                ],
                if (_canEdit) ...[
                  const SizedBox(height: 22),
                  _sectionHeader('ID document', 'Required', required: true),
                  const SizedBox(height: 10),
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: _uploadCard('Front of ID', _idFrontPath, true, () => _pickFor(_Slot.idFront))),
                    const SizedBox(width: 12),
                    Expanded(child: _uploadCard('Back of ID', _idBackPath, false, () => _pickFor(_Slot.idBack))),
                  ]),

                  const SizedBox(height: 22),
                  _sectionHeader('Selfie with ID', 'Optional', required: false),
                  const SizedBox(height: 10),
                  _uploadCard('Hold your ID next to your face', _selfiePath, false, () => _pickFor(_Slot.selfie), tall: true),

                  const SizedBox(height: 22),
                  _sectionHeader('Document number', 'Optional', required: false),
                  const SizedBox(height: 10),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    child: TextField(
                      controller: _docNumberCtrl,
                      autocorrect: false,
                      enableSuggestions: false,
                      style: _f(size: 14, weight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'e.g. 19900101-12345-67890-1',
                        hintStyle: _f(size: 13, color: AppColors.textHint),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        border: InputBorder.none,
                        prefixIcon: const Padding(
                          padding: EdgeInsets.only(left: 14, right: 8),
                          child: Icon(Icons.badge_outlined, size: 18, color: AppColors.textTertiary),
                        ),
                        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.borderLight),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.success.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: const Icon(Icons.lock_rounded, size: 16, color: AppColors.success),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('End-to-end encrypted', style: _f(size: 13, weight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          'Documents are used only for verification and reviewed within 1-3 business days.',
                          style: _f(size: 11.5, color: AppColors.textSecondary, height: 1.45),
                        ),
                      ])),
                    ]),
                  ),

                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity, height: 54,
                    child: ElevatedButton(
                      onPressed: (_submitting || _idFrontPath == null) ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.primary.withOpacity(0.35),
                        disabledForegroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: _submitting
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.4))
                          : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Text('Submit for verification', style: _f(size: 15, weight: FontWeight.w700, color: Colors.white)),
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.white),
                            ]),
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  Widget _heroCard() {
    final isVerified = _status == 'verified';
    final isPending = _status == 'pending';
    final isRejected = _status == 'rejected';

    final bg = isVerified
        ? const LinearGradient(colors: [Color(0xFF0E2A18), Color(0xFF134A26)], begin: Alignment.topLeft, end: Alignment.bottomRight)
        : isPending
            ? const LinearGradient(colors: [Color(0xFF2A1F08), Color(0xFF4A360E)], begin: Alignment.topLeft, end: Alignment.bottomRight)
            : isRejected
                ? const LinearGradient(colors: [Color(0xFF2A0E0E), Color(0xFF4A1818)], begin: Alignment.topLeft, end: Alignment.bottomRight)
                : const LinearGradient(colors: [Color(0xFF0A1C40), Color(0xFF12284F)], begin: Alignment.topLeft, end: Alignment.bottomRight);

    final accent = isVerified
        ? AppColors.accent
        : isPending
            ? AppColors.primary
            : isRejected
                ? AppColors.error
                : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        gradient: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Stack(children: [
        Positioned(
          right: -30, top: -30,
          child: Container(
            width: 160, height: 160,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
          ),
        ),
        Positioned(
          right: 30, bottom: -50,
          child: Container(
            width: 120, height: 120,
            decoration: BoxDecoration(
              color: accent.withOpacity(0.06),
              shape: BoxShape.circle,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: accent.withOpacity(0.35), width: 0.8),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(_statusIcon, size: 12, color: accent),
                  const SizedBox(width: 6),
                  Text(_statusTitle.toUpperCase(),
                      style: _f(size: 10, weight: FontWeight.w700, color: accent, height: 1)),
                ]),
              ),
              const Spacer(),
              if (_canEdit)
                Text('${_completedCount}/3 uploaded',
                    style: _f(size: 11, weight: FontWeight.w600, color: Colors.white.withOpacity(0.7))),
            ]),
            const SizedBox(height: 18),
            Text(
              isVerified ? 'You\u2019re verified' : isPending ? 'Under review' : isRejected ? 'Verification rejected' : 'Verify your identity',
              style: GoogleFonts.playfairDisplay(
                fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white, height: 1.15,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _statusDesc,
              style: _f(size: 13, color: Colors.white.withOpacity(0.78), height: 1.5),
            ),
            if (_canEdit) ...[
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: _completedCount / 3,
                  minHeight: 6,
                  backgroundColor: Colors.white.withOpacity(0.12),
                  valueColor: AlwaysStoppedAnimation<Color>(accent),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }

  Widget _sectionHeader(String title, String tag, {required bool required}) {
    return Row(children: [
      Text(title, style: _f(size: 14.5, weight: FontWeight.w700)),
      const SizedBox(width: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: required ? AppColors.error.withOpacity(0.08) : AppColors.borderLight,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          tag.toUpperCase(),
          style: _f(size: 9.5, weight: FontWeight.w700, color: required ? AppColors.error : AppColors.textTertiary, height: 1),
        ),
      ),
    ]);
  }

  Widget _uploadCard(String label, String? path, bool required, VoidCallback onTap, {bool tall = false}) {
    final h = tall ? 200.0 : 150.0;
    final hasFile = path != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: h,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: hasFile ? AppColors.primary : AppColors.borderLight,
            width: hasFile ? 1.5 : 1,
          ),
          boxShadow: hasFile
              ? [BoxShadow(color: AppColors.primary.withOpacity(0.10), blurRadius: 12, offset: const Offset(0, 3))]
              : [const BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 1))],
        ),
        clipBehavior: Clip.antiAlias,
        child: hasFile
            ? Stack(fit: StackFit.expand, children: [
                Image.file(File(path), fit: BoxFit.cover),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black.withOpacity(0.55)],
                        stops: const [0.55, 1.0],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 8, right: 8,
                  child: Row(children: [
                    GestureDetector(
                      onTap: onTap,
                      child: Container(
                        width: 30, height: 30,
                        decoration: BoxDecoration(color: Colors.black.withOpacity(0.55), shape: BoxShape.circle),
                        child: const Icon(Icons.refresh_rounded, size: 16, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () => setState(() {
                        if (path == _idFrontPath) _idFrontPath = null;
                        else if (path == _idBackPath) _idBackPath = null;
                        else if (path == _selfiePath) _selfiePath = null;
                      }),
                      child: Container(
                        width: 30, height: 30,
                        decoration: BoxDecoration(color: Colors.black.withOpacity(0.55), shape: BoxShape.circle),
                        child: const Icon(Icons.close_rounded, size: 16, color: Colors.white),
                      ),
                    ),
                  ]),
                ),
                Positioned(
                  top: 8, left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.check_rounded, size: 12, color: Colors.white),
                      const SizedBox(width: 3),
                      Text('Uploaded', style: _f(size: 10, weight: FontWeight.w700, color: Colors.white, height: 1)),
                    ]),
                  ),
                ),
                Positioned(
                  bottom: 10, left: 12, right: 12,
                  child: Text(label, style: _f(size: 12, weight: FontWeight.w600, color: Colors.white)),
                ),
              ])
            : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.cloud_upload_rounded, size: 24, color: AppColors.primary),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    label,
                    style: _f(size: 12.5, weight: FontWeight.w600, color: AppColors.textPrimary),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 4),
                Text('Tap to upload', style: _f(size: 11, weight: FontWeight.w500, color: AppColors.primary)),
                const SizedBox(height: 4),
                Text('JPG · PNG · WEBP · 5MB', style: _f(size: 9.5, color: AppColors.textHint)),
              ]),
      ),
    );
  }

  IconData get _statusIcon {
    switch (_status) {
      case 'verified': return Icons.verified_rounded;
      case 'pending': return Icons.hourglass_top_rounded;
      case 'rejected': return Icons.error_outline_rounded;
      default: return Icons.shield_outlined;
    }
  }

  String get _statusTitle {
    switch (_status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Pending';
      case 'rejected': return 'Action needed';
      default: return 'Not verified';
    }
  }

  String get _statusDesc {
    switch (_status) {
      case 'verified': return 'Your identity has been confirmed. You now have full access to trusted features.';
      case 'pending': return 'Our team is reviewing your documents. This typically takes 1-3 business days.';
      case 'rejected': return 'We couldn\u2019t verify your identity. Please re-upload clearer documents below.';
      default: return 'Confirm your identity to build trust, unlock advanced features, and access higher limits.';
    }
  }
}
