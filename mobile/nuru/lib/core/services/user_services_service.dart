import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'secure_token_storage.dart';
import 'api_config.dart';

class UserServicesService {
  static String get _baseUrl => ApiConfig.baseUrl;

  static Map<String, dynamic> _normalizeResponse(http.Response res, {String fallbackError = 'Request failed'}) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        if (decoded.containsKey('success')) return decoded;
        return {
          'success': res.statusCode >= 200 && res.statusCode < 300,
          'message': decoded['message']?.toString() ?? '',
          'data': decoded,
        };
      }
      return {
        'success': res.statusCode >= 200 && res.statusCode < 300,
        'message': res.statusCode >= 200 && res.statusCode < 300 ? '' : fallbackError,
        'data': decoded,
      };
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
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

  static Future<Map<String, dynamic>> getMyServices() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-services/'), headers: await _headers());
      return _normalizeResponse(res, fallbackError: 'Unable to fetch services');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch services'};
    }
  }

  static Future<Map<String, dynamic>> getServiceProviders({int page = 1, int limit = 20}) async {
    try {
      final uri = Uri.parse('$_baseUrl/services').replace(queryParameters: {'page': '$page', 'limit': '$limit'});
      final res = await http.get(uri, headers: await _headers());
      return _normalizeResponse(res, fallbackError: 'Unable to fetch service providers');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch service providers'};
    }
  }

  static Future<Map<String, dynamic>> getServiceDetail(String serviceId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/services/$serviceId'), headers: await _headers());
      return _normalizeResponse(res, fallbackError: 'Unable to fetch service details');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch service details'};
    }
  }

  static Future<Map<String, dynamic>> getServiceCategories() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/references/service-categories'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch categories'};
    }
  }

  static Future<Map<String, dynamic>> getServiceTypesByCategory(String categoryId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/references/service-types/category/$categoryId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch service types'};
    }
  }

  static Future<Map<String, dynamic>> createService(Map<String, dynamic> data, {List<String>? imagePaths}) async {
    try {
      final uri = Uri.parse('$_baseUrl/services');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      data.forEach((k, v) { if (v != null) request.fields[k] = v.toString(); });
      if (imagePaths != null) {
        for (final p in imagePaths) {
          request.files.add(await http.MultipartFile.fromPath('images', p));
        }
      }
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return jsonDecode(body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to create service'};
    }
  }

  static Future<Map<String, dynamic>> updateService(String serviceId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/services/$serviceId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update service'};
    }
  }

  static Future<Map<String, dynamic>> deleteService(String serviceId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/services/$serviceId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete service'};
    }
  }

  static Future<Map<String, dynamic>> getServiceReviews(String serviceId, {int page = 1}) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/services/$serviceId/reviews?page=$page'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch reviews'};
    }
  }

  static Future<Map<String, dynamic>> getBookings({int page = 1}) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/bookings?page=$page'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch bookings'};
    }
  }

  static Future<Map<String, dynamic>> getBookingDetail(String bookingId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/bookings/$bookingId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch booking details'};
    }
  }

  static Future<Map<String, dynamic>> updateBookingStatus(String bookingId, String status) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/bookings/$bookingId/status'),
        headers: await _headers(),
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update booking'};
    }
  }

  static Future<Map<String, dynamic>> getPhotoLibraries(String serviceId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/services/$serviceId/photo-libraries'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch photo libraries'};
    }
  }

  static Future<Map<String, dynamic>> getPhotoLibraryDetail(String libraryId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/photo-libraries/$libraryId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch photo library'};
    }
  }

  static Future<Map<String, dynamic>> getContributors({int page = 1, int limit = 100}) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-contributors/?page=$page&limit=$limit'), headers: await _headers());
      return _normalizeResponse(res, fallbackError: 'Unable to fetch contributors');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch contributors'};
    }
  }

  static Future<Map<String, dynamic>> getPublicProfile(String username) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/users/username/$username'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch profile'};
    }
  }

  static Future<Map<String, dynamic>> getUserProfile(String userId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/users/$userId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch profile'};
    }
  }
}
