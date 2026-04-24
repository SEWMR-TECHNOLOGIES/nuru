import 'dart:convert';
import 'package:http/http.dart' as http;
import 'secure_token_storage.dart';
import 'api_config.dart';

class NuruCardsService {
  static String get _baseUrl => ApiConfig.baseUrl;

  static Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> getMyCards() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/nuru-cards/'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch cards'};
    }
  }

  static Future<Map<String, dynamic>> getCardTypes() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/nuru-cards/types'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch card types'};
    }
  }

  static Future<Map<String, dynamic>> getMyOrders() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/nuru-cards/my-orders'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch orders'};
    }
  }

  static Future<Map<String, dynamic>> orderCard(Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/nuru-cards/order'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to order card'};
    }
  }

  static Future<Map<String, dynamic>> upgradeToPremium(String cardId, {required String paymentMethod, String? phone}) async {
    try {
      final body = <String, dynamic>{'payment_method': paymentMethod};
      if (phone != null) body['phone'] = phone;
      final res = await http.post(
        Uri.parse('$_baseUrl/nuru-cards/$cardId/upgrade'),
        headers: await _headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to upgrade card'};
    }
  }

  static Future<Map<String, dynamic>> getCheckInHistory(String cardId, {int page = 1, int limit = 20}) async {
    try {
      final uri = Uri.parse('$_baseUrl/nuru-cards/$cardId/checkins?page=$page&limit=$limit');
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch check-in history'};
    }
  }
}
