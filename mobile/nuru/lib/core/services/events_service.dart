import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import 'secure_token_storage.dart';
import 'api_config.dart';

/// Events API service for mobile — mirrors src/lib/api/events.ts
class EventsService {
  static String get _baseUrl => ApiConfig.baseUrl;

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
      return {
        'success': false,
        'message': fallbackError,
        'data': null,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getProfile() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/users/profile'), headers: await _headers());
      return _normalizeResponse(res, fallbackError: 'Unable to fetch profile');
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch profile', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getUserById(String userId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/users/$userId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch user', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> updateProfile({
    String? firstName,
    String? lastName,
    String? phone,
    String? bio,
    String? location,
    String? avatarPath,
    String? coverPath,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/users/profile');
      final request = http.MultipartRequest('PUT', uri);
      request.headers.addAll(await _authOnlyHeaders());
      if (firstName != null) request.fields['first_name'] = firstName;
      if (lastName != null) request.fields['last_name'] = lastName;
      if (phone != null) request.fields['phone'] = phone;
      if (bio != null) request.fields['bio'] = bio;
      if (location != null) request.fields['location'] = location;
      if (avatarPath != null) request.files.add(await http.MultipartFile.fromPath('avatar', avatarPath));
      if (coverPath != null) request.files.add(await http.MultipartFile.fromPath('cover_image', coverPath));
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      final fakeResponse = http.Response(body, streamedRes.statusCode);
      return _normalizeResponse(fakeResponse, fallbackError: 'Unable to update profile');
    } catch (e) {
      return {'success': false, 'message': 'Unable to update profile', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> changePassword(String currentPassword, String newPassword, String confirmPassword) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/users/change-password'),
        headers: await _headers(),
        body: jsonEncode({'current_password': currentPassword, 'new_password': newPassword, 'confirm_password': confirmPassword}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to change password'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getMyEvents({int page = 1, int limit = 20, String? status}) async {
    try {
      final params = <String, String>{'page': '$page', 'limit': '$limit'};
      if (status != null && status != 'all') params['status'] = status;
      final uri = Uri.parse('$_baseUrl/user-events/').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch events', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getInvitedEvents({int page = 1, int limit = 20}) async {
    try {
      final uri = Uri.parse('$_baseUrl/user-events/invited?page=$page&limit=$limit');
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch invitations', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getCommitteeEvents({int page = 1, int limit = 20}) async {
    try {
      final uri = Uri.parse('$_baseUrl/user-events/committee?page=$page&limit=$limit');
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch committee events', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getEventById(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch event', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getMyPermissions(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/my-permissions'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch permissions', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> createEvent({
    required String title,
    required String eventType,
    String? description,
    String? startDate,
    String? endDate,
    String? location,
    String? venue,
    String? imagePath,
    String visibility = 'private',
    int? expectedGuests,
    double? budget,
    bool sellsTickets = false,
    bool isPublic = false,
    String? dressCode,
    String? specialInstructions,
    String? time,
    double? venueLatitude,
    double? venueLongitude,
    String? venueAddress,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/user-events/');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.fields['title'] = title;
      request.fields['event_type_id'] = eventType;
      request.fields['is_public'] = isPublic ? 'true' : 'false';
      request.fields['sells_tickets'] = sellsTickets ? 'true' : 'false';
      if (description != null && description.isNotEmpty) request.fields['description'] = description;
      if (startDate != null) request.fields['start_date'] = startDate;
      if (endDate != null) request.fields['end_date'] = endDate;
      if (time != null && time.isNotEmpty) request.fields['time'] = time;
      if (location != null && location.isNotEmpty) request.fields['location'] = location;
      if (venue != null && venue.isNotEmpty) request.fields['venue'] = venue;
      if (expectedGuests != null) request.fields['expected_guests'] = '$expectedGuests';
      if (budget != null) request.fields['budget'] = '$budget';
      if (dressCode != null && dressCode.isNotEmpty) request.fields['dress_code'] = dressCode;
      if (specialInstructions != null && specialInstructions.isNotEmpty) request.fields['special_instructions'] = specialInstructions;
      if (venueLatitude != null) request.fields['venue_latitude'] = '$venueLatitude';
      if (venueLongitude != null) request.fields['venue_longitude'] = '$venueLongitude';
      if (venueAddress != null && venueAddress.isNotEmpty) request.fields['venue_address'] = venueAddress;
      if (imagePath != null) request.files.add(await http.MultipartFile.fromPath('cover_image', imagePath));
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return jsonDecode(body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to create event', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> updateEvent(String eventId, {
    String? title,
    String? description,
    String? eventTypeId,
    String? startDate,
    String? endDate,
    String? location,
    String? venue,
    String? imagePath,
    String? visibility,
    int? expectedGuests,
    double? budget,
    bool? sellsTickets,
    bool? isPublic,
    String? dressCode,
    String? specialInstructions,
    String? time,
    double? venueLatitude,
    double? venueLongitude,
    String? venueAddress,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/user-events/$eventId');
      final request = http.MultipartRequest('PUT', uri);
      request.headers.addAll(await _authOnlyHeaders());
      if (title != null) request.fields['title'] = title;
      if (description != null) request.fields['description'] = description;
      if (eventTypeId != null) request.fields['event_type_id'] = eventTypeId;
      if (startDate != null) request.fields['start_date'] = startDate;
      if (endDate != null) request.fields['end_date'] = endDate;
      if (time != null && time.isNotEmpty) request.fields['time'] = time;
      if (location != null) request.fields['location'] = location;
      if (venue != null) request.fields['venue'] = venue;
      if (expectedGuests != null) request.fields['expected_guests'] = '$expectedGuests';
      if (budget != null) request.fields['budget'] = '$budget';
      if (sellsTickets != null) request.fields['sells_tickets'] = sellsTickets ? 'true' : 'false';
      if (isPublic != null) request.fields['is_public'] = isPublic ? 'true' : 'false';
      if (dressCode != null) request.fields['dress_code'] = dressCode;
      if (specialInstructions != null) request.fields['special_instructions'] = specialInstructions;
      if (venueLatitude != null) request.fields['venue_latitude'] = '$venueLatitude';
      if (venueLongitude != null) request.fields['venue_longitude'] = '$venueLongitude';
      if (venueAddress != null && venueAddress.isNotEmpty) request.fields['venue_address'] = venueAddress;
      if (imagePath != null) request.files.add(await http.MultipartFile.fromPath('cover_image', imagePath));
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return jsonDecode(body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update event', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> deleteEvent(String eventId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete event'};
    }
  }

  static Future<Map<String, dynamic>> updateEventStatus(String eventId, String status) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/$eventId/status'),
        headers: await _headers(),
        body: jsonEncode({'status': status}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update status'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getGuests(String eventId, {int page = 1, int limit = 50, String? search, String? rsvpStatus}) async {
    try {
      final params = <String, String>{'page': '$page', 'limit': '$limit'};
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (rsvpStatus != null && rsvpStatus != 'all') params['rsvp_status'] = rsvpStatus;
      final uri = Uri.parse('$_baseUrl/user-events/$eventId/guests').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch guests', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addGuest(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/guests'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add guest'};
    }
  }

  static Future<Map<String, dynamic>> updateGuest(String eventId, String guestId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/$eventId/guests/$guestId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update guest'};
    }
  }

  static Future<Map<String, dynamic>> deleteGuest(String eventId, String guestId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/guests/$guestId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to remove guest'};
    }
  }

  static Future<Map<String, dynamic>> sendInvitation(String eventId, String guestId, {String method = 'whatsapp', String? customMessage}) async {
    try {
      final body = <String, dynamic>{'method': method};
      if (customMessage != null) body['custom_message'] = customMessage;
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/guests/$guestId/invite'),
        headers: await _headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to send invitation'};
    }
  }

  static Future<Map<String, dynamic>> sendBulkInvitations(String eventId, {String method = 'whatsapp', List<String>? guestIds}) async {
    try {
      final body = <String, dynamic>{'method': method};
      if (guestIds != null) body['guest_ids'] = guestIds;
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/guests/invite-all'),
        headers: await _headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to send invitations'};
    }
  }

  static Future<Map<String, dynamic>> checkinGuest(String eventId, String guestId, {int? plusOnes, String? notes}) async {
    try {
      final body = <String, dynamic>{};
      if (plusOnes != null) body['plus_ones_checked_in'] = plusOnes;
      if (notes != null) body['notes'] = notes;
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/guests/$guestId/checkin'),
        headers: await _headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to check in guest'};
    }
  }

  static Future<Map<String, dynamic>> checkinByQR(String eventId, String qrCode) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/guests/checkin-qr'),
        headers: await _headers(),
        body: jsonEncode({'qr_code': qrCode}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to check in'};
    }
  }

  static Future<Map<String, dynamic>> undoCheckin(String eventId, String guestId) async {
    try {
      final res = await http.post(Uri.parse('$_baseUrl/user-events/$eventId/guests/$guestId/undo-checkin'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to undo check-in'};
    }
  }

  static Future<Map<String, dynamic>> respondToInvitation(String eventId, String rsvpStatus, {String? mealPreference, String? dietaryRestrictions}) async {
    try {
      final body = <String, dynamic>{'rsvp_status': rsvpStatus};
      if (mealPreference != null) body['meal_preference'] = mealPreference;
      if (dietaryRestrictions != null) body['dietary_restrictions'] = dietaryRestrictions;
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/invited/$eventId/rsvp'),
        headers: await _headers(),
        body: jsonEncode(body),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to respond'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMITTEE
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getCommittee(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/committee'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch committee', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addCommitteeMember(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/committee'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add member'};
    }
  }

  static Future<Map<String, dynamic>> removeCommitteeMember(String eventId, String memberId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/committee/$memberId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to remove member'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTRIBUTORS (Address Book + Event Contributors - mirrors web API)
  // ═══════════════════════════════════════════════════════════════════════════

  /// Get user's address book contributors
  static Future<Map<String, dynamic>> getUserContributors({String? search, int page = 1, int limit = 100}) async {
    try {
      final params = <String, String>{'page': '$page', 'limit': '$limit'};
      if (search != null && search.isNotEmpty) params['search'] = search;
      final uri = Uri.parse('$_baseUrl/user-contributors/').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch contributors', 'data': null};
    }
  }

  /// Get event contributors (pledges + payments) - matches web's /user-contributors/events/{id}/contributors
  static Future<Map<String, dynamic>> getEventContributors(String eventId, {int page = 1, int limit = 1000}) async {
    try {
      final params = <String, String>{'page': '$page', 'limit': '$limit'};
      final uri = Uri.parse('$_baseUrl/user-contributors/events/$eventId/contributors').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch event contributors', 'data': null};
    }
  }

  /// Add contributor to event (new or from address book) - matches web approach
  static Future<Map<String, dynamic>> addContributorToEvent(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-contributors/events/$eventId/contributors'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add contributor'};
    }
  }

  /// Record payment for an event contributor
  static Future<Map<String, dynamic>> recordContributorPayment(String eventId, String ecId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-contributors/events/$eventId/contributors/$ecId/payments'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to record payment'};
    }
  }

  /// Update event contributor (pledge amount, notes)
  static Future<Map<String, dynamic>> updateEventContributor(String eventId, String ecId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-contributors/events/$eventId/contributors/$ecId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update contributor'};
    }
  }

  /// Remove contributor from event
  static Future<Map<String, dynamic>> removeContributorFromEvent(String eventId, String ecId) async {
    try {
      final res = await http.delete(
        Uri.parse('$_baseUrl/user-contributors/events/$eventId/contributors/$ecId'),
        headers: await _headers(),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to remove contributor'};
    }
  }

  // Legacy contribution endpoints (kept for backward compat)
  static Future<Map<String, dynamic>> getContributions(String eventId, {int page = 1, int limit = 50}) async {
    try {
      final params = <String, String>{'page': '$page', 'limit': '$limit'};
      final uri = Uri.parse('$_baseUrl/user-events/$eventId/contributions').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch contributions', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addContribution(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/contributions'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add contribution'};
    }
  }

  static Future<Map<String, dynamic>> updateContribution(String eventId, String contributionId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/$eventId/contributions/$contributionId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update contribution'};
    }
  }

  static Future<Map<String, dynamic>> deleteContribution(String eventId, String contributionId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/contributions/$contributionId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to remove contribution'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getBudget(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/budget'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch budget', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addBudgetItem(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/budget'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add budget item'};
    }
  }

  static Future<Map<String, dynamic>> deleteBudgetItem(String eventId, String itemId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/budget/$itemId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete budget item'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPENSES
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getExpenses(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/expenses'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch expenses', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addExpense(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/expenses'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add expense'};
    }
  }

  static Future<Map<String, dynamic>> deleteExpense(String eventId, String expenseId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/expenses/$expenseId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete expense'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getSchedule(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/schedule'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch schedule', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addScheduleItem(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/schedule'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add schedule item'};
    }
  }

  static Future<Map<String, dynamic>> updateScheduleItem(String eventId, String itemId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/$eventId/schedule/$itemId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update schedule item'};
    }
  }

  static Future<Map<String, dynamic>> deleteScheduleItem(String eventId, String itemId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/schedule/$itemId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete schedule item'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKLIST
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getChecklist(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/checklist'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch checklist', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addChecklistItem(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/checklist'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add checklist item'};
    }
  }

  static Future<Map<String, dynamic>> updateChecklistItem(String eventId, String itemId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/$eventId/checklist/$itemId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update checklist item'};
    }
  }

  static Future<Map<String, dynamic>> deleteChecklistItem(String eventId, String itemId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/checklist/$itemId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to delete checklist item'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getTemplates({String? eventTypeId}) async {
    try {
      final query = eventTypeId != null ? '?event_type_id=$eventTypeId' : '';
      final res = await http.get(Uri.parse('$_baseUrl/templates$query'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch templates', 'data': []};
    }
  }

  static Future<Map<String, dynamic>> applyTemplate(String eventId, String templateId, {bool clearExisting = false}) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/checklist/from-template'),
        headers: await _headers(),
        body: jsonEncode({'template_id': templateId, 'clear_existing': clearExisting}),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to apply template'};
    }
  }


  static Future<Map<String, dynamic>> getSettings() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/settings'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch settings', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> updateNotificationSettings(Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/settings/notifications'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update settings'};
    }
  }

