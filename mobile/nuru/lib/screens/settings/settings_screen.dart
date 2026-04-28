import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/api_service.dart';
import '../../core/services/events_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/language_selector.dart';
import '../../core/l10n/l10n_helper.dart';
import '../auth/widgets/auth_text_field.dart';
import 'identity_verification_screen.dart';
import '../wallet/payout_profile_screen.dart';
import 'terms_screen.dart';
import 'privacy_policy_screen.dart';
import 'licenses_screen.dart';
import '../../core/theme/text_styles.dart';

class SettingsScreen extends StatefulWidget {
  final Map<String, dynamic>? profile;
  final VoidCallback? onProfileUpdated;
  final int initialSection;
  const SettingsScreen({
    super.key,
    this.profile,
    this.onProfileUpdated,
    this.initialSection = 0,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late int _section;

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarContrastEnforced: false,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        if (_section == 0)
                          Navigator.pop(context);
                        else
                          setState(() => _section = 0);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: SvgPicture.asset(
                          'assets/icons/chevron-left-icon.svg',
                          width: 20,
                          height: 20,
                          colorFilter: const ColorFilter.mode(
                            AppColors.textPrimary,
                            BlendMode.srcIn,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        _sectionTitle(),
                        style: appText(size: 18, weight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(child: _buildSection()),
            ],
          ),
        ),
      ),
    );
  }

  String _sectionTitle() {
    switch (_section) {
      case 1:
        return context.trw('edit_profile');
      case 2:
        return context.trw('change_password');
      case 3:
        return context.trw('privacy_security');
      case 4:
        return context.trw('notifications');
      case 5:
        return context.trw('about_nuru');
      default:
        return context.trw('settings');
    }
  }

  Widget _buildSection() {
    switch (_section) {
      case 1:
        return _EditProfileSection(
          profile: widget.profile,
          onUpdated: widget.onProfileUpdated,
        );
      case 2:
        return _ChangePasswordSection();
      case 3:
        return _PrivacySection();
      case 4:
        return _NotificationsSection();
      case 5:
        return _AboutSection();
      default:
        return _menuSection();
    }
  }

  Widget _menuSection() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        _sectionLabel(context.trw('account').toUpperCase()),
        _menuItem(
          'assets/icons/user-icon.svg',
          context.trw('edit_profile'),
          context.trw('update_personal_info'),
          () => setState(() => _section = 1),
        ),
        _menuItem(
          'assets/icons/shield-icon.svg',
          context.trw('change_password'),
          context.trw('update_account_password'),
          () => setState(() => _section = 2),
        ),
        _menuItem(
          'assets/icons/verified-icon.svg',
          context.trw('identity_verification'),
          context.trw('verify_identity'),
          () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const IdentityVerificationScreen(),
              ),
            );
          },
        ),
        _menuItem(
          'assets/icons/card-icon.svg',
          'Payments & Payouts',
          'Country, currency, mobile money & bank',
          () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const PayoutProfileScreen(),
              ),
            );
          },
        ),
        const SizedBox(height: 20),
        _sectionLabel(context.trw('preferences').toUpperCase()),
        const LanguageSettingsCard(),
        _menuItem(
          'assets/icons/bell-icon.svg',
          context.trw('notifications'),
          context.trw('manage_notifications'),
          () => setState(() => _section = 4),
        ),
        _menuItem(
          'assets/icons/shield-icon.svg',
          context.trw('privacy_security'),
          context.trw('control_privacy'),
          () => setState(() => _section = 3),
        ),
        const SizedBox(height: 20),
        _sectionLabel(context.trw('about').toUpperCase()),
        _menuItem(
          'assets/icons/info-icon.svg',
          context.trw('about_nuru'),
          context.trw('terms_and_licenses'),
          () => setState(() => _section = 5),
        ),
      ],
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 0, 10),
      child: Text(
        text,
        style: appText(
          size: 10,
          weight: FontWeight.w600,
          color: AppColors.textHint,
          height: 1.0,
        ),
      ),
    );
  }

  Widget _menuItem(
    String icon,
    String title,
    String subtitle,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight, width: 1),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: SvgPicture.asset(
                  icon,
                  width: 18,
                  height: 18,
                  colorFilter: const ColorFilter.mode(
                    AppColors.primary,
                    BlendMode.srcIn,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: appText(size: 14, weight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: appText(size: 11, color: AppColors.textTertiary),
                  ),
                ],
              ),
            ),
            SvgPicture.asset(
              'assets/icons/chevron-right-icon.svg',
              width: 18,
              height: 18,
              colorFilter: const ColorFilter.mode(
                AppColors.textHint,
                BlendMode.srcIn,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// EDIT PROFILE — Redesigned with hero avatar, segmented form cards
class _EditProfileSection extends StatefulWidget {
  final Map<String, dynamic>? profile;
  final VoidCallback? onUpdated;
  const _EditProfileSection({this.profile, this.onUpdated});

  @override
  State<_EditProfileSection> createState() => _EditProfileSectionState();
}

class _EditProfileSectionState extends State<_EditProfileSection> {
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _bioCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  bool _saving = false;
  bool _loadingProfile = true;
  String? _avatarPath;
  Map<String, dynamic> _loadedProfile = {};

  @override
  void initState() {
    super.initState();
    _hydrateProfile();
  }

  void _applyProfile(Map<String, dynamic> p) {
    _firstNameCtrl.text = p['first_name']?.toString() ?? '';
    _lastNameCtrl.text = p['last_name']?.toString() ?? '';
    _usernameCtrl.text = p['username']?.toString() ?? '';
    _phoneCtrl.text = p['phone']?.toString() ?? '';
    _bioCtrl.text = p['bio']?.toString() ?? '';
    _locationCtrl.text = p['location']?.toString() ?? '';
  }

  Future<void> _hydrateProfile() async {
    final initial = widget.profile;
    if (initial != null && initial.isNotEmpty) {
      _loadedProfile = Map<String, dynamic>.from(initial);
      _applyProfile(_loadedProfile);
    }

    final meRes = await AuthApi.me();
    Map<String, dynamic>? userData;
    if (meRes['success'] == true && meRes['data'] is Map<String, dynamic>) {
      userData = meRes['data'] as Map<String, dynamic>;
    } else if (meRes['data'] is Map<String, dynamic> &&
        meRes['data']['id'] != null) {
      userData = meRes['data'] as Map<String, dynamic>;
    }

    final profileRes = await EventsService.getProfile();
    if (profileRes['success'] == true &&
        profileRes['data'] is Map<String, dynamic>) {
      final profileData = profileRes['data'] as Map<String, dynamic>;
      userData = {...(userData ?? {}), ...profileData};
    }

    if (mounted && userData != null) {
      _loadedProfile = userData;
      _applyProfile(_loadedProfile);
    }
    setState(() => _loadingProfile = false);
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _usernameCtrl.dispose();
    _phoneCtrl.dispose();
    _bioCtrl.dispose();
    _locationCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        margin: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                context.tr('change_profile_photo'),
                style: appText(size: 16, weight: FontWeight.w700),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.camera_alt_rounded,
                    color: AppColors.primary,
                    size: 22,
                  ),
                ),
                title: Text(
                  context.tr('take_photo'),
                  style: appText(size: 14, weight: FontWeight.w600),
                ),
                subtitle: Text(
                  context.tr('use_camera'),
                  style: appText(size: 12, color: AppColors.textTertiary),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              const Divider(height: 1, indent: 72),
              ListTile(
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.photo_library_rounded,
                    color: Color(0xFF2E7D32),
                    size: 22,
                  ),
                ),
                title: Text(
                  context.tr('choose_from_gallery'),
                  style: appText(size: 14, weight: FontWeight.w600),
                ),
                subtitle: Text(
                  context.tr('pick_from_photos'),
                  style: appText(size: 12, color: AppColors.textTertiary),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: source,
      maxWidth: 1200,
      imageQuality: 90,
    );
    if (picked == null || !mounted) return;

    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      compressQuality: 85,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: context.tr('crop_profile_photo'),
          toolbarColor: const Color(0xFF1A1A2E),
          toolbarWidgetColor: Colors.white,
          activeControlsWidgetColor: AppColors.primary,
          backgroundColor: const Color(0xFF1A1A2E),
          dimmedLayerColor: Colors.black54,
          cropFrameColor: AppColors.primary,
          cropGridColor: Colors.white30,
          cropStyle: CropStyle.circle,
          lockAspectRatio: true,
          hideBottomControls: false,
          showCropGrid: true,
          initAspectRatio: CropAspectRatioPreset.square,
        ),
        IOSUiSettings(
          title: context.tr('crop_profile_photo'),
          cropStyle: CropStyle.circle,
          aspectRatioLockEnabled: true,
          resetAspectRatioEnabled: false,
          minimumAspectRatio: 1.0,
        ),
      ],
    );
    if (cropped != null && mounted) {
      setState(() => _avatarPath = cropped.path);
    }
  }

  bool _hasChanged(String field) {
    final original = _loadedProfile[field]?.toString() ?? '';
    switch (field) {
      case 'first_name':
        return _firstNameCtrl.text.trim() != original;
      case 'last_name':
        return _lastNameCtrl.text.trim() != original;
      case 'phone':
        return _phoneCtrl.text.trim() != original;
      case 'bio':
        return _bioCtrl.text.trim() != original;
      case 'location':
        return _locationCtrl.text.trim() != original;
      default:
        return false;
    }
  }

  Future<void> _save() async {
    final firstName = _firstNameCtrl.text.trim();
    final lastName = _lastNameCtrl.text.trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      AppSnackbar.error(context, context.tr('required_field'));
      return;
    }

    // Check if phone changed — phone requires separate verification
    final phoneChanged = _hasChanged('phone');
    final newPhone = _phoneCtrl.text.trim();

    if (phoneChanged && newPhone.isNotEmpty) {
      // Show confirmation that phone change requires verification
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Text(
            context.tr('verify_phone'),
            style: appText(size: 16, weight: FontWeight.w700),
          ),
          content: Text(
            'Changing your phone number to $newPhone will require verification via SMS or WhatsApp. Continue?',
            style: appText(size: 13, color: AppColors.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                context.tr('cancel'),
                style: appText(size: 13, color: AppColors.textTertiary),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(
                context.tr('continue_text'),
                style: appText(
                  size: 13,
                  weight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
      );
      if (confirm != true) return;
    }

    final nothingChanged =
        !_hasChanged('first_name') &&
        !_hasChanged('last_name') &&
        !_hasChanged('phone') &&
        !_hasChanged('bio') &&
        !_hasChanged('location') &&
        _avatarPath == null;
    if (nothingChanged) {
      if (mounted) AppSnackbar.info(context, context.tr('no_changes'));
      return;
    }

    setState(() => _saving = true);

    // Mirror web behaviour: always send the full set of editable fields so
    // backend validators receive a complete payload (mobile previously sent
    // only changed fields which triggered "validation failed" responses).
    final res = await EventsService.updateProfile(
      firstName: firstName,
      lastName: lastName,
      phone: phoneChanged ? newPhone : null,
      bio: _bioCtrl.text.trim(),
      location: _locationCtrl.text.trim(),
      avatarPath: _avatarPath,
    );

    setState(() => _saving = false);
    if (mounted) {
      if (res['success'] == true) {
        _avatarPath = null;
        // Update loaded profile with new data
        if (res['data'] is Map<String, dynamic>) {
          _loadedProfile = res['data'] as Map<String, dynamic>;
        }
        AppSnackbar.success(context, context.tr('profile_updated'));
        widget.onUpdated?.call();
      } else {
        final errors = res['data']?['errors'];
        if (errors is Map) {
          final msg =
              (errors.values.first is List
                      ? errors.values.first.first
                      : errors.values.first)
                  .toString();
          AppSnackbar.error(context, msg);
        } else {
          AppSnackbar.error(context, res['message'] ?? 'Failed to update');
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final avatar =
        (_loadedProfile['avatar'] ?? widget.profile?['avatar']) as String?;
    final username = _loadedProfile['username']?.toString() ?? '';
    final fullName =
        '${_loadedProfile['first_name'] ?? ''} ${_loadedProfile['last_name'] ?? ''}'
            .trim();
    final email = _loadedProfile['email']?.toString() ?? '';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_loadingProfile)
            const Padding(
              padding: EdgeInsets.only(bottom: 16),
              child: LinearProgressIndicator(
                minHeight: 3,
                color: AppColors.primary,
              ),
            ),

          // ─── Hero Avatar Card ───
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 28),
            margin: const EdgeInsets.only(bottom: 20, top: 8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1A1A2E), Color(0xFF16213E)],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                GestureDetector(
                  onTap: _pickAvatar,
                  child: Stack(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withOpacity(0.3),
                            width: 3,
                          ),
                        ),
                        child: ClipOval(
                          child: _avatarPath != null
                              ? Image.file(
                                  File(_avatarPath!),
                                  width: 100,
                                  height: 100,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => _fallback(),
                                )
                              : (avatar != null && avatar.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: avatar,
                                        width: 100,
                                        height: 100,
                                        fit: BoxFit.cover,
                                        placeholder: (_, __) => _fallback(),
                                        errorWidget: (_, __, ___) =>
                                            _fallback(),
                                      )
                                    : _fallback()),
                        ),
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: const Color(0xFF1A1A2E),
                              width: 3,
                            ),
                          ),
                          child: const Icon(
                            Icons.camera_alt_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (fullName.isNotEmpty)
                  Text(
                    fullName,
                    style: appText(
                      size: 18,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                if (username.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '@$username',
                      style: appText(size: 13, color: Colors.white70),
                    ),
                  ),
                if (email.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      email,
                      style: appText(size: 12, color: Colors.white54),
                    ),
                  ),
              ],
            ),
          ),

          // ─── Personal Info Card ───
          _formCard(context.tr('personal_info'), [
            _formRow(
              context.tr('first_name'),
              _firstNameCtrl,
              context.tr('your_first_name'),
              TextInputType.name,
            ),
            _formRow(
              context.tr('last_name'),
              _lastNameCtrl,
              context.tr('your_last_name'),
              TextInputType.name,
            ),
            _formRow(
              context.tr('username'),
              _usernameCtrl,
              context.tr('username'),
              TextInputType.text,
              enabled: false,
            ),
          ]),

          const SizedBox(height: 14),

          // ─── Contact Card ───
          _formCard(context.tr('contact_info'), [
            _formRow(
              context.tr('phone'),
              _phoneCtrl,
              '+255 XXX XXX XXX',
              TextInputType.phone,
            ),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 12,
                    color: AppColors.textHint,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      'Changing your phone number will require verification',
                      style: appText(size: 10, color: AppColors.textHint),
                    ),
                  ),
                ],
              ),
            ),
          ]),

          const SizedBox(height: 14),

          // ─── About Card ───
          _formCard(context.tr('about'), [
            _formRow(
              context.tr('bio'),
              _bioCtrl,
              context.tr('write_bio'),
              TextInputType.multiline,
              maxLines: 3,
            ),
            _formRow(
              context.tr('location'),
              _locationCtrl,
              context.tr('city_country'),
              TextInputType.text,
            ),
          ]),

          const SizedBox(height: 28),

          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.primary.withOpacity(0.6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : Text(
                      context.tr('save_changes'),
                      style: appText(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _formCard(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 16,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: appText(
                  size: 13,
                  weight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _formRow(
    String label,
    TextEditingController ctrl,
    String hint,
    TextInputType type, {
    int maxLines = 1,
    bool enabled = true,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: appText(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: ctrl,
            keyboardType: type,
            maxLines: maxLines,
            enabled: enabled,
            style: appText(size: 14, weight: FontWeight.w500),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: appText(size: 13, color: AppColors.textHint),
              filled: true,
              fillColor: enabled
                  ? const Color(0xFFF5F7FA)
                  : const Color(0xFFEEEEEE),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.borderLight),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.borderLight),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: AppColors.primary,
                  width: 1.5,
                ),
              ),
              disabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.borderLight),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fallback() => Container(
    width: 100,
    height: 100,
    color: const Color(0xFF2A2A4A),
    child: const Center(
      child: Icon(Icons.person_rounded, size: 40, color: Colors.white38),
    ),
  );
}

class _ChangePasswordSection extends StatefulWidget {
  @override
  State<_ChangePasswordSection> createState() => _ChangePasswordSectionState();
}

class _ChangePasswordSectionState extends State<_ChangePasswordSection> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _saving = false;
  bool _showCurrent = false;
  bool _showNew = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _change() async {
    if (_newCtrl.text != _confirmCtrl.text) {
      AppSnackbar.error(context, context.tr('passwords_dont_match'));
      return;
    }
    if (_newCtrl.text.length < 8) {
      AppSnackbar.error(context, context.tr('min_8_chars'));
      return;
    }
    setState(() => _saving = true);
    final res = await EventsService.changePassword(
      _currentCtrl.text,
      _newCtrl.text,
      _confirmCtrl.text,
    );
    setState(() => _saving = false);
    if (mounted) {
      if (res['success'] == true) {
        AppSnackbar.success(context, context.tr('password_changed'));
        _currentCtrl.clear();
        _newCtrl.clear();
        _confirmCtrl.clear();
      } else {
        AppSnackbar.error(
          context,
          res['message'] ?? 'Failed to change password',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.info_outline_rounded,
                  size: 18,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    context.tr('password_hint'),
                    style: appText(size: 12, color: AppColors.primary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          _passwordField(
            _currentCtrl,
            context.tr('current_password'),
            context.tr('enter_current_password'),
            _showCurrent,
            (v) => setState(() => _showCurrent = v),
          ),
          const SizedBox(height: 16),
          _passwordField(
            _newCtrl,
            context.tr('new_password'),
            context.tr('enter_new_password'),
            _showNew,
            (v) => setState(() => _showNew = v),
          ),
          const SizedBox(height: 16),
          AuthTextField(
            controller: _confirmCtrl,
            label: context.tr('confirm_password'),
            hintText: context.tr('confirm_new_password'),
            obscureText: true,
          ),
          const SizedBox(height: 28),

          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _saving ? null : _change,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Text(
                      context.tr('change_password'),
                      style: appText(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _passwordField(
    TextEditingController ctrl,
    String label,
    String hint,
    bool show,
    ValueChanged<bool> toggle,
  ) {
    return AuthTextField(
      controller: ctrl,
      label: label,
      hintText: hint,
      obscureText: !show,
      suffixIcon: GestureDetector(
        onTap: () => toggle(!show),
        child: Icon(
          show ? Icons.visibility_off_rounded : Icons.visibility_rounded,
          size: 20,
          color: AppColors.textHint,
        ),
      ),
    );
  }
}

// PRIVACY & SECURITY
class _PrivacySection extends StatefulWidget {
  @override
  State<_PrivacySection> createState() => _PrivacySectionState();
}

class _PrivacySectionState extends State<_PrivacySection> {
  bool _loading = true;
  bool _updating = false;
  bool _privateProfile = false;
  bool _showOnlineStatus = true;
  bool _showLastSeen = true;
  bool _showReadReceipts = true;
  bool _twoFactorEnabled = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await ApiService.get('/settings');
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true && res['data'] is Map) {
          final data = res['data'] as Map<String, dynamic>;
          final privacy = data['privacy'] as Map<String, dynamic>? ?? {};
          final security = data['security'] as Map<String, dynamic>? ?? {};
          _privateProfile =
              privacy['private_profile'] == true ||
              (data['private_profile'] == true);
          _showOnlineStatus = privacy['show_online_status'] ?? true;
          _showLastSeen = privacy['show_last_seen'] ?? true;
          _showReadReceipts = privacy['show_read_receipts'] ?? true;
          _twoFactorEnabled = security['two_factor_enabled'] ?? false;
        }
      });
    }
  }

  Future<void> _updatePrivacy(String field, bool value) async {
    setState(() => _updating = true);
    try {
      final token = await SecureTokenStorage.getToken();
      await http.put(
        Uri.parse('${ApiService.baseUrl}/settings/privacy'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({field: value}),
      );
    } catch (_) {}
    if (mounted) {
      setState(() => _updating = false);
      AppSnackbar.success(context, context.tr('settings_updated'));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        _toggleItem(
          context.tr('private_profile'),
          context.tr('private_profile_desc'),
          _privateProfile,
          (v) {
            setState(() => _privateProfile = v);
            _updatePrivacy('private_profile', v);
          },
        ),
        _toggleItem(
          context.tr('show_online_status'),
          context.tr('show_online_status_desc'),
          _showOnlineStatus,
          (v) {
            setState(() => _showOnlineStatus = v);
            _updatePrivacy('show_online_status', v);
          },
        ),
        _toggleItem(
          context.tr('show_last_seen'),
          context.tr('show_last_seen_desc'),
          _showLastSeen,
          (v) {
            setState(() => _showLastSeen = v);
            _updatePrivacy('show_last_seen', v);
          },
        ),
        _toggleItem(
          context.tr('read_receipts'),
          context.tr('read_receipts_desc'),
          _showReadReceipts,
          (v) {
            setState(() => _showReadReceipts = v);
            _updatePrivacy('show_read_receipts', v);
          },
        ),
        const SizedBox(height: 20),
        _infoRow(
          context.tr('two_factor_auth'),
          _twoFactorEnabled ? context.tr('enabled') : context.tr('disabled'),
        ),
      ],
    );
  }

  Widget _toggleItem(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: appText(size: 14, weight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: appText(size: 11, color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: _updating ? null : onChanged,
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String title, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: appText(size: 14, weight: FontWeight.w600),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: value == 'Enabled'
                  ? AppColors.successSoft
                  : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              value,
              style: appText(
                size: 12,
                weight: FontWeight.w600,
                color: value == 'Enabled'
                    ? AppColors.success
                    : AppColors.textTertiary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationsSection extends StatefulWidget {
  @override
  State<_NotificationsSection> createState() => _NotificationsSectionState();
}

class _NotificationsSectionState extends State<_NotificationsSection> {
  bool _loading = true;
  bool _updating = false;
  bool _emailNotifications = true;
  bool _pushNotifications = true;
  bool _smsNotifications = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await ApiService.get('/settings');
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true && res['data'] is Map) {
          final data = res['data'] as Map<String, dynamic>;
          final notif = data['notifications'] as Map<String, dynamic>? ?? {};
          _emailNotifications = notif['email_notifications'] ?? true;
          _pushNotifications = notif['push_notifications'] ?? true;
          _smsNotifications = notif['sms_notifications'] ?? false;
        }
      });
    }
  }

  Future<void> _updateNotification(String field, bool value) async {
    setState(() => _updating = true);
    try {
      final token = await SecureTokenStorage.getToken();
      await http.put(
        Uri.parse('${ApiService.baseUrl}/settings/notifications'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({field: value}),
      );
    } catch (_) {}
    if (mounted) {
      setState(() => _updating = false);
      AppSnackbar.success(context, context.tr('settings_updated'));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        _toggleItem(
          context.tr('email_notifications'),
          context.tr('email_notifications_desc'),
          _emailNotifications,
          (v) {
            setState(() => _emailNotifications = v);
            _updateNotification('email_notifications', v);
          },
        ),
        _toggleItem(
          context.tr('push_notifications'),
          context.tr('push_notifications_desc'),
          _pushNotifications,
          (v) {
            setState(() => _pushNotifications = v);
            _updateNotification('push_notifications', v);
          },
        ),
        _toggleItem(
          context.tr('sms_notifications'),
          context.tr('sms_notifications_desc'),
          _smsNotifications,
          (v) {
            setState(() => _smsNotifications = v);
            _updateNotification('sms_notifications', v);
          },
        ),
      ],
    );
  }

  Widget _toggleItem(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: appText(size: 14, weight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: appText(size: 11, color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: _updating ? null : onChanged,
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

// ABOUT NURU — with clickable links to Terms, Privacy, Licenses
class _AboutSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        Center(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Image.asset(
              'assets/images/nuru-logo-square.png',
              width: 80,
              height: 80,
              errorBuilder: (_, __, ___) => Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Center(
                  child: Text(
                    'N',
                    style: appText(
                      size: 32,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            'Nuru',
            style: appText(size: 22, weight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 4),
        Center(
          child: Text(
            '${context.tr('version')} 1.0.0',
            style: appText(size: 13, color: AppColors.textTertiary),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            'Nuru helps you organize events with clarity. Contributions, guests, vendors, and planning in one trusted place.',
            style: appText(
              size: 12,
              color: AppColors.textSecondary,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 24),
        _aboutItem(context, context.tr('terms_of_service'), () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const TermsScreen()),
          );
        }),
        _aboutItem(context, context.tr('privacy_policy'), () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
          );
        }),
        _aboutItem(context, context.tr('open_source_licenses'), () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const LicensesScreen()),
          );
        }),
        const SizedBox(height: 24),
        Center(
          child: Text(
            '© ${DateTime.now().year} Nuru. All rights reserved.',
            style: appText(size: 11, color: AppColors.textHint),
          ),
        ),
      ],
    );
  }

  Widget _aboutItem(BuildContext context, String title, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: appText(size: 14, weight: FontWeight.w600),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.textHint,
            ),
          ],
        ),
      ),
    );
  }
}
