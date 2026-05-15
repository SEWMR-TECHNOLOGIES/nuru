import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/services/api_service.dart';
import '../core/services/events_service.dart';
import '../core/services/secure_token_storage.dart';
import '../core/services/push_notification_service.dart';
import '../core/utils/money_format.dart' as money_fmt;

class AuthProvider extends ChangeNotifier {
  static const String _keyIsLoggedIn = 'is_logged_in';
  static const String _keyHasSeenOnboarding = 'has_seen_onboarding';

  bool _isLoggedIn = false;
  bool _hasSeenOnboarding = false;
  bool _isLoading = true;
  Map<String, dynamic>? _user;

  void _syncCurrencyFromUser() {
    final code = _user?['currency_code'] ?? _user?['currency']?['code'];
    if (code != null) money_fmt.setActiveCurrency(code.toString());
  }

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
      // Optimistic restore: a valid token in secure storage means we trust
      // the previous session. Bring the user straight into the app and
      // hydrate /auth/me + profile in the background. This shaves the cold-
      // start latency that previously waited on two sequential network
      // round-trips before the splash could dismiss.
      _isLoggedIn = true;
      // Use the lightweight cached snapshot while the network call is in
      // flight so screens that read userName/avatar don't flash empty.
      final cachedUser = prefs.getString('cached_user');
      if (cachedUser != null && cachedUser.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedUser);
          if (decoded is Map<String, dynamic>) _user = decoded;
        } catch (_) {}
      }
      _syncCurrencyFromUser();
      _isLoading = false;
      notifyListeners();

      // Background hydration — never blocks UI.
      // Roll the 30-day refresh window forward FIRST so a long-dormant
      // user who just opened the app gets a brand-new pair of tokens
      // before anything else hits the network.
      // ignore: discarded_futures
      _rollRefreshAndHydrate();
      return;
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> _rollRefreshAndHydrate() async {
    // Best-effort proactive refresh. If it fails (offline, server down,
    // refresh token finally expired after 30 days of total inactivity), we
    // simply fall through to /auth/me — ApiBase will retry the refresh on
    // any 401 it sees and we still won't sign the user out automatically.
    try {
      final rt = await SecureTokenStorage.getRefreshToken();
      if (rt != null && rt.isNotEmpty) {
        final res = await AuthApi.refresh(rt);
        if (res['success'] == true && res['data'] is Map) {
          final data = res['data'] as Map;
          final newAccess = data['access_token']?.toString();
          final newRefresh = data['refresh_token']?.toString();
          if (newAccess != null && newAccess.isNotEmpty) {
            await SecureTokenStorage.setToken(newAccess);
          }
          if (newRefresh != null && newRefresh.isNotEmpty) {
            await SecureTokenStorage.setRefreshToken(newRefresh);
          }
        }
      }
    } catch (_) {}
    await _hydrateUserInBackground();
  }

  Future<void> _hydrateUserInBackground() async {
    try {
      final results = await Future.wait([
        AuthApi.me(),
        EventsService.getProfile(),
      ]);
      final meRes = results[0];
      final profileRes = results[1];

      // Only treat the session as dead if the backend explicitly says the
      // bearer is invalid AND our refresh attempt (handled inside ApiBase)
      // already failed. Transient network/server errors must NOT log the
      // user out — that's what was wiping sessions even though tokens are
      // valid for 24h with a 30-day refresh window.
      final meSucceeded = meRes['success'] == true && meRes['data'] != null;
      final msg = meRes['message']?.toString().toLowerCase() ?? '';
      final isAuthDead = meRes['success'] == false &&
          (msg.contains('unauthor') ||
              msg.contains('expired') ||
              msg.contains('invalid token') ||
              msg.contains('not authenticated'));

      if (meSucceeded) {
        Map<String, dynamic>? userData =
            meRes['data'] is Map<String, dynamic> ? meRes['data'] : null;
        if (userData != null) {
          _user = userData;
          if (profileRes['success'] == true &&
              profileRes['data'] is Map<String, dynamic>) {
            _user = {..._user!, ...profileRes['data'] as Map<String, dynamic>};
          }
          _syncCurrencyFromUser();
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('cached_user', jsonEncode(_user));
          } catch (_) {}
          notifyListeners();
        }
        try {
          await PushNotificationService.instance.registerWithBackend();
        } catch (_) {}
      }
      // Session is permanent until the user explicitly signs out: even if
      // /auth/me returns an auth-dead response, we keep the local session
      // intact. ApiBase will keep trying to refresh on the next request,
      // and the refresh-token window (30 days) is rolled forward on every
      // cold start by `_rollRefreshTokenForward()`.
    } catch (_) {
      // Network exceptions never log the user out.
    }
  }

  /// Refresh the cached user from the server (used after profile changes
  /// like confirming country/currency, avatar updates, etc.).
  Future<void> refreshUser() async {
    try {
      final res = await AuthApi.me();
      Map<String, dynamic>? userData;
      if (res['success'] == true && res['data'] is Map<String, dynamic>) {
        userData = res['data'] as Map<String, dynamic>;
      } else if (res['data'] is Map<String, dynamic> && res['data']['id'] != null) {
        userData = res['data'] as Map<String, dynamic>;
      }
      if (userData != null) {
        _user = userData;
        try {
          final profileRes = await EventsService.getProfile();
          if (profileRes['success'] == true && profileRes['data'] is Map<String, dynamic>) {
            _user = {..._user!, ...profileRes['data'] as Map<String, dynamic>};
          }
        } catch (_) {}
        notifyListeners();
      }
    } catch (_) {}
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

        _syncCurrencyFromUser();
        try {
          await prefs.setString('cached_user', jsonEncode(_user));
        } catch (_) {}

        // Register the device's FCM token with the backend so push
        // notifications (messages, payments, invitations, etc.) reach this
        // device. Best-effort — never block sign-in.
        try {
          await PushNotificationService.instance.registerWithBackend();
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
    // Resolve the current FCM token first so we can hand it to BOTH the
    // device-unregister call and the /auth/logout safety net. Doing this
    // before _clearTokens() guarantees the bearer token is still valid.
    String? fcmToken;
    try {
      fcmToken = await PushNotificationService.instance.currentToken();
    } catch (_) {}

    // Primary path: unbind the device row by (platform, token).
    try { await PushNotificationService.instance.unregister(); } catch (_) {}

    // Belt-and-suspenders: tell /auth/logout the token so the backend can
    // delete any leftover row owned by this user. Awaited (not fire-and-
    // forget) so we know the unbind happened before we drop the bearer.
    try {
      await AuthApi.logout(body: {
        if (fcmToken != null && fcmToken.isNotEmpty) 'fcm_token': fcmToken,
      });
    } catch (_) {}

    await _clearTokens();
    _isLoggedIn = false;
    _user = null;
    notifyListeners();
  }

  Future<void> _clearTokens() async {
    await SecureTokenStorage.clearTokens();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsLoggedIn, false);
    await prefs.remove('cached_user');
    _isLoggedIn = false;
    _user = null;
  }
}
