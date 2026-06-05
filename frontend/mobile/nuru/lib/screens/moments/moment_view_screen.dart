/// Standalone moment viewer for /moment/:id deep links.
///
/// Media-first cinematic experience. The single-moment endpoint may require
/// auth; if a 401 is returned, we present a clean "sign in to view" state
/// instead of bouncing to home. Deleted / expired / private content yields a
/// clear, friendly state.
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/utils/share_helpers.dart';
import '../../core/services/api_base.dart';
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/date_formatters.dart';
import '../../core/widgets/nuru_logo.dart';
import '../auth/login_screen.dart';

class MomentViewScreen extends StatefulWidget {
  final String momentId;
  const MomentViewScreen({super.key, required this.momentId});

  @override
  State<MomentViewScreen> createState() => _MomentViewScreenState();
}

class _MomentViewScreenState extends State<MomentViewScreen> {
  bool _loading = true;
  bool _needsAuth = false;
  String? _error;
  Map<String, dynamic>? _moment;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    debugPrint('[MomentView] loading id=${widget.momentId}');
    setState(() {
      _loading = true;
      _error = null;
      _needsAuth = false;
    });
    final token = await SecureTokenStorage.getToken();
    final hasToken = token != null && token.isNotEmpty;
    final res = await ApiBase.get('/moments/${widget.momentId}', auth: hasToken);
    debugPrint('[MomentView] response success=${res['success']} auth=$hasToken');
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true && res['data'] is Map) {
        _moment = Map<String, dynamic>.from(res['data'] as Map);
      } else {
        final msg = (res['message'] ?? '').toString().toLowerCase();
        _needsAuth = !hasToken || msg.contains('unauthor') || msg.contains('not authenticated');
        _error = (res['message'] ?? 'Moment not available').toString();
      }
    });
  }

  void _share() {
    Share.share('https://nuru.tz/moment/${widget.momentId}', subject: 'Moment on Nuru', sharePositionOrigin: sharePositionOrigin(context));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        actions: [
          if (_moment != null)
            IconButton(
              icon: const Icon(Icons.ios_share, color: Colors.white),
              onPressed: _share,
            ),
        ],
      ),
      body: _build(),
    );
  }

  Widget _build() {
    if (_loading) {
      return const Center(
        child: SizedBox(
          width: 26,
          height: 26,
          child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
        ),
      );
    }
    if (_moment == null) {
      return _MomentEmpty(
        needsAuth: _needsAuth,
        message: _error ?? 'Moment not available',
        onRetry: _load,
      );
    }
    final m = _moment!;
    final mediaUrl = (m['media_url'] ?? m['url'] ?? m['file_url'] ?? '').toString();
    final caption = (m['caption'] ?? m['text'] ?? '').toString();
    final author = (m['user'] is Map ? m['user'] as Map : const {});
    final authorName = ((author['first_name'] ?? '').toString() + ' ' + (author['last_name'] ?? '').toString()).trim();
    final avatar = (author['avatar'] ?? author['avatar_url'] ?? '').toString();
    final createdAt = (m['created_at'] ?? '').toString();

    return Stack(fit: StackFit.expand, children: [
      if (mediaUrl.isNotEmpty)
        Center(
          child: InteractiveViewer(
            child: CachedNetworkImage(
              imageUrl: mediaUrl,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
              placeholder: (_, __) => const Center(
                child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
              ),
              errorWidget: (_, __, ___) => const Center(
                child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
              ),
            ),
          ),
        )
      else
        const Center(child: Text('No media', style: TextStyle(color: Colors.white70))),
      // Bottom gradient + author / caption overlay
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 60, 20, 36),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black87],
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: Colors.white24,
                backgroundImage: avatar.isNotEmpty ? CachedNetworkImageProvider(avatar) : null,
                child: avatar.isEmpty
                    ? Text(authorName.isNotEmpty ? authorName[0].toUpperCase() : '?',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(authorName.isEmpty ? 'Nuru user' : authorName,
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                  if (createdAt.isNotEmpty)
                    Text(getTimeAgo(createdAt),
                        style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ]),
              ),
            ]),
            if (caption.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                caption,
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 14.5, height: 1.45, fontWeight: FontWeight.w500),
              ),
            ],
          ]),
        ),
      ),
    ]);
  }
}

class _MomentEmpty extends StatelessWidget {
  final bool needsAuth;
  final String message;
  final VoidCallback onRetry;
  const _MomentEmpty({required this.needsAuth, required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const NuruLogo(size: 40),
        const SizedBox(height: 22),
        Text(needsAuth ? 'Sign in to view this moment' : 'Moment not available',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white)),
        const SizedBox(height: 10),
        Text(needsAuth ? 'This moment is shared with the creator’s circle.' : message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, height: 1.5)),
        const SizedBox(height: 24),
        if (needsAuth)
          FilledButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
            child: const Text('Sign in'),
          )
        else
          FilledButton(
            onPressed: onRetry,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
            child: const Text('Try again'),
          ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => Navigator.of(context).maybePop(),
          child: const Text('Go back', style: TextStyle(color: Colors.white70)),
        ),
      ]),
    );
  }
}