  static Future<Map<String, dynamic>> updatePrivacySettings(Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/settings/privacy'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update settings'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY VERIFICATION (KYC)
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getVerificationStatus() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/users/verify-identity/status'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch status', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> submitVerification({
    required String documentType,
    required String frontPath,
    String? backPath,
    String? selfiePath,
  }) async {
    try {
      final uri = Uri.parse('$_baseUrl/users/verify-identity');
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(await _authOnlyHeaders());
      request.fields['document_type'] = documentType;
      request.files.add(await http.MultipartFile.fromPath('front_image', frontPath));
      if (backPath != null) request.files.add(await http.MultipartFile.fromPath('back_image', backPath));
      if (selfiePath != null) request.files.add(await http.MultipartFile.fromPath('selfie', selfiePath));
      final streamedRes = await request.send();
      final body = await streamedRes.stream.bytesToString();
      return jsonDecode(body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to submit verification'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> searchUsers(String query, {int limit = 20}) async {
    try {
      final uri = Uri.parse('$_baseUrl/users/search').replace(queryParameters: {'q': query, 'limit': '$limit'});
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Search failed', 'data': null};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTS / DOWNLOADS
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> downloadReport(String eventId, {String format = 'pdf', String section = 'full'}) async {
    try {
      final uri = Uri.parse('$_baseUrl/user-events/$eventId/report').replace(
        queryParameters: {'format': format, 'section': section},
      );
      final headers = await _headers();
      // Remove Content-Type for download - we want the raw bytes
      headers.remove('Content-Type');
      
      final res = await http.get(uri, headers: headers);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Check if the response is actually a file (not JSON error)
        final contentType = res.headers['content-type'] ?? '';
        if (contentType.contains('application/json')) {
          // API returned JSON — might be an error or might contain a download URL
          try {
            final json = jsonDecode(res.body);
            if (json['success'] == false) {
              return {'success': false, 'message': json['message'] ?? 'Unable to generate report'};
            }
            // Check for download URL in response
            final downloadUrl = json['data']?['url'] ?? json['data']?['download_url'] ?? json['url'];
            if (downloadUrl != null) {
              return await _downloadFromUrl(downloadUrl.toString(), eventId, format);
            }
            return {'success': false, 'message': 'Report generation not available for this event'};
          } catch (_) {
            return {'success': false, 'message': 'Unexpected response format'};
          }
        }
        
        // Direct file response — save it
        final dir = await getApplicationDocumentsDirectory();
        final ext = format == 'xlsx' ? 'xlsx' : 'pdf';
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        final fileName = 'event_report_${eventId}_$timestamp.$ext';
        final file = File('${dir.path}/$fileName');
        await file.writeAsBytes(res.bodyBytes);
        
        final result = await OpenFilex.open(file.path);
        if (result.type == ResultType.done) {
          return {'success': true, 'message': 'Report opened'};
        } else if (result.type == ResultType.noAppToOpen) {
          return {'success': true, 'message': 'Report saved to ${file.path}'};
        }
        return {'success': true, 'message': 'Report saved'};
      }
      
      // Non-2xx status
      try {
        final json = jsonDecode(res.body);
        return {'success': false, 'message': json['message'] ?? 'Failed to generate report (${res.statusCode})'};
      } catch (_) {
        return {'success': false, 'message': 'Failed to generate report (${res.statusCode})'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Unable to download report: ${e.toString().length > 80 ? e.toString().substring(0, 80) : e}'};
    }
  }

  /// Download a file from a URL and open it
  static Future<Map<String, dynamic>> _downloadFromUrl(String url, String eventId, String format) async {
    try {
      final res = await http.get(Uri.parse(url));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        final dir = await getApplicationDocumentsDirectory();
        final ext = format == 'xlsx' ? 'xlsx' : 'pdf';
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        final fileName = 'event_report_${eventId}_$timestamp.$ext';
        final file = File('${dir.path}/$fileName');
        await file.writeAsBytes(res.bodyBytes);
        await OpenFilex.open(file.path);
        return {'success': true, 'message': 'Report opened'};
      }
      return {'success': false, 'message': 'Failed to download report file'};
    } catch (e) {
      return {'success': false, 'message': 'Unable to download report file'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATION CARD
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getInvitationCard(String eventId, {String? guestId}) async {
    try {
      final params = <String, String>{};
      if (guestId != null) {
        params['guest_id'] = guestId;
        params['attendee_id'] = guestId;
      }
      final uri = Uri.parse('$_baseUrl/user-events/$eventId/invitation-card').replace(queryParameters: params.isNotEmpty ? params : null);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch invitation', 'data': null};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVICES MARKETPLACE
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getServices({int limit = 20, String? category, String? search}) async {
    try {
      final params = <String, String>{'limit': '$limit'};
      if (category != null) params['category'] = category;
      if (search != null) params['search'] = search;
      final uri = Uri.parse('$_baseUrl/services').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch services', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> getServiceCategories() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/references/service-categories'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch categories', 'data': null};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT TYPES (from references API)
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getEventTypes() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/references/event-types'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch event types', 'data': null};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT SERVICES — mirrors web eventsApi.getEventServices / addEventService
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> getEventServices(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/services'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch services', 'data': null};
    }
  }

  static Future<Map<String, dynamic>> addEventService(String eventId, Map<String, dynamic> data) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/services'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to add service'};
    }
  }

  static Future<Map<String, dynamic>> removeEventService(String eventId, String serviceId) async {
    try {
      final res = await http.delete(Uri.parse('$_baseUrl/user-events/$eventId/services/$serviceId'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to remove service'};
    }
  }

  /// Search public services — mirrors web servicesApi.search
  static Future<Map<String, dynamic>> searchServicesPublic(String query, {String? eventTypeId, int limit = 10}) async {
    try {
      final params = <String, String>{'search': query, 'limit': '$limit', 'sort_by': 'rating'};
      if (eventTypeId != null) params['event_type_id'] = eventTypeId;
      final uri = Uri.parse('$_baseUrl/services').replace(queryParameters: params);
      final res = await http.get(uri, headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Search failed', 'data': null};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMITTEE — additional methods for web parity
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> updateCommitteeMember(String eventId, String memberId, Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$_baseUrl/user-events/$eventId/committee/$memberId'),
        headers: await _headers(),
        body: jsonEncode(data),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to update member'};
    }
  }

  static Future<Map<String, dynamic>> resendCommitteeInvitation(String eventId, String memberId) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/user-events/$eventId/committee/$memberId/resend-invite'),
        headers: await _headers(),
      );
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to resend invitation'};
    }
  }

  /// Get assignable members (committee + creator) for task assignment
  static Future<Map<String, dynamic>> getAssignableMembers(String eventId) async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/user-events/$eventId/assignable-members'), headers: await _headers());
      return jsonDecode(res.body);
    } catch (e) {
      return {'success': false, 'message': 'Unable to fetch members', 'data': null};
    }
  }
}
