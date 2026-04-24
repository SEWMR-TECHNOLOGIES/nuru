import 'dart:convert';
import 'package:http/http.dart' as http;
import 'secure_token_storage.dart';
import 'api_config.dart';

class TicketingService {
  static String get _baseUrl => ApiConfig.baseUrl;

  static Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Public: browse ticketed events
  static Future<Map<String, dynamic>> getTicketedEvents({int page = 1, int limit = 12, String? search}) async {
    try {
      final params = <String, String>{'page': '$page', 'limit': '$limit'};
      if (search != null && search.isNotEmpty) params['search'] = search;
      final uri = Uri.parse('$_baseUrl/ticketing/events').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch events'};
    }
  }

  /// Public: get ticket classes for an event
  static Future<Map<String, dynamic>> getTicketClasses(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/ticketing/events/$eventId/ticket-classes'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch ticket classes'};
    }
  }

  /// Organizer: get ticket classes for own event
  static Future<Map<String, dynamic>> getMyTicketClasses(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/ticketing/my-events/$eventId/ticket-classes'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch ticket classes'};
    }
  }

  /// Organizer: create ticket class
  static Future<Map<String, dynamic>> createTicketClass(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/ticketing/events/$eventId/ticket-classes'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to create ticket class'};
    }
  }

  /// Organizer: update ticket class
  static Future<Map<String, dynamic>> updateTicketClass(String classId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/ticketing/ticket-classes/$classId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update ticket class'};
    }
  }

  /// Organizer: delete ticket class
  static Future<Map<String, dynamic>> deleteTicketClass(String classId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/ticketing/ticket-classes/$classId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete ticket class'};
    }
  }

  /// Purchase ticket
  static Future<Map<String, dynamic>> purchaseTicket({required String ticketClassId, int quantity = 1}) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/ticketing/purchase'),
        headers: await _headers(),
        body: jsonEncode({'ticket_class_id': ticketClassId, 'quantity': quantity}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to purchase ticket'};
    }
  }

  /// My purchased tickets
  static Future<Map<String, dynamic>> getMyTickets({int page = 1, int limit = 20, String? search}) async {
    try {
      final qp = <String, String>{'page': '$page', 'limit': '$limit'};
      if (search != null && search.isNotEmpty) qp['search'] = search;
      final uri = Uri.parse('$_baseUrl/ticketing/my-tickets').replace(queryParameters: qp);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch tickets'};
    }
  }

  /// My upcoming ticketed events (for sidebar)
  static Future<Map<String, dynamic>> getMyUpcomingTickets() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/ticketing/my-upcoming-tickets'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch upcoming tickets'};
    }
  }

  /// Organizer: get sold tickets for event
  static Future<Map<String, dynamic>> getEventTickets(String eventId, {int page = 1, int limit = 50}) async {
    try {
      final uri = Uri.parse('$_baseUrl/ticketing/events/$eventId/tickets?page=$page&limit=$limit');
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch event tickets'};
    }
  }

  /// Organizer: update ticket status (approve/reject)
  static Future<Map<String, dynamic>> updateTicketStatus(String ticketId, String status) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/ticketing/tickets/$ticketId/status'),
        headers: await _headers(),
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update ticket status'};
    }
  }

  /// Check-in ticket by QR code
  static Future<Map<String, dynamic>> checkInTicket(String ticketCode) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/ticketing/verify/$ticketCode/check-in'),
        headers: await _headers(),
        body: jsonEncode({}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to check in ticket'};
    }
  }
}
