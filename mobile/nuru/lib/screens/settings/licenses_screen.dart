import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';
import '_legal_doc_layout.dart';

class LicensesScreen extends StatelessWidget {
  const LicensesScreen({super.key});

  static const _packages = [
    {'name': 'Flutter', 'license': 'BSD-3-Clause'},
    {'name': 'Google Fonts', 'license': 'Apache-2.0'},
    {'name': 'Provider', 'license': 'MIT'},
    {'name': 'Cached Network Image', 'license': 'MIT'},
    {'name': 'Flutter SVG', 'license': 'MIT'},
    {'name': 'Image Picker', 'license': 'Apache-2.0'},
    {'name': 'Image Cropper', 'license': 'MIT'},
    {'name': 'Shared Preferences', 'license': 'BSD-3-Clause'},
    {'name': 'URL Launcher', 'license': 'BSD-3-Clause'},
    {'name': 'HTTP', 'license': 'BSD-3-Clause'},
    {'name': 'Geolocator', 'license': 'MIT'},
    {'name': 'QR Flutter', 'license': 'BSD-3-Clause'},
    {'name': 'Package Info Plus', 'license': 'BSD-3-Clause'},
    {'name': 'Firebase', 'license': 'Apache-2.0'},
    {'name': 'LiveKit', 'license': 'Apache-2.0'},
    {'name': 'Flutter Map', 'license': 'BSD-3-Clause'},
  ];

  @override
  Widget build(BuildContext context) {
    return LegalDocLayout(
      title: 'Open-source licenses',
      subtitle: 'Nuru is built on the shoulders of the open-source community. Thank you.',
      lastUpdated: 'May 2026',
      heroIconAsset: 'assets/icons/settings-icon.svg',
      sections: const [
        LegalSection('Acknowledgements',
          'We are grateful to the maintainers of the libraries below. Their work powers Nuru.'),
      ],
      footer: Container(
        padding: const EdgeInsets.all(4),
        child: Column(
          children: [
            for (final p in _packages)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory_2_outlined, color: AppColors.primary, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(p['name']!, style: appText(size: 14, weight: FontWeight.w600))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(p['license']!,
                        style: appText(size: 10, weight: FontWeight.w700, color: AppColors.textSecondary)),
                  ),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}
