import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Auto-formats numeric input with thousand separators (e.g. 1,500,000).
/// The underlying controller stores the FORMATTED string. Use [rawValue]
/// or [parseAmount] to read the digits-only value back out for API calls.
class AmountInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) {
      return const TextEditingValue(text: '');
    }
    final buf = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      final fromRight = digits.length - i;
      buf.write(digits[i]);
      if (fromRight > 1 && fromRight % 3 == 1) buf.write(',');
    }
    final formatted = buf.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

/// Convert a formatted amount string ("1,500,000") to digits ("1500000").
String rawAmount(String input) => input.replaceAll(RegExp(r'[^0-9.]'), '');

/// Parse a possibly formatted amount to a double (or null if empty/invalid).
double? parseAmount(String input) {
  final s = rawAmount(input);
  if (s.isEmpty) return null;
  return double.tryParse(s);
}

int? parseAmountInt(String input) {
  final s = input.replaceAll(RegExp(r'[^0-9]'), '');
  if (s.isEmpty) return null;
  return int.tryParse(s);
}

final amountFormatters = <TextInputFormatter>[AmountInputFormatter()];
