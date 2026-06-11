import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../theme/app_colors.dart';
import '../theme/text_styles.dart';
import 'api_base.dart';

class AppUpdateService {
  AppUpdateService._();

  static bool _shown = false;

  static Future<void> checkAndPrompt(BuildContext context) async {
    if (_shown) return;
    String currentVersion = '';
    int currentBuild = 0;
    try {
      final info = await PackageInfo.fromPlatform();
      currentVersion = info.version.trim();
      currentBuild = int.tryParse(info.buildNumber) ?? 0;
    } catch (_) {
      return;
    }
    final platform = Platform.isIOS ? 'ios' : 'android';
    final res = await ApiBase.get(
      '/settings/app-version',
      auth: false,
      queryParams: {'platform': platform},
    );
    if (res['success'] != true || res['data'] is! Map || !context.mounted) {
      return;
    }
    final data = (res['data'] as Map).cast<String, dynamic>();
    final latestBuild = _asInt(data['latest_build']);
    final minBuild = _asInt(data['min_supported_build']);
    final latestVersion = data['latest_version']?.toString().trim() ?? '';
    final hasNewerBuild =
        latestBuild > 0 && currentBuild > 0 && latestBuild > currentBuild;
    final hasNewerVersion =
        latestVersion.isNotEmpty &&
        currentVersion.isNotEmpty &&
        _compareVersions(latestVersion, currentVersion) > 0;
    final belowMinimum =
        minBuild > 0 && currentBuild > 0 && currentBuild < minBuild;
    final hasUpdate = hasNewerBuild || hasNewerVersion || belowMinimum;
    // Only force the update when the backend explicitly sets force_update=true.
    // A lower min_supported_build alone should NOT hide the "Later" button.
    final mustUpdate = data['force_update'] == true && hasUpdate;
    if (!hasUpdate) return;
    _shown = true;
    _showUpdateDialog(context, data, mustUpdate, latestVersion);
  }

  static int _asInt(dynamic value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

  static int _compareVersions(String a, String b) {
    final left = a
        .split(RegExp(r'[^0-9]+'))
        .where((p) => p.isNotEmpty)
        .map((p) => int.tryParse(p) ?? 0)
        .toList();
    final right = b
        .split(RegExp(r'[^0-9]+'))
        .where((p) => p.isNotEmpty)
        .map((p) => int.tryParse(p) ?? 0)
        .toList();
    final length = left.length > right.length ? left.length : right.length;
    for (var i = 0; i < length; i++) {
      final l = i < left.length ? left[i] : 0;
      final r = i < right.length ? right[i] : 0;
      if (l != r) return l.compareTo(r);
    }
    return 0;
  }

  static List<Map<String, String>> _parseHighlights(dynamic raw) {
    if (raw is! List) return const [];
    final out = <Map<String, String>>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final title = (item['title'] ?? '').toString().trim();
      final description = (item['description'] ?? '').toString().trim();
      if (title.isEmpty) continue;
      out.add({'title': title, 'description': description});
    }
    return out;
  }

  static void _showUpdateDialog(
    BuildContext context,
    Map<String, dynamic> data,
    bool mustUpdate,
    String latestVersion,
  ) {
    final highlights = _parseHighlights(data['highlights']);

    showDialog(
      context: context,
      barrierDismissible: !mustUpdate,
      barrierColor: Colors.black.withOpacity(0.55),
      builder: (_) => PopScope(
        canPop: !mustUpdate,
        child: Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 32,
          ),
          child: _UpdateModalCard(
            data: data,
            mustUpdate: mustUpdate,
            latestVersion: latestVersion,
            highlights: highlights,
          ),
        ),
      ),
    );
  }
}

class _UpdateModalCard extends StatelessWidget {
  const _UpdateModalCard({
    required this.data,
    required this.mustUpdate,
    required this.latestVersion,
    required this.highlights,
  });

