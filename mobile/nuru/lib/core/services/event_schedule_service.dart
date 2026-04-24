import 'api_base.dart';

class EventScheduleService {
  static Future<Map<String, dynamic>> getSchedule(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/schedule');
  }

  static Future<Map<String, dynamic>> addScheduleItem(String eventId, Map<String, dynamic> data) {
    return ApiBase.postRaw('/user-events/$eventId/schedule', data);
  }

  static Future<Map<String, dynamic>> updateScheduleItem(String eventId, String itemId, Map<String, dynamic> data) {
    return ApiBase.putRaw('/user-events/$eventId/schedule/$itemId', data);
  }

  static Future<Map<String, dynamic>> deleteScheduleItem(String eventId, String itemId) {
    return ApiBase.deleteRaw('/user-events/$eventId/schedule/$itemId');
  }

  static Future<Map<String, dynamic>> getChecklist(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/checklist');
  }

  static Future<Map<String, dynamic>> addChecklistItem(String eventId, Map<String, dynamic> data) {
    return ApiBase.postRaw('/user-events/$eventId/checklist', data);
  }

  static Future<Map<String, dynamic>> updateChecklistItem(String eventId, String itemId, Map<String, dynamic> data) {
    return ApiBase.putRaw('/user-events/$eventId/checklist/$itemId', data);
  }

  static Future<Map<String, dynamic>> deleteChecklistItem(String eventId, String itemId) {
    return ApiBase.deleteRaw('/user-events/$eventId/checklist/$itemId');
  }

  static Future<Map<String, dynamic>> getTemplates({String? eventTypeId}) {
    final query = eventTypeId != null ? '?event_type_id=$eventTypeId' : '';
    return ApiBase.getRaw('/templates$query');
  }

  static Future<Map<String, dynamic>> applyTemplate(String eventId, String templateId, {bool clearExisting = false}) {
    return ApiBase.postRaw('/user-events/$eventId/checklist/from-template', {
      'template_id': templateId,
      'clear_existing': clearExisting,
    });
  }
}
