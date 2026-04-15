import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';

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
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: IconButton(
        icon: SvgPicture.asset(
          'assets/icons/chevron-left-icon.svg',
          width: 22,
          height: 22,
          colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
        ),
        onPressed: onBack ?? () => Navigator.of(context).maybePop(),
      ),
      title: Text(
        title,
        style: GoogleFonts.plusJakartaSans(
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
