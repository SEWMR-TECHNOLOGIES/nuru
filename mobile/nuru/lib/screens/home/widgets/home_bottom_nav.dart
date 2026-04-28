import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';

/// Premium 5-tab bottom navigation with a centered floating "Create" action.
/// The center "+" pushes the Create Event screen instead of switching tabs.
///
/// Tab indices kept stable for [HomeScreen]'s IndexedStack:
///   0 → Home, 1 → Events, 3 → Tickets, 4 → Profile
///   2 is reserved for the create action and does not switch tabs.
class HomeBottomNav extends StatelessWidget {
  final int currentTab;
  final int unreadMessages;
  final int unreadNotifications;
  final ValueChanged<int> onTabChanged;
  final VoidCallback? onCreateTap;

  const HomeBottomNav({
    super.key,
    required this.currentTab,
    this.unreadMessages = 0,
    this.unreadNotifications = 0,
    required this.onTabChanged,
    this.onCreateTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, -2),
          ),
        ],
        border: const Border(
          top: BorderSide(color: AppColors.borderLight, width: 0.5),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              _navItem(index: 0, svg: 'assets/icons/home-icon.svg', label: 'Home'),
              _navItem(index: 1, svg: 'assets/icons/calendar-icon.svg', label: 'Events'),
              _createButton(),
              _navItem(index: 3, svg: 'assets/icons/ticket-icon.svg', label: 'Tickets'),
              _navItem(
                index: 4,
                svg: 'assets/icons/user-profile-icon.svg',
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem({
    required int index,
    required String svg,
    required String label,
    int badge = 0,
  }) {
    final isActive = index == currentTab;
    return Expanded(
      child: InkWell(
        onTap: () => onTabChanged(index),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SvgPicture.asset(
                  svg,
                  width: 22,
                  height: 22,
                  colorFilter: ColorFilter.mode(
                    isActive ? AppColors.primary : AppColors.textTertiary,
                    BlendMode.srcIn,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive ? AppColors.primary : AppColors.textTertiary,
                    height: 1.0,
                  ),
                ),
              ],
            ),
            if (badge > 0)
              Positioned(
                top: 8,
                right: 18,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.surface, width: 1.5),
                  ),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: Text(
                    badge > 9 ? '9+' : '$badge',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1.1,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _createButton() {
    return Expanded(
      child: Center(
        child: GestureDetector(
          onTap: () {
            if (onCreateTap != null) {
              onCreateTap!();
            } else {
              onTabChanged(2);
            }
          },
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.35),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.add_rounded, color: Colors.white, size: 30),
          ),
        ),
      ),
    );
  }
}
