import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/services/api_service.dart';
import '../core/services/events_service.dart';
import '../core/services/secure_token_storage.dart';

class AuthProvider extends ChangeNotifier {
  static const String _keyIsLoggedIn = 'is_logged_in';
  static const String _keyHasSeenOnboarding = 'has_seen_onboarding';

  bool _isLoggedIn = false;
  bool _hasSeenOnboarding = false;
  bool _isLoading = true;
  Map<String, dynamic>? _user;

  bool get isLoggedIn => _isLoggedIn;
  bool get hasSeenOnboarding => _hasSeenOnboarding;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get userName => _user?['first_name'];
  String? get userEmail => _user?['email'];
  String? get userAvatar => _user?['avatar'] as String?;

  AuthProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    // Migrate tokens from plain SharedPreferences to secure storage (one-time)
    await SecureTokenStorage.migrateFromSharedPreferences();

    final prefs = await SharedPreferences.getInstance();
    _hasSeenOnboarding = prefs.getBool(_keyHasSeenOnboarding) ?? false;

    final token = await SecureTokenStorage.getToken();
    if (token != null) {
      try {
        final res = await AuthApi.me();
        Map<String, dynamic>? userData;
        if (res['success'] == true && res['data'] != null) {
          userData = res['data'] is Map<String, dynamic> ? res['data'] : null;
        } else {
          final rawUser = res['data'] ?? res;
          if (rawUser is Map<String, dynamic> && rawUser['id'] != null) {
            userData = rawUser;
          }
        }

        if (userData != null) {
          _user = userData;
          _isLoggedIn = true;

          try {
            final profileRes = await EventsService.getProfile();
            if (profileRes['success'] == true && profileRes['data'] != null) {
              final profileData = profileRes['data'] as Map<String, dynamic>;
              _user = {..._user!, ...profileData};
            }
          } catch (_) {}
        } else {
          await _clearTokens();
        }
      } catch (_) {
        await _clearTokens();
      }
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyHasSeenOnboarding, true);
    _hasSeenOnboarding = true;
    notifyListeners();
  }

  /// Sign in with credential (email/phone/username) + password
  Future<Map<String, dynamic>> signIn({
    required String credential,
    required String password,
  }) async {
    final res = await AuthApi.signin(credential: credential, password: password);

    if (res['success'] == true && res['data'] != null) {
      final data = res['data'] as Map<String, dynamic>;
      final token = data['access_token'] as String?;
      final refreshToken = data['refresh_token'] as String?;
      final user = data['user'] as Map<String, dynamic>?;

      if (token != null) {
        await SecureTokenStorage.setToken(token);
        if (refreshToken != null) await SecureTokenStorage.setRefreshToken(refreshToken);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(_keyIsLoggedIn, true);
        _isLoggedIn = true;
        _user = user;

        try {
          final profileRes = await EventsService.getProfile();
          if (profileRes['success'] == true && profileRes['data'] != null) {
            final profileData = profileRes['data'] as Map<String, dynamic>;
            _user = {...(_user ?? {}), ...profileData};
          }
        } catch (_) {}

        notifyListeners();
      }
    }

    return res;
  }

  /// Sign up — creates account, returns response with user ID
  Future<Map<String, dynamic>> signUp({
    required String firstName,
    required String lastName,
    required String username,
    required String phone,
    required String password,
    String? email,
  }) async {
    return AuthApi.signup(
      firstName: firstName,
      lastName: lastName,
      username: username,
      phone: phone,
      password: password,
      email: email,
    );
  }

  /// Verify OTP
  Future<Map<String, dynamic>> verifyOtp({
    required String userId,
    required String verificationType,
    required String otpCode,
  }) {
    return AuthApi.verifyOtp(
      userId: userId,
      verificationType: verificationType,
      otpCode: otpCode,
    );
  }

  /// Request OTP
  Future<Map<String, dynamic>> requestOtp({
    required String userId,
    required String verificationType,
  }) {
    return AuthApi.requestOtp(userId: userId, verificationType: verificationType);
  }

  /// Check username availability
  Future<Map<String, dynamic>> checkUsername(String username, {String? firstName, String? lastName}) {
    return AuthApi.checkUsername(username, firstName: firstName, lastName: lastName);
  }

  /// Validate name
  Future<Map<String, dynamic>> validateName(String name) {
    return AuthApi.validateName(name);
  }

  /// Auto sign-in after OTP verification (same as web)
  Future<bool> autoSignInAfterVerification({
    required String phone,
    required String password,
  }) async {
    final res = await signIn(credential: phone, password: password);
    return res['success'] == true;
  }

  /// Forgot password (email)
  Future<Map<String, dynamic>> forgotPassword(String email) {
    return AuthApi.forgotPassword(email);
  }

  /// Forgot password (phone)
  Future<Map<String, dynamic>> forgotPasswordPhone(String phone) {
    return AuthApi.forgotPasswordPhone(phone);
  }

  /// Verify reset OTP
  Future<Map<String, dynamic>> verifyResetOtp(String phone, String otpCode) {
    return AuthApi.verifyResetOtp(phone, otpCode);
  }

  /// Reset password
  Future<Map<String, dynamic>> resetPassword(String token, String password, String confirmation) {
    return AuthApi.resetPassword(token, password, confirmation);
  }

  Future<void> signOut() async {
    // Fire-and-forget the server call — don't let it block local cleanup
    AuthApi.logout().catchError((_) => <String, dynamic>{});
    await _clearTokens();
    _isLoggedIn = false;
    _user = null;
    notifyListeners();
  }

  Future<void> _clearTokens() async {
    await SecureTokenStorage.clearTokens();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsLoggedIn, false);
  }
}
