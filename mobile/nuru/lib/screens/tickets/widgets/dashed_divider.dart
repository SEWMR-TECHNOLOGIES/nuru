import 'dart:math' as math;

import 'package:flutter/material.dart';

/// A horizontal dashed line divider used inside ticket cards.
class DashedDivider extends StatelessWidget {
  final Color color;
  final double dashWidth;
  final double dashSpace;
  final double thickness;
  const DashedDivider({
    super.key,
    this.color = const Color(0xFFE5E7EB),
    this.dashWidth = 5,
    this.dashSpace = 4,
    this.thickness = 1,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: thickness,
      child: LayoutBuilder(
        builder: (_, c) {
          final count = (c.maxWidth / (dashWidth + dashSpace)).floor();
          return Flex(
            direction: Axis.horizontal,
            mainAxisSize: MainAxisSize.max,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(count, (_) => SizedBox(
              width: dashWidth, height: thickness,
              child: DecoratedBox(decoration: BoxDecoration(color: color)),
            )),
          );
        },
      ),
    );
  }
}

/// A dashed divider with two small semicircle "notches" cut into the
/// left and right edges of the parent card. The notches are drawn by
/// painting circles in [bgColor] (matching the page background) that
/// overlap the card's border, creating a torn-perforation look like
/// the ticket details mockup.
///
/// Place this flush with the card's inner edges (no horizontal padding).
class NotchedDashedDivider extends StatelessWidget {
  final Color borderColor;
  final Color dashColor;
  final double notchRadius;
  final double horizontalInset;
  const NotchedDashedDivider({
    super.key,
    this.borderColor = const Color(0xFFEDEDF2),
    this.dashColor = const Color(0xFFE5E7EB),
    this.notchRadius = 7,
    this.horizontalInset = 4,
  });

  @override
  Widget build(BuildContext context) {
    final h = notchRadius * 2;
    return SizedBox(
      height: h,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: notchRadius + horizontalInset,
            right: notchRadius + horizontalInset,
            top: notchRadius - 0.5,
            child: DashedDivider(color: dashColor),
          ),
          Positioned.fill(
            child: CustomPaint(
              painter: _NotchArcPainter(radius: notchRadius, color: borderColor),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotchArcPainter extends CustomPainter {
  final double radius;
  final Color color;
  const _NotchArcPainter({required this.radius, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.round;

    final cy = size.height / 2;
    canvas.drawArc(Rect.fromCircle(center: Offset(0, cy), radius: radius), -math.pi / 2, math.pi, false, paint);
    canvas.drawArc(Rect.fromCircle(center: Offset(size.width, cy), radius: radius), math.pi / 2, math.pi, false, paint);
  }

  @override
  bool shouldRepaint(covariant _NotchArcPainter oldDelegate) {
    return oldDelegate.radius != radius || oldDelegate.color != color;
  }
}

/// Clipper that produces a "ticket" shape with two semicircle notches on the
/// left and right edges at [notchY] from the top, plus an optional scalloped
/// bottom edge. Used by the Your Ticket screen.
class TicketShapeClipper extends CustomClipper<Path> {
  final double radius;
  final double notchY;
  final double notchRadius;
  final bool scallopedBottom;
  final double scallopRadius;

  TicketShapeClipper({
    this.radius = 20,
    required this.notchY,
    this.notchRadius = 10,
    this.scallopedBottom = false,
    this.scallopRadius = 7,
  });

  @override
  Path getClip(Size size) {
    final p = Path();
    final r = radius;
    final nr = notchRadius;

    p.moveTo(0, r);
    p.quadraticBezierTo(0, 0, r, 0);
    p.lineTo(size.width - r, 0);
    p.quadraticBezierTo(size.width, 0, size.width, r);

    p.lineTo(size.width, notchY - nr);
    p.arcToPoint(
      Offset(size.width, notchY + nr),
      radius: Radius.circular(nr),
      clockwise: false,
    );

    if (scallopedBottom) {
      p.lineTo(size.width, size.height - scallopRadius);
      final sr = scallopRadius;
      double x = size.width;
      while (x > 0) {
        final nextX = (x - sr * 2).clamp(0, size.width).toDouble();
        p.arcToPoint(
          Offset(nextX, size.height - sr),
          radius: Radius.circular(sr),
          clockwise: true,
        );
        x = nextX;
      }
      p.lineTo(0, notchY + nr);
    } else {
      p.lineTo(size.width, size.height - r);
      p.quadraticBezierTo(size.width, size.height, size.width - r, size.height);
      p.lineTo(r, size.height);
      p.quadraticBezierTo(0, size.height, 0, size.height - r);
      p.lineTo(0, notchY + nr);
    }

    p.arcToPoint(
      Offset(0, notchY - nr),
      radius: Radius.circular(nr),
      clockwise: false,
    );
    p.lineTo(0, r);
    p.close();
    return p;
  }

  @override
  bool shouldReclip(covariant TicketShapeClipper old) =>
      old.notchY != notchY ||
      old.notchRadius != notchRadius ||
      old.radius != radius ||
      old.scallopedBottom != scallopedBottom ||
      old.scallopRadius != scallopRadius;
}
