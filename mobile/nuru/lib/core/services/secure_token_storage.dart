import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Centralized secure token storage using EncryptedSharedPreferences (Android)
/// and Keychain (iOS). All sensitive auth tokens go through this class.
///
/// Non-sensitive preferences (onboarding flags, UI state) remain in
/// regular SharedPreferences.
class SecureTokenStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const String _keyAccessToken = 'access_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyMigrated = 'secure_storage_migrated';

  /// One-time migration from plain SharedPreferences to secure storage.
  /// Call once at app startup (e.g. in main or AuthProvider init).
  static Future<void> migrateFromSharedPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_keyMigrated) == true) return;

    final accessToken = prefs.getString(_keyAccessToken);
    final refreshToken = prefs.getString(_keyRefreshToken);

    if (accessToken != null) {
      await _storage.write(key: _keyAccessToken, value: accessToken);
      await prefs.remove(_keyAccessToken);
    }
    if (refreshToken != null) {
      await _storage.write(key: _keyRefreshToken, value: refreshToken);
      await prefs.remove(_keyRefreshToken);
    }

    await prefs.setBool(_keyMigrated, true);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  static Future<String?> getToken() async {
    return _storage.read(key: _keyAccessToken);
  }

  static Future<String?> getRefreshToken() async {
    return _storage.read(key: _keyRefreshToken);
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  static Future<void> setToken(String token) async {
    await _storage.write(key: _keyAccessToken, value: token);
  }

  static Future<void> setRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  static Future<void> clearTokens() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
  }

  // ── Generic key API (for feature-specific tokens like guest group JWTs) ──
  static Future<String?> read(String key) => _storage.read(key: key);
  static Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);
  static Future<void> deleteKey(String key) => _storage.delete(key: key);
}
