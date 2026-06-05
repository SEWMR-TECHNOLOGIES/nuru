import 'api_base.dart';

/// Mobile parity for the web `ticketOfflineClaimsApi` and the multipart
/// receipt-upload variants of self-contribute & ticket-class offline claim.
///
/// The submit*OfflineClaim helpers accept an optional `receiptImagePath`
/// pointing to a JPG/PNG/WebP file; the backend enforces the 4KB–5MB limit.
class OfflineClaimsService {
  // ── Submission (buyer / contributor side) ────────────────────────────

  /// Submit an offline-paid contribution to an event. Used by the mobile
  /// "Already paid another way" flow on the contribution checkout sheet.
  static Future<Map<String, dynamic>> submitContributionOfflineClaim(
    String eventId, {
    required String paymentChannel, // 'mobile_money' | 'bank'
    required String transactionCode,
    required num amount,
    String? providerName,
    String? providerId,
    String? payerAccount,
    String? note,
    String? receiptImagePath,
  }) {
    final fields = <String, String>{
      'payment_channel': paymentChannel,
      'transaction_code': transactionCode,
      'amount': amount.toString(),
      if (providerName != null) 'provider_name': providerName,
      if (providerId != null) 'provider_id': providerId,
      if (payerAccount != null) 'payer_account': payerAccount,
      if (note != null) 'note': note,
    };
    final files = <MapEntry<String, String>>[];
    if (receiptImagePath != null) {
      files.add(MapEntry('receipt_image', receiptImagePath));
    }
    return ApiBase.postMultipart(
      '/user-contributors/events/$eventId/self-contribute',
      fields: fields,
      files: files,
    );
  }

  /// Submit an offline-paid claim against a ticket class.
  static Future<Map<String, dynamic>> submitTicketOfflineClaim(
    String ticketClassId, {
    required String claimantName,
    required int quantity,
    required num amount,
    required String paymentChannel,
    required String transactionCode,
    String? claimantPhone,
    String? claimantEmail,
    String? providerName,
    String? providerId,
    String? payerAccount,
    String? receiptImagePath,
  }) {
    final fields = <String, String>{
      'claimant_name': claimantName,
      'quantity': quantity.toString(),
      'amount': amount.toString(),
      'payment_channel': paymentChannel,
      'transaction_code': transactionCode,
      if (claimantPhone != null) 'claimant_phone': claimantPhone,
      if (claimantEmail != null) 'claimant_email': claimantEmail,
      if (providerName != null) 'provider_name': providerName,
      if (providerId != null) 'provider_id': providerId,
      if (payerAccount != null) 'payer_account': payerAccount,
    };
    final files = <MapEntry<String, String>>[];
    if (receiptImagePath != null) {
      files.add(MapEntry('receipt_image', receiptImagePath));
    }
    return ApiBase.postMultipart(
      '/ticketing/classes/$ticketClassId/offline-claim',
      fields: fields,
      files: files,
    );
  }

  // ── Organiser-side review queue ──────────────────────────────────────

  static Future<Map<String, dynamic>> listEventClaims(
    String eventId, {
    String? status, // pending | confirmed | rejected
  }) {
    final qs = status != null ? '?status=$status' : '';
    return ApiBase.get(
      '/ticketing/events/$eventId/offline-claims$qs',
      fallbackError: 'Unable to fetch offline claims',
    );
  }

  static Future<Map<String, dynamic>> confirmClaim(String claimId) {
    return ApiBase.postRaw('/ticketing/offline-claims/$claimId/confirm', {});
  }

  static Future<Map<String, dynamic>> rejectClaim(String claimId, {String? rejectionReason}) {
    return ApiBase.postRaw(
      '/ticketing/offline-claims/$claimId/reject',
      rejectionReason == null ? {} : {'rejection_reason': rejectionReason},
    );
  }

  /// Buyer's own offline claim history.
  static Future<Map<String, dynamic>> myClaims() {
    return ApiBase.get('/ticketing/my-offline-claims', fallbackError: 'Unable to fetch your claims');
  }
}
