import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/sign_out_overlay.dart';
import '../../../core/widgets/sign_out_confirm_button.dart';
import '../../../providers/auth_provider.dart';
import '../../auth/login_screen.dart';
import '../../tickets/browse_tickets_screen.dart';
import '../../services/find_services_screen.dart';
import '../../services/my_services_screen.dart';
import '../../circle/circle_screen.dart';
import '../../communities/communities_screen.dart';
import '../../bookings/bookings_screen.dart';
import '../../help/help_screen.dart';
import '../../settings/settings_screen.dart';
import '../../settings/identity_verification_screen.dart';
import '../../wallet/wallet_screen.dart';
import '../../wallet/payment_history_screen.dart';
import '../../event_groups/my_groups_screen.dart';
import '../../contributors/contributors_screen.dart';
import '../../contributors/my_contributions_screen.dart';
import '../../messages/messages_screen.dart';
import '../../../core/l10n/l10n_helper.dart';

/// Left drawer matching the mockup: header, identity status card, 4-tab grid,
/// list with expandable groups (sub-items connected by vertical line + dots),
/// "Make an impact" card with Nuru logo, and footer (Settings/Help + Sign Out).
class HomeLeftDrawer extends StatefulWidget {
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
  State<HomeLeftDrawer> createState() => _HomeLeftDrawerState();
}

class _HomeLeftDrawerState extends State<HomeLeftDrawer> {
  static const _kExpandedKey = 'nuru_drawer_expanded_v2';
  final Map<String, bool> _expanded = {};

  @override
  void initState() {
    super.initState();
    _loadPersisted();
  }

  Future<void> _loadPersisted() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kExpandedKey);
      if (raw == null || !mounted) return;
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      setState(() {
        _expanded.clear();
        decoded.forEach((k, v) => _expanded[k] = v == true);
      });
    } catch (_) {}
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kExpandedKey, jsonEncode(_expanded));
    } catch (_) {}
  }

  void _toggle(String id) {
    setState(() => _expanded[id] = !(_expanded[id] ?? false));
    _persist();
  }

  bool get _isVerified {
    final p = widget.profile ?? const {};
    if (p['is_identity_verified'] == true ||
        p['identity_verified'] == true ||
        p['kyc_verified'] == true) return true;
    final s = (p['verification_status'] ?? p['identity_status'] ?? p['kyc_status'])
        ?.toString().toLowerCase();
    return s == 'verified' || s == 'approved';
  }

  bool get _isPending {
    final p = widget.profile ?? const {};
    final s = (p['verification_status'] ?? p['identity_status'] ?? p['kyc_status'])
        ?.toString().toLowerCase();
    return s == 'pending' || s == 'submitted' || s == 'in_review';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final name = widget.profile?['first_name'] ?? auth.userName ?? '';
    final lastName = widget.profile?['last_name'] ?? '';
    final fullName = '$name $lastName'.trim();
    final username = widget.profile?['username'] ?? '';
    final avatar = (widget.profile?['avatar'] as String?) ?? auth.userAvatar;

    return Drawer(
      width: 320,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                children: [
                  _buildHeader(context, fullName, username, avatar),
                  const SizedBox(height: 18),
                  _buildIdentityCard(context),
                  const SizedBox(height: 18),
                  _buildTabsGrid(context),
                  const SizedBox(height: 18),
                  _buildNavList(context),
                ],
              ),
            ),
            const Divider(color: AppColors.borderLight, height: 1),
            _buildFooter(context, auth),
          ],
        ),
      ),
    );
  }

  // ── Header ───────────────────────────────────────────────────────────────
  Widget _buildHeader(BuildContext context, String fullName, String username, String? avatar) {
    return Row(
      children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.borderLight, width: 1.5),
          ),
          child: ClipOval(
            child: avatar != null && avatar.isNotEmpty
                ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _avatarFallback(fullName))
                : _avatarFallback(fullName),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                fullName.isNotEmpty ? fullName : 'Welcome',
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 17, fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary, height: 1.2),
              ),
              if (username.isNotEmpty)
                Text('@$username',
                  style: GoogleFonts.inter(
                    fontSize: 12, color: AppColors.textTertiary, height: 1.4)),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: AppColors.background,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close_rounded, size: 18, color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }

  // ── Identity status card ─────────────────────────────────────────────────
  Widget _buildIdentityCard(BuildContext context) {
    final verified = _isVerified;
    final pending = _isPending;
    final title = verified
        ? 'Verified Member'
        : (pending ? 'Verification Pending' : 'Verify your identity');
    final subtitle = verified
        ? 'Your identity is confirmed.'
        : (pending ? 'We’re reviewing your documents.' : 'Tap to start verification.');
    final iconData = verified
        ? Icons.verified_rounded
        : (pending ? Icons.hourglass_top_rounded : Icons.shield_outlined);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: verified
            ? null
            : () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => const IdentityVerificationScreen()));
              },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.10),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: Icon(iconData, size: 22, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary, height: 1.2)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: GoogleFonts.inter(
                      fontSize: 12, color: AppColors.textSecondary, height: 1.3)),
                  ],
                ),
              ),
              if (!verified)
                const Icon(Icons.chevron_right_rounded, size: 22, color: AppColors.primary),
            ],
          ),
        ),
      ),
    );
  }

  // ── 4-tab grid ───────────────────────────────────────────────────────────
  Widget _buildTabsGrid(BuildContext context) {
    final tabs = <_TabCell>[
      _TabCell(icon: 'assets/icons/home-icon.svg', label: context.tr('home'), active: widget.currentTab == 0,
        onTap: () { widget.onTabSelected(0); Navigator.pop(context); }),
      _TabCell(icon: 'assets/icons/calendar-icon.svg', label: 'Events', active: widget.currentTab == 1,
        onTap: () { widget.onTabSelected(1); Navigator.pop(context); }),
      _TabCell(icon: 'assets/icons/chat-icon.svg', label: 'Chat', badge: widget.unreadMessages,
        onTap: () => _push(context, const MessagesScreen())),
      _TabCell(icon: 'assets/icons/communities-icon.svg', label: 'Groups',
        onTap: () => _push(context, const MyGroupsScreen())),
    ];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight, width: 1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: tabs.map((t) => _tabCellWidget(t)).toList(),
      ),
    );
  }

  Widget _tabCellWidget(_TabCell t) {
    final color = t.active ? AppColors.primary : AppColors.textSecondary;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: t.onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  SvgPicture.asset(t.icon, width: 22, height: 22,
                    colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
                  if ((t.badge ?? 0) > 0)
                    Positioned(
                      top: -4, right: -8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(8)),
                        child: Text('${t.badge}', style: GoogleFonts.inter(
                          fontSize: 9, fontWeight: FontWeight.w700,
                          color: Colors.white, height: 1.1)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(t.label, style: GoogleFonts.inter(
                fontSize: 12, fontWeight: t.active ? FontWeight.w700 : FontWeight.w500,
                color: color, height: 1.2)),
              const SizedBox(height: 6),
              Container(
                width: 18, height: 2,
                decoration: BoxDecoration(
                  color: t.active ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Expandable nav list ──────────────────────────────────────────────────
  List<_NavGroup> _navGroups(BuildContext context) => [
    _NavGroup(
      id: 'contributors',
      icon: 'assets/icons/contributors-icon.svg',
      label: 'Contributors',
      children: [
        _NavLeaf('My Contributors', const ContributorsScreen()),
        _NavLeaf('My Contributions', const MyContributionsScreen()),
      ],
    ),
    _NavGroup(
      id: 'discover',
      icon: 'assets/icons/earth-icon.svg',
      label: 'Discover',
      children: [
        _NavLeaf(context.tr('browse_tickets'), const BrowseTicketsScreen()),
        _NavLeaf(context.tr('find_services'), const FindServicesScreen()),
        _NavLeaf(context.tr('communities'), const CommunitiesScreen()),
      ],
    ),
    _NavGroup(
      id: 'money',
      icon: 'assets/icons/wallet-icon.svg',
      label: 'Money',
      children: [
        _NavLeaf('Wallet', const WalletScreen()),
        _NavLeaf(context.tr('bookings'), const BookingsScreen()),
        _NavLeaf('Payment History', const PaymentHistoryScreen()),
      ],
    ),
    _NavGroup(
      id: 'network',
      icon: 'assets/icons/communities-icon.svg',
      label: 'Network',
      children: [
        _NavLeaf(context.tr('my_circle'), const CircleScreen()),
        _NavLeaf('My Groups', const MyGroupsScreen()),
      ],
    ),
    _NavGroup(
      id: 'services',
      icon: 'assets/icons/package-icon.svg',
      label: 'Services',
      children: [
        _NavLeaf('My Services', const MyServicesScreen()),
      ],
    ),
  ];

  Widget _buildNavList(BuildContext context) {
    final groups = _navGroups(context);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: List.generate(groups.length, (i) {
          final g = groups[i];
          final isLast = i == groups.length - 1;
          return _buildNavGroup(context, g, isLast);
        }),
      ),
    );
  }

  Widget _buildNavGroup(BuildContext context, _NavGroup g, bool isLast) {
    final open = _expanded[g.id] ?? false;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => _toggle(g.id),
            splashColor: Colors.transparent,
            highlightColor: Colors.transparent,
            hoverColor: Colors.transparent,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(
                children: [
                  const SizedBox(width: 8),
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: SvgPicture.asset(g.icon, width: 18, height: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(g.label, style: GoogleFonts.inter(
                      fontSize: 15, fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary, height: 1.2)),
                  ),
                  AnimatedRotation(
                    turns: open ? 0.25 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: const Icon(Icons.chevron_right_rounded,
                      size: 22, color: AppColors.textHint),
                  ),
                ],
              ),
            ),
          ),
        ),
        ClipRect(
          child: AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeInOutCubic,
            alignment: Alignment.topCenter,
            child: open ? _buildSubItems(context, g) : const SizedBox(width: double.infinity, height: 0),
          ),
        ),
        if (!isLast)
          const Divider(height: 1, thickness: 1, color: AppColors.borderLight,
            indent: 14, endIndent: 4),
      ],
    );
  }

  Widget _buildSubItems(BuildContext context, _NavGroup g) {
    return Padding(
      padding: const EdgeInsets.only(left: 20, bottom: 10),
      child: Column(
        children: List.generate(g.children.length, (i) {
          final leaf = g.children[i];
          final isLast = i == g.children.length - 1;
          return IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Vertical line + dot
                SizedBox(
                  width: 28,
                  child: CustomPaint(
                    painter: _ConnectorPainter(isLast: isLast),
                  ),
                ),
                Expanded(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: () => _push(context, leaf.screen),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                        child: Text(leaf.label, style: GoogleFonts.inter(
                          fontSize: 13.5, fontWeight: FontWeight.w500,
                          color: AppColors.textPrimary, height: 1.3)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }

  // ── Footer: Settings | Help, then Sign Out ───────────────────────────────
  Widget _buildFooter(BuildContext context, AuthProvider auth) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 14, 20, MediaQuery.of(context).padding.bottom + 14),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _footerAction(
                icon: Icons.settings_outlined,
                label: context.tr('settings'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(
                    builder: (_) => SettingsScreen(
                      profile: widget.profile,
                      onProfileUpdated: widget.onRefresh)));
                },
              )),
              Container(width: 1, height: 28, color: AppColors.borderLight),
              Expanded(child: _footerAction(
                icon: Icons.help_outline_rounded,
                label: context.tr('help'),
                onTap: () => _push(context, const HelpScreen()),
              )),
            ],
          ),
          const SizedBox(height: 14),
          SignOutConfirmButton(
            confirmLabel: context.tr('sign_out'),
            cancelLabel: context.tr('cancel'),
            questionLabel: context.tr('are_you_sure'),
            onConfirm: () => _runSignOut(context, auth),
            trigger: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.error.withOpacity(0.4), width: 1.2),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SvgPicture.asset('assets/icons/logout-icon.svg', width: 18, height: 18,
                    colorFilter: const ColorFilter.mode(AppColors.error, BlendMode.srcIn)),
                  const SizedBox(width: 10),
                  Text(context.tr('sign_out'), style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w700,
                    color: AppColors.error, height: 1.2)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _footerAction({required IconData icon, required String label, required VoidCallback onTap}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 34, height: 34,
                decoration: BoxDecoration(
                  color: AppColors.background,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: AppColors.textPrimary),
              ),
              const SizedBox(width: 10),
              Text(label, style: GoogleFonts.inter(
                fontSize: 14, fontWeight: FontWeight.w600,
                color: AppColors.textPrimary, height: 1.2)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _runSignOut(BuildContext context, AuthProvider auth) async {
    final navContext = Navigator.of(context);
    await SignOutOverlay.run(context, () => auth.signOut());
    navContext.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.pop(context);
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen))
        .then((_) => widget.onRefresh());
  }

  Widget _avatarFallback(String name) {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700,
          color: AppColors.textSecondary, height: 1.0))),
    );
  }
}

class _TabCell {
  final String icon;
  final String label;
  final bool active;
  final int? badge;
  final VoidCallback onTap;
  _TabCell({required this.icon, required this.label, required this.onTap,
    this.active = false, this.badge});
}

class _NavLeaf {
  final String label;
  final Widget screen;
  _NavLeaf(this.label, this.screen);
}

class _NavGroup {
  final String id;
  final String icon;
  final String label;
  final List<_NavLeaf> children;
  _NavGroup({required this.id, required this.icon, required this.label, required this.children});
}

/// Paints the vertical line + dot connector for sub-items.
class _ConnectorPainter extends CustomPainter {
  final bool isLast;
  _ConnectorPainter({required this.isLast});

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = AppColors.borderLight
      ..strokeWidth = 1.2;
    final dotPaint = Paint()..color = AppColors.primary;

    final cx = size.width / 2 - 4;
    final midY = size.height / 2;
    // Vertical line: top -> bottom (or top -> mid for last)
    canvas.drawLine(Offset(cx, 0),
      Offset(cx, isLast ? midY : size.height), linePaint);
    // Horizontal stub to the item
    canvas.drawLine(Offset(cx, midY), Offset(size.width, midY), linePaint);
    // Dot at junction
    canvas.drawCircle(Offset(cx, midY), 3.2, dotPaint);
  }

  @override
  bool shouldRepaint(covariant _ConnectorPainter old) => old.isLast != isLast;
}
