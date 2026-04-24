import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';

/// Modern OTP input with full paste support.
class OtpInput extends StatefulWidget {
  final int length;
  final ValueChanged<String>? onCompleted;
  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;

  const OtpInput({
    super.key,
    this.length = 6,
    this.onCompleted,
    required this.controllers,
    required this.focusNodes,
  });

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  String get _value => widget.controllers.map((c) => c.text).join();

  /// Distribute a pasted/typed string across all cells starting at [index].
  void _distribute(String text, int startIndex) {
    final digits = text.replaceAll(RegExp(r'[^\d]'), '');
    if (digits.isEmpty) return;

    for (int i = 0; i < digits.length && (startIndex + i) < widget.length; i++) {
      widget.controllers[startIndex + i].text = digits[i];
    }

    final nextIdx = (startIndex + digits.length).clamp(0, widget.length - 1);
    widget.focusNodes[nextIdx].requestFocus();

    setState(() {});
    final full = _value;
    if (full.length == widget.length) {
      widget.onCompleted?.call(full);
    }
  }

  void _onChanged(int index, String val) {
    if (val.isEmpty) {
      setState(() {});
      return;
    }

    // Multi-character input (paste or autocomplete)
    if (val.length > 1) {
      widget.controllers[index].text = '';
      _distribute(val, index);
      return;
    }

    // Single character
    if (index < widget.length - 1) {
      widget.focusNodes[index + 1].requestFocus();
    }

    setState(() {});
    final full = _value;
    if (full.length == widget.length) {
      widget.onCompleted?.call(full);
    }
  }

  void _handleKeyDown(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        widget.controllers[index].text.isEmpty &&
        index > 0) {
      widget.controllers[index - 1].text = '';
      widget.focusNodes[index - 1].requestFocus();
      setState(() {});
    }
  }

  /// Handle paste from clipboard on tap of any cell.
  Future<void> _handleTapWithPasteCheck(int index) async {
    // Select existing text
    widget.controllers[index].selection = TextSelection(
      baseOffset: 0,
      extentOffset: widget.controllers[index].text.length,
    );

    // Try reading clipboard for a full OTP code
    try {
      final clip = await Clipboard.getData(Clipboard.kTextPlain);
      final clipText = clip?.text?.replaceAll(RegExp(r'[^\d]'), '') ?? '';
      if (clipText.length >= widget.length) {
        _distribute(clipText.substring(0, widget.length), 0);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalGaps = (widget.length - 1) * 10.0 + 8.0 + 16.0;
        final availableWidth = constraints.maxWidth - totalGaps;
        final cellSize = (availableWidth / widget.length).clamp(40.0, 52.0);

        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.length, (i) {
            final hasValue = widget.controllers[i].text.isNotEmpty;
            final isFocused = widget.focusNodes[i].hasFocus;

            return AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: cellSize,
              height: cellSize * 1.15,
              margin: EdgeInsets.only(
                right: i < widget.length - 1 ? (i == 2 ? 16 : 10) : 0,
                left: i == 3 ? 8 : 0,
              ),
              decoration: BoxDecoration(
                color: hasValue
                    ? AppColors.primary.withOpacity(0.06)
                    : isFocused
                        ? AppColors.surface
                        : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: hasValue
                      ? AppColors.primary.withOpacity(0.35)
                      : isFocused
                          ? AppColors.primary
                          : AppColors.borderLight,
                  width: isFocused ? 2 : 1,
                ),
              ),
              child: KeyboardListener(
                focusNode: FocusNode(),
                onKeyEvent: (event) => _handleKeyDown(i, event),
                child: TextField(
                  controller: widget.controllers[i],
                  focusNode: widget.focusNodes[i],
                  textAlign: TextAlign.center,
                  keyboardType: TextInputType.number,
                  maxLength: widget.length, // Allow paste of full code
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: cellSize < 46 ? 20 : 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    filled: false,
                    contentPadding: EdgeInsets.symmetric(vertical: cellSize < 46 ? 8 : 12),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                  ),
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (val) => _onChanged(i, val),
                  onTap: () => _handleTapWithPasteCheck(i),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
