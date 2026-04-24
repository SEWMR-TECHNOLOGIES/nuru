import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_logo.dart';
import '../../core/widgets/nuru_loader.dart';
import '../../core/widgets/country_phone_input.dart';
import '../../core/widgets/otp_input.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/language_selector.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../providers/auth_provider.dart';
import '../../core/services/otp_service.dart';
import '../home/home_screen.dart';
import 'widgets/auth_text_field.dart';

TextStyle _f({
  required double size,
  FontWeight weight = FontWeight.w500,
  Color color = AppColors.textPrimary,
  double height = 1.2,
  double letterSpacing = 0,
}) =>
    GoogleFonts.plusJakartaSans(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );

final _pwRules = [
  _R('At least 8 characters', (p) => p.length >= 8),
  _R('One uppercase letter', (p) => RegExp(r'[A-Z]').hasMatch(p)),
  _R('One lowercase letter', (p) => RegExp(r'[a-z]').hasMatch(p)),
  _R('One number', (p) => RegExp(r'\d').hasMatch(p)),
  _R(
    'One special character',
    (p) => RegExp(r'[!@#\$%\^&\*\(\),\.?":{}|<>_\-\+=\[\]\\\/~`]').hasMatch(p),
  ),
];

class _R {
  final String label;
  final bool Function(String) test;
  _R(this.label, this.test);
}

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  double _step = 1;
  bool _submitting = false;

  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPwCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  bool _obscurePw = true;
  bool _obscureConfirm = true;

  bool _firstNameValid = false;
  bool _lastNameValid = false;
  String? _firstNameError;
  String? _lastNameError;

  String _usernameStatus = 'idle';
  List<String> _usernameSuggestions = [];
  Timer? _usernameTimer;

  String? _userId;
  String? _otpChannel;
  bool _resendLoading = false;
  String _fullPhone = '';

  final _otpCtrls = List.generate(6, (_) => TextEditingController());
  final _otpNodes = List.generate(6, (_) => FocusNode());

  @override
  void initState() {
    super.initState();
    _usernameCtrl.addListener(() => _checkUsername(_usernameCtrl.text));
    _passwordCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPwCtrl.dispose();
    _phoneCtrl.dispose();
    _usernameTimer?.cancel();
    for (final c in _otpCtrls) c.dispose();
    for (final n in _otpNodes) n.dispose();
    super.dispose();
  }

  AuthProvider get _auth => context.read<AuthProvider>();
  String get _otpValue => _otpCtrls.map((c) => c.text).join();
  bool get _allPwPassed => _pwRules.every((r) => r.test(_passwordCtrl.text));

  Future<void> _validateName(bool isFirst) async {
    final name = isFirst ? _firstNameCtrl.text.trim() : _lastNameCtrl.text.trim();
    if (name.length < 2) return;
    try {
      final res = await _auth.validateName(name);
      if (!mounted) return;
      final data = res['data'];
      if (data is Map && data['valid'] == false) {
        setState(() {
          if (isFirst) { _firstNameError = data['reason'] ?? 'Use your real name'; _firstNameValid = false; }
          else { _lastNameError = data['reason'] ?? 'Use your real name'; _lastNameValid = false; }
        });
      } else {
        setState(() {
          if (isFirst) { _firstNameError = null; _firstNameValid = true; }
          else { _lastNameError = null; _lastNameValid = true; }
        });
      }
    } catch (_) {
      setState(() {
        if (isFirst) { _firstNameError = null; _firstNameValid = true; }
        else { _lastNameError = null; _lastNameValid = true; }
      });
    }
  }

  void _checkUsername(String val) {
    _usernameTimer?.cancel();
    if (val.trim().length < 3) {
      setState(() { _usernameStatus = 'idle'; _usernameSuggestions = []; });
      return;
    }
    setState(() => _usernameStatus = 'checking');
    _usernameTimer = Timer(const Duration(milliseconds: 500), () async {
      try {
        final res = await _auth.checkUsername(val.trim(), firstName: _firstNameCtrl.text.trim(), lastName: _lastNameCtrl.text.trim());
        if (!mounted) return;
        final data = res['data'];
        if (data is Map) {
          if (data['available'] == true) {
            setState(() { _usernameStatus = 'available'; _usernameSuggestions = []; });
          } else {
            setState(() {
              _usernameStatus = 'taken';
              _usernameSuggestions = data['suggestions'] is List ? (data['suggestions'] as List).cast<String>() : [];
            });
          }
        }
      } catch (_) {
        if (mounted) setState(() => _usernameStatus = 'idle');
      }
    });
  }

  Future<void> _handleNext() async {
    if (_step == 1) {
      if (_firstNameCtrl.text.trim().isEmpty || _lastNameCtrl.text.trim().isEmpty) {
        AppSnackbar.error(context, 'Please enter your first and last name');
        return;
      }
      if (_firstNameError != null || _lastNameError != null) {
        AppSnackbar.error(context, 'Please fix the name errors');
        return;
      }
      setState(() => _step = 2);
    } else if (_step == 2) {
      if (_usernameCtrl.text.trim().length < 3) {
        AppSnackbar.error(context, 'Username must be at least 3 characters');
        return;
      }
      if (_usernameStatus == 'taken') {
        AppSnackbar.error(context, 'Username is taken');
        return;
      }
      setState(() => _step = 3);
    } else if (_step == 3) {
      if (!_allPwPassed) {
        AppSnackbar.error(context, 'Meet all password requirements');
        return;
      }
      if (_passwordCtrl.text != _confirmPwCtrl.text) {
        AppSnackbar.error(context, 'Passwords don\'t match');
        return;
      }
      setState(() => _step = 4);
    } else if (_step == 4) {
      final cleaned = _fullPhone.replaceAll(RegExp(r'[^\d]'), '');
      if (cleaned.length < 7 || cleaned.length > 15) {
        AppSnackbar.error(context, 'Enter a valid phone number');
        return;
      }
      setState(() => _submitting = true);
      final res = await _auth.signUp(
        firstName: _firstNameCtrl.text.trim(),
        lastName: _lastNameCtrl.text.trim(),
        username: _usernameCtrl.text.trim(),
        phone: cleaned,
        password: _passwordCtrl.text,
      );
      setState(() => _submitting = false);
      if (res['success'] != true) {
        if (mounted) AppSnackbar.error(context, res['message'] ?? 'Signup failed');
        return;
      }
      _userId = res['data']?['id']?.toString();
      if (_userId == null) {
        if (mounted) AppSnackbar.error(context, 'No user ID returned');
        return;
      }
      if (mounted) AppSnackbar.success(context, 'Account created! Verify your phone.');
      await _resendOtp();
      setState(() => _step = 4.5);
    }
  }

  Future<void> _resendOtp() async {
    if (_userId == null) return;
    setState(() => _resendLoading = true);
    final cleaned = _fullPhone.replaceAll(RegExp(r'[^\d]'), '');
    final otpRes = await OtpService.requestOtp(phone: cleaned, userId: _userId, purpose: 'phone_verification');
    if (mounted) {
      final channels = (otpRes['channels'] as List?)?.cast<String>() ?? [];
      setState(() {
        if (channels.contains('whatsapp') && channels.contains('sms')) _otpChannel = 'both';
        else if (channels.contains('whatsapp')) _otpChannel = 'whatsapp';
        else _otpChannel = 'sms';
        _resendLoading = false;
      });
      if (otpRes['success'] == true) {
        AppSnackbar.success(context, otpRes['message'] ?? 'Verification code sent');
      } else {
        final backendRes = await _auth.requestOtp(userId: _userId!, verificationType: 'phone');
        if (backendRes['success'] == true) {
          setState(() => _otpChannel = 'sms');
          AppSnackbar.success(context, backendRes['message'] ?? 'Code sent via SMS');
        } else {
          AppSnackbar.error(context, 'Failed to send verification code');
        }
      }
    }
  }

  Future<void> _verify() async {
    final otp = _otpValue;
    if (otp.length < 6) {
      AppSnackbar.error(context, 'Enter the 6-digit code');
      return;
    }
    setState(() => _submitting = true);
    final cleaned = _fullPhone.replaceAll(RegExp(r'[^\d]'), '');
    final edgeRes = await OtpService.verifyOtp(phone: cleaned, code: otp, purpose: 'phone_verification');
    if (edgeRes['success'] == true) {
      try { await _auth.verifyOtp(userId: _userId!, verificationType: 'phone', otpCode: otp); } catch (_) {}
      await _auth.autoSignInAfterVerification(phone: cleaned, password: _passwordCtrl.text);
      setState(() { _submitting = false; _step = 5; });
      return;
    }
    final backendRes = await _auth.verifyOtp(userId: _userId!, verificationType: 'phone', otpCode: otp);
    if (backendRes['success'] == true) {
      await _auth.autoSignInAfterVerification(phone: cleaned, password: _passwordCtrl.text);
      setState(() { _submitting = false; _step = 5; });
      return;
    }
    setState(() => _submitting = false);
    if (mounted) AppSnackbar.error(context, backendRes['message'] ?? edgeRes['message'] ?? 'Verification failed');
  }

  void _goBack() {
    if (_step == 4.5) setState(() => _step = 4);
    else if (_step > 1) setState(() => _step = _step - 1);
    else Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final progress = (_step.ceil() / 4).clamp(0.0, 1.0);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: const Color(0xFFE8EEF5),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, box) {
              final hp = box.maxWidth < 360 ? 20.0 : 24.0;

              return Column(
                children: [
                  // ── Top bar ──
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: hp, vertical: 8),
                    child: Row(
                      children: [
                        if (_step < 5)
                          GestureDetector(
                            onTap: _goBack,
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.7),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.border.withOpacity(0.4), width: 0.7),
                              ),
                              child: const Icon(Icons.chevron_left_rounded, size: 22, color: AppColors.textPrimary),
                            ),
                          ),
                        const Spacer(),
                        const NuruLogo(size: 18),
                        const Spacer(),
                        if (_step < 5)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.7),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.border.withOpacity(0.4), width: 0.7),
                            ),
                            child: Text(
                              '${_step.ceil().clamp(1, 4)} / 4',
                              style: _f(size: 11, weight: FontWeight.w700, color: AppColors.textSecondary),
                            ),
                          )
                        else
                          const SizedBox(width: 40),
                      ],
                    ),
                  ),

                  // ── Progress bar ──
                  if (_step < 5)
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: hp),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: progress),
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOutCubic,
                          builder: (_, val, __) => LinearProgressIndicator(
                            value: val,
                            minHeight: 3,
                            backgroundColor: Colors.white.withOpacity(0.5),
                            valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                          ),
                        ),
                      ),
                    ),

                  // ── Content ──
                  Expanded(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.only(
                        left: hp,
                        right: hp,
                        top: 20,
                        bottom: bottomInset > 0 ? 24 : 14,
                      ),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 250),
                        switchInCurve: Curves.easeOut,
                        switchOutCurve: Curves.easeIn,
                        child: _buildStep(),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 1: return _nameStep();
      case 2: return _usernameStep();
      case 3: return _passwordStep();
      case 4: return _phoneStep();
      case 4.5: return _otpStep();
      case 5: return _welcomeStep();
      default: return _nameStep();
    }
  }

  // ─── Step 1: Name ───
  Widget _nameStep() {
    return Column(
      key: const ValueKey('s1'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader("What's your name?", "Let's start with the basics"),
        const SizedBox(height: 24),
        _card(
          child: Column(
            children: [
              AuthTextField(
                controller: _firstNameCtrl,
                label: 'First Name',
                hintText: 'Your first name',
                prefixIcon: Icons.person_outline_rounded,
                autofocus: true,
                onChanged: (_) => _validateName(true),
              ),
              if (_firstNameError != null) _errorLabel(_firstNameError!),
              if (_firstNameValid) _successLabel('Looks good'),
              const SizedBox(height: 16),
              AuthTextField(
                controller: _lastNameCtrl,
                label: 'Last Name',
                hintText: 'Your last name',
                prefixIcon: Icons.person_outline_rounded,
                onChanged: (_) => _validateName(false),
              ),
              if (_lastNameError != null) _errorLabel(_lastNameError!),
              if (_lastNameValid) _successLabel('Looks good'),
              const SizedBox(height: 24),
              _ctaButton('Continue', _handleNext),
            ],
          ),
        ),
        _loginLink(),
      ],
    );
  }

  // ─── Step 2: Username ───
  Widget _usernameStep() {
    return Column(
      key: const ValueKey('s2'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('Choose a username', 'This is how others will find you'),
        const SizedBox(height: 24),
        _card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AuthTextField(
                controller: _usernameCtrl,
                label: 'Username',
                hintText: 'your_username',
                prefixIcon: Icons.alternate_email_rounded,
                autofocus: true,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9_.]')),
                ],
              ),
              const SizedBox(height: 10),
              if (_usernameStatus == 'checking')
                _statusChip(Icons.sync_rounded, 'Checking...', AppColors.textTertiary, Colors.white.withOpacity(0.5)),
              if (_usernameStatus == 'available')
                _statusChip(Icons.check_circle_rounded, 'Available', AppColors.success, AppColors.successSoft),
              if (_usernameStatus == 'taken') ...[
                _statusChip(Icons.cancel_rounded, 'Taken', AppColors.error, AppColors.errorSoft),
                if (_usernameSuggestions.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text('Try one of these:', style: _f(size: 12, color: AppColors.textTertiary)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _usernameSuggestions.take(4).map((s) => GestureDetector(
                      onTap: () { _usernameCtrl.text = s; _checkUsername(s); },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.primary.withOpacity(0.15)),
                        ),
                        child: Text(s, style: _f(size: 13, color: AppColors.primary, weight: FontWeight.w600)),
                      ),
                    )).toList(),
                  ),
                ],
              ],
              const SizedBox(height: 24),
              _ctaButton('Continue', _handleNext),
            ],
          ),
        ),
        _loginLink(),
      ],
    );
  }

  // ─── Step 3: Password ───
  Widget _passwordStep() {
    return Column(
      key: const ValueKey('s3'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('Secure your account', 'Create a strong password'),
        const SizedBox(height: 24),
        _card(
          child: Column(
            children: [
              AuthTextField(
                controller: _passwordCtrl,
                label: 'Password',
                hintText: 'Create a password',
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: _obscurePw,
                autofocus: true,
                suffixIcon: IconButton(
                  icon: Icon(_obscurePw ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.textHint, size: 20),
                  onPressed: () => setState(() => _obscurePw = !_obscurePw),
                ),
              ),
              const SizedBox(height: 14),
              // Password rules
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF2F5F8),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  children: _pwRules.map((r) {
                    final passed = r.test(_passwordCtrl.text);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 18, height: 18,
                            decoration: BoxDecoration(
                              color: passed ? AppColors.success : Colors.transparent,
                              borderRadius: BorderRadius.circular(9),
                              border: Border.all(color: passed ? AppColors.success : AppColors.border, width: 1.5),
                            ),
                            child: passed ? const Icon(Icons.check, size: 11, color: Colors.white) : null,
                          ),
                          const SizedBox(width: 10),
                          Text(r.label, style: _f(size: 12.5, color: passed ? AppColors.success : AppColors.textTertiary, weight: passed ? FontWeight.w600 : FontWeight.w400)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),
              AuthTextField(
                controller: _confirmPwCtrl,
                label: 'Confirm Password',
                hintText: 'Re-enter your password',
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: _obscureConfirm,
                suffixIcon: IconButton(
                  icon: Icon(_obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.textHint, size: 20),
                  onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                ),
              ),
              const SizedBox(height: 24),
              _ctaButton('Continue', _handleNext),
            ],
          ),
        ),
        _loginLink(),
      ],
    );
  }

  // ─── Step 4: Phone ───
  Widget _phoneStep() {
    return Column(
      key: const ValueKey('s4'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('Verify your phone', "We'll send you a verification code"),
        const SizedBox(height: 24),
        _card(
          child: Column(
            children: [
              CountryPhoneInput(
                controller: _phoneCtrl,
                initialCountryCode: 'TZ',
                onFullNumberChanged: (full) => _fullPhone = full,
              ),
              const SizedBox(height: 24),
              _ctaButton('Create Account', _submitting ? null : _handleNext, isLoading: _submitting),
            ],
          ),
        ),
        _loginLink(),
      ],
    );
  }

  // ─── Step 4.5: OTP ───
  Widget _otpStep() {
    return Column(
      key: const ValueKey('s4_5'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepHeader('Enter verification code', 'A 6-digit code was sent to ${maskPhoneDisplay(_fullPhone)}'),
        const SizedBox(height: 24),
        _card(
          child: Column(
            children: [
              if (_otpChannel != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: _otpChannel == 'both' ? AppColors.primarySoft
                        : _otpChannel == 'whatsapp' ? const Color(0x1225D366) : AppColors.infoSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _otpChannel == 'both' ? Icons.verified_rounded
                            : _otpChannel == 'whatsapp' ? Icons.message_rounded : Icons.sms_outlined,
                        size: 16,
                        color: _otpChannel == 'both' ? AppColors.primary
                            : _otpChannel == 'whatsapp' ? const Color(0xFF25D366) : AppColors.info,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _otpChannel == 'both' ? 'Check WhatsApp and SMS'
                              : _otpChannel == 'whatsapp' ? 'Check WhatsApp' : 'Check SMS',
                          style: _f(
                            size: 13, weight: FontWeight.w600,
                            color: _otpChannel == 'both' ? AppColors.primary
                                : _otpChannel == 'whatsapp' ? const Color(0xFF25D366) : AppColors.info,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              OtpInput(controllers: _otpCtrls, focusNodes: _otpNodes, onCompleted: (_) => _verify()),
              const SizedBox(height: 24),
              _ctaButton('Verify & Continue', _submitting ? null : _verify, isLoading: _submitting),
              const SizedBox(height: 14),
              Center(
                child: GestureDetector(
                  onTap: _resendLoading ? null : _resendOtp,
                  child: Text(
                    _resendLoading ? 'Sending...' : "Didn't get a code? Resend",
                    style: _f(size: 13, color: AppColors.primary, weight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Step 5: Welcome ───
  Widget _welcomeStep() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted && _step == 5) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (_) => false,
        );
      }
    });

    return Column(
      key: const ValueKey('s5'),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.12),
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            color: AppColors.successSoft,
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(Icons.check_circle_rounded, size: 40, color: AppColors.success),
        ),
        const SizedBox(height: 28),
        Text(
          'Welcome, ${_firstNameCtrl.text.trim()}!',
          style: _f(size: 28, weight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.5),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        Text(
          'Your account is verified.\nTaking you to your workspace...',
          style: _f(size: 15, color: AppColors.textTertiary, height: 1.6),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 36),
        const NuruLoader(size: 36),
      ],
    );
  }

  // ─── Shared Widgets ───

  Widget _stepHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: _f(size: 26, weight: FontWeight.w800, color: AppColors.textPrimary, height: 1.15, letterSpacing: -0.5),
        ),
        const SizedBox(height: 6),
        Text(subtitle, style: _f(size: 14, color: AppColors.textTertiary, height: 1.5)),
      ],
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border.withOpacity(0.5), width: 0.7),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 20, offset: const Offset(0, 4)),
        ],
      ),
      child: child,
    );
  }

  Widget _ctaButton(String label, VoidCallback? onPressed, {bool isLoading = false}) {
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
            : Text(label, style: _f(size: 16, weight: FontWeight.w700, color: Colors.white)),
      ),
    );
  }

  Widget _statusChip(IconData icon, String text, Color color, Color bg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(text, style: _f(size: 12, color: color, weight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _errorLabel(String msg) => Padding(
    padding: const EdgeInsets.only(top: 6, left: 2),
    child: Text(msg, style: _f(size: 12, color: AppColors.error)),
  );

  Widget _successLabel(String msg) => Padding(
    padding: const EdgeInsets.only(top: 6, left: 2),
    child: Row(
      children: [
        const Icon(Icons.check_circle_rounded, size: 14, color: AppColors.success),
        const SizedBox(width: 6),
        Text(msg, style: _f(size: 12, color: AppColors.success, weight: FontWeight.w500)),
      ],
    ),
  );

  Widget _loginLink() => Padding(
    padding: const EdgeInsets.only(top: 24),
    child: Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text("Already have an account? ", style: _f(size: 14, color: AppColors.textTertiary)),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Text('Sign in', style: _f(size: 14, color: AppColors.primary, weight: FontWeight.w700)),
          ),
        ],
      ),
    ),
  );
}

String maskPhoneDisplay(String phone) {
  final cleaned = phone.replaceAll(RegExp(r'[^\d]'), '');
  if (cleaned.length < 6) return phone;
  return '${cleaned.substring(0, 3)}****${cleaned.substring(cleaned.length - 3)}';
}
