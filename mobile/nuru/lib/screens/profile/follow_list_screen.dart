import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/social_service.dart';
import '../public_profile/public_profile_screen.dart';

class FollowListScreen extends StatefulWidget {
  final String userId;
  final bool followers;

  const FollowListScreen({
    super.key,
    required this.userId,
    required this.followers,
  });

  @override
  State<FollowListScreen> createState() => _FollowListScreenState();
}

class _FollowListScreenState extends State<FollowListScreen> {
  bool _loading = true;
  List<dynamic> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = widget.followers
        ? await SocialService.getFollowers(widget.userId, limit: 50)
        : await SocialService.getFollowing(widget.userId, limit: 50);

    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _items = data is Map
            ? (data[widget.followers ? 'followers' : 'following'] ?? [])
            : (data is List ? data : []);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.followers ? 'Followers' : 'Following';

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Text(
          title,
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _items.isEmpty
              ? Center(
                  child: Text(
                    widget.followers ? 'No followers yet' : 'Not following anyone yet',
                    style: GoogleFonts.inter(fontSize: 14, color: AppColors.textTertiary),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    itemBuilder: (_, i) {
                      final user = _items[i] is Map<String, dynamic>
                          ? _items[i] as Map<String, dynamic>
                          : <String, dynamic>{};

                      final first = user['first_name']?.toString() ?? '';
                      final last = user['last_name']?.toString() ?? '';
                      final name = '$first $last'.trim().isNotEmpty
                          ? '$first $last'.trim()
                          : (user['full_name']?.toString() ?? user['username']?.toString() ?? 'Unknown');
                      final username = user['username']?.toString() ?? '';
                      final avatar = user['avatar']?.toString();
                      final id = user['id']?.toString() ?? '';

                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        leading: CircleAvatar(
                          radius: 22,
                          backgroundColor: AppColors.surfaceVariant,
                          backgroundImage: avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
                          child: (avatar == null || avatar.isEmpty)
                              ? Text(
                                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                                  style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textTertiary,
                                  ),
                                )
                              : null,
                        ),
                        title: Text(
                          name,
                          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                        subtitle: username.isNotEmpty
                            ? Text('@$username', style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary))
                            : null,
                        onTap: id.isEmpty
                            ? null
                            : () => Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => PublicProfileScreen(userId: id, username: username)),
                                ),
                      );
                    },
                  ),
                ),
    );
  }
}
