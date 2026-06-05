import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Tiny helper to render a project SVG icon with optional color tint.
/// Usage: AppIcon('plus', size: 18, color: AppColors.primary)
class AppIcon extends StatelessWidget {
  final String name; // file stem under assets/icons (without -icon.svg suffix or .svg)
  final double size;
  final Color? color;
  const AppIcon(this.name, {super.key, this.size = 18, this.color});

  @override
  Widget build(BuildContext context) {
    // Allow both bare ("plus") and full ("plus-icon") names
    final stem = name.endsWith('-icon') || name.contains('/')
        ? name
        : '$name-icon';
    final asset = 'assets/icons/$stem.svg';
    return SvgPicture.asset(
      asset,
      width: size,
      height: size,
      colorFilter: color == null ? null : ColorFilter.mode(color!, BlendMode.srcIn),
    );
  }
}
