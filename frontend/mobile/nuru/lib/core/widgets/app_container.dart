import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Safe container widget that prevents pixel overflow.
/// Wraps content with proper constraints and padding.
class AppContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final BorderRadius? borderRadius;
  final Border? border;
  final List<BoxShadow>? boxShadow;
  final double? width;
  final double? height;
  final BoxConstraints? constraints;

  const AppContainer({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.color,
    this.borderRadius,
    this.border,
    this.boxShadow,
    this.width,
    this.height,
    this.constraints,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      padding: padding,
      margin: margin,
      constraints: constraints,
      decoration: BoxDecoration(
        color: color ?? AppColors.surface,
        borderRadius: borderRadius ?? BorderRadius.circular(14),
        border: border ?? Border.all(color: AppColors.borderLight, width: 1),
        boxShadow: boxShadow ?? AppColors.softShadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

/// Screen wrapper that prevents overflow on all edges.
class AppSafeScreen extends StatelessWidget {
  final Widget child;
  final Color? backgroundColor;
  final EdgeInsetsGeometry? padding;

  const AppSafeScreen({
    super.key,
    required this.child,
    this.backgroundColor,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor ?? AppColors.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: constraints.maxWidth,
                maxHeight: constraints.maxHeight,
              ),
              child: Padding(
                padding: padding ?? EdgeInsets.zero,
                child: child,
              ),
            );
          },
        ),
      ),
    );
  }
}

/// A row that gracefully handles overflow by wrapping or scrolling.
class AppSafeRow extends StatelessWidget {
  final List<Widget> children;
  final double spacing;
  final MainAxisAlignment mainAxisAlignment;

  const AppSafeRow({
    super.key,
    required this.children,
    this.spacing = 8,
    this.mainAxisAlignment = MainAxisAlignment.start,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minWidth: constraints.maxWidth),
            child: Row(
              mainAxisAlignment: mainAxisAlignment,
              children: [
                for (int i = 0; i < children.length; i++) ...[
                  if (i > 0) SizedBox(width: spacing),
                  children[i],
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
