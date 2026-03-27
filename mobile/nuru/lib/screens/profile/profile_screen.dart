import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/api_service.dart';
import '../../core/services/events_service.dart';
import '../../core/services/social_service.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../settings/settings_screen.dart';
import '../events/event_detail_screen.dart';
import '../public_profile/public_profile_screen.dart';
import '../help/help_screen.dart';
import 'follow_list_screen.dart';

TextStyle _pf({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3, double letterSpacing = 0}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height, letterSpacing: letterSpacing);

/// Premium Profile Screen — world-class editorial design with full web parity
class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic>? profile;
  final int myEventsCount;
  final VoidCallback? onRefresh;

  const ProfileScreen({
    super.key,
    this.profile,
    this.myEventsCount = 0,
    this.onRefresh,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  Map<String, dynamic>? _profileData;
  bool _profileLoading = true;
  List<dynamic> _moments = [];
  bool _momentsLoading = true;
  List<dynamic> _events = [];
  bool _eventsLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadProfileDetails().then((_) => _loadMoments());
    _loadEvents();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadMoments() async {
    setState(() => _momentsLoading = true);
    // Use getUserPosts (same as /my-posts page) for reliable data
    final userId = _profileData?['id']?.toString() ?? '';
    Map<String, dynamic> res;
    if (userId.isNotEmpty) {
      res = await SocialService.getUserPosts(userId, limit: 30);
    } else {
      res = await SocialService.getMyPosts(limit: 30);
    }
    if (mounted) {
      setState(() {
        _momentsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _moments = data is List ? data : (data is Map ? (data['posts'] ?? data['items'] ?? []) : []);
        }
      });
    }
  }

  Future<void> _loadEvents() async {
    setState(() => _eventsLoading = true);
    final res = await EventsService.getMyEvents(limit: 20);
    if (mounted) {
      setState(() {
        _eventsLoading = false;
        if (res['success'] == true) {
          final data = res['data'];
          if (data is List) {
            _events = data;
          } else if (data is Map) {
            final nested = data['data'];
            final extracted = data['events'] ?? data['items'] ?? (nested is Map ? (nested['events'] ?? nested['items']) : nested) ?? [];
            _events = extracted is List ? extracted : [];
          } else {
            _events = [];
          }
        }
      });
    }
  }

  Future<void> _loadProfileDetails() async {
    setState(() => _profileLoading = true);

    // Use /auth/me first (same as web useCurrentUser approach)
    final meRes = await AuthApi.me();
    Map<String, dynamic>? userData;
    if (meRes['success'] == true && meRes['data'] is Map<String, dynamic>) {
      userData = meRes['data'] as Map<String, dynamic>;
    } else if (meRes['data'] is Map<String, dynamic> && meRes['data']['id'] != null) {
      userData = meRes['data'] as Map<String, dynamic>;
    }

    // Merge with /users/profile for additional fields (avatar, bio, cover, social_links)
    final profileRes = await EventsService.getProfile();
    if (profileRes['success'] == true && profileRes['data'] is Map<String, dynamic>) {
      final profileData = profileRes['data'] as Map<String, dynamic>;
      userData = {...(userData ?? {}), ...profileData};
    }

    if (mounted) {
      setState(() {
        _profileData = userData;
        _profileLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final p = _profileData ?? widget.profile ?? <String, dynamic>{};
    final firstName = p['first_name']?.toString() ?? '';
    final lastName = p['last_name']?.toString() ?? '';
    final fullName = '$firstName $lastName'.trim();
    final username = p['username']?.toString() ?? '';
    final phone = p['phone']?.toString() ?? '';
    final email = p['email']?.toString() ?? '';
    final avatar = p['avatar'] as String?;
    final coverImage = p['cover_image'] as String?;
    final bio = p['bio']?.toString() ?? '';
    final location = p['location']?.toString() ?? '';
    final website = p['website_url']?.toString() ?? p['website']?.toString() ?? '';
    final profileEventCount = (p['event_count'] ?? p['events_count'] ?? p['total_events'] ?? 0) as num;
    final eventCount = _events.isNotEmpty ? _events.length : (profileEventCount > 0 ? profileEventCount.toInt() : widget.myEventsCount);
    final followerCount = p['follower_count'] ?? p['followers_count'] ?? 0;
    final followingCount = p['following_count'] ?? 0;
    final momentsCount = p['post_count'] ?? p['posts_count'] ?? _moments.length;
    final socialLinks = p['social_links'] is Map ? p['social_links'] as Map<String, dynamic> : <String, dynamic>{};
    final userId = p['id']?.toString() ?? '';

    return RefreshIndicator(
      onRefresh: () async {
        widget.onRefresh?.call();
        await Future.wait([_loadProfileDetails(), _loadMoments(), _loadEvents()]);
      },
      color: AppColors.primary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Cover + Avatar hero section
          SliverToBoxAdapter(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: 170,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, Color(0xFF1A3B6E)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    image: coverImage != null
                        ? DecorationImage(
                            image: NetworkImage(coverImage),
                            fit: BoxFit.cover,
                            colorFilter: ColorFilter.mode(Colors.black.withOpacity(0.15), BlendMode.darken),
                          )
                        : null,
                  ),
                  child: coverImage == null ? CustomPaint(painter: _CoverPatternPainter()) : null,
                ),
                Positioned.fill(
                  child: Center(
                    child: Text(
                      'Plan Smarter',
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        shadows: [
                          Shadow(color: Colors.black.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2)),
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 20, bottom: -44,
                  child: Container(
                    width: 92, height: 92,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.surface, width: 4),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 16, offset: const Offset(0, 4))],
                    ),
                    child: ClipOval(
                      child: SizedBox(
                        width: 92, height: 92,
                        child: avatar != null && avatar.isNotEmpty
                            ? CachedNetworkImage(imageUrl: avatar, width: 92, height: 92, fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => _avatarFallback(fullName))
                            : _avatarFallback(fullName),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 16, bottom: -20,
                  child: GestureDetector(
                    onTap: () => Navigator.push(context, MaterialPageRoute(
                      builder: (_) => SettingsScreen(profile: p, onProfileUpdated: () => widget.onRefresh?.call()),
                    )),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.borderLight, width: 1),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2))],
                      ),
                      child: Text('Edit Profile', style: _pf(size: 12, weight: FontWeight.w600, color: AppColors.textPrimary)),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Name, username, bio, social
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 54, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Full name (no tick — removed per user request)
                  Text(
                    _profileLoading && fullName.isEmpty ? 'Loading profile...' : (fullName.isNotEmpty ? fullName : 'Your Name'),
                    style: _pf(size: 24, weight: FontWeight.w800, letterSpacing: -0.3, height: 1.2),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                  ),
                  if (username.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text('@$username', style: _pf(size: 14, color: AppColors.primary, weight: FontWeight.w600)),
                  ],
                  if (bio.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(bio, style: _pf(size: 14, color: AppColors.textSecondary, height: 1.5), maxLines: 4, overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 12),
                  // Contact & location info
                  Wrap(spacing: 14, runSpacing: 8, children: [
                    if (phone.isNotEmpty)
                      _infoChipIcon(Icons.phone_outlined, phone),
                    if (email.isNotEmpty)
                      _infoChipIcon(Icons.email_outlined, email),
                    if (location.isNotEmpty)
                      _infoChip('assets/icons/location-icon.svg', location),
                    if (website.isNotEmpty)
                      GestureDetector(
                        onTap: () => _launchUrl(website),
                        child: _infoChip(null, website.replaceAll(RegExp(r'https?://'), ''), icon: Icons.link_rounded, isLink: true),
                      ),
                  ]),
                  // Social links
                  if (socialLinks.values.any((v) => v != null && v.toString().isNotEmpty)) ...[
                    const SizedBox(height: 10),
                    Wrap(spacing: 10, children: [
                      if (_hasSocial(socialLinks, 'instagram')) _socialButton('Instagram', () => _launchUrl('https://instagram.com/${socialLinks['instagram']}')),
                      if (_hasSocial(socialLinks, 'twitter')) _socialButton('Twitter', () => _launchUrl('https://twitter.com/${socialLinks['twitter']}')),
                      if (_hasSocial(socialLinks, 'facebook')) _socialButton('Facebook', () => _launchUrl('https://facebook.com/${socialLinks['facebook']}')),
                      if (_hasSocial(socialLinks, 'linkedin')) _socialButton('LinkedIn', () => _launchUrl('https://linkedin.com/in/${socialLinks['linkedin']}')),
                    ]),
                  ],
                ],
              ),
            ),
          ),

          // Stats row
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight, width: 1),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8)],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _stat('$momentsCount', 'Moments'),
                    _statDivider(),
                    GestureDetector(
                      onTap: userId.isNotEmpty ? () => Navigator.push(context, MaterialPageRoute(
                        builder: (_) => FollowListScreen(userId: userId, followers: true))) : null,
                      child: _stat('$followerCount', 'Followers'),
                    ),
                    _statDivider(),
                    GestureDetector(
                      onTap: userId.isNotEmpty ? () => Navigator.push(context, MaterialPageRoute(
                        builder: (_) => FollowListScreen(userId: userId, followers: false))) : null,
                      child: _stat('$followingCount', 'Following'),
                    ),
                    _statDivider(),
                    _stat('$eventCount', 'Events'),
                  ],
                ),
              ),
            ),
          ),

          // Tab bar — Moments | Events | Settings
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 6)],
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  indicatorPadding: const EdgeInsets.all(3),
                  dividerHeight: 0,
                  labelStyle: _pf(size: 12, weight: FontWeight.w700),
                  unselectedLabelStyle: _pf(size: 12, weight: FontWeight.w500),
                  labelColor: AppColors.textPrimary,
                  unselectedLabelColor: AppColors.textTertiary,
                  tabs: const [Tab(text: 'Moments'), Tab(text: 'Events'), Tab(text: 'Settings')],
                ),
              ),
            ),
          ),

          // Tab content
          SliverFillRemaining(
            child: TabBarView(
              controller: _tabController,
              children: [
                _momentsGrid(),
                _eventsTab(),
                _settingsList(auth),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoChip(String? svgAsset, String text, {IconData? icon, bool isLink = false}) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (svgAsset != null)
        SvgPicture.asset(svgAsset, width: 14, height: 14,
          colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn))
      else if (icon != null)
        Icon(icon, size: 14, color: isLink ? AppColors.primary : AppColors.textTertiary),
      const SizedBox(width: 4),
      Flexible(child: Text(text, style: _pf(size: 12, color: isLink ? AppColors.primary : AppColors.textTertiary),
        maxLines: 1, overflow: TextOverflow.ellipsis)),
    ]);
  }

  Widget _infoChipIcon(IconData icon, String text) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: AppColors.textTertiary),
      const SizedBox(width: 4),
      Flexible(child: Text(text, style: _pf(size: 12, color: AppColors.textSecondary),
        maxLines: 1, overflow: TextOverflow.ellipsis)),
    ]);
  }

  Widget _socialButton(String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: _pf(size: 11, weight: FontWeight.w600, color: AppColors.textSecondary)),
      ),
    );
  }

  bool _hasSocial(Map<String, dynamic> links, String key) {
    final v = links[key];
    return v != null && v.toString().isNotEmpty;
  }

  Future<void> _launchUrl(String url) async {
    if (!url.startsWith('http')) url = 'https://$url';
    try { await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOMENTS GRID
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _momentsGrid() {
    if (_momentsLoading) {
      return GridView.builder(
        padding: const EdgeInsets.all(20),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 3, crossAxisSpacing: 3),
        itemCount: 9,
        itemBuilder: (_, __) => Container(decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4))),
      );
    }
    if (_moments.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset('assets/icons/camera-icon.svg', width: 32, height: 32,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        const SizedBox(height: 14),
        Text('No moments yet', style: _pf(size: 15, weight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text('Share your first moment', style: _pf(size: 12, color: AppColors.textTertiary)),
      ]));
    }
    return GridView.builder(
      padding: const EdgeInsets.all(20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, mainAxisSpacing: 3, crossAxisSpacing: 3),
      itemCount: _moments.length,
      itemBuilder: (_, i) {
        final post = _moments[i] is Map ? _moments[i] as Map<String, dynamic> : <String, dynamic>{};
        final images = post['images'] as List?;
        String? firstImage;
        if (images != null && images.isNotEmpty) {
          final first = images[0];
          if (first is String) firstImage = first;
          else if (first is Map) firstImage = (first['image_url'] ?? first['url'] ?? '').toString();
        }
        return ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: firstImage != null && firstImage.isNotEmpty
              ? Image.network(firstImage, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _momentPlaceholder(post))
              : _momentPlaceholder(post),
        );
      },
    );
  }

  Widget _momentPlaceholder(Map<String, dynamic> post) {
    final content = post['content']?.toString() ?? '';
    return Container(
      color: AppColors.surfaceVariant,
      padding: const EdgeInsets.all(6),
      child: Center(child: Text(content.isNotEmpty ? content : '', style: _pf(size: 9, color: AppColors.textTertiary),
        maxLines: 3, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center)),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTS TAB — shows user's events like web profile
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _eventsTab() {
    if (_eventsLoading) {
      return ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: 4,
        itemBuilder: (_, __) => Container(
          height: 80, margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
        ),
      );
    }
    if (_events.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        SvgPicture.asset('assets/icons/calendar-icon.svg', width: 32, height: 32,
          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        const SizedBox(height: 14),
        Text('No events yet', style: _pf(size: 15, weight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text('Create your first event', style: _pf(size: 12, color: AppColors.textTertiary)),
      ]));
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      itemCount: _events.length,
      itemBuilder: (_, i) {
        final e = _events[i] is Map<String, dynamic> ? _events[i] as Map<String, dynamic> : <String, dynamic>{};
        final title = e['title']?.toString() ?? 'Untitled';
        final date = e['start_date']?.toString() ?? '';
        final cover = e['cover_image'] as String?;
        final status = e['status']?.toString() ?? 'draft';
        return GestureDetector(
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => EventDetailScreen(eventId: e['id'].toString(), initialData: e, knownRole: 'creator'),
          )),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.borderLight, width: 1),
            ),
            child: Row(children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                clipBehavior: Clip.antiAlias,
                child: cover != null
                    ? Image.network(cover, width: 56, height: 56, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Center(child: SvgPicture.asset('assets/icons/calendar-icon.svg', width: 22, height: 22,
                          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))))
                    : Center(child: SvgPicture.asset('assets/icons/calendar-icon.svg', width: 22, height: 22,
                        colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: _pf(size: 14, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                if (date.isNotEmpty) Text(_formatDateShort(date), style: _pf(size: 11, color: AppColors.textTertiary)),
              ])),
              _miniStatusBadge(status),
            ]),
          ),
        );
      },
    );
  }

  Widget _miniStatusBadge(String status) {
    final colors = {'draft': AppColors.textTertiary, 'published': AppColors.accent, 'confirmed': AppColors.accent, 'cancelled': AppColors.error, 'completed': AppColors.blue};
    final c = colors[status] ?? AppColors.textTertiary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
      child: Text(status[0].toUpperCase() + status.substring(1), style: _pf(size: 10, weight: FontWeight.w600, color: c)),
    );
  }

  String _formatDateShort(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) { return dateStr; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS TAB — navigates to actual screens
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _settingsList(AuthProvider auth) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
      children: [
        _settingsGroup('Account', [
          _settingsTile('assets/icons/user-icon.svg', 'Edit Profile', onTap: () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: () => widget.onRefresh?.call(), initialSection: 1),
            ));
          }),
          _settingsTile('assets/icons/shield-icon.svg', 'Change Password', onTap: () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: () => widget.onRefresh?.call(), initialSection: 2),
            ));
          }),
          _settingsTile('assets/icons/verified-icon.svg', 'Identity Verification', onTap: () {
            // Navigate to verification via settings
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: () => widget.onRefresh?.call()),
            ));
          }),
        ]),
        const SizedBox(height: 16),
        _settingsGroup('Preferences', [
          _settingsTile('assets/icons/bell-icon.svg', 'Notifications', onTap: () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: () => widget.onRefresh?.call(), initialSection: 4),
            ));
          }),
          _settingsTile('assets/icons/shield-icon.svg', 'Privacy & Security', onTap: () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: () => widget.onRefresh?.call(), initialSection: 3),
            ));
          }),
        ]),
        const SizedBox(height: 16),
        _settingsGroup('Support', [
          _settingsTile('assets/icons/help-icon.svg', 'Help Center', onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpScreen()));
          }),
          _settingsTile('assets/icons/info-icon.svg', 'About Nuru', onTap: () {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => SettingsScreen(profile: widget.profile, onProfileUpdated: () => widget.onRefresh?.call(), initialSection: 5),
            ));
          }),
        ]),
        const SizedBox(height: 16),

        // Sign out
        GestureDetector(
          onTap: () async {
            await auth.signOut();
            if (context.mounted) {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false,
              );
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.error.withOpacity(0.15), width: 1),
            ),
            child: Row(children: [
              Container(
                width: 34, height: 34,
                decoration: BoxDecoration(color: AppColors.errorSoft, borderRadius: BorderRadius.circular(10)),
                child: Center(child: SvgPicture.asset('assets/icons/logout-icon.svg', width: 16, height: 16,
                  colorFilter: const ColorFilter.mode(AppColors.error, BlendMode.srcIn))),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text('Sign Out', style: _pf(size: 14, weight: FontWeight.w600, color: AppColors.error))),
            ]),
          ),
        ),

        const SizedBox(height: 32),
        Center(child: Text('Nuru v1.0.0', style: _pf(size: 10, color: AppColors.textHint))),
      ],
    );
  }

  Widget _settingsGroup(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _pf(size: 10, weight: FontWeight.w600, color: AppColors.textHint, letterSpacing: 1.2)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.borderLight, width: 1),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(children: items),
        ),
      ],
    );
  }

  Widget _settingsTile(String svgAsset, String label, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap ?? () {},
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 0.5))),
        child: Row(children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(10)),
            child: Center(child: SvgPicture.asset(svgAsset, width: 16, height: 16,
              colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn))),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: _pf(size: 14, weight: FontWeight.w500, color: AppColors.textPrimary))),
          SvgPicture.asset('assets/icons/chevron-right-icon.svg', width: 16, height: 16,
            colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
        ]),
      ),
    );
  }

  Widget _avatarFallback(String name) {
    final initials = name.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(initials.isNotEmpty ? initials : '?',
        style: _pf(size: 28, weight: FontWeight.w700, color: AppColors.textTertiary))),
    );
  }

  Widget _stat(String value, String label) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: _pf(size: 18, weight: FontWeight.w800, color: AppColors.textPrimary, height: 1.0)),
      const SizedBox(height: 4),
      Text(label, style: _pf(size: 10, weight: FontWeight.w500, color: AppColors.textTertiary, height: 1.0)),
    ]);
  }

  Widget _statDivider() => Container(width: 1, height: 30, color: AppColors.borderLight);
}

class _CoverPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white.withOpacity(0.08)..strokeWidth = 1;
    for (double i = -size.height; i < size.width; i += 20) {
      canvas.drawLine(Offset(i, size.height), Offset(i + size.height, 0), paint);
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
