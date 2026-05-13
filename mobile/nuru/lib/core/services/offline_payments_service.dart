import 'api_base.dart';

class OfflinePaymentsService {
  static Future<Map<String, dynamic>> log(
    String eventId,
    String eventServiceId,
    Map<String, dynamic> body,
  ) {
    return ApiBase.postRaw(
      '/user-events/$eventId/services/$eventServiceId/offline-payments',
      body,
    );
  }

  static Future<Map<String, dynamic>> listForEvent(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/offline-payments');
  }

  static Future<Map<String, dynamic>> listMine() {
    return ApiBase.getRaw('/user-events/me/offline-payments');
  }

  static Future<Map<String, dynamic>> confirm(String paymentId, String otp) {
    return ApiBase.postRaw(
      '/user-events/offline-payments/$paymentId/confirm',
      {'otp': otp},
    );
  }

  static Future<Map<String, dynamic>> resend(String paymentId) {
    return ApiBase.postRaw(
      '/user-events/offline-payments/$paymentId/resend-otp',
      {},
    );
  }

  static Future<Map<String, dynamic>> cancel(String paymentId) {
    return ApiBase.postRaw(
      '/user-events/offline-payments/$paymentId/cancel',
      {},
    );
  }
}
