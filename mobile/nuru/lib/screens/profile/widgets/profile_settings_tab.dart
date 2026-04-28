import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/l10n/l10n_helper.dart';
import '../../../core/widgets/language_selector.dart';
import '../../../providers/auth_provider.dart';
import '../../auth/login_screen.dart';
import '../../settings/settings_screen.dart';
import '../../help/help_screen.dart';

class ProfileSettingsTab extends StatelessWidget {
  final Map<String, dynamic> profile;
  final VoidCallback? onRefresh;

  const ProfileSettingsTab({super.key, required this.profile, this.onRefresh});

  TextStyle _pf({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color);

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        _group(context.trw('account'), [
          _tile(context, 'assets/icons/user-icon.svg', context.trw('edit_profile'), section: 1),
          _tile(context, 'assets/icons/shield-icon.svg', context.trw('change_password'), section: 2),
          _tile(context, 'assets/icons/verified-icon.svg', context.trw('identity_verification')),
        ]),
        const SizedBox(height: 16),
        _group(context.trw('preferences'), [
          _tile(context, 'assets/icons/bell-icon.svg', context.trw('notifications'), section: 4),
          _tile(context, 'assets/icons/shield-icon.svg', context.trw('privacy_security'), section: 3),
        ]),
        const SizedBox(height: 16),
        // Language selector
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(context.trw('language').toUpperCase(), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textHint, letterSpacing: 1.2)),
          const SizedBox(height: 8),
          const LanguageSettingsCard(),
        ]),
        const SizedBox(height: 16),
        _group(context.trw('help'), [
          _helpTile(context),
          _tile(context, 'assets/icons/info-icon.svg', context.trw('about_nuru'), section: 5),
        ]),
        const SizedBox(height: 16),
        _signOutButton(context, auth),
        const SizedBox(height: 32),
        Center(child: Text('Nuru v1.0.0', style: _pf(size: 10, color: AppColors.textHint))),
      ],
    );
  }

  Widget _group(String title, List<Widget> items) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title.toUpperCase(), style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textHint, letterSpacing: 1.2)),
      const SizedBox(height: 8),
      Container(
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight, width: 1)),
        clipBehavior: Clip.antiAlias,
        child: Column(children: items),
      ),
    ]);
  }

  Widget _tile(BuildContext context, String svgAsset, String label, {int? section}) {
    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(
        builder: (_) => SettingsScreen(profile: profile, onProfileUpdated: () => onRefresh?.call(), initialSection: section ?? 0),
      )),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 0.5))),
        child: Row(children: [
          Container(width: 34, height: 34,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(10)),
            child: Center(child: SvgPicture.asset(svgAsset, width: 16, height: 16,
              colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)))),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: _pf(size: 14, weight: FontWeight.w500))),
          SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 16, height: 16,
            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        ]),
      ),
    );
  }

  Widget _helpTile(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpScreen())),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 0.5))),
        child: Row(children: [
          Container(width: 34, height: 34,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(10)),
            child: Center(child: SvgPicture.asset('assets/icons/help-icon.svg', width: 16, height: 16,
              colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)))),
          const SizedBox(width: 12),
          Expanded(child: Text(context.trw('help_center'), style: _pf(size: 14, weight: FontWeight.w500))),
          SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 16, height: 16,
            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        ]),
      ),
    );
  }

  Widget _signOutButton(BuildContext context, AuthProvider auth) {
    return GestureDetector(
      onTap: () async {
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Text(context.trw('sign_out'), style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
            content: Text('Are you sure you want to sign out?', style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary)),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false),
                child: Text(context.trw('cancel'), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textTertiary))),
              TextButton(onPressed: () => Navigator.pop(ctx, true),
                child: Text(context.trw('sign_out'), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.error))),
            ],
          ),
        );
        if (confirmed == true && context.mounted) {
          await auth.signOut();
          if (context.mounted) {
            Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.error.withOpacity(0.15), width: 1)),
        child: Row(children: [
          Container(width: 34, height: 34,
            decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(10)),
            child: Center(child: SvgPicture.asset('assets/icons/logout-icon.svg', width: 16, height: 16,
              colorFilter: const ColorFilter.mode(AppColors.error, BlendMode.srcIn)))),
          const SizedBox(width: 12),
          Expanded(child: Text(context.trw('sign_out'), style: _pf(size: 14, weight: FontWeight.w600, color: AppColors.error))),
        ]),
      ),
    );
  }
}
