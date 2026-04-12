import 'package:nuru/core/services/api_service.dart';

class MeetingDocsService {
  // Agenda
  Future<Map<String, dynamic>> listAgenda(String eventId, String meetingId) async {
    return await ApiService.get('/events/$eventId/meetings/$meetingId/agenda');
  }

  Future<Map<String, dynamic>> createAgendaItem(String eventId, String meetingId, {
    required String title,
    String? description,
    int? durationMinutes,
    String? presenterUserId,
    int? sortOrder,
  }) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/agenda', {
      'title': title,
      'description': description,
      'duration_minutes': durationMinutes,
      'presenter_user_id': presenterUserId,
      'sort_order': sortOrder,
    });
  }

  Future<Map<String, dynamic>> updateAgendaItem(String eventId, String meetingId, String itemId, Map<String, dynamic> data) async {
    return await ApiService.put('/events/$eventId/meetings/$meetingId/agenda/$itemId', data);
  }

  Future<Map<String, dynamic>> deleteAgendaItem(String eventId, String meetingId, String itemId) async {
    return await ApiService.delete('/events/$eventId/meetings/$meetingId/agenda/$itemId');
  }

  // Minutes
  Future<Map<String, dynamic>> getMinutes(String eventId, String meetingId) async {
    return await ApiService.get('/events/$eventId/meetings/$meetingId/minutes');
  }

  Future<Map<String, dynamic>> createMinutes(String eventId, String meetingId, Map<String, dynamic> data) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/minutes', data);
  }

  Future<Map<String, dynamic>> updateMinutes(String eventId, String meetingId, Map<String, dynamic> data) async {
    return await ApiService.put('/events/$eventId/meetings/$meetingId/minutes', data);
  }

  Future<Map<String, dynamic>> deleteMinutes(String eventId, String meetingId) async {
    return await ApiService.delete('/events/$eventId/meetings/$meetingId/minutes');
  }
}
