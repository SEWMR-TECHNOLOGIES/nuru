import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../theme/app_colors.dart';
import '../data/countries.dart';

// ── IP-based country detection (singleton, same logic as web) ──
class _IpCountryDetector {
  static CountryData? _detected;
  static bool _detecting = false;
  static final List<void Function(CountryData)> _listeners = [];

  static Future<CountryData> detect() async {
    if (_detected != null) return _detected!;
    if (_detecting) {
      // Wait for the in-flight detection to finish
      final completer = Completer<CountryData>();
      _listeners.add((c) => completer.complete(c));
      return completer.future;
    }
    _detecting = true;
    try {
      final res = await http.get(
        Uri.parse('https://ipapi.co/json/'),
      ).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final code = data['country_code'] as String?;
        if (code != null) {
          final found = allCountries.cast<CountryData?>().firstWhere(
            (c) => c!.code == code,
            orElse: () => null,
          );
          if (found != null) {
            _detected = found;
            for (final fn in _listeners) { fn(found); }
            _listeners.clear();
            return found;
          }
        }
      }
    } catch (_) {
      // fallback silently
    } finally {
      _detecting = false;
    }
    final fallback = allCountries.firstWhere((c) => c.code == 'TZ', orElse: () => allCountries.first);
    _detected = fallback;
    for (final fn in _listeners) { fn(fallback); }
    _listeners.clear();
    return fallback;
  }
}

/// Modern country phone input with searchable bottom sheet picker.
/// Supports IP-based auto-detection matching web logic.
class CountryPhoneInput extends StatefulWidget {
  final TextEditingController controller;
  final String? initialCountryCode;
  final bool autoDetect;
  final ValueChanged<String>? onFullNumberChanged;
  final String? Function(String?)? validator;

  const CountryPhoneInput({
    super.key,
    required this.controller,
    this.initialCountryCode = 'TZ',
    this.autoDetect = true,
    this.onFullNumberChanged,
    this.validator,
  });

  @override
  State<CountryPhoneInput> createState() => _CountryPhoneInputState();
}

class _CountryPhoneInputState extends State<CountryPhoneInput> {
  late CountryData _selected;
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _selected = allCountries.firstWhere(
      (c) => c.code == widget.initialCountryCode,
      orElse: () => allCountries.first,
    );
    widget.controller.addListener(_notify);

    // Auto-detect country by IP (same as web)
    if (widget.autoDetect) {
      _IpCountryDetector.detect().then((detected) {
        if (mounted && widget.controller.text.isEmpty) {
          setState(() => _selected = detected);
          _notify();
        }
      });
    }
  }

  void _notify() {
    final digits = widget.controller.text.replaceAll(RegExp(r'[^\d]'), '');
    widget.onFullNumberChanged?.call('${_selected.dialCode}$digits');
  }

  void _openPicker() async {
    final result = await showModalBottomSheet<CountryData>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CountrySheet(selected: _selected),
    );
    if (result != null && mounted) {
      setState(() => _selected = result);
      _notify();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 8),
          child: Text(
            'Phone Number',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _focused ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: _focused ? AppColors.surface : AppColors.surfaceVariant,
            border: Border.all(
              color: _focused ? AppColors.primary : AppColors.borderLight,
              width: _focused ? 1.5 : 1,
            ),
            boxShadow: _focused
                ? [BoxShadow(color: AppColors.primary.withOpacity(0.06), blurRadius: 16, offset: const Offset(0, 4))]
                : [],
          ),
          child: Row(
            children: [
              // Country picker
              GestureDetector(
                onTap: _openPicker,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  decoration: BoxDecoration(
                    border: Border(
                      right: BorderSide(color: _focused ? AppColors.primary.withOpacity(0.2) : AppColors.borderLight),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_selected.flag, style: const TextStyle(fontSize: 20)),
                      const SizedBox(width: 6),
                      Text(
                        _selected.dialCode,
                        style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.expand_more_rounded, size: 18, color: AppColors.textTertiary),
                    ],
                  ),
                ),
              ),

              // Phone field
              Expanded(
                child: TextFormField(
                  controller: widget.controller,
                  keyboardType: TextInputType.phone,
                  validator: widget.validator,
                  style: GoogleFonts.plusJakartaSans(fontSize: 15, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                  onTap: () => setState(() => _focused = true),
                  onEditingComplete: () => setState(() => _focused = false),
                  onTapOutside: (_) {
                    setState(() => _focused = false);
                    FocusScope.of(context).unfocus();
                  },
                  decoration: InputDecoration(
                    hintText: '7XX XXX XXX',
                    hintStyle: GoogleFonts.plusJakartaSans(color: AppColors.textHint, fontSize: 15),
                    filled: false,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CountrySheet extends StatefulWidget {
  final CountryData selected;
  const _CountrySheet({required this.selected});

  @override
  State<_CountrySheet> createState() => _CountrySheetState();
}

class _CountrySheetState extends State<_CountrySheet> {
  final _searchCtrl = TextEditingController();
  List<CountryData> _filtered = allCountries;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      final q = _searchCtrl.text.toLowerCase();
      setState(() {
        _filtered = allCountries
            .where((c) => c.name.toLowerCase().contains(q) || c.dialCode.contains(q) || c.code.toLowerCase().contains(q))
            .toList();
      });
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text('Select Country', style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _searchCtrl,
              autofocus: true,
              style: GoogleFonts.plusJakartaSans(fontSize: 15, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search country...',
                hintStyle: GoogleFonts.plusJakartaSans(color: AppColors.textHint),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textTertiary, size: 20),
                filled: true,
                fillColor: AppColors.surfaceVariant,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.borderLight)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _filtered.length,
              itemBuilder: (_, i) {
                final c = _filtered[i];
                final selected = c.code == widget.selected.code;
                return ListTile(
                  onTap: () => Navigator.pop(context, c),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  selected: selected,
                  selectedTileColor: AppColors.primarySoft,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                  leading: Text(c.flag, style: const TextStyle(fontSize: 26)),
                  title: Text(c.name, style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? AppColors.primary : AppColors.textPrimary)),
                  trailing: Text(c.dialCode, style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? AppColors.primary : AppColors.textTertiary)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Mask a phone number for display (e.g. "255712345678" → "+255 7** ***78")
String maskPhoneDisplay(String fullNumber) {
  if (fullNumber.isEmpty) return '';
  final cleaned = fullNumber.replaceAll(RegExp(r'[^\d]'), '');
  if (cleaned.length < 6) return '***';

  // Find country dial code
  String dialCode = '';
  String local = cleaned;
  final sorted = List<CountryData>.from(allCountries)
    ..sort((a, b) => b.dialCode.length.compareTo(a.dialCode.length));
  for (final c in sorted) {
    final code = c.dialCode.replaceAll('+', '');
    if (cleaned.startsWith(code)) {
      dialCode = code;
      local = cleaned.substring(code.length);
      break;
    }
  }
  if (dialCode.isEmpty) {
    dialCode = cleaned.substring(0, 3);
    local = cleaned.substring(3);
  }
  if (local.length <= 3) return '+$dialCode ${'*' * local.length}';
  final first = local[0];
  final last2 = local.substring(local.length - 2);
  final masked = first + '*' * (local.length - 3) + last2;
  // Group in threes
  final groups = <String>[];
  for (var i = 0; i < masked.length; i += 3) {
    groups.add(masked.substring(i, (i + 3).clamp(0, masked.length)));
  }
  return '+$dialCode ${groups.join(' ')}';
}
