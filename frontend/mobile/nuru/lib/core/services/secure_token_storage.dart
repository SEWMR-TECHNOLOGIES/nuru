import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Centralized secure token storage using EncryptedSharedPreferences (Android)
/// and Keychain (iOS). All sensitive auth tokens go through this class.
///
/// Every read is wrapped in a try/catch so that a backing-store error
/// (e.g. Android master-key rotation after a backup restore, transient
/// Keychain unavailability before first-unlock) NEVER crashes the splash
/// screen and NEVER causes the app to think the user is logged out. The
/// caller will simply retry on the next attempt.
class SecureTokenStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,
    ),
  );

  static const String _keyAccessToken = 'access_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyMigrated = 'secure_storage_migrated';

  /// One-time migration from plain SharedPreferences to secure storage.
  /// Call once at app startup (e.g. in main or AuthProvider init).
  static Future<void> migrateFromSharedPreferences() async {
    try {
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
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] migration failed: $e');
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  static Future<String?> getToken() async {
    try {
      return await _storage.read(key: _keyAccessToken);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] getToken failed: $e');
      return null;
    }
  }

  static Future<String?> getRefreshToken() async {
    try {
      return await _storage.read(key: _keyRefreshToken);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] getRefreshToken failed: $e');
      return null;
    }
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  static Future<void> setToken(String token) async {
    try {
      await _storage.write(key: _keyAccessToken, value: token);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] setToken failed: $e');
    }
  }

  static Future<void> setRefreshToken(String token) async {
    try {
      await _storage.write(key: _keyRefreshToken, value: token);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] setRefreshToken failed: $e');
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  static Future<void> clearTokens() async {
    try {
      await _storage.delete(key: _keyAccessToken);
      await _storage.delete(key: _keyRefreshToken);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] clearTokens failed: $e');
    }
  }

  // ── Generic key API (for feature-specific tokens like guest group JWTs) ──
  static Future<String?> read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] read($key) failed: $e');
      return null;
    }
  }

  static Future<void> write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] write($key) failed: $e');
    }
  }

  static Future<void> deleteKey(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (e) {
      if (kDebugMode) debugPrint('[SecureTokenStorage] deleteKey($key) failed: $e');
    }
  }
}
