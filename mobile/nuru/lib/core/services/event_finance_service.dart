import 'api_base.dart';

class EventFinanceService {
  static Future<Map<String, dynamic>> getBudget(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/budget');
  }

  static Future<Map<String, dynamic>> addBudgetItem(String eventId, Map<String, dynamic> data) {
    return ApiBase.postRaw('/user-events/$eventId/budget', data);
  }

  static Future<Map<String, dynamic>> deleteBudgetItem(String eventId, String itemId) {
    return ApiBase.deleteRaw('/user-events/$eventId/budget/$itemId');
  }

  static Future<Map<String, dynamic>> getExpenses(String eventId) {
    return ApiBase.getRaw('/user-events/$eventId/expenses');
  }

  static Future<Map<String, dynamic>> addExpense(String eventId, Map<String, dynamic> data) {
    return ApiBase.postRaw('/user-events/$eventId/expenses', data);
  }

  static Future<Map<String, dynamic>> deleteExpense(String eventId, String expenseId) {
    return ApiBase.deleteRaw('/user-events/$eventId/expenses/$expenseId');
  }

  static Future<Map<String, dynamic>> getContributions(String eventId, {int page = 1, int limit = 50}) {
    final params = <String, String>{'page': '$page', 'limit': '$limit'};
    return ApiBase.get('/user-events/$eventId/contributions', queryParams: params, fallbackError: 'Unable to fetch contributions');
  }

  static Future<Map<String, dynamic>> addContribution(String eventId, Map<String, dynamic> data) {
    return ApiBase.postRaw('/user-events/$eventId/contributions', data);
  }

  static Future<Map<String, dynamic>> updateContribution(String eventId, String contributionId, Map<String, dynamic> data) {
    return ApiBase.putRaw('/user-events/$eventId/contributions/$contributionId', data);
  }

  static Future<Map<String, dynamic>> deleteContribution(String eventId, String contributionId) {
    return ApiBase.deleteRaw('/user-events/$eventId/contributions/$contributionId');
  }
}
