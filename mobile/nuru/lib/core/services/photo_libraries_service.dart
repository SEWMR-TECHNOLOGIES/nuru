import 'dart:convert';
import 'package:http/http.dart' as http;
import 'secure_token_storage.dart';
import 'api_config.dart';

/// Photo Libraries API service — mirrors src/lib/api/photoLibraries.ts
class PhotoLibrariesService {
  static String get _baseUrl => ApiConfig.baseUrl;

  static Map<String, dynamic> _normalizeBody({
    required String body,
    required int statusCode,
    required String fallbackError,
  }) {
    try {
      final decoded = jsonDecode(body);
      final ok = statusCode >= 200 && statusCode < 300;

      if (decoded is Map<String, dynamic>) {
        if (decoded.containsKey('success')) return decoded;
        return {
          'success': ok,
          'message': decoded['message']?.toString() ?? (ok ? '' : fallbackError),
          'data': decoded,
        };
      }

      return {
        'success': ok,
        'message': ok ? '' : fallbackError,
        'data': decoded,
      };
    } catch (_) {
      return {
        'success': false,
        'message': fallbackError,
        'data': null,
      };
    }
  }

  static Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, String>> _authOnlyHeaders() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Get all libraries for a service
  static Future<Map<String, dynamic>> getServiceLibraries(String serviceId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/photo-libraries/service/$serviceId'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to fetch libraries');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch libraries'};
    }
  }

  /// Get a single library with photos
  static Future<Map<String, dynamic>> getLibrary(String libraryId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/photo-libraries/$libraryId'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to fetch library');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch library'};
    }
  }

  /// Access library via share token
  static Future<Map<String, dynamic>> getLibraryByToken(String token) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/photo-libraries/shared/$token'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to fetch shared library');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch shared library'};
    }
  }

  /// Create a photo library for a confirmed event
  static Future<Map<String, dynamic>> createLibrary(String serviceId, {required String eventId, String? privacy, String? description}) async {
    try {
      final uri = Uri.parse('$_baseUrl/photo-libraries/service/$serviceId/create');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.fields['event_id'] = eventId;
      if (privacy != null) request.fields['privacy'] = privacy;
      if (description != null) request.fields['description'] = description;
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return _normalizeBody(body: body, statusCode: streamedRes.statusCode, fallbackError: 'Unable to create library');
    } catch (e) {
      return {'success': false, 'message': 'Unable to create library'};
    }
  }

  /// Update library settings (privacy/description)
  static Future<Map<String, dynamic>> updateLibrary(String libraryId, {String? privacy, String? description}) async {
    try {
      final uri = Uri.parse('$_baseUrl/photo-libraries/$libraryId');
      final request = http.MultipartRequest('PUT', uri);
      request.headers.addAll(await _authOnlyHeaders());
      if (privacy != null) request.fields['privacy'] = privacy;
      if (description != null) request.fields['description'] = description;
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return _normalizeBody(body: body, statusCode: streamedRes.statusCode, fallbackError: 'Unable to update library');
    } catch (e) {
      return {'success': false, 'message': 'Unable to update library'};
    }
  }

  /// Upload a photo to a library
  static Future<Map<String, dynamic>> uploadPhoto(String libraryId, String filePath, {String? caption}) async {
    try {
      final uri = Uri.parse('$_baseUrl/photo-libraries/$libraryId/upload');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.files.add(await http.MultipartFile.fromPath('file', filePath));
      if (caption != null) request.fields['caption'] = caption;
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return _normalizeBody(body: body, statusCode: streamedRes.statusCode, fallbackError: 'Unable to upload photo');
    } catch (e) {
      return {'success': false, 'message': 'Unable to upload photo'};
    }
  }

  /// Delete a photo
  static Future<Map<String, dynamic>> deletePhoto(String libraryId, String photoId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/photo-libraries/$libraryId/photos/$photoId'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to delete photo');
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete photo'};
    }
  }

  /// Delete an entire library
  static Future<Map<String, dynamic>> deleteLibrary(String libraryId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/photo-libraries/$libraryId'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to delete library');
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete library'};
    }
  }

  /// Get confirmed events for a service (to create libraries from)
  static Future<Map<String, dynamic>> getServiceEvents(String serviceId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/photo-libraries/service/$serviceId/events'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to fetch events');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch events'};
    }
  }

  /// Get photo libraries for an event (event creator view)
  static Future<Map<String, dynamic>> getEventLibraries(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/photo-libraries/event/$eventId'), headers: await _headers());
      return _normalizeBody(body: res.body, statusCode: res.statusCode, fallbackError: 'Unable to fetch event libraries');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch event libraries'};
    }
  }
}
