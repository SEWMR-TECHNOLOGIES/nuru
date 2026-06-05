import 'api_base.dart';

/// Reminder Automations API client.
/// Mirrors web src/lib/api/reminderAutomations.ts
class AutomationsService {
  AutomationsService._();

  // ── Templates ──
  static Future<Map<String, dynamic>> listTemplates({
    String? automationType,
    String? language,
  }) {
    final q = <String, String>{};
    if (automationType != null) q['automation_type'] = automationType;
    if (language != null) q['language'] = language;
    return ApiBase.get('/reminder-templates', queryParams: q.isEmpty ? null : q);
  }

  // ── Automations ──
  static Future<Map<String, dynamic>> list(String eventId) =>
      ApiBase.get('/events/$eventId/automations');

  static Future<Map<String, dynamic>> create(
    String eventId,
    Map<String, dynamic> payload,
  ) => ApiBase.post('/events/$eventId/automations', payload);

  static Future<Map<String, dynamic>> getOne(String eventId, String id) =>
      ApiBase.get('/events/$eventId/automations/$id');

  static Future<Map<String, dynamic>> update(
    String eventId,
    String id,
    Map<String, dynamic> payload,
  ) => ApiBase.patch('/events/$eventId/automations/$id', payload,
      fallbackError: 'Update failed');

  static Future<Map<String, dynamic>> remove(String eventId, String id) =>
      ApiBase.delete('/events/$eventId/automations/$id');

  static Future<Map<String, dynamic>> enable(String eventId, String id) =>
      ApiBase.post('/events/$eventId/automations/$id/enable', {});

  static Future<Map<String, dynamic>> disable(String eventId, String id) =>
      ApiBase.post('/events/$eventId/automations/$id/disable', {});

  static Future<Map<String, dynamic>> preview(
    String eventId,
    String id, {
    String? bodyOverride,
    String? language,
  }) {
    final body = <String, dynamic>{};
    if (bodyOverride != null) body['body_override'] = bodyOverride;
    if (language != null) body['language'] = language;
    return ApiBase.post('/events/$eventId/automations/$id/preview', body);
  }

  static Future<Map<String, dynamic>> sendNow(String eventId, String id) =>
      ApiBase.post('/events/$eventId/automations/$id/send-now', {});

  static Future<Map<String, dynamic>> listRuns(
    String eventId,
    String id, {
    int limit = 20,
  }) => ApiBase.get(
        '/events/$eventId/automations/$id/runs',
        queryParams: {'limit': '$limit'},
      );

  static Future<Map<String, dynamic>> listRecipients(
    String eventId,
    String id,
    String runId, {
    String? status,
  }) => ApiBase.get(
        '/events/$eventId/automations/$id/runs/$runId/recipients',
        queryParams: status != null && status.isNotEmpty ? {'status': status} : null,
      );

  static Future<Map<String, dynamic>> resendFailed(
    String eventId,
    String id,
    String runId,
  ) => ApiBase.post(
        '/events/$eventId/automations/$id/runs/$runId/resend-failed',
        {},
      );
}

// ── Constants mirroring the web page ──

const Map<String, String> kAutomationTypeLabelsEn = {
  'fundraise_attend': 'Fundraising attendance',
  'pledge_remind': 'Contribution payment reminder',
  'guest_remind': 'Guest event reminder',
};

const Map<String, String> kAutomationTypeLabelsSw = {
  'fundraise_attend': 'Mwaliko wa kuchangia',
  'pledge_remind': 'Kukumbusha malipo ya ahadi',
  'guest_remind': 'Kukumbusha mgeni tukio',
};

const Map<String, String> kScheduleKindLabels = {
  'now': 'Manual send',
  'datetime': 'Specific date & time',
  'days_before': 'N days before event',
  'hours_before': 'N hours before event',
  'repeat': 'Repeating',
};

const Map<String, String> kLanguageLabels = {
  'en': 'English',
  'sw': 'Kiswahili',
};
