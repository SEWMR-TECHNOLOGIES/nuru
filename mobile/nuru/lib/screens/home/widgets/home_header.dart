import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/l10n/l10n_helper.dart';

class HomeHeader extends StatelessWidget {
  final String name;
  final String? avatar;
  final int unreadNotifications;
  final VoidCallback onMenuTap;
  final VoidCallback onSearchTap;
  final VoidCallback onNotificationsTap;
  final VoidCallback onRightPanelTap;
  final VoidCallback onProfileTap;

  const HomeHeader({
    super.key,
    required this.name,
    this.avatar,
    this.unreadNotifications = 0,
    required this.onMenuTap,
    required this.onSearchTap,
    required this.onNotificationsTap,
    required this.onRightPanelTap,
    required this.onProfileTap,
  });

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    return Container(
      padding: EdgeInsets.only(top: topPadding + 8, left: 16, right: 16, bottom: 12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 0.5)),
      ),
      child: Row(
        children: [
          _iconButton('assets/icons/menu-icon.svg', onMenuTap),
          const SizedBox(width: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.asset('assets/images/nuru-logo-square.png', width: 72, height: 72,
              errorBuilder: (_, __, ___) => Container(
                width: 72, height: 72,
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(14)),
                child: Center(child: Text('N', style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w700, color: Colors.white))),
              )),
          ),
          const Spacer(),
          _iconButton('assets/icons/search-icon.svg', onSearchTap),
          const SizedBox(width: 6),
          _iconButton('assets/icons/bell-icon.svg', onNotificationsTap, badge: unreadNotifications),
          const SizedBox(width: 6),
          _iconButton('assets/icons/panel-right-icon.svg', onRightPanelTap),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: onProfileTap,
            child: Container(
              width: 32, height: 32,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.border, width: 1.5)),
              child: ClipOval(
                child: SizedBox(
                  width: 32, height: 32,
                  child: avatar != null && avatar!.isNotEmpty
                      ? CachedNetworkImage(imageUrl: avatar!, width: 32, height: 32, fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _avatarFallback(name))
                      : _avatarFallback(name),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _iconButton(String svgAsset, VoidCallback onTap, {int badge = 0}) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(11)),
            child: Center(child: SvgPicture.asset(svgAsset, width: 20, height: 20,
              colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn))),
          ),
          if (badge > 0)
            Positioned(top: 0, right: 0,
              child: Container(
                width: 16, height: 16,
                decoration: BoxDecoration(color: AppColors.secondary, shape: BoxShape.circle,
                  border: Border.all(color: AppColors.surface, width: 2)),
                child: Center(child: Text(badge > 9 ? '9+' : '$badge',
                  style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white, height: 1.0))),
              ),
            ),
        ],
      ),
    );
  }

  Widget _avatarFallback(String n) {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(n.isNotEmpty ? n[0].toUpperCase() : '?',
        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary, height: 1.0))),
    );
  }
}