  final Map<String, dynamic> data;
  final bool mustUpdate;
  final String latestVersion;
  final List<Map<String, String>> highlights;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.18),
            blurRadius: 40,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 18, 22, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Close button (only if dismissible) ──
            Align(
              alignment: Alignment.centerRight,
              child: SizedBox(
                width: 32,
                height: 32,
                child: mustUpdate
                    ? const SizedBox.shrink()
                    : IconButton(
                        padding: EdgeInsets.zero,
                        iconSize: 22,
                        splashRadius: 18,
                        icon: const Icon(
                          Icons.close_rounded,
                          color: AppColors.textTertiary,
                        ),
                        onPressed: () => Navigator.pop(context),
                      ),
              ),
            ),

            // ── Scrollable body (so CTA below stays pinned) ──
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── Mockup hero image ──
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset(
                        'assets/images/update-modal-mockup.png',
                        height: 180,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const SizedBox(height: 180),
                      ),
                    ),
                    const SizedBox(height: 22),

                    // ── Title ──
                    Text(
                      mustUpdate ? 'Time to update Nuru' : 'A better Nuru is here',
                      textAlign: TextAlign.center,
                      style: appText(
                        size: 24,
                        weight: FontWeight.w700,
                        height: 1.2,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      data['message']?.toString().isNotEmpty == true
                          ? data['message'].toString()
                          : "We've made Nuru faster, smoother and even more enjoyable to use.",
                      textAlign: TextAlign.center,
                      style: appText(
                        size: 14,
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),

                    // ── What's new card ──
                    if (highlights.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.borderLight, width: 1),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                "What's new",
                                style: appText(
                                  size: 13,
                                  weight: FontWeight.w600,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                            for (var i = 0; i < highlights.length; i++) ...[
                              _HighlightRow(
                                title: highlights[i]['title']!,
                                description: highlights[i]['description'] ?? '',
                              ),
                              if (i < highlights.length - 1)
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: Divider(
                                    height: 1,
                                    thickness: 1,
                                    color: AppColors.borderLight,
                                  ),
                                )
                              else
                                const SizedBox(height: 10),
                            ],
                          ],
                        ),
                      ),
                    ],

                    // ── Version chip ──
                    if (latestVersion.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppColors.borderLight, width: 1),
                        ),
                        child: Text(
                          'Version $latestVersion',
                          style: appText(
                            size: 12,
                            weight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),

            // ── Primary CTA: Update now (pinned, always visible) ──
            Material(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () async {
                  final uri = Uri.tryParse(
                    data['update_url']?.toString() ?? '',
                  );
                  if (uri != null) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  }
                },
                child: Container(
                  width: double.infinity,
                  height: 54,
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SvgPicture.asset(
                        'assets/icons/download-cloud-icon.svg',
                        width: 20,
                        height: 20,
                        colorFilter: const ColorFilter.mode(
                          AppColors.textOnPrimary,
                          BlendMode.srcIn,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Update now',
                        style: appText(
                          size: 15,
                          weight: FontWeight.w600,
                          color: AppColors.textOnPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Secondary CTA: Later (outlined) ──
            if (!mustUpdate) ...[
              const SizedBox(height: 10),
              Material(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    width: double.infinity,
                    height: 54,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primary, width: 1.5),
                    ),
                    child: Text(
                      'Later',
                      style: appText(
                        size: 15,
                        weight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
              ),
            ],

            // ── Footer note ──
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SvgPicture.asset(
                  'assets/icons/time-fast-icon.svg',
                  width: 14,
                  height: 14,
                  colorFilter: const ColorFilter.mode(
                    AppColors.textTertiary,
                    BlendMode.srcIn,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'Takes less than a minute',
                  style: appText(size: 12, color: AppColors.textTertiary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HighlightRow extends StatelessWidget {
  const _HighlightRow({required this.title, required this.description});

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: SvgPicture.asset(
            'assets/icons/list-icon.svg',
            width: 20,
            height: 20,
            colorFilter: const ColorFilter.mode(
              AppColors.primary,
              BlendMode.srcIn,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: appText(
                  size: 14,
                  weight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  height: 1.3,
                ),
              ),
              if (description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  description,
                  style: appText(
                    size: 13,
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
