import 'package:nuru/core/services/api_service.dart';

class MeetingsService {
  Future<Map<String, dynamic>> listMeetings(String eventId) async {
    return await ApiService.get('/events/$eventId/meetings');
  }

  Future<Map<String, dynamic>> getMeeting(String eventId, String meetingId) async {
    return await ApiService.get('/events/$eventId/meetings/$meetingId');
  }

  Future<Map<String, dynamic>> createMeeting(String eventId, {
    required String title,
    String? description,
    required String scheduledAt,
    String? timezone,
    String durationMinutes = '60',
    List<String> participantUserIds = const [],
    String? passcode,
  }) async {
    return await ApiService.post('/events/$eventId/meetings', {
      'title': title,
      'description': description,
      'scheduled_at': scheduledAt,
      'timezone': timezone ?? DateTime.now().timeZoneName,
      'duration_minutes': durationMinutes,
      'participant_user_ids': participantUserIds,
      if (passcode != null && passcode.isNotEmpty) 'passcode': passcode,
    });
  }

  Future<Map<String, dynamic>> updateMeeting(String eventId, String meetingId, {
    String? title,
    String? description,
    String? scheduledAt,
    String? timezone,
    String? durationMinutes,
  }) async {
    final body = <String, dynamic>{};
    if (title != null) body['title'] = title;
    if (description != null) body['description'] = description;
    if (scheduledAt != null) body['scheduled_at'] = scheduledAt;
    if (timezone != null) body['timezone'] = timezone;
    if (durationMinutes != null) body['duration_minutes'] = durationMinutes;
    return await ApiService.put('/events/$eventId/meetings/$meetingId', body);
  }

  Future<Map<String, dynamic>> deleteMeeting(String eventId, String meetingId) async {
    return await ApiService.delete('/events/$eventId/meetings/$meetingId');
  }

  Future<Map<String, dynamic>> joinMeeting(String eventId, String meetingId) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/join', {});
  }

  Future<Map<String, dynamic>> leaveMeeting(String eventId, String meetingId) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/leave', {});
  }

  Future<Map<String, dynamic>> endMeeting(String eventId, String meetingId) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/end', {});
  }

  Future<Map<String, dynamic>> addParticipants(String eventId, String meetingId, List<String> userIds) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/participants', {
      'user_ids': userIds,
    });
  }

  Future<Map<String, dynamic>> getMeetingToken(String eventId, String meetingId) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/token', {});
  }

  // Waiting room
  Future<Map<String, dynamic>> listJoinRequests(String eventId, String meetingId) async {
    return await ApiService.get('/events/$eventId/meetings/$meetingId/join-requests');
  }

  Future<Map<String, dynamic>> reviewJoinRequest(String eventId, String meetingId, String requestId, String action) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/join-requests/$requestId', {
      'action': action,
    });
  }

  Future<Map<String, dynamic>> checkJoinStatus(String eventId, String meetingId) async {
    return await ApiService.get('/events/$eventId/meetings/$meetingId/join-status');
  }

  // Co-host
  Future<Map<String, dynamic>> setCoHost(String eventId, String meetingId, String userId, bool isCoHost) async {
    return await ApiService.post('/events/$eventId/meetings/$meetingId/co-host', {
      'user_id': userId,
      'is_co_host': isCoHost,
    });
  }

  Future<Map<String, dynamic>> getByRoom(String roomId) async {
    return await ApiService.get('/meetings/room/$roomId', auth: false);
  }

  Future<Map<String, dynamic>> myMeetings() async {
    return await ApiService.get('/meetings/my');
  }
}
