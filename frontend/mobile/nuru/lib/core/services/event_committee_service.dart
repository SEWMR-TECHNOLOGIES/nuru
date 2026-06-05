import 'api_base.dart';

class EventCommitteeService {
  static Future<Map<String, dynamic>> getCommittee(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/committee');
  }

  static Future<Map<String, dynamic>> addCommitteeMember(
    String eventId,
    Map<String, dynamic> data,
  ) {
    return ApiBase.postRaw('/user-events/$eventId/committee', data);
  }

  static Future<Map<String, dynamic>> removeCommitteeMember(
    String eventId,
    String memberId,
  ) {
    return ApiBase.deleteRaw('/user-events/$eventId/committee/$memberId');
  }

  static Future<Map<String, dynamic>> updateCommitteeMember(
    String eventId,
    String memberId,
    Map<String, dynamic> data,
  ) {
    return ApiBase.putRaw('/user-events/$eventId/committee/$memberId', data);
  }

  static Future<Map<String, dynamic>> resendCommitteeInvitation(
    String eventId,
    String memberId,
  ) {
    return ApiBase.postRaw(
      '/user-events/$eventId/committee/$memberId/resend-invite',
      {},
    );
  }

  static Future<Map<String, dynamic>> getAssignableMembers(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/assignable-members');
  }
}
