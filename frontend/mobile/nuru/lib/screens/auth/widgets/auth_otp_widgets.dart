import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';

const Color kAuthAccent = AppColors.primary;
const Color kAuthAccentSoft = Color(0xFFFFF3EC);
const Color kAuthInkSoft = Color(0xFF6B7280);

TextStyle authF({
  required double size,
  FontWeight weight = FontWeight.w500,
  Color color = AppColors.textPrimary,
  double height = 1.2,
  double letterSpacing = 0,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );

String maskPhoneDisplay(String phone) {
  final cleaned = phone.replaceAll(RegExp(r'[^\d]'), '');
  if (cleaned.length < 6) return phone;
  return '${cleaned.substring(0, 3)}****${cleaned.substring(cleaned.length - 3)}';
}

class AuthCtaButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool showArrow;
  const AuthCtaButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.showArrow = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: kAuthAccent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: kAuthAccent.withOpacity(0.55),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ).copyWith(
          overlayColor: WidgetStateProperty.all(Colors.white.withOpacity(0.08)),
        ),
        child: isLoading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(label, style: authF(size: 16, weight: FontWeight.w700, color: Colors.white)),
                  if (showArrow) ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.arrow_forward_rounded, size: 20, color: Colors.white),
                  ],
                ],
              ),
      ),
    );
  }
}

class OtpChannelChip extends StatelessWidget {
  final String channel;
  const OtpChannelChip({super.key, required this.channel});
  @override
  Widget build(BuildContext context) {
    final isWa = channel == 'whatsapp';
    final isBoth = channel == 'both';
    final color = isBoth ? kAuthAccent : isWa ? const Color(0xFF25D366) : AppColors.info;
    final icon = isBoth ? Icons.verified_rounded : isWa ? Icons.message_rounded : Icons.sms_outlined;
    final label = isBoth ? 'Sent via WhatsApp & SMS' : isWa ? 'Sent via WhatsApp' : 'Sent via SMS';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: authF(size: 13, color: color, weight: FontWeight.w700))),
        ],
      ),
    );
  }
}

class OtpShieldIllustration extends StatelessWidget {
  const OtpShieldIllustration({super.key});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      height: 140,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          Positioned(left: 6, bottom: 18, child: _cloud(opacity: 0.55, scale: 1.0)),
          Positioned(right: 12, bottom: 10, child: _cloud(opacity: 0.45, scale: 0.85)),
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: kAuthAccent.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
          ),
          CustomPaint(size: const Size(96, 110), painter: _ShieldPainter()),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Container(
              width: 30,
              height: 26,
              decoration: BoxDecoration(
                color: kAuthAccent,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Center(child: Icon(Icons.circle, size: 6, color: Colors.white)),
            ),
          ),
          Positioned(
            right: -2,
            top: 6,
            child: CustomPaint(size: const Size(80, 60), painter: _DottedArcPainter()),
          ),
          const Positioned(
            right: -6,
            top: -4,
            child: Icon(Icons.send_rounded, color: kAuthAccent, size: 28),
          ),
        ],
      ),
    );
  }

  Widget _cloud({required double opacity, required double scale}) {
    return Opacity(
      opacity: opacity,
      child: Transform.scale(
        scale: scale,
        child: CustomPaint(size: const Size(60, 22), painter: _CloudPainter()),
      ),
    );
  }
}

class _ShieldPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.5, 0)
      ..lineTo(w, h * 0.18)
      ..lineTo(w, h * 0.55)
      ..quadraticBezierTo(w, h * 0.92, w * 0.5, h)
      ..quadraticBezierTo(0, h * 0.92, 0, h * 0.55)
      ..lineTo(0, h * 0.18)
      ..close();
    final fill = Paint()..color = kAuthAccent.withOpacity(0.18);
    canvas.drawPath(path, fill);
    final stroke = Paint()
      ..color = kAuthAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, stroke);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _DottedArcPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = kAuthAccent.withOpacity(0.55)
      ..style = PaintingStyle.fill;
    final path = Path();
    for (double t = 0; t <= 1; t += 0.08) {
      final x = size.width * t;
      final y = size.height * (1 - math.sin(t * math.pi)) * 0.9;
      path.addOval(Rect.fromCircle(center: Offset(x, y), radius: 1.6));
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _CloudPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = kAuthAccent.withOpacity(0.25);
    final h = size.height;
    final w = size.width;
    canvas.drawCircle(Offset(w * 0.25, h * 0.6), h * 0.55, paint);
    canvas.drawCircle(Offset(w * 0.5, h * 0.45), h * 0.7, paint);
    canvas.drawCircle(Offset(w * 0.75, h * 0.6), h * 0.55, paint);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.15, h * 0.55, w * 0.7, h * 0.45),
        Radius.circular(h * 0.3),
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
