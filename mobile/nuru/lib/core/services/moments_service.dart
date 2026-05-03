import 'api_base.dart';

/// Service for the /moments endpoints (stories/reels).
///
/// Backend visibility: only authors the current user follows OR has in their
/// accepted circle, plus the current user.
class MomentsService {
  /// Returns the grouped feed:
  /// `[{ user: {id, name, avatar, is_self}, moments: [...], all_seen, latest_created_at }]`
  static Future<Map<String, dynamic>> getFeed() async {
    return ApiBase.get('/moments/');
  }

  static Future<Map<String, dynamic>> getMyMoments() async {
    return ApiBase.get('/moments/me');
  }

  static Future<Map<String, dynamic>> getUserMoments(String userId) async {
    return ApiBase.get('/moments/user/$userId');
  }

  /// Create a moment. For text moments pass `contentType: 'text'`, `caption`
  /// (the body) and an optional `backgroundColor` (e.g. '#0F172A').
  /// For media moments pass `mediaPath` to upload.
  static Future<Map<String, dynamic>> createMoment({
    String? caption,
    String? location,
    String? mediaPath,
    String contentType = 'image',
    String? backgroundColor,
    int durationHours = 24,
  }) async {
    final fields = <String, String>{
      'content_type': contentType,
      'duration_hours': durationHours.toString(),
    };
    if (caption != null && caption.isNotEmpty) fields['content'] = caption;
    if (location != null && location.isNotEmpty) fields['location'] = location;
    if (backgroundColor != null && backgroundColor.isNotEmpty) {
      fields['background_color'] = backgroundColor;
    }
    final files = <MapEntry<String, String>>[];
    if (mediaPath != null && mediaPath.isNotEmpty) {
      files.add(MapEntry('media', mediaPath));
    }
    return ApiBase.postMultipart('/moments/', fields: fields, files: files);
  }

  static Future<Map<String, dynamic>> deleteMoment(String momentId) async {
    return ApiBase.delete('/moments/$momentId');
  }

  static Future<Map<String, dynamic>> markSeen(String momentId) async {
    return ApiBase.post('/moments/$momentId/seen', {});
  }

  static Future<Map<String, dynamic>> getViewers(String momentId) async {
    return ApiBase.get('/moments/$momentId/viewers');
  }
}
