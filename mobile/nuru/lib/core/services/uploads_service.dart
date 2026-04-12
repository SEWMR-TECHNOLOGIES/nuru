import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'secure_token_storage.dart';

class UploadsService {
  static String get _baseUrl => ApiConfig.baseUrl;

  static Future<Map<String, String>> _authOnlyHeaders() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> uploadFile(String filePath) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl/uploads/'),
      );
      request.headers.addAll(await _authOnlyHeaders());
      request.files.add(await http.MultipartFile.fromPath('file', filePath));

      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      final decoded = jsonDecode(body);

      if (decoded is Map<String, dynamic>) return decoded;

      return {
        'success': streamedRes.statusCode >= 200 && streamedRes.statusCode < 300,
        'message': streamedRes.statusCode >= 200 && streamedRes.statusCode < 300
            ? ''
            : 'Unable to upload file',
        'data': decoded,
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to upload file',
        'data': null,
      };
    }
  }
}