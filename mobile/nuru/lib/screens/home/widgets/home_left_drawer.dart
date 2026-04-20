import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../auth/login_screen.dart';
import '../../events/create_event_screen.dart';
import '../../tickets/browse_tickets_screen.dart';
import '../../services/find_services_screen.dart';
import '../../services/my_services_screen.dart';
import '../../cards/nuru_cards_screen.dart';
import '../../circle/circle_screen.dart';
import '../../contributors/contributors_screen.dart';
import '../../communities/communities_screen.dart';
import '../../issues/my_issues_screen.dart';
import '../../removed/removed_content_screen.dart';
import '../../saved/saved_posts_screen.dart';
import '../../bookings/bookings_screen.dart';
import '../../moments/my_moments_screen.dart';
import '../../help/help_screen.dart';
import '../../settings/settings_screen.dart';
import '../../wallet/wallet_screen.dart';
import '../../../core/l10n/l10n_helper.dart';

class HomeLeftDrawer extends StatelessWidget {
  final int currentTab;
  final int unreadMessages;
  final int unreadNotifications;
  final Map<String, dynamic>? profile;
  final ValueChanged<int> onTabSelected;
  final VoidCallback onRefresh;

  const HomeLeftDrawer({
    super.key,
    required this.currentTab,
    this.unreadMessages = 0,
    this.unreadNotifications = 0,
    this.profile,
    required this.onTabSelected,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final name = profile?['first_name'] ?? auth.userName ?? '';
    final lastName = profile?['last_name'] ?? '';
    final fullName = '$name $lastName'.trim();
    final username = profile?['username'] ?? '';
    final avatar = (profile?['avatar'] as String?) ?? auth.userAvatar;

    return Drawer(
      width: 290,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(topRight: Radius.circular(20), bottomRight: Radius.circular(20)),
      ),
      child: Column(
        children: [
          _buildProfileHeader(context, fullName, username, avatar),
          const Divider(color: AppColors.borderLight, height: 1),
          Expanded(child: _buildMenuList(context)),
          const Divider(color: AppColors.borderLight, height: 1),
          _buildFooter(context, auth),
        ],
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context, String fullName, String username, String? avatar) {
    return Container(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 16, left: 20, right: 20, bottom: 16),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.border, width: 1.5)),
            child: ClipOval(child: SizedBox(width: 44, height: 44,
              child: avatar != null && avatar.isNotEmpty
                  ? CachedNetworkImage(imageUrl: avatar, width: 44, height: 44, fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _avatarFallback(fullName))
                  : _avatarFallback(fullName))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(fullName.isNotEmpty ? fullName : 'Welcome',
              style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2),
              maxLines: 1, overflow: TextOverflow.ellipsis),
            if (username.isNotEmpty) Text('@$username',
              style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary, height: 1.3)),
          ])),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: SvgPicture.asset('assets/icons/close-icon.svg', width: 20, height: 20,
              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuList(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        _section(context.tr('home').toUpperCase()),
        _item(context, 'assets/icons/home-icon.svg', context.tr('home'), isActive: currentTab == 0, onTap: () => _selectTab(context, 0)),
        _item(context, 'assets/icons/calendar-icon.svg', context.tr('my_events'), isActive: currentTab == 1, onTap: () => _selectTab(context, 1)),
        _item(context, 'assets/icons/chat-icon.svg', context.tr('messages'), isActive: currentTab == 2, onTap: () => _selectTab(context, 2), badge: unreadMessages),
        _item(context, 'assets/icons/bell-icon.svg', context.tr('notifications'), isActive: currentTab == 3, onTap: () => _selectTab(context, 3), badge: unreadNotifications),
        _createEventButton(context),
        _section(context.tr('discover').toUpperCase()),
        _item(context, 'assets/icons/ticket-icon.svg', context.tr('browse_tickets'), onTap: () => _navigate(context, const BrowseTicketsScreen())),
        _item(context, 'assets/icons/search-icon.svg', context.tr('find_services'), onTap: () => _navigate(context, const FindServicesScreen())),
        _section(context.tr('profile').toUpperCase()),
        _item(context, 'assets/icons/settings-icon.svg', context.tr('my_services'), onTap: () => _navigate(context, const MyServicesScreen())),
        _item(context, 'assets/icons/calendar-icon.svg', context.tr('bookings'), onTap: () => _navigate(context, const BookingsScreen())),
        _item(context, 'assets/icons/card-icon.svg', context.tr('nuru_pass'), onTap: () => _navigate(context, const NuruCardsScreen())),
        _item(context, 'assets/icons/card-icon.svg', 'Wallet', onTap: () => _navigate(context, const WalletScreen())),
        _item(context, 'assets/icons/circle-icon.svg', context.tr('my_circle'), onTap: () => _navigate(context, const CircleScreen())),
        _item(context, 'assets/icons/contributors-icon.svg', context.tr('contributors'), onTap: () => _navigate(context, const ContributorsScreen())),
        _item(context, 'assets/icons/communities-icon.svg', context.tr('communities'), onTap: () => _navigate(context, const CommunitiesScreen())),
        _item(context, 'assets/icons/bookmark-icon.svg', context.tr('saved_posts'), onTap: () => _navigate(context, const SavedPostsScreen())),
        _item(context, 'assets/icons/camera-icon.svg', context.tr('my_moments'), onTap: () => _navigate(context, const MyMomentsScreen())),
        _section(context.tr('help').toUpperCase()),
        _item(context, 'assets/icons/issue-icon.svg', context.tr('my_issues'), onTap: () => _navigate(context, const MyIssuesScreen())),
        _item(context, 'assets/icons/close-icon.svg', context.tr('removed_content'), onTap: () => _navigate(context, const RemovedContentScreen())),
        _item(context, 'assets/icons/help-icon.svg', context.tr('help'), onTap: () => _navigate(context, const HelpScreen())),
        _item(context, 'assets/icons/settings-icon.svg', context.tr('settings'), onTap: () {
          Navigator.pop(context);
          Navigator.push(context, MaterialPageRoute(builder: (_) => SettingsScreen(profile: profile, onProfileUpdated: onRefresh)));
        }),
      ],
    );
  }

  Widget _buildFooter(BuildContext context, AuthProvider auth) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.only(left: 16, right: 16, top: 14, bottom: 8),
        child: GestureDetector(
          onTap: () => _selectTab(context, 4),
          child: Row(children: [
            SvgPicture.asset('assets/icons/user-profile-icon.svg', width: 18, height: 18,
              colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn)),
            const SizedBox(width: 10),
            Expanded(child: Text(context.tr('profile'), style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.2))),
            SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 18, height: 18,
              colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
          ]),
        ),
      ),
      Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 4, bottom: MediaQuery.of(context).padding.bottom + 14),
        child: GestureDetector(
          onTap: () => _handleSignOut(context, auth),
          child: Row(children: [
            SvgPicture.asset('assets/icons/logout-icon.svg', width: 18, height: 18,
              colorFilter: const ColorFilter.mode(AppColors.error, BlendMode.srcIn)),
            const SizedBox(width: 10),
            Expanded(child: Text(context.tr('sign_out'), style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.error, height: 1.2))),
          ]),
        ),
      ),
    ]);
  }

  void _selectTab(BuildContext context, int index) {
    onTabSelected(index);
    Navigator.pop(context);
  }

  void _navigate(BuildContext context, Widget screen) {
    Navigator.pop(context);
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  Future<void> _handleSignOut(BuildContext context, AuthProvider auth) async {
    final navContext = Navigator.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('sign_out'), style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
        content: Text(context.tr('are_you_sure'), style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('cancel'), style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textTertiary))),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('sign_out'), style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.error))),
        ],
      ),
    );
    if (confirmed == true) {
      await auth.signOut();
      navContext.pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
    }
  }

  Widget _createEventButton(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: GestureDetector(
        onTap: () {
          Navigator.pop(context);
          Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateEventScreen()));
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(12)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.add_rounded, size: 18, color: Colors.white),
            const SizedBox(width: 8),
            Text(context.tr('create_event'), style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white, height: 1.2)),
          ]),
        ),
      ),
    );
  }

  Widget _section(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
      child: Text(title, style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textHint, letterSpacing: 1.2, height: 1.0)),
    );
  }

  Widget _item(BuildContext context, String svgAsset, String label, {bool isActive = false, VoidCallback? onTap, int badge = 0}) {
    return GestureDetector(
      onTap: onTap ?? () => Navigator.pop(context),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(color: isActive ? AppColors.primarySoft : Colors.transparent, borderRadius: BorderRadius.circular(10)),
        child: Row(children: [
          SvgPicture.asset(svgAsset, width: 20, height: 20,
            colorFilter: ColorFilter.mode(isActive ? AppColors.primary : AppColors.textSecondary, BlendMode.srcIn)),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: GoogleFonts.plusJakartaSans(
            fontSize: 14, fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            color: isActive ? AppColors.primary : AppColors.textPrimary, height: 1.3))),
          if (badge > 0) Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(8)),
            child: Text('$badge', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white, height: 1.0)),
          ),
        ]),
      ),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textSecondary, height: 1.0))),
    );
  }
}
