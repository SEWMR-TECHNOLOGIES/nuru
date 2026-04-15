import 'dart:convert';
import 'package:http/http.dart' as http;
import 'secure_token_storage.dart';
import 'api_config.dart';

class AgreementsService {
  static String get _baseUrl => ApiConfig.baseUrl;

  static Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Check if user has accepted the latest version of an agreement
  static Future<Map<String, dynamic>> check(String type) async {
    try {
      final res = await http.get(
        Uri.parse('$_baseUrl/agreements/check/$type'),
        headers: await _headers(),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to check agreement status'};
    }
  }

  /// Accept the latest version of an agreement
  static Future<Map<String, dynamic>> accept(String type) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/agreements/accept'),
        headers: await _headers(),
        body: jsonEncode({'agreement_type': type}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to accept agreement'};
    }
  }
}
