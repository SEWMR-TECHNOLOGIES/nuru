import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_colors.dart';
import '../theme/text_styles.dart';
import 'api_base.dart';

class AppUpdateService {
  AppUpdateService._();

  static const int _currentBuild = 1;
  static bool _shown = false;

  static Future<void> checkAndPrompt(BuildContext context) async {
    if (_shown) return;
    final platform = Platform.isIOS ? 'ios' : 'android';
    final res = await ApiBase.get('/settings/app-version', auth: false, queryParams: {'platform': platform});
    if (res['success'] != true || res['data'] is! Map || !context.mounted) return;
    final data = (res['data'] as Map).cast<String, dynamic>();
    final latestBuild = _asInt(data['latest_build']);
    final minBuild = _asInt(data['min_supported_build']);
    final mustUpdate = data['force_update'] == true || _currentBuild < minBuild;
    if (latestBuild <= _currentBuild && !mustUpdate) return;
    _shown = true;
    _showUpdateDialog(context, data, mustUpdate);
  }

  static int _asInt(dynamic value) => value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

  static void _showUpdateDialog(BuildContext context, Map<String, dynamic> data, bool mustUpdate) {
    showDialog(
      context: context,
      barrierDismissible: !mustUpdate,
      builder: (_) => PopScope(
        canPop: !mustUpdate,
        child: Dialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
                child: Center(child: SvgPicture.asset('assets/icons/thunder-icon.svg', width: 26, height: 26, colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))),
              ),
              const SizedBox(height: 16),
              Text('Update Nuru', style: appText(size: 18, weight: FontWeight.w800), textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(data['message']?.toString() ?? 'A new Nuru update is available.', style: appText(size: 13, color: AppColors.textSecondary, height: 1.45), textAlign: TextAlign.center),
              const SizedBox(height: 18),
              GestureDetector(
                onTap: () async {
                  final uri = Uri.tryParse(data['update_url']?.toString() ?? '');
                  if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                },
                child: Container(
                  width: double.infinity,
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(999)),
                  child: Text('Update App', style: appText(size: 14, weight: FontWeight.w800, color: AppColors.textOnPrimary)),
                ),
              ),
              if (!mustUpdate) ...[
                const SizedBox(height: 10),
                GestureDetector(onTap: () => Navigator.pop(context), child: Padding(padding: const EdgeInsets.all(8), child: Text('Not now', style: appText(size: 13, weight: FontWeight.w700, color: AppColors.textTertiary)))),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}