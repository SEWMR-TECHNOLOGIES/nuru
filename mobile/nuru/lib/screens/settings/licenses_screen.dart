import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/l10n/l10n_helper.dart';

/// Open Source Licenses screen
class LicensesScreen extends StatelessWidget {
  const LicensesScreen({super.key});

  static const _packages = [
    {'name': 'Flutter', 'license': 'BSD-3-Clause', 'url': 'flutter.dev'},
    {'name': 'Google Fonts', 'license': 'Apache-2.0', 'url': 'pub.dev/packages/google_fonts'},
    {'name': 'Provider', 'license': 'MIT', 'url': 'pub.dev/packages/provider'},
    {'name': 'Cached Network Image', 'license': 'MIT', 'url': 'pub.dev/packages/cached_network_image'},
    {'name': 'Flutter SVG', 'license': 'MIT', 'url': 'pub.dev/packages/flutter_svg'},
    {'name': 'Image Picker', 'license': 'Apache-2.0', 'url': 'pub.dev/packages/image_picker'},
    {'name': 'Shared Preferences', 'license': 'BSD-3-Clause', 'url': 'pub.dev/packages/shared_preferences'},
    {'name': 'URL Launcher', 'license': 'BSD-3-Clause', 'url': 'pub.dev/packages/url_launcher'},
    {'name': 'HTTP', 'license': 'BSD-3-Clause', 'url': 'pub.dev/packages/http'},
    {'name': 'Geolocator', 'license': 'MIT', 'url': 'pub.dev/packages/geolocator'},
    {'name': 'QR Flutter', 'license': 'BSD-3-Clause', 'url': 'pub.dev/packages/qr_flutter'},
    {'name': 'Animate Do', 'license': 'MIT', 'url': 'pub.dev/packages/animate_do'},
    {'name': 'Smooth Page Indicator', 'license': 'MIT', 'url': 'pub.dev/packages/smooth_page_indicator'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(title: context.tr('about')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          Text(
            'This app uses the following open source packages. We are grateful to the open source community.',
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary, height: 1.5),
          ),
          const SizedBox(height: 20),
          ..._packages.map((p) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Row(children: [
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p['name']!, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(p['license']!, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)),
                ],
              )),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(6)),
                child: Text(p['license']!, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
              ),
            ]),
          )),
        ],
      ),
    );
  }
}
