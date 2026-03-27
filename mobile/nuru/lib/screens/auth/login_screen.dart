import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/nuru_logo.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import '../home/home_screen.dart';
import 'signup_screen.dart';
import 'forgot_password_screen.dart';
import 'widgets/auth_text_field.dart';
import '../../core/widgets/otp_input.dart';

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

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _credCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  bool _loading = false;
  bool _obscure = true;

  @override
  void dispose() {
    _credCtrl.dispose();
    _pwCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    try {
      final res = await context.read<AuthProvider>().signIn(
        credential: _credCtrl.text.trim(),
        password: _pwCtrl.text,
      );

      if (!mounted) return;

      if (res['success'] == true) {
        final data = res['data'] as Map<String, dynamic>?;
        final user = data?['user'] as Map<String, dynamic>?;

        if (user != null && user['is_phone_verified'] == false) {
          final userId = user['id']?.toString() ?? '';
          if (mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (_) => _PhoneVerificationScreen(
                  userId: userId,
                  phone: _credCtrl.text.trim(),
                  password: _pwCtrl.text,
                ),
              ),
            );
          }
          return;
        }

        AppSnackbar.success(context, res['message'] ?? 'Welcome back!');
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
          (_) => false,
        );
      } else {
        final data = res['data'];
        if (data is Map && data['suspended'] == true) {
          _showSuspendedDialog(data['suspension_reason']?.toString());
        } else {
          AppSnackbar.error(context, res['message'] ?? 'Login failed');
        }
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Unable to reach server. Try again later.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showSuspendedDialog(String? reason) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        backgroundColor: Colors.white,
        title: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.errorSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.block_rounded, color: AppColors.error, size: 20),
          ),
          const SizedBox(width: 12),
          Text('Account Suspended', style: AppTheme.heading(fontSize: 17)),
        ]),
        content: Text(
          reason ?? 'Your account has been suspended. Contact support for help.',
          style: AppTheme.body(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('OK',
                style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
          ),
        ],
      ),
    );
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
          child: LayoutBuilder(
            builder: (context, box) {
              final hp = box.maxWidth < 360 ? 20.0 : 28.0;

              return SingleChildScrollView(
                padding: EdgeInsets.only(
                  left: hp,
                  right: hp,
                  bottom: bottomInset > 0 ? 24 : 14,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: box.maxHeight,
                  ),
                  child: Column(
                    children: [
                      // ── Logo at top ──
                      const SizedBox(height: 12),
                      const Center(child: NuruLogo(size: 28)),
                      SizedBox(height: box.maxHeight * 0.04),

                      // ── Title ──
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Welcome\nback',
                          textAlign: TextAlign.left,
                          style: _f(
                            size: (box.maxHeight * 0.048).clamp(30.0, 42.0),
                            weight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            height: 1.08,
                            letterSpacing: -0.8,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Sign in to continue managing your events',
                        textAlign: TextAlign.center,
                        style: _f(
                          size: 14.5,
                          weight: FontWeight.w500,
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),

                      SizedBox(height: box.maxHeight * 0.04),

                      // ── Form card ──
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: AppColors.border.withOpacity(0.5),
                            width: 0.7,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              AuthTextField(
                                controller: _credCtrl,
                                label: 'Email, phone, or username',
                                hintText: 'Enter your credential',
                                prefixIcon: Icons.person_outline_rounded,
                                validator: (v) =>
                                    (v == null || v.isEmpty) ? 'Required' : null,
                              ),
                              const SizedBox(height: 16),
                              AuthTextField(
                                controller: _pwCtrl,
                                label: 'Password',
                                hintText: 'Enter your password',
                                prefixIcon: Icons.lock_outline_rounded,
                                obscureText: _obscure,
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscure
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined,
                                    color: AppColors.textHint,
                                    size: 20,
                                  ),
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                ),
                                validator: (v) =>
                                    (v == null || v.isEmpty) ? 'Required' : null,
                              ),
                              const SizedBox(height: 4),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) =>
                                            const ForgotPasswordScreen()),
                                  ),
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppColors.primary,
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4, vertical: 4),
                                    minimumSize: const Size(52, 32),
                                  ),
                                  child: Text(
                                    'Forgot Password?',
                                    style: _f(
                                      size: 12,
                                      weight: FontWeight.w600,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),

                              // ── Sign In CTA ──
                              SizedBox(
                                width: double.infinity,
                                height: 54,
                                child: ElevatedButton(
                                  onPressed: _loading ? null : _login,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: Colors.white,
                                    disabledBackgroundColor:
                                        AppColors.primary.withOpacity(0.5),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                  ),
                                  child: _loading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : Text(
                                          'Sign In',
                                          style: _f(
                                            size: 16,
                                            weight: FontWeight.w700,
                                            color: Colors.white,
                                          ),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 28),

                      // ── Sign up link ──
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            "Don't have an account? ",
                            style: _f(
                              size: 14,
                              weight: FontWeight.w500,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => Navigator.of(context).push(
                              PageRouteBuilder(
                                transitionDuration:
                                    const Duration(milliseconds: 350),
                                pageBuilder: (_, a, __) =>
                                    const SignupScreen(),
                                transitionsBuilder: (_, a, __, child) =>
                                    SlideTransition(
                                  position: Tween<Offset>(
                                    begin: const Offset(1, 0),
                                    end: Offset.zero,
                                  ).animate(CurvedAnimation(
                                    parent: a,
                                    curve: Curves.easeOutCubic,
                                  )),
                                  child: child,
                                ),
                              ),
                            ),
                            child: Text(
                              'Sign Up',
                              style: _f(
                                size: 14,
                                weight: FontWeight.w700,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHONE VERIFICATION (post-login)
// ═══════════════════════════════════════════════════════════════════════════
class _PhoneVerificationScreen extends StatefulWidget {
  final String userId;
  final String phone;
  final String password;
  const _PhoneVerificationScreen({required this.userId, required this.phone, required this.password});

  @override
  State<_PhoneVerificationScreen> createState() => _PhoneVerificationScreenState();
}

class _PhoneVerificationScreenState extends State<_PhoneVerificationScreen> {
  final List<TextEditingController> _otpCtrls = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocus = List.generate(6, (_) => FocusNode());
  bool _verifying = false;
  bool _resending = false;
  int _countdown = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCountdown();
    // Request OTP immediately
    context.read<AuthProvider>().requestOtp(userId: widget.userId, verificationType: 'phone');
  }

  void _startCountdown() {
    _countdown = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_countdown <= 1) { t.cancel(); }
      if (mounted) setState(() => _countdown--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _otpCtrls) c.dispose();
    for (final f in _otpFocus) f.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final code = _otpCtrls.map((c) => c.text).join();
    if (code.length < 6) {
      AppSnackbar.error(context, 'Enter the 6-digit code');
      return;
    }
    setState(() => _verifying = true);
    final res = await context.read<AuthProvider>().verifyOtp(
      userId: widget.userId,
      verificationType: 'phone',
      otpCode: code,
    );
    if (!mounted) return;

    if (res['success'] == true) {
      // Auto sign-in after verification
      final ok = await context.read<AuthProvider>().autoSignInAfterVerification(
        phone: widget.phone,
        password: widget.password,
      );
      if (mounted) {
        if (ok) {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
            (_) => false,
          );
        } else {
          AppSnackbar.error(context, 'Verified but sign-in failed. Please log in again.');
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
            (_) => false,
          );
        }
      }
    } else {
      setState(() => _verifying = false);
      AppSnackbar.error(context, res['message'] ?? 'Invalid OTP');
    }
  }

  Future<void> _resend() async {
    setState(() => _resending = true);
    await context.read<AuthProvider>().requestOtp(userId: widget.userId, verificationType: 'phone');
    if (mounted) {
      setState(() => _resending = false);
      _startCountdown();
      AppSnackbar.success(context, 'OTP sent');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
            child: Column(children: [
              const SizedBox(height: 12),
              const Center(child: NuruLogo(size: 28)),
              const SizedBox(height: 32),
              Text('Verify Your Phone', style: _f(size: 24, weight: FontWeight.w800, height: 1.1)),
              const SizedBox(height: 10),
              Text('We sent a 6-digit code to ${widget.phone}',
                textAlign: TextAlign.center,
                style: _f(size: 14, color: AppColors.textSecondary, height: 1.4)),
              const SizedBox(height: 32),

              // OTP Input
              OtpInput(
                controllers: _otpCtrls,
                focusNodes: _otpFocus,
                onCompleted: (_) => _verify(),
              ),
              const SizedBox(height: 24),

              // Verify button
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _verifying ? null : _verify,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                  ),
                  child: _verifying
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('Verify', style: _f(size: 16, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 20),

              // Resend
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text("Didn't get the code? ", style: _f(size: 13, color: AppColors.textTertiary)),
                _countdown > 0
                  ? Text('Resend in ${_countdown}s', style: _f(size: 13, weight: FontWeight.w600, color: AppColors.textHint))
                  : GestureDetector(
                      onTap: _resending ? null : _resend,
                      child: Text('Resend', style: _f(size: 13, weight: FontWeight.w700, color: AppColors.primary)),
                    ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
