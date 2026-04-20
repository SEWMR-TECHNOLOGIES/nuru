import 'dart:convert';
import 'package:http/http.dart' as http;
import 'secure_token_storage.dart';
import 'api_config.dart';
import 'rate_limit_notifier.dart';

void _checkRateLimit(http.Response res, String endpoint) {
  if (res.statusCode != 429) return;
  final retryAfter = int.tryParse(res.headers['retry-after'] ?? '') ?? 60;
  final isAuth = endpoint.startsWith('/auth/') ||
      endpoint.startsWith('/users/signup') ||
      endpoint.startsWith('/users/verify-otp') ||
      endpoint.startsWith('/users/request-otp');
  RateLimitNotifier.instance.trigger(retryAfter: retryAfter, isAuth: isAuth);
}

class ApiBase {
  static String get baseUrl => ApiConfig.baseUrl;

  static Future<Map<String, String>> headers({bool auth = true}) async {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (auth) {
      final token = await SecureTokenStorage.getToken();
      if (token != null) h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  static Future<Map<String, String>> authOnlyHeaders() async {
    final h = <String, String>{'Accept': 'application/json'};
    final token = await SecureTokenStorage.getToken();
    if (token != null) h['Authorization'] = 'Bearer $token';
    return h;
  }

  static Map<String, dynamic> normalizeResponse(
    http.Response res, {
    String fallbackError = 'Request failed',
  }) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic> && decoded.containsKey('success')) {
        return decoded;
      }
      return {
        'success': res.statusCode >= 200 && res.statusCode < 300,
        'message': decoded is Map ? (decoded['message']?.toString() ?? '') : '',
        'data': decoded,
      };
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
    }
  }

  static Future<Map<String, dynamic>> get(
    String endpoint, {
    bool auth = true,
    Map<String, String>? queryParams,
    String fallbackError = 'Request failed',
  }) async {
    try {
      var uri = Uri.parse('$baseUrl$endpoint');
      if (queryParams != null) {
        uri = uri.replace(queryParameters: queryParams);
      }
      final res = await http.get(uri, headers: await headers(auth: auth));
      _checkRateLimit(res, endpoint);
      return normalizeResponse(res, fallbackError: fallbackError);
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
    }
  }

  static Future<Map<String, dynamic>> post(
    String endpoint,
    Map<String, dynamic> body, {
    bool auth = true,
    String fallbackError = 'Request failed',
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(auth: auth),
        body: jsonEncode(body),
      );
      _checkRateLimit(res, endpoint);
      return normalizeResponse(res, fallbackError: fallbackError);
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
    }
  }

  static Future<Map<String, dynamic>> put(
    String endpoint,
    Map<String, dynamic> body, {
    bool auth = true,
    String fallbackError = 'Request failed',
  }) async {
    try {
      final res = await http.put(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(auth: auth),
        body: jsonEncode(body),
      );
      _checkRateLimit(res, endpoint);
      return normalizeResponse(res, fallbackError: fallbackError);
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
    }
  }

  static Future<Map<String, dynamic>> delete(
    String endpoint, {
    bool auth = true,
    String fallbackError = 'Request failed',
  }) async {
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(auth: auth),
      );
      _checkRateLimit(res, endpoint);
      return normalizeResponse(res, fallbackError: fallbackError);
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getRaw(String endpoint) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(),
      );
      return jsonDecode(res.body);
    } catch (_) {
      return {'success': false, 'message': 'Request failed', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> postRaw(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (_) {
      return {'success': false, 'message': 'Request failed', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> putRaw(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    try {
      final res = await http.put(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (_) {
      return {'success': false, 'message': 'Request failed', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> deleteRaw(String endpoint) async {
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl$endpoint'),
        headers: await headers(),
      );
      return jsonDecode(res.body);
    } catch (_) {
      return {'success': false, 'message': 'Request failed', 'data': null};
    }
  }

  /// Generic request that lets the caller pass arbitrary headers
  /// (used by services that mix auth + guest tokens, e.g. event groups).
  static Future<Map<String, dynamic>> requestWithHeaders({
    required String method,
    required String endpoint,
    required Map<String, String> headers,
    Map<String, dynamic>? body,
    Map<String, String>? queryParams,
    String fallbackError = 'Request failed',
  }) async {
    try {
      var uri = Uri.parse('$baseUrl$endpoint');
      if (queryParams != null) {
        uri = uri.replace(queryParameters: queryParams);
      }
      http.Response res;
      switch (method.toUpperCase()) {
        case 'GET':
          res = await http.get(uri, headers: headers);
          break;
        case 'POST':
          res = await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
          break;
        case 'PUT':
          res = await http.put(uri, headers: headers, body: jsonEncode(body ?? {}));
          break;
        case 'DELETE':
          res = await http.delete(uri, headers: headers);
          break;
        default:
          throw UnsupportedError('Method $method not supported');
      }
      _checkRateLimit(res, endpoint);
      return normalizeResponse(res, fallbackError: fallbackError);
    } catch (_) {
      return {'success': false, 'message': fallbackError, 'data': null};
    }
  }
}
