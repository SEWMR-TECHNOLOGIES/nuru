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
    final res = await ApiBase.get('/settings/app-version', auth: false, queryParams: {'platform': platform});
    if (res['success'] != true || res['data'] is! Map || !context.mounted) return;
    final data = (res['data'] as Map).cast<String, dynamic>();
    final latestBuild = _asInt(data['latest_build']);
    final minBuild = _asInt(data['min_supported_build']);
    final latestVersion = data['latest_version']?.toString().trim() ?? '';
    final hasNewerBuild = latestBuild > 0 && currentBuild > 0 && latestBuild > currentBuild;
    final hasNewerVersion = latestVersion.isNotEmpty && currentVersion.isNotEmpty && _compareVersions(latestVersion, currentVersion) > 0;
    final belowMinimum = minBuild > 0 && currentBuild > 0 && currentBuild < minBuild;
    final hasUpdate = hasNewerBuild || hasNewerVersion || belowMinimum;
    final mustUpdate = belowMinimum || (data['force_update'] == true && hasUpdate);
    if (!hasUpdate) return;
    _shown = true;
    _showUpdateDialog(context, data, mustUpdate, currentVersion, currentBuild);
  }

  static int _asInt(dynamic value) => value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

  static int _compareVersions(String a, String b) {
    final left = a.split(RegExp(r'[^0-9]+')).where((p) => p.isNotEmpty).map((p) => int.tryParse(p) ?? 0).toList();
    final right = b.split(RegExp(r'[^0-9]+')).where((p) => p.isNotEmpty).map((p) => int.tryParse(p) ?? 0).toList();
    final length = left.length > right.length ? left.length : right.length;
    for (var i = 0; i < length; i++) {
      final l = i < left.length ? left[i] : 0;
      final r = i < right.length ? right[i] : 0;
      if (l != r) return l.compareTo(r);
    }
    return 0;
  }

  static void _showUpdateDialog(BuildContext context, Map<String, dynamic> data, bool mustUpdate, String currentVersion, int currentBuild) {
    showDialog(
      context: context,
      barrierDismissible: !mustUpdate,
      barrierColor: Colors.black.withOpacity(0.55),
      builder: (_) => PopScope(
        canPop: !mustUpdate,
        child: Dialog(
          backgroundColor: Colors.transparent,
          elevation: 0,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          child: Container(
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
              padding: const EdgeInsets.fromLTRB(26, 30, 26, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Hero icon badge — soft primary halo
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.primary.withOpacity(0.14),
                          AppColors.primary.withOpacity(0.04),
                        ],
                      ),
                    ),
                    child: Center(
                      child: SvgPicture.asset(
                        'assets/icons/thunder-icon.svg',
                        width: 30,
                        height: 30,
                        colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    mustUpdate ? 'Time to update' : 'A fresh Nuru is ready',
                    textAlign: TextAlign.center,
                    style: appText(size: 20, weight: FontWeight.w700, height: 1.25),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    data['message']?.toString() ??
                        (mustUpdate
                            ? 'Update to keep using Nuru without interruption.'
                            : 'New improvements and refinements are waiting for you.'),
                    textAlign: TextAlign.center,
                    style: appText(size: 14, color: AppColors.textSecondary, height: 1.5),
                  ),
                  const SizedBox(height: 26),
                  // Primary CTA
                  Material(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      onTap: () async {
                        final uri = Uri.tryParse(data['update_url']?.toString() ?? '');
                        if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        width: double.infinity,
                        height: 52,
                        alignment: Alignment.center,
                        child: Text(
                          'Update now',
                          style: appText(size: 15, weight: FontWeight.w700, color: AppColors.textOnPrimary),
                        ),
                      ),
                    ),
                  ),
                  if (!mustUpdate) ...[
                    const SizedBox(height: 6),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      style: TextButton.styleFrom(
                        minimumSize: const Size(double.infinity, 44),
                      ),
                      child: Text(
                        'Maybe later',
                        style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textTertiary),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}