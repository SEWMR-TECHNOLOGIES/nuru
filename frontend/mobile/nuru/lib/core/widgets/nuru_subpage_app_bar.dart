import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';

/// Standard sub-page AppBar.
///
/// Back affordance is a chevron-left inside a soft rounded white tile,
/// matching the Nuru mobile design system across all sub-pages.
///
/// Also forces the Android system navigation bar to a white background
/// (with dark icons) so the on-screen home/back gesture area never blends
/// with our content and users do not accidentally tap system buttons.
class NuruSubPageAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final VoidCallback? onBack;

  const NuruSubPageAppBar({
    super.key,
    required this.title,
    this.actions,
    this.bottom,
    this.onBack,
  });

  @override
  Size get preferredSize => Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.surface,
      surfaceTintColor: AppColors.surface,
      elevation: 0,
      scrolledUnderElevation: 0,
      systemOverlayStyle: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: AppColors.surface,
        systemNavigationBarIconBrightness: Brightness.dark,
        systemNavigationBarContrastEnforced: false,
        systemNavigationBarDividerColor: AppColors.surface,
      ),
      leadingWidth: 48,
      leading: IconButton(
        onPressed: onBack ?? () => Navigator.of(context).maybePop(),
        icon: const Icon(
          Icons.arrow_back,
          size: 24,
          color: AppColors.textPrimary,
        ),
        splashRadius: 22,
      ),
      title: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      ),
      centerTitle: false,
      actions: actions,
      bottom: bottom,
    );
  }
}
