import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';
import '../../core/l10n/l10n_helper.dart';

class NuruLogo extends StatelessWidget {
  final double size;
  final Color? color;
  final bool showTagline;
  final bool compact;

  const NuruLogo({
    super.key,
    this.size = 48,
    this.color,
    this.showTagline = false,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size * 1.4,
          height: size * 1.4,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(size * 0.3),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(size * 0.3),
            child: Image.asset(
              'assets/images/nuru-logo-square.png',
              width: size * 1.4,
              height: size * 1.4,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _fallback(color ?? AppColors.primary),
            ),
          ),
        ),
        if (showTagline) ...[
          SizedBox(height: size * 0.25),
          Text(
            'EVERY MOMENT DESERVES CARE',
            style: GoogleFonts.inter(
              fontSize: size * 0.14,
              fontWeight: FontWeight.w400,
              color: AppColors.textHint,
              letterSpacing: 2,
            ),
          ),
        ],
      ],
    );
  }

  Widget _fallback(Color c) => Container(
    width: size * 1.4,
    height: size * 1.4,
    decoration: BoxDecoration(
      color: AppColors.primary,
      borderRadius: BorderRadius.circular(size * 0.3),
    ),
    child: Center(
      child: Text('N', style: GoogleFonts.inter(fontSize: size * 0.55, fontWeight: FontWeight.w700, color: Colors.white)),
    ),
  );
}
