import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/app_colors.dart';
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
import '../../wallet/wallet_screen.dart';
import '../../event_groups/my_groups_screen.dart';
import '../../messages/messages_screen.dart';
import '../../../core/l10n/l10n_helper.dart';

/// Modern, organized left drawer that mirrors the web sidebar redesign:
/// pinned essentials on top, bold Create-Event CTA, collapsible groups
/// (Discover / Money / Network / Account), live filter at the top, and a
/// sticky profile + sign-out footer. Group open/closed state persists.
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
  static const _kSectionStateKey = 'nuru_drawer_sections_v1';
  static const _kFavoritesKey   = 'nuru_drawer_favorites_v1';
  static const _kRecentsKey     = 'nuru_drawer_recents_v1';
  static const _kMaxRecents     = 5;

  final TextEditingController _filterCtrl = TextEditingController();
  String _filter = '';

  // Default open state per group; overridden by what we load from prefs.
  Map<String, bool> _sectionOpen = {
    'discover': true,
    'money': true,
    'network': false,
    'account': false,
  };

  // Favorites and recents are keyed by item label (stable enough across
  // navigations within a single locale; gracefully degrades on locale change).
  List<String> _favorites = [];
  List<String> _recents = [];

  @override
  void initState() {
    super.initState();
    _loadPersistedState();
    _filterCtrl.addListener(() {
      if (_filterCtrl.text != _filter) {
        setState(() => _filter = _filterCtrl.text.trim().toLowerCase());
      }
    });
  }

  @override
  void dispose() {
    _filterCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPersistedState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final secRaw = prefs.getString(_kSectionStateKey);
      final favRaw = prefs.getString(_kFavoritesKey);
      final recRaw = prefs.getString(_kRecentsKey);
      if (!mounted) return;
      setState(() {
        if (secRaw != null) {
          final decoded = jsonDecode(secRaw) as Map<String, dynamic>;
          _sectionOpen = { ..._sectionOpen, ...decoded.map((k, v) => MapEntry(k, v == true)) };
        }
        if (favRaw != null) {
          _favorites = (jsonDecode(favRaw) as List).map((e) => e.toString()).toList();
        }
        if (recRaw != null) {
          _recents = (jsonDecode(recRaw) as List).map((e) => e.toString()).toList();
        }
      });
    } catch (_) {}
  }

  Future<void> _persistSectionState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kSectionStateKey, jsonEncode(_sectionOpen));
    } catch (_) {}
  }

  Future<void> _persistFavorites() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kFavoritesKey, jsonEncode(_favorites));
    } catch (_) {}
  }

  Future<void> _persistRecents() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kRecentsKey, jsonEncode(_recents));
    } catch (_) {}
  }

  void _toggleSection(String id) {
    setState(() => _sectionOpen[id] = !(_sectionOpen[id] ?? false));
    _persistSectionState();
  }

  void _toggleFavorite(String key) {
    setState(() {
      if (_favorites.contains(key)) {
        _favorites.remove(key);
      } else {
        _favorites.add(key);
      }
    });
    _persistFavorites();
  }

  void _recordRecent(String key) {
    setState(() {
      _recents.remove(key);
      _recents.insert(0, key);
      if (_recents.length > _kMaxRecents) {
        _recents = _recents.sublist(0, _kMaxRecents);
      }
    });
    _persistRecents();
  }

  // ── Build ────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final name = widget.profile?['first_name'] ?? auth.userName ?? '';
    final lastName = widget.profile?['last_name'] ?? '';
    final fullName = '$name $lastName'.trim();
    final username = widget.profile?['username'] ?? '';
    final avatar = (widget.profile?['avatar'] as String?) ?? auth.userAvatar;

    return Drawer(
      width: 290,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      child: Column(
        children: [
          _buildProfileHeader(context, fullName, username, avatar),
          const Divider(color: AppColors.borderLight, height: 1),
          _buildFilterField(),
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
              style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2),
              maxLines: 1, overflow: TextOverflow.ellipsis),
            if (username.isNotEmpty) Text('@$username',
              style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary, height: 1.3)),
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

  Widget _buildFilterField() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0xFFEDEDEF), width: 1),
        ),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, size: 20, color: Color(0xFF8E8E93)),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _filterCtrl,
                cursorColor: Colors.black,
                textAlignVertical: TextAlignVertical.center,
                style: GoogleFonts.inter(fontSize: 14, color: Colors.black),
                decoration: InputDecoration(
                  isDense: true,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  focusedErrorBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  hintText: 'Quick jump…',
                  hintStyle: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    color: const Color(0xFF9E9E9E),
                  ),
                ),
              ),
            ),
            if (_filter.isNotEmpty)
              GestureDetector(
                onTap: () => _filterCtrl.clear(),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close_rounded, size: 16, color: Color(0xFF8E8E93)),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // Group definitions (label + items) — kept lean: profile page hosts the rest.
  List<_NavItem> get _pinned => [
        _NavItem(icon: 'assets/icons/home-icon.svg', label: context.tr('home'), tab: 0),
        _NavItem(icon: 'assets/icons/calendar-icon.svg', label: context.tr('my_events'), tab: 1),
        _NavItem(icon: 'assets/icons/chat-icon.svg', label: context.tr('messages'), screen: const MessagesScreen(), badge: widget.unreadMessages),
      ];

  List<_NavSection> get _sections => [
        _NavSection(id: 'discover', label: 'Discover', items: [
          _NavItem(icon: 'assets/icons/ticket-icon.svg', label: context.tr('browse_tickets'), screen: const BrowseTicketsScreen()),
          _NavItem(icon: 'assets/icons/search-icon.svg', label: context.tr('find_services'), screen: const FindServicesScreen()),
          _NavItem(icon: 'assets/icons/communities-icon.svg', label: context.tr('communities'), screen: const CommunitiesScreen()),
        ]),
        _NavSection(id: 'money', label: 'Money', items: [
          _NavItem(icon: 'assets/icons/card-icon.svg', label: 'Wallet', screen: const WalletScreen()),
          _NavItem(icon: 'assets/icons/calendar-icon.svg', label: context.tr('bookings'), screen: const BookingsScreen()),
        ]),
        _NavSection(id: 'network', label: 'Network', items: [
          _NavItem(icon: 'assets/icons/circle-icon.svg', label: context.tr('my_circle'), screen: const CircleScreen()),
          _NavItem(icon: 'assets/icons/communities-icon.svg', label: 'My Groups', screen: const MyGroupsScreen()),
          _NavItem(icon: 'assets/icons/settings-icon.svg', label: context.tr('my_services'), screen: const MyServicesScreen()),
        ]),
        _NavSection(id: 'account', label: 'Account', items: [
          _NavItem(icon: 'assets/icons/help-icon.svg', label: context.tr('help'), screen: const HelpScreen()),
          _NavItem(icon: 'assets/icons/settings-icon.svg', label: context.tr('settings'), onTap: (ctx) {
            Navigator.pop(ctx);
            Navigator.push(ctx, MaterialPageRoute(builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: widget.onRefresh)));
          }),
        ]),
      ];

  Widget _buildMenuList(BuildContext context) {
    final filtering = _filter.isNotEmpty;

    if (filtering) {
      // Flat filtered results across all items.
      final all = <_NavItem>[
        ..._pinned,
        ..._sections.expand((s) => s.items),
      ].where((i) => i.label.toLowerCase().contains(_filter)).toList();

      return ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          if (all.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text('No matches', textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textHint)),
            )
          else
            ...all.map((i) => _buildItem(context, i)),
        ],
      );
    }

    // Build resolved Favorites + Recents from labels we have available.
    final allItems = <_NavItem>[..._pinned, ..._sections.expand((s) => s.items)];
    final byKey = { for (final i in allItems) i.label : i };
    final favItems = _favorites.map((k) => byKey[k]).whereType<_NavItem>().toList();
    final recentItems = _recents
        .where((k) => !_favorites.contains(k))
        .map((k) => byKey[k])
        .whereType<_NavItem>()
        .toList();

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        ..._pinned.map((i) => _buildItem(context, i)),
        if (favItems.isNotEmpty) ...[
          _buildHeader(Icons.star_rounded, 'Favorites'),
          ...favItems.map((i) => _buildItem(context, i)),
        ],
        if (recentItems.isNotEmpty) ...[
          _buildHeader(Icons.access_time_rounded, 'Recents'),
          ...recentItems.take(3).map((i) => _buildItem(context, i)),
        ],
        ..._sections.map((s) => _buildSection(context, s)),
      ],
    );
  }

  Widget _buildHeader(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
      child: Row(children: [
        Icon(icon, size: 12, color: AppColors.textHint),
        const SizedBox(width: 6),
        Text(label.toUpperCase(),
          style: GoogleFonts.inter(
            fontSize: 10, fontWeight: FontWeight.w700,
            color: AppColors.textHint, letterSpacing: 1.2, height: 1.0,
          )),
      ]),
    );
  }

  Widget _buildSection(BuildContext context, _NavSection section) {
    final open = _sectionOpen[section.id] ?? false;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => _toggleSection(section.id),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Row(
                children: [
                  AnimatedRotation(
                    turns: open ? 0 : -0.25,
                    duration: const Duration(milliseconds: 180),
                    curve: Curves.easeOut,
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 14,
                      color: open ? AppColors.textSecondary : AppColors.textHint,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      section.label.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: open ? AppColors.textSecondary : AppColors.textHint,
                        letterSpacing: 1.1,
                        height: 1.0,
                      ),
                    ),
                  ),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 180),
                    opacity: open ? 0 : 1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${section.items.length}',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textTertiary,
                          height: 1.0,
                        ),
                      ),
                    ),
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
            child: open
                ? Padding(
                    padding: const EdgeInsets.only(left: 22, right: 4, bottom: 4),
                    child: Container(
                      decoration: const BoxDecoration(
                        border: Border(
                          left: BorderSide(color: AppColors.borderLight, width: 1),
                        ),
                      ),
                      padding: const EdgeInsets.only(left: 6),
                      child: Column(
                        children: section.items.map((i) => _buildItem(context, i, nested: true)).toList(),
                      ),
                    ),
                  )
                : const SizedBox(width: double.infinity, height: 0),
          ),
        ),
      ],
    );
  }

  Widget _buildItem(BuildContext context, _NavItem item, {bool nested = false}) {
    final isActive = item.tab != null && widget.currentTab == item.tab;
    final isFav = _favorites.contains(item.label);
    return GestureDetector(
      onTap: () {
        // Track recents for non-tab items so the Recents section is useful.
        if (item.tab == null) _recordRecent(item.label);
        if (item.onTap != null) {
          item.onTap!(context);
        } else if (item.tab != null) {
          widget.onTabSelected(item.tab!);
          Navigator.pop(context);
        } else if (item.screen != null) {
          Navigator.pop(context);
          Navigator.push(context, MaterialPageRoute(builder: (_) => item.screen!))
              .then((_) => widget.onRefresh());
        }
      },
      onLongPress: () {
        HapticFeedback.selectionClick();
        _toggleFavorite(item.label);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          duration: const Duration(milliseconds: 1400),
          behavior: SnackBarBehavior.floating,
          content: Text(isFav ? 'Removed from favorites' : 'Added to favorites',
            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
        ));
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: EdgeInsets.symmetric(horizontal: nested ? 4 : 12, vertical: nested ? 1 : 2),
        padding: EdgeInsets.symmetric(horizontal: nested ? 10 : 12, vertical: nested ? 9 : 11),
        decoration: BoxDecoration(
          color: isActive
              ? AppColors.primarySoft
              : Colors.transparent,
          borderRadius: BorderRadius.circular(nested ? 8 : 10),
        ),
        child: Row(children: [
          if (!nested)
            // Active accent bar (only for top-level items)
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 3,
              height: 18,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          SvgPicture.asset(item.icon,
            width: nested ? 17 : 20, height: nested ? 17 : 20,
            colorFilter: ColorFilter.mode(isActive ? AppColors.primary : AppColors.textSecondary, BlendMode.srcIn)),
          SizedBox(width: nested ? 10 : 12),
          Expanded(child: Text(item.label, style: GoogleFonts.inter(
            fontSize: nested ? 13 : 14,
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            color: isActive ? AppColors.primary : AppColors.textPrimary, height: 1.3))),
          if (isFav)
            const Padding(
              padding: EdgeInsets.only(right: 6),
              child: Icon(Icons.star_rounded, size: 14, color: AppColors.primary),
            ),
          if ((item.badge ?? 0) > 0) Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(8)),
            child: Text('${item.badge}', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white, height: 1.0)),
          ),
        ]),
      ),
    );
  }

  Widget _buildFooter(BuildContext context, AuthProvider auth) {
    return Column(children: [
      Padding(
        padding: EdgeInsets.only(left: 16, right: 16, top: 14, bottom: MediaQuery.of(context).padding.bottom + 14),
        child: GestureDetector(
          onTap: () => _handleSignOut(context, auth),
          child: Row(children: [
            SvgPicture.asset('assets/icons/logout-icon.svg', width: 18, height: 18,
              colorFilter: const ColorFilter.mode(AppColors.error, BlendMode.srcIn)),
            const SizedBox(width: 10),
            Expanded(child: Text(context.tr('sign_out'), style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.error, height: 1.2))),
          ]),
        ),
      ),
    ]);
  }

  Future<void> _handleSignOut(BuildContext context, AuthProvider auth) async {
    final navContext = Navigator.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(context.tr('sign_out'), style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
        content: Text(context.tr('are_you_sure'), style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('cancel'), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textTertiary))),
          TextButton(onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('sign_out'), style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.error))),
        ],
      ),
    );
    if (confirmed == true) {
      await auth.signOut();
      navContext.pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
    }
  }

  Widget _avatarFallback(String name) {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textSecondary, height: 1.0))),
    );
  }
}

class _NavItem {
  final String icon;
  final String label;
  final int? tab;            // bottom-nav tab index (for primary items)
  final Widget? screen;      // pushed via MaterialPageRoute
  final void Function(BuildContext)? onTap; // custom handler (e.g. Settings)
  final int? badge;
  _NavItem({required this.icon, required this.label, this.tab, this.screen, this.onTap, this.badge});
}

class _NavSection {
  final String id;
  final String label;
  final List<_NavItem> items;
  _NavSection({required this.id, required this.label, required this.items});
}
