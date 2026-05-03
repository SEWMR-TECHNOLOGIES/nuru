import 'package:intl/intl.dart';

/// Global active currency for the signed-in user. Set on auth/profile load.
/// Falls back to 'TZS' only if nothing has been resolved yet.
String _activeCurrency = 'TZS';

void setActiveCurrency(String? code) {
  if (code != null && code.trim().isNotEmpty) {
    _activeCurrency = code.trim().toUpperCase();
  }
}

String getActiveCurrency() => _activeCurrency;

/// Currency-aware money formatter used across the wallet/payment screens.
/// Defaults to 0 decimals (TZS/KES are whole-unit currencies).
/// When [currency] is null/empty, falls back to the active user currency.
String formatMoney(num amount, {String? currency, bool symbolFirst = true, bool bare = false}) {
  final fmt = NumberFormat.decimalPattern();
  final body = fmt.format(amount);
  if (bare) return body;
  final code = (currency != null && currency.trim().isNotEmpty)
      ? currency.trim().toUpperCase()
      : _activeCurrency;
  return symbolFirst ? '$code $body' : '$body $code';
}
