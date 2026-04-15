import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/l10n/l10n_helper.dart';

class HomeBottomNav extends StatelessWidget {
  final int currentTab;
  final int unreadMessages;
  final int unreadNotifications;
  final ValueChanged<int> onTabChanged;

  const HomeBottomNav({
    super.key,
    required this.currentTab,
    this.unreadMessages = 0,
    this.unreadNotifications = 0,
    required this.onTabChanged,
  });

  static const _icons = [
    'assets/icons/home-icon.svg',
    'assets/icons/calendar-icon.svg',
    'assets/icons/chat-icon.svg',
    'assets/icons/bell-icon.svg',
    'assets/icons/user-profile-icon.svg',
  ];

  static const _labelKeys = [
    'nav_home',
    'nav_events',
    'messages',
    'notifications',
    'nav_profile',
  ];

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.borderLight, width: 0.5)),
      ),
      child: Padding(
        padding: EdgeInsets.only(top: 8, bottom: bottomPadding + 6, left: 8, right: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: List.generate(_icons.length, (i) {
            final isActive = i == currentTab;
            final badge = i == 2 ? unreadMessages : (i == 3 ? unreadNotifications : 0);
            final label = context.trw(_labelKeys[i]);
            return GestureDetector(
              onTap: () => onTabChanged(i),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primarySoft : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Column(mainAxisSize: MainAxisSize.min, children: [
                      SvgPicture.asset(_icons[i], width: 22, height: 22,
                        colorFilter: ColorFilter.mode(isActive ? AppColors.primary : AppColors.textHint, BlendMode.srcIn)),
                      const SizedBox(height: 4),
                      Text(label, style: GoogleFonts.plusJakartaSans(
                        fontSize: 9, fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                        color: isActive ? AppColors.primary : AppColors.textHint, height: 1.0)),
                    ]),
                    if (badge > 0)
                      Positioned(top: -4, right: -8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.surface, width: 1.5)),
                          child: Text(badge > 9 ? '9+' : '$badge',
                            style: GoogleFonts.plusJakartaSans(fontSize: 8, fontWeight: FontWeight.w700, color: Colors.white, height: 1.0)),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
