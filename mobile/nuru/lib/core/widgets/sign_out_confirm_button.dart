import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';

/// A sign-out control that confirms inline: tapping the trigger pushes a
/// small "Are you sure?" pill *up* out of the button itself with a spring
/// animation, instead of showing a jarring modal AlertDialog.
///
/// Pass [trigger] as the resting button UI (icon + label). When tapped, the
/// trigger morphs into a Cancel / Confirm pair that slides up from the same
/// spot. Tapping outside (or Cancel) collapses it back.
class SignOutConfirmButton extends StatefulWidget {
  final Widget trigger;
  final Future<void> Function() onConfirm;
  final String confirmLabel;
  final String cancelLabel;
  final String questionLabel;

  const SignOutConfirmButton({
    super.key,
    required this.trigger,
    required this.onConfirm,
    this.confirmLabel = 'Sign out',
    this.cancelLabel = 'Cancel',
    this.questionLabel = 'Sign out of this account?',
  });

  @override
  State<SignOutConfirmButton> createState() => _SignOutConfirmButtonState();
}

class _SignOutConfirmButtonState extends State<SignOutConfirmButton>
    with SingleTickerProviderStateMixin {
  bool _confirming = false;
  bool _busy = false;

  void _open() {
    if (_busy) return;
    setState(() => _confirming = true);
  }

  void _close() {
    if (_busy) return;
    setState(() => _confirming = false);
  }

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.onConfirm();
    } finally {
      if (mounted) setState(() { _busy = false; _confirming = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      alignment: Alignment.bottomCenter,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 280),
        switchInCurve: Curves.easeOutBack,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, anim) {
          final slide = Tween<Offset>(
            begin: const Offset(0, 0.35),
            end: Offset.zero,
          ).animate(anim);
          return ClipRect(
            child: SlideTransition(
              position: slide,
              child: FadeTransition(opacity: anim, child: child),
            ),
          );
        },
        layoutBuilder: (current, previous) => Stack(
          alignment: Alignment.bottomCenter,
          children: [...previous, if (current != null) current],
        ),
        child: _confirming
            ? _ConfirmPanel(
                key: const ValueKey('confirm'),
                busy: _busy,
                question: widget.questionLabel,
                cancelLabel: widget.cancelLabel,
                confirmLabel: widget.confirmLabel,
                onCancel: _close,
                onConfirm: _confirm,
              )
            : GestureDetector(
                key: const ValueKey('trigger'),
                behavior: HitTestBehavior.opaque,
                onTap: _open,
                child: widget.trigger,
              ),
      ),
    );
  }
}

class _ConfirmPanel extends StatelessWidget {
  final bool busy;
  final String question;
  final String cancelLabel;
  final String confirmLabel;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;
  const _ConfirmPanel({
    super.key,
    required this.busy,
    required this.question,
    required this.cancelLabel,
    required this.confirmLabel,
    required this.onCancel,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.error.withOpacity(0.18), width: 1),
        boxShadow: [
          BoxShadow(
            color: AppColors.error.withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.errorSoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.logout_rounded, size: 16, color: AppColors.error),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  question,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _PillButton(
                label: cancelLabel,
                onTap: busy ? null : onCancel,
                background: Colors.white,
                foreground: AppColors.textSecondary,
                border: AppColors.borderLight,
              ),
              const SizedBox(width: 8),
              _PillButton(
                label: confirmLabel,
                onTap: busy ? null : onConfirm,
                background: AppColors.error,
                foreground: Colors.white,
                border: AppColors.error,
                loading: busy,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PillButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final Color background;
  final Color foreground;
  final Color border;
  final bool loading;
  const _PillButton({
    required this.label,
    required this.onTap,
    required this.background,
    required this.foreground,
    required this.border,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border, width: 1),
        ),
        child: loading
            ? SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(foreground),
                ),
              )
            : Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: foreground,
                  height: 1.0,
                ),
              ),
      ),
    );
  }
}