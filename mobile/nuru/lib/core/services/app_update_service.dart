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
    final latestVersion = data['latest_version']?.toString() ?? '';
    final latestBuild = _asInt(data['latest_build']);
    showDialog(
      context: context,
      barrierDismissible: !mustUpdate,
      builder: (_) => PopScope(
        canPop: !mustUpdate,
        child: Dialog(
          backgroundColor: AppColors.surface,
          insetPadding: const EdgeInsets.symmetric(horizontal: 22),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                SvgPicture.asset('assets/icons/thunder-icon.svg', width: 24, height: 24, colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                const SizedBox(width: 10),
                Expanded(child: Text(mustUpdate ? 'Update required' : 'Update available', style: appText(size: 18, weight: FontWeight.w700))),
              ]),
              const SizedBox(height: 14),
              Text(data['message']?.toString() ?? 'A newer Nuru version is ready.', style: appText(size: 14, color: AppColors.textSecondary, height: 1.45)),
              const SizedBox(height: 12),
              Text('Installed v$currentVersion ($currentBuild) • Latest v$latestVersion ($latestBuild)', style: appText(size: 12, color: AppColors.textTertiary, height: 1.35)),
              const SizedBox(height: 20),
              InkWell(
                onTap: () async {
                  final uri = Uri.tryParse(data['update_url']?.toString() ?? '');
                  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                },
                borderRadius: BorderRadius.circular(12),
                child: Ink(
                  width: double.infinity,
                  height: 46,
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
                  child: Center(
                    child: Text('Update app', style: appText(size: 14, weight: FontWeight.w700, color: AppColors.textOnPrimary)),
                  ),
                ),
              ),
              if (!mustUpdate) ...[
                const SizedBox(height: 10),
                Center(child: TextButton(onPressed: () => Navigator.pop(context), child: Text('Not now', style: appText(size: 13, weight: FontWeight.w500, color: AppColors.textTertiary)))),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}