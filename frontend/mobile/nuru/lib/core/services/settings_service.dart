import 'api_service.dart';

/// Settings backend client. Mirrors /settings/* endpoints.
class SettingsService {
  static Future<Map<String, dynamic>> fetchAll() =>
      ApiService.get('/settings');

  static Future<Map<String, dynamic>> updateNotifications(Map<String, dynamic> body) =>
      ApiService.put('/settings/notifications', body);

  static Future<Map<String, dynamic>> updatePrivacy(Map<String, dynamic> body) =>
      ApiService.put('/settings/privacy', body);

  static Future<Map<String, dynamic>> updatePreferences(Map<String, dynamic> body) =>
      ApiService.put('/settings/preferences', body);

  static Future<Map<String, dynamic>> updateSecurity(Map<String, dynamic> body) =>
      ApiService.put('/settings/security', body);

  // 2FA
  static Future<Map<String, dynamic>> enable2fa() =>
      ApiService.post('/settings/security/2fa/enable', {});
  static Future<Map<String, dynamic>> verify2fa(String code) =>
      ApiService.post('/settings/security/2fa/verify', {'code': code});
  static Future<Map<String, dynamic>> disable2fa(String code) =>
      ApiService.post('/settings/security/2fa/disable', {'code': code});

  // Sessions
  static Future<Map<String, dynamic>> sessions() =>
      ApiService.get('/settings/security/sessions');
  static Future<Map<String, dynamic>> revokeSession(String id) =>
      ApiService.delete('/settings/security/sessions/$id');
  static Future<Map<String, dynamic>> revokeAllSessions() =>
      ApiService.delete('/settings/security/sessions');

  // Data export
  static Future<Map<String, dynamic>> requestDataExport() =>
      ApiService.post('/settings/data/export', {});

  // App version (public)
  static Future<Map<String, dynamic>> appVersion(String platform) =>
      ApiService.get('/settings/app-version', queryParams: {'platform': platform});
}
