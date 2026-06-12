import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_icon.dart';

/// Standard search input used across the app.
///
/// Visual contract (matches the conversation-list search):
///  - 48px tall pill (BorderRadius 28)
///  - White fill with 1px #EDEDEF border
///  - Leading project SVG search icon (20, #8E8E93) and 12px gap
///  - GoogleFonts.inter(14) text and #9E9E9E hint
///  - Optional trailing clear button when text is present
///
/// Use this widget anywhere you need a search field (lists, tabs, filters)
/// instead of building a bespoke `TextField` decoration.
class NuruSearchBar extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final String hintText;
  final Duration debounce;
  final VoidCallback? onClear;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final EdgeInsetsGeometry padding;

  const NuruSearchBar({
    super.key,
    this.value = '',
    required this.onChanged,
    this.hintText = 'Search…',
    this.debounce = const Duration(milliseconds: 300),
    this.onClear,
    this.controller,
    this.focusNode,
    this.padding = EdgeInsets.zero,
  });

  @override
  State<NuruSearchBar> createState() => _NuruSearchBarState();
}

class _NuruSearchBarState extends State<NuruSearchBar> {
  late TextEditingController _ctrl;
  Timer? _debounce;
  bool _ownsCtrl = false;

  @override
  void initState() {
    super.initState();
    if (widget.controller != null) {
      _ctrl = widget.controller!;
    } else {
      _ctrl = TextEditingController(text: widget.value);
      _ownsCtrl = true;
    }
    _ctrl.addListener(_handleListener);
  }

  void _handleListener() => setState(() {});

  @override
  void didUpdateWidget(covariant NuruSearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.controller == null && widget.value != _ctrl.text) {
      _ctrl.text = widget.value;
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.removeListener(_handleListener);
    if (_ownsCtrl) _ctrl.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    if (widget.debounce == Duration.zero) {
      widget.onChanged(v);
    } else {
      _debounce = Timer(widget.debounce, () => widget.onChanged(v));
    }
  }

  void _clear() {
    _ctrl.clear();
    _debounce?.cancel();
    widget.onChanged('');
    widget.onClear?.call();
  }

  @override
  Widget build(BuildContext context) {
    final hasText = _ctrl.text.isNotEmpty;
    return Padding(
      padding: widget.padding,
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0xFFEDEDEF), width: 1),
        ),
        child: Row(children: [
          const AppIcon('search', size: 20, color: Color(0xFF8E8E93)),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _ctrl,
              focusNode: widget.focusNode,
              onChanged: _onChanged,
              cursorColor: Colors.black,
              textAlignVertical: TextAlignVertical.center,
              style: GoogleFonts.inter(fontSize: 14, color: Colors.black),
              decoration: InputDecoration(
                isDense: true,
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                focusedErrorBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                hintText: widget.hintText,
                hintStyle: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: const Color(0xFF9E9E9E),
                ),
              ),
            ),
          ),
          if (hasText)
            GestureDetector(
              onTap: _clear,
              behavior: HitTestBehavior.opaque,
              child: const Padding(
                padding: EdgeInsets.only(left: 8),
                child: AppIcon('close', size: 18, color: Color(0xFF8E8E93)),
              ),
            ),
        ]),
      ),
    );
  }
}