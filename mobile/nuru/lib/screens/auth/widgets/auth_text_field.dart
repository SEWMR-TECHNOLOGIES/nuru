import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';

/// Floating label field — consistent Plus Jakarta Sans
class AuthTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String? hintText;
  final IconData? prefixIcon;
  final bool obscureText;
  final Widget? suffixIcon;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final bool autofocus;
  final ValueChanged<String>? onChanged;

  const AuthTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hintText,
    this.prefixIcon,
    this.obscureText = false,
    this.suffixIcon,
    this.keyboardType,
    this.validator,
    this.inputFormatters,
    this.maxLength,
    this.autofocus = false,
    this.onChanged,
  });

  @override
  State<AuthTextField> createState() => _AuthTextFieldState();
}

class _AuthTextFieldState extends State<AuthTextField> {
  bool _focused = false;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _hasText = widget.controller.text.isNotEmpty;
    widget.controller.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    final hasText = widget.controller.text.isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Label
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 200),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: _focused ? AppColors.primary : AppColors.textSecondary,
            height: 1.2,
          ),
          child: Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 8),
            child: Text(widget.label),
          ),
        ),

        // Field
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: _focused
                ? [BoxShadow(color: AppColors.primary.withOpacity(0.08), blurRadius: 16, offset: const Offset(0, 4))]
                : [],
          ),
          child: TextFormField(
            controller: widget.controller,
            obscureText: widget.obscureText,
            keyboardType: widget.keyboardType,
            validator: widget.validator,
            inputFormatters: widget.inputFormatters,
            maxLength: widget.maxLength,
            autofocus: widget.autofocus,
            onChanged: widget.onChanged,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            style: GoogleFonts.plusJakartaSans(fontSize: 15, color: AppColors.textPrimary, fontWeight: FontWeight.w500, height: 1.4),
            onTap: () => setState(() => _focused = true),
            onEditingComplete: () => setState(() => _focused = false),
            onTapOutside: (_) {
              setState(() => _focused = false);
              FocusScope.of(context).unfocus();
            },
            decoration: InputDecoration(
              hintText: widget.hintText ?? widget.label,
              counterText: '',
              prefixIcon: widget.prefixIcon != null
                  ? Padding(
                      padding: const EdgeInsets.only(left: 16, right: 12),
                      child: Icon(widget.prefixIcon, size: 20,
                        color: _focused ? AppColors.primary : AppColors.textHint,
                      ),
                    )
                  : null,
              prefixIconConstraints: widget.prefixIcon != null ? const BoxConstraints(minWidth: 48) : null,
              suffixIcon: widget.suffixIcon,
              filled: true,
              fillColor: _focused ? AppColors.surface : AppColors.surfaceVariant,
              hintStyle: GoogleFonts.plusJakartaSans(color: AppColors.textHint, fontSize: 14, height: 1.4),
              errorStyle: GoogleFonts.plusJakartaSans(color: AppColors.error, fontSize: 12, height: 1.2),
              contentPadding: EdgeInsets.symmetric(horizontal: widget.prefixIcon != null ? 0 : 20, vertical: 17),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.borderLight, width: 1)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.error, width: 1)),
              focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.error, width: 1.5)),
            ),
          ),
        ),
      ],
    );
  }
}
