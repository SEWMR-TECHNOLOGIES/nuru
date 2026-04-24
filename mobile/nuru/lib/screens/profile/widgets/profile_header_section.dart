import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../follow_list_screen.dart';
import '../../../core/l10n/l10n_helper.dart';

class ProfileHeaderSection extends StatelessWidget {
  final String fullName;
  final String username;
  final String? avatar;
  final String? coverImage;
  final String bio;
  final String location;
  final String phone;
  final String email;
  final String website;
  final Map<String, dynamic> socialLinks;
  final bool isLoading;
  final dynamic momentsCount;
  final dynamic followerCount;
  final dynamic followingCount;
  final dynamic eventCount;
  final String userId;
  final Map<String, dynamic> profile;
  final VoidCallback onEditProfile;
  final VoidCallback? onRefresh;

  const ProfileHeaderSection({
    super.key,
    required this.fullName,
    required this.username,
    this.avatar,
    this.coverImage,
    required this.bio,
    required this.location,
    required this.phone,
    required this.email,
    required this.website,
    required this.socialLinks,
    this.isLoading = false,
    required this.momentsCount,
    required this.followerCount,
    required this.followingCount,
    required this.eventCount,
    required this.userId,
    required this.profile,
    required this.onEditProfile,
    this.onRefresh,
  });

  TextStyle _pf({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3, double letterSpacing = 0}) =>
      GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height, letterSpacing: letterSpacing);

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _coverSection(context),
      _infoSection(context),
      _statsRow(context),
    ]);
  }

  Widget _coverSection(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          height: 170, width: double.infinity,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [AppColors.primary, Color(0xFF1A3B6E)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            image: coverImage != null
                ? DecorationImage(image: NetworkImage(coverImage!), fit: BoxFit.cover,
                    colorFilter: ColorFilter.mode(Colors.black.withOpacity(0.15), BlendMode.darken))
                : null,
          ),
          child: coverImage == null ? CustomPaint(painter: _CoverPatternPainter()) : null,
        ),
        Positioned.fill(child: Center(
          child: Text('Plan Smarter', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 1.2,
            shadows: [Shadow(color: Colors.black.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2))])),
        )),
        Positioned(left: 20, bottom: -44,
          child: Container(
            width: 92, height: 92,
            decoration: BoxDecoration(shape: BoxShape.circle,
              border: Border.all(color: AppColors.surface, width: 4),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 16, offset: const Offset(0, 4))]),
            child: ClipOval(child: SizedBox(width: 92, height: 92,
              child: avatar != null && avatar!.isNotEmpty
                  ? CachedNetworkImage(imageUrl: avatar!, width: 92, height: 92, fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _avatarFallback(fullName))
                  : _avatarFallback(fullName))),
          ),
        ),
        Positioned(right: 16, bottom: -20,
          child: GestureDetector(
            onTap: onEditProfile,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderLight, width: 1),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2))]),
              child: Text(context.tr('edit_profile'), style: _pf(size: 12, weight: FontWeight.w600)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _infoSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 54, 20, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(isLoading && fullName.isEmpty ? context.tr('loading') : (fullName.isNotEmpty ? fullName : context.tr('full_name')),
          style: _pf(size: 24, weight: FontWeight.w800, letterSpacing: -0.3, height: 1.2), maxLines: 1, overflow: TextOverflow.ellipsis),
        if (username.isNotEmpty) ...[const SizedBox(height: 3), Text('@$username', style: _pf(size: 14, color: AppColors.primary, weight: FontWeight.w600))],
        if (bio.isNotEmpty) ...[const SizedBox(height: 10), Text(bio, style: _pf(size: 14, color: AppColors.textSecondary, height: 1.5), maxLines: 4, overflow: TextOverflow.ellipsis)],
        const SizedBox(height: 12),
        Wrap(spacing: 14, runSpacing: 8, children: [
          if (phone.isNotEmpty) _infoChipIcon(Icons.phone_outlined, phone),
          if (email.isNotEmpty) _infoChipIcon(Icons.email_outlined, email),
          if (location.isNotEmpty) _infoChipSvg('assets/icons/location-icon.svg', location),
          if (website.isNotEmpty) GestureDetector(
            onTap: () => _launchUrl(website),
            child: _infoChipIcon(Icons.link_rounded, website.replaceAll(RegExp(r'https?://'), ''), isLink: true),
          ),
        ]),
        if (socialLinks.values.any((v) => v != null && v.toString().isNotEmpty)) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 10, children: [
            if (_hasSocial('instagram')) _socialButton('Instagram', () => _launchUrl('https://instagram.com/${socialLinks['instagram']}')),
            if (_hasSocial('twitter')) _socialButton('Twitter', () => _launchUrl('https://twitter.com/${socialLinks['twitter']}')),
            if (_hasSocial('facebook')) _socialButton('Facebook', () => _launchUrl('https://facebook.com/${socialLinks['facebook']}')),
            if (_hasSocial('linkedin')) _socialButton('LinkedIn', () => _launchUrl('https://linkedin.com/in/${socialLinks['linkedin']}')),
          ]),
        ],
      ]),
    );
  }

  Widget _statsRow(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.borderLight, width: 1),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8)]),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          _stat('$momentsCount', context.tr('moments')),
          _statDivider(),
          GestureDetector(
            onTap: userId.isNotEmpty ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => FollowListScreen(userId: userId, followers: true))) : null,
            child: _stat('$followerCount', context.tr('followers')),
          ),
          _statDivider(),
          GestureDetector(
            onTap: userId.isNotEmpty ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => FollowListScreen(userId: userId, followers: false))) : null,
            child: _stat('$followingCount', context.tr('following')),
          ),
          _statDivider(),
          _stat('$eventCount', context.tr('events')),
        ]),
      ),
    );
  }

  Widget _infoChipIcon(IconData icon, String text, {bool isLink = false}) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: isLink ? AppColors.primary : AppColors.textTertiary),
      const SizedBox(width: 4),
      Flexible(child: Text(text, style: _pf(size: 12, color: isLink ? AppColors.primary : AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis)),
    ]);
  }

  Widget _infoChipSvg(String svgAsset, String text) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      SvgPicture.asset(svgAsset, width: 14, height: 14, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn)),
      const SizedBox(width: 4),
      Flexible(child: Text(text, style: _pf(size: 12, color: AppColors.textTertiary), maxLines: 1, overflow: TextOverflow.ellipsis)),
    ]);
  }

  Widget _socialButton(String label, VoidCallback onTap) {
    return GestureDetector(onTap: onTap,
      child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(8)),
        child: Text(label, style: _pf(size: 11, weight: FontWeight.w600, color: AppColors.textSecondary))));
  }

  bool _hasSocial(String key) {
    final v = socialLinks[key];
    return v != null && v.toString().isNotEmpty;
  }

  Future<void> _launchUrl(String url) async {
    if (!url.startsWith('http')) url = 'https://$url';
    try { await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication); } catch (_) {}
  }

  Widget _avatarFallback(String name) {
    final initials = name.split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase();
    return Container(color: AppColors.surfaceVariant,
      child: Center(child: Text(initials.isNotEmpty ? initials : '?', style: _pf(size: 28, weight: FontWeight.w700, color: AppColors.textTertiary))));
  }

  Widget _stat(String value, String label) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: _pf(size: 18, weight: FontWeight.w800, height: 1.0)),
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
