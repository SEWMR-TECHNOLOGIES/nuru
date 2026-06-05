import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/locale_provider.dart';
import 'app_translations.dart';

/// Convenience extension to translate strings anywhere with context
extension L10nContext on BuildContext {
  String tr(String key) {
    final locale = read<LocaleProvider>().languageCode;
    return AppTranslations.tr(key, locale);
  }

  /// Watch locale changes to rebuild widgets
  String trw(String key) {
    final locale = watch<LocaleProvider>().languageCode;
    return AppTranslations.tr(key, locale);
  }
}

/// Standalone translate function for use outside of build methods
String translate(String key, String locale) {
  return AppTranslations.tr(key, locale);
}
