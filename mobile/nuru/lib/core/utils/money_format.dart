import 'package:intl/intl.dart';

/// Currency-aware money formatter used across the wallet/payment screens.
/// Defaults to 0 decimals (TZS/KES are whole-unit currencies).
String formatMoney(num amount, {String? currency, bool symbolFirst = true}) {
  final fmt = NumberFormat.decimalPattern();
  final body = fmt.format(amount);
  if (currency == null || currency.isEmpty) return body;
  return symbolFirst ? '$currency $body' : '$body $currency';
}
