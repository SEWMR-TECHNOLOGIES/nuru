import 'api_base.dart';

/// WalletService — wraps backend `/wallet`, `/payments`, `/payment-profiles`
/// endpoints. All responses use the standard `{success, message, data}` shape.
class WalletService {
  // ── Wallets ──
  static Future<Map<String, dynamic>> listWallets() {
    return ApiBase.get('/wallet', fallbackError: 'Unable to load wallet');
  }

  static Future<Map<String, dynamic>> getLedger(
    String walletId, {
    int page = 1,
    int limit = 25,
  }) {
    return ApiBase.get(
      '/wallet/$walletId/ledger',
      queryParams: {'page': '$page', 'limit': '$limit'},
      fallbackError: 'Unable to load ledger',
    );
  }

  // ── Payments ──
  static Future<Map<String, dynamic>> listProviders({
    required String countryCode,
    bool collection = true,
    bool? payout,
  }) {
    String? purpose;
    if (payout == true) {
      purpose = 'payout';
    } else if (collection) {
      purpose = 'collection';
    }

    final params = <String, String>{
      'country_code': countryCode,
      if (purpose != null) 'purpose': purpose,
    };
    return ApiBase.get(
      '/payments/providers',
      queryParams: params,
      fallbackError: 'Unable to load providers',
    );
  }

  static Future<Map<String, dynamic>> initiatePayment({
    required String targetType,
    String? targetId,
    String? beneficiaryUserId,
    required num amount,
    String? countryCode,
    String? currencyCode,
    String? methodType,
    String? paymentChannel,
    String? providerId,
    String? phone,
    String? accountNumber,
    String? description,
    bool useWallet = false,
  }) {
    return ApiBase.post('/payments/initiate', {
      'target_type': targetType,
      if (targetId != null) 'target_id': targetId,
      if (beneficiaryUserId != null) 'beneficiary_user_id': beneficiaryUserId,
      'gross_amount': amount,
      if (countryCode != null) 'country_code': countryCode,
      if (currencyCode != null) 'currency_code': currencyCode,
      if (methodType != null) 'method_type': methodType,
      if (paymentChannel != null) 'payment_channel': paymentChannel,
      if (providerId != null) 'provider_id': providerId,
      if (phone != null) 'phone_number': phone,
      if (accountNumber != null) 'account_number': accountNumber,
      if (description != null) 'payment_description': description,
      'use_wallet': useWallet,
    });
  }

  static Future<Map<String, dynamic>> getStatus(String transactionCode) {
    return ApiBase.get(
      '/payments/${Uri.encodeComponent(transactionCode)}/status',
      fallbackError: 'Unable to fetch status',
    );
  }

  static Future<Map<String, dynamic>> history({int page = 1, int limit = 25}) {
    return ApiBase.get(
      '/payments/my-transactions',
      queryParams: {'page': '$page', 'limit': '$limit'},
      fallbackError: 'Unable to load transactions',
    );
  }

  // ── Payout profiles ──
  static Future<Map<String, dynamic>> listProfiles() {
    return ApiBase.get('/payment-profiles', fallbackError: 'Unable to load payout profiles');
  }

  static Future<Map<String, dynamic>> createProfile(Map<String, dynamic> data) {
    return ApiBase.post('/payment-profiles', data);
  }

  static Future<Map<String, dynamic>> setDefaultProfile(String id) {
    return ApiBase.post('/payment-profiles/$id/default', {});
  }

  static Future<Map<String, dynamic>> deleteProfile(String id) {
    return ApiBase.delete('/payment-profiles/$id');
  }

  // ── Country / currency ──
  static Future<Map<String, dynamic>> confirmCountry({
    required String countryCode,
    String source = 'manual',
  }) {
    return ApiBase.post('/users/me/country', {
      'country_code': countryCode,
      'source': source,
    });
  }
}
