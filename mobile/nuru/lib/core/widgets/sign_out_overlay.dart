import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';

/// Branded full-screen overlay shown while the auth provider tears down
/// the session, wipes caches and unbinds push notifications. Blocks input
/// so the user can't double-tap into a half-cleared state.
class SignOutOverlay {
  /// Run [task] while a polished "Signing you out" overlay is visible.
  /// The overlay is guaranteed to be removed before this returns.
  static Future<void> run(
    BuildContext context,
    Future<void> Function() task, {
    String title = 'Signing you out',
  }) async {
    final navigator = Navigator.of(context, rootNavigator: true);
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: AppColors.textPrimary.withOpacity(0.55),
      useRootNavigator: true,
      builder: (_) => PopScope(
        canPop: false,
        child: _SignOutBody(title: title),
      ),
    );
    // Kick off the teardown but don't block the UI on the full cache wipe.
    // The overlay only stays visible long enough to feel intentional; the
    // rest of the work finishes in the background.
    final future = task().catchError((_) {});
    try {
      await Future.any<void>([
        future,
        Future<void>.delayed(const Duration(milliseconds: 650)),
      ]);
    } finally {
      if (navigator.canPop()) navigator.pop();
    }
  }
}

class _SignOutBody extends StatefulWidget {
  final String title;
  const _SignOutBody({required this.title});

  @override
  State<_SignOutBody> createState() => _SignOutBodyState();
}

class _SignOutBodyState extends State<_SignOutBody> with TickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat();

  @override
  void dispose() {
    _pulse.dispose();
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 36),
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withOpacity(0.12),
              blurRadius: 40,
              offset: const Offset(0, 16),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 96,
              height: 96,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _pulse,
                    builder: (_, __) => Container(
                      width: 96 - (_pulse.value * 20),
                      height: 96 - (_pulse.value * 20),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primary.withOpacity(0.08 + (1 - _pulse.value) * 0.06),
                      ),
                    ),
                  ),
                  RotationTransition(
                    turns: _spin,
                    child: SizedBox(
                      width: 72,
                      height: 72,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        valueColor: AlwaysStoppedAnimation(AppColors.primary.withOpacity(0.55)),
                      ),
                    ),
                  ),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.logout_rounded, color: Colors.white, size: 22),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text(
              widget.title,
              style: GoogleFonts.inter(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}