import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/country_phone_input.dart';
import '../../core/widgets/otp_input.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';

import 'widgets/auth_text_field.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  String _step = 'choose';
  bool _loading = false;

  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  final _confirmPwCtrl = TextEditingController();

  String _fullPhone = '';
  String? _otpChannel;
  String? _resetToken;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  final _otpCtrls = List.generate(6, (_) => TextEditingController());
  final _otpNodes = List.generate(6, (_) => FocusNode());

  AuthProvider get _auth => context.read<AuthProvider>();
  String get _otpValue => _otpCtrls.map((c) => c.text).join();

  @override
  void dispose() {
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmPwCtrl.dispose();
    for (final c in _otpCtrls) c.dispose();
    for (final n in _otpNodes) n.dispose();
    super.dispose();
  }

  Future<void> _handleEmailReset() async {
    if (_emailCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Enter your email');
      return;
    }
    setState(() => _loading = true);
    final res = await _auth.forgotPassword(_emailCtrl.text.trim());
    setState(() => _loading = false);
    if (res['success'] == true) {
      if (mounted) {
        AppSnackbar.success(context, res['message'] ?? 'Reset link sent!');
        Navigator.pop(context);
      }
    } else {
      if (mounted) AppSnackbar.error(context, res['message'] ?? 'Failed');
    }
  }

  Future<void> _handlePhoneReset() async {
    final cleaned = _fullPhone.replaceAll(RegExp(r'[^\d]'), '');
    if (cleaned.length < 7) {
      AppSnackbar.error(context, 'Enter your phone');
      return;
    }
    setState(() => _loading = true);

    // Only use backend flow (it handles WhatsApp/SMS routing internally)
    final backendRes = await _auth.forgotPasswordPhone(cleaned);

    setState(() => _loading = false);

    if (backendRes['success'] == true) {
      final msg = (backendRes['message'] ?? '').toString().toLowerCase();
      setState(() {
        if (msg.contains('whatsapp')) {
          _otpChannel = 'whatsapp';
        } else if (msg.contains('sms')) {
          _otpChannel = 'sms';
        } else {
          _otpChannel = 'sms';
        }
        _step = 'otp';
      });
      if (mounted)
        AppSnackbar.success(context, backendRes['message'] ?? 'Code sent');
    } else {
      if (mounted)
        AppSnackbar.error(context, backendRes['message'] ?? 'Failed');
    }
  }

  Future<void> _handleVerifyOtp() async {
    final otp = _otpValue;
    if (otp.length < 6) {
      AppSnackbar.error(context, 'Enter the 6-digit code');
      return;
    }
    setState(() => _loading = true);
    final cleaned = _fullPhone.replaceAll(RegExp(r'[^\d]'), '');

    // Only use backend verification (matches the backend-sent OTP)
    final res = await _auth.verifyResetOtp(cleaned, otp);
    setState(() => _loading = false);

    if (res['success'] == true && res['data']?['reset_token'] != null) {
      _resetToken = res['data']['reset_token'];
      setState(() => _step = 'reset');
    } else {
      if (mounted)
        AppSnackbar.error(context, res['message'] ?? 'Verification failed');
    }
  }

  Future<void> _handleResetPassword() async {
    if (_newPwCtrl.text.length < 8) {
      AppSnackbar.error(context, 'Min 8 characters');
      return;
    }
    if (_newPwCtrl.text != _confirmPwCtrl.text) {
      AppSnackbar.error(context, 'Passwords don\'t match');
      return;
    }
    setState(() => _loading = true);
    final res = await _auth.resetPassword(
      _resetToken!,
      _newPwCtrl.text,
      _confirmPwCtrl.text,
    );
    setState(() => _loading = false);
    if (res['success'] == true) {
      if (mounted) {
        AppSnackbar.success(context, 'Password reset! Please sign in.');
        Navigator.pop(context);
      }
    } else {
      if (mounted) AppSnackbar.error(context, res['message'] ?? 'Reset failed');
    }
  }

  void _goBack() {
    if (_step == 'otp')
      setState(() => _step = 'phone');
    else if (_step == 'reset')
      setState(() => _step = 'otp');
    else if (_step != 'choose')
      setState(() => _step = 'choose');
    else
      Navigator.pop(context);
  }

  String get _title {
    switch (_step) {
      case 'email':
        return 'Reset via email';
      case 'phone':
        return 'Reset via phone';
      case 'otp':
        return 'Enter code';
      case 'reset':
        return 'New password';
      default:
        return 'Reset password';
    }
  }

  String get _subtitle {
    switch (_step) {
      case 'email':
        return 'Enter your email to receive reset instructions';
      case 'phone':
        return 'Enter your phone to receive a reset code';
      case 'otp':
        return 'We sent a 6-digit code to ${maskPhoneDisplay(_fullPhone)}';
      case 'reset':
        return 'Choose a new secure password';
      default:
        return 'Choose how to recover your account';
    }
  }

  IconData get _icon {
    switch (_step) {
      case 'email':
        return Icons.email_outlined;
      case 'phone':
        return Icons.phone_android_rounded;
      case 'otp':
        return Icons.verified_rounded;
      case 'reset':
        return Icons.shield_rounded;
      default:
        return Icons.lock_reset_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: const Color(0xFFE8EEF5),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: _goBack,
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border.withOpacity(0.4), width: 0.7),
                        ),
                        child: const Icon(Icons.chevron_left_rounded, size: 20, color: AppColors.textPrimary),
                      ),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.only(
                    left: 24,
                    right: 24,
                    bottom: bottomInset > 0 ? 24 : 40,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _title,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.5,
                              height: 1.15,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _subtitle,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              color: AppColors.textTertiary,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 28),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 250),
                        child: _buildCurrentStep(),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_step) {
      case 'choose':
        return _chooseStep();
      case 'email':
        return _emailStep();
      case 'phone':
        return _phoneStep();
      case 'otp':
        return _otpStep();
      case 'reset':
        return _resetStep();
      default:
        return _chooseStep();
    }
  }

  Widget _chooseStep() {
    return Column(
      key: const ValueKey('choose'),
      children: [
        _optionCard(
          Icons.email_outlined,
          'Reset via email',
          'We\'ll send a reset link',
          () => setState(() => _step = 'email'),
        ),
        const SizedBox(height: 12),
        _optionCard(
          Icons.phone_android_rounded,
          'Reset via phone',
          'We\'ll send an OTP code',
          () => setState(() => _step = 'phone'),
        ),
      ],
    );
  }

  Widget _optionCard(
    IconData icon,
    String label,
    String desc,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border.withOpacity(0.5), width: 0.7),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 16, offset: const Offset(0, 4)),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFF2F5F8),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: AppColors.textSecondary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(desc, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  Widget _emailStep() {
    return Column(
      key: const ValueKey('email'),
      children: [
        AuthTextField(
          controller: _emailCtrl,
          label: 'Email address',
          hintText: 'your.email@example.com',
          prefixIcon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          autofocus: true,
        ),
        const SizedBox(height: 28),
        _ctaBtn(
          label: 'Send reset link',
          onPressed: _loading ? null : _handleEmailReset,
          isLoading: _loading,
        ),
      ],
    );
  }

  Widget _phoneStep() {
    return Column(
      key: const ValueKey('phone'),
      children: [
        CountryPhoneInput(
          controller: _phoneCtrl,
          initialCountryCode: 'TZ',
          onFullNumberChanged: (f) => _fullPhone = f,
        ),
        const SizedBox(height: 28),
        _ctaBtn(
          label: 'Send reset code',
          onPressed: _loading ? null : _handlePhoneReset,
          isLoading: _loading,
        ),
      ],
    );
  }

  Widget _otpStep() {
    return Column(
      key: const ValueKey('otp'),
      children: [
        if (_otpChannel != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: _otpChannel == 'whatsapp'
                  ? const Color(0x1225D366)
                  : AppColors.infoSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  _otpChannel == 'whatsapp'
                      ? Icons.message_rounded
                      : Icons.sms_outlined,
                  size: 16,
                  color: _otpChannel == 'whatsapp'
                      ? const Color(0xFF25D366)
                      : AppColors.info,
                ),
                const SizedBox(width: 8),
                Text(
                  _otpChannel == 'whatsapp' ? 'Check WhatsApp' : 'Check SMS',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _otpChannel == 'whatsapp'
                        ? const Color(0xFF25D366)
                        : AppColors.info,
                  ),
                ),
              ],
            ),
          ),
        OtpInput(
          controllers: _otpCtrls,
          focusNodes: _otpNodes,
          onCompleted: (_) => _handleVerifyOtp(),
        ),
        const SizedBox(height: 28),
        _ctaBtn(
          label: 'Verify & continue',
          onPressed: _loading ? null : _handleVerifyOtp,
          isLoading: _loading,
        ),
        const SizedBox(height: 16),
        Center(
          child: GestureDetector(
            onTap: _loading ? null : _handlePhoneReset,
            child: Text(
              "Didn't get a code? Resend",
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _resetStep() {
    return Column(
      key: const ValueKey('reset'),
      children: [
        AuthTextField(
          controller: _newPwCtrl,
          label: 'New Password',
          hintText: 'Create a new password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscureNew,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureNew
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              color: AppColors.textHint,
              size: 20,
            ),
            onPressed: () => setState(() => _obscureNew = !_obscureNew),
          ),
        ),
        const SizedBox(height: 18),
        AuthTextField(
          controller: _confirmPwCtrl,
          label: 'Confirm Password',
          hintText: 'Re-enter your password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscureConfirm,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureConfirm
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              color: AppColors.textHint,
              size: 20,
            ),
            onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
          ),
        ),
        const SizedBox(height: 28),
        _ctaBtn(
          label: 'Reset Password',
          onPressed: _loading ? null : _handleResetPassword,
          isLoading: _loading,
        ),
      ],
    );
  }

  Widget _ctaBtn({required String label, VoidCallback? onPressed, bool isLoading = false}) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        ),
        child: isLoading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
      ),
    );
  }
}
