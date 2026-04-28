import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import '../../core/widgets/expanding_search_action.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:record/record.dart';
import '../../widgets/nuru_emoji_picker.dart';
import '../../widgets/inline_voice_player.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/messages_service.dart';
import '../../core/services/uploads_service.dart';
import '../../core/services/calls_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../core/services/events_service.dart';
import '../../core/services/social_service.dart';
import '../../core/utils/prefetch_helper.dart';
import '../calls/voice_call_screen.dart';
import '../calls/video_call_screen.dart';

/// Messages screen — matches web Messages.tsx design
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  List<dynamic> _conversations = [];
  bool _loading = true;
  String _search = '';
  Timer? _pollTimer;
  Timer? _searchDebounce;
  String _filter = 'all'; // all | people | vendors
  String? _currentUserId;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadConversations(silent: true));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_currentUserId == null) {
      try {
        final auth = Provider.of<AuthProvider>(context, listen: false);
        _currentUserId = auth.user?['id']?.toString();
      } catch (_) {}
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _searchDebounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    _search = v;
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () => _loadConversations());
  }

  Future<void> _loadConversations({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final res = await MessagesService.getConversations(search: _search.isNotEmpty ? _search : null);
    if (mounted) {
      setState(() {
        if (!silent) _loading = false;
        if (res['success'] == true) {
          final data = res['data'];
          _conversations = data is List ? data : (data is Map ? (data['conversations'] ?? []) : []);
          // Sort newest first by last_message time or updated_at
          _conversations.sort((a, b) {
            final aTime = _getConvTimestamp(a);
            final bTime = _getConvTimestamp(b);
            return bTime.compareTo(aTime); // newest first
          });
        }
        if (!silent) _loading = false;
      });
    }
  }

  String _getConvTimestamp(dynamic conv) {
    if (conv is! Map) return '';
    final lastMsg = conv['last_message'];
    String time = '';
    if (lastMsg is Map) time = lastMsg['sent_at']?.toString() ?? lastMsg['created_at']?.toString() ?? '';
    if (time.isEmpty) time = conv['updated_at']?.toString() ?? conv['last_message_at']?.toString() ?? conv['created_at']?.toString() ?? '';
    return time;
  }

  /// A conversation is a "vendor" conversation only from the CUSTOMER's
  /// perspective — i.e. there is a service attached AND the current user is
  /// NOT the service owner. The service owner side simply sees a normal
  /// chat with a customer.
  bool _isVendorConv(dynamic conv) {
    if (conv is! Map) return false;
    final svc = conv['service'];
    if (svc is! Map) return false;
    final providerId = svc['provider_id']?.toString();
    if (_currentUserId != null && providerId == _currentUserId) return false;
    return true;
  }

  bool _isOnline(dynamic conv) {
    if (conv is! Map) return false;
    final p = conv['participant'] ?? conv['other_user'] ?? {};
    if (p is Map) {
      return p['is_online'] == true || p['online'] == true;
    }
    return false;
  }

  /// Verified badge logic:
  ///  - Customer viewing a vendor chat → show only if the SERVICE is verified
  ///  - Otherwise (normal chat, or vendor viewing a customer) → show only if
  ///    the other person is identity-verified
  bool _isVerified(dynamic conv) {
    if (conv is! Map) return false;
    if (_isVendorConv(conv)) {
      final svc = conv['service'];
      if (svc is Map) {
        return svc['is_verified'] == true || svc['verified'] == true;
      }
      return false;
    }
    final p = conv['participant'] ?? conv['other_user'] ?? {};
    if (p is Map) {
      return p['is_verified'] == true || p['is_identity_verified'] == true || p['verified'] == true;
    }
    return false;
  }

  bool _lastMessageMine(dynamic conv) {
    if (conv is! Map) return false;
    final lm = conv['last_message'];
    if (lm is Map) return lm['is_mine'] == true;
    return false;
  }

  String _formatConvTime(dynamic conv) {
    final raw = _getConvTimestamp(conv);
    if (raw.isEmpty) return '';
    DateTime? dt;
    try {
      dt = DateTime.parse(raw).toLocal();
    } catch (_) {
      return '';
    }
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(dt.year, dt.month, dt.day);
    final diff = today.difference(msgDay).inDays;
    if (diff == 0) {
      // Today → time like 10:30 AM
      final h = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
      final m = dt.minute.toString().padLeft(2, '0');
      final ap = dt.hour >= 12 ? 'PM' : 'AM';
      return '$h:$m $ap';
    } else if (diff == 1) {
      return 'Yesterday';
    } else if (diff < 7) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days[dt.weekday - 1];
    } else {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return '${months[dt.month - 1]} ${dt.day}';
    }
  }

  List<dynamic> get _filteredConversations {
    if (_filter == 'people') {
      return _conversations.where((c) => !_isVendorConv(c)).toList();
    }
    if (_filter == 'vendors') {
      return _conversations.where((c) => _isVendorConv(c)).toList();
    }
    return _conversations;
  }

  String _getConversationName(dynamic conv) {
    if (conv is! Map) return 'Unknown';
    final participant = conv['participant'] ?? conv['other_user'] ?? conv['recipient'] ?? {};
    if (participant is Map) {
      final fullName = participant['full_name']?.toString() ?? '';
      if (fullName.isNotEmpty) return fullName;
      final name = participant['name']?.toString() ?? '';
      if (name.isNotEmpty) return name;
      final firstName = participant['first_name']?.toString() ?? '';
      final lastName = participant['last_name']?.toString() ?? '';
      final full = '$firstName $lastName'.trim();
      if (full.isNotEmpty) return full;
      return participant['username']?.toString() ?? 'Unknown';
    }
    return 'Unknown';
  }

  String? _getConversationAvatar(dynamic conv) {
    if (conv is! Map) return null;
    final participant = conv['participant'] ?? conv['other_user'] ?? conv['recipient'] ?? {};
    if (participant is Map) {
      return participant['avatar'] as String?;
    }
    return null;
  }

  String _getLastMessage(dynamic conv) {
    if (conv is! Map) return '';
    final lastMsg = conv['last_message'];
    if (lastMsg is Map) {
      final content = lastMsg['content']?.toString() ?? '';
      if (content.isNotEmpty) return content;
      final attachments = _extractAttachmentUrls(lastMsg['attachments']);
      final imageUrl = lastMsg['image_url']?.toString() ?? '';
      if (attachments.isNotEmpty || imageUrl.isNotEmpty) return 'Photo';
      return '';
    }
    if (lastMsg is String) return lastMsg;
    return conv['last_message_text']?.toString() ?? '';
  }

  /// Returns the second-most-recent message preview, used to render the
  /// "two-line" preview in the conversation cards (matches the design).
  String _getPreviousMessage(dynamic conv) {
    if (conv is! Map) return '';
    final prev = conv['previous_message'];
    if (prev is Map) {
      final content = prev['content']?.toString() ?? '';
      if (content.isNotEmpty) {
        return prev['is_mine'] == true ? 'You: $content' : content;
      }
      final attachments = _extractAttachmentUrls(prev['attachments']);
      if (attachments.isNotEmpty) return prev['is_mine'] == true ? 'You: Photo' : 'Photo';
    }
    return '';
  }

  List<String> _extractAttachmentUrls(dynamic attachments) {
    if (attachments is! List) return const [];
    return attachments
        .map<String>((item) {
          if (item is String) return item;
          if (item is Map) {
            return item['url']?.toString() ??
                item['image_url']?.toString() ??
                item['file_url']?.toString() ??
                '';
          }
          return '';
        })
        .where((url) => url.isNotEmpty)
        .toList();
  }

  String _getTimeAgo(dynamic conv) {
    if (conv is! Map) return '';
    final lastMsg = conv['last_message'];
    String time = '';
    if (lastMsg is Map) {
      time = lastMsg['sent_at']?.toString() ?? '';
    }
    if (time.isEmpty) {
      time = conv['updated_at']?.toString() ?? conv['last_message_at']?.toString() ?? '';
    }
    if (time.isEmpty) return '';
    return SocialService.getTimeAgo(time);
  }

  bool _isUnread(dynamic conv) {
    if (conv is! Map) return false;
    return conv['unread_count'] != null && conv['unread_count'] > 0;
  }

  int _getUnreadCount(dynamic conv) {
    if (conv is! Map) return 0;
    return conv['unread_count'] ?? 0;
  }

  void _showNewConversationSheet() {
    final searchCtrl = TextEditingController();
    List<dynamic> searchResults = [];
    bool searching = false;
    Timer? debounce;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                Text(context.tr('new_conversation'), style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 4),
                Text(context.tr('search_for_person'), style: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary)),
                const SizedBox(height: 16),
                Container(
                  height: 46,
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
                  child: TextField(
                    controller: searchCtrl,
                    autofocus: true,
                    style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: context.tr('search_hint'),
                      hintStyle: GoogleFonts.inter(fontSize: 14, color: AppColors.textHint),
                      border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      prefixIcon: Padding(
                        padding: const EdgeInsets.all(12),
                        child: SvgPicture.asset('assets/icons/search-icon.svg', width: 20, height: 20,
                          colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                      ),
                      isDense: true,
                    ),
                    onChanged: (q) {
                      debounce?.cancel();
                      if (q.trim().length < 2) { setModalState(() { searchResults = []; }); return; }
                      debounce = Timer(const Duration(milliseconds: 400), () async {
                        setModalState(() => searching = true);
                        final res = await EventsService.searchUsers(q.trim());
                        if (ctx.mounted) {
                          setModalState(() {
                            searching = false;
                            if (res['success'] == true) {
                              final data = res['data'];
                              // API returns { items: [...] } — handle all response shapes
                              searchResults = data is List ? data : (data is Map ? (data['items'] ?? data['users'] ?? data['results'] ?? []) : []);
                            }
                          });
                        }
                      });
                    },
                  ),
                ),
                const SizedBox(height: 12),
                if (searching)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))),
                if (!searching && searchResults.isEmpty && searchCtrl.text.length >= 2)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Center(child: Text(context.tr('no_users_found'), style: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary))),
                  ),
                if (searchResults.isNotEmpty)
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 300),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: searchResults.length,
                      itemBuilder: (_, i) {
                        final user = searchResults[i] as Map<String, dynamic>;
                        final fullName = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
                        final name = user['full_name']?.toString() ?? (fullName.isNotEmpty ? fullName : user['username']?.toString() ?? 'Unknown');
                        final avatar = user['avatar']?.toString();
                        final subtitle = user['email']?.toString() ?? user['phone']?.toString() ?? '';
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(
                            radius: 20,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.04),
                            backgroundImage: avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
                            child: (avatar == null || avatar.isEmpty) ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primaryDark)) : null,
                          ),
                          title: Text(name.isNotEmpty ? name : 'Unknown', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                          subtitle: subtitle.isNotEmpty ? Text(subtitle, style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)) : null,
                          onTap: () => _startConversation(ctx, user),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _startConversation(BuildContext sheetCtx, Map<String, dynamic> user) async {
    // Check existing conversation
    final existingConv = _conversations.firstWhere(
      (c) {
        if (c is! Map) return false;
        final p = c['participant'] ?? c['other_user'] ?? {};
        if (p is Map) return p['id']?.toString() == user['id']?.toString();
        return false;
      },
      orElse: () => null,
    );
    if (existingConv != null) {
      Navigator.pop(sheetCtx);
      final name = _getConversationName(existingConv);
      final avatar = _getConversationAvatar(existingConv);
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => ChatDetailScreen(conversationId: existingConv['id'].toString(), name: name, avatar: avatar),
      ));
      return;
    }

    // Show message input
    final msgCtrl = TextEditingController();
    final rawName = '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final userName = user['full_name']?.toString() ?? (rawName.isNotEmpty ? rawName : user['username']?.toString() ?? 'Unknown');
    Navigator.pop(sheetCtx);
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          bool sending = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                Text('Say hello to $userName 👋', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 16),
                TextField(
                  controller: msgCtrl,
                  maxLines: 3,
                  autofocus: true,
                  style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Write a message to $userName...',
                    hintStyle: GoogleFonts.inter(fontSize: 14, color: AppColors.textHint),
                    filled: true, fillColor: AppColors.surfaceVariant,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: sending ? null : () async {
                      if (msgCtrl.text.trim().isEmpty) return;
                      setModalState(() => sending = true);
                      final res = await MessagesService.startConversation(
                        recipientId: user['id'].toString(),
                        message: msgCtrl.text.trim(),
                      );
                      if (ctx.mounted) Navigator.pop(ctx);
                      if (res['success'] == true && res['data'] != null) {
                        await _loadConversations();
                        final convId = res['data']['id']?.toString();
                        if (convId != null && mounted) {
                          Navigator.push(context, MaterialPageRoute(
                            builder: (_) => ChatDetailScreen(conversationId: convId, name: userName, avatar: user['avatar']?.toString()),
                          ));
                        }
                      }
                    },
                    icon: sending
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : SvgPicture.asset('assets/icons/send-icon.svg', width: 18, height: 18, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                    label: Text(sending ? 'Sending...' : 'Start Conversation', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      // Header — matches Find Services screen exactly: arrow_back + centered
      // "Messages" title. The only addition is a "+" action on the right for
      // starting a new conversation.
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leadingWidth: 56,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded,
              size: 24, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        centerTitle: true,
        title: Text(
          context.tr('messages'),
          style: GoogleFonts.inter(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
            letterSpacing: -0.2,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: GestureDetector(
              onTap: _showNewConversationSheet,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: SvgPicture.asset(
                    'assets/icons/plus-icon.svg',
                    width: 16,
                    height: 16,
                    colorFilter: const ColorFilter.mode(
                      Colors.white,
                      BlendMode.srcIn,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            // Search bar — matches Find Services screen style
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFFEDEDEF), width: 1),
                ),
                child: Row(children: [
                  const Icon(Icons.search_rounded, size: 20, color: Color(0xFF8E8E93)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      onChanged: _onSearchChanged,
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
                        hintText: context.tr('search_conversations'),
                        hintStyle: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          color: const Color(0xFF9E9E9E),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 16),
            // Filter chips: All | People | Vendors | filter icon
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(child: _filterChip('all', context.tr('all'), 'assets/icons/chat-icon.svg')),
                  const SizedBox(width: 10),
                  Expanded(child: _filterChip('people', context.tr('people'), 'assets/icons/user-icon.svg')),
                  const SizedBox(width: 10),
                  Expanded(child: _filterChip('vendors', context.tr('vendors'), 'assets/icons/package-icon.svg')),
                  const SizedBox(width: 10),
                  Container(
                    width: 46, height: 46,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border, width: 1),
                    ),
                    child: Center(
                      child: SvgPicture.asset(
                        'assets/icons/menu-icon.svg',
                        width: 18, height: 18,
                        colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _loading
                  ? _buildShimmer()
                  : _filteredConversations.isEmpty
                      ? _buildEmpty()
                      : RefreshIndicator(
                          onRefresh: _loadConversations,
                          color: AppColors.primary,
                          child: ListView.separated(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                            itemCount: _filteredConversations.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (_, i) => _conversationCard(_filteredConversations[i]),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  String _getServiceContext(dynamic conv) {
    if (conv is! Map) return '';
    final service = conv['service'] ?? conv['service_context'];
    if (service is Map) {
      return service['title']?.toString() ?? service['name']?.toString() ?? '';
    }
    return conv['service_title']?.toString() ?? conv['service_name']?.toString() ?? '';
  }

  Widget _filterChip(String value, String label, String svgAsset) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            SvgPicture.asset(
              svgAsset,
              width: 16, height: 16,
              colorFilter: ColorFilter.mode(
                selected ? AppColors.primary : AppColors.textSecondary,
                BlendMode.srcIn,
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? AppColors.textPrimary : AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _conversationCard(dynamic conv) {
    final name = _getConversationName(conv);
    final avatar = _getConversationAvatar(conv);
    final lastMsg = _getLastMessage(conv);
    final prevMsg = _getPreviousMessage(conv);
    final time = _formatConvTime(conv);
    final unread = _isUnread(conv);
    final unreadCount = _getUnreadCount(conv);
    final isVendor = _isVendorConv(conv);
    final isOnline = _isOnline(conv);
    final isVerified = _isVerified(conv);
    final lastIsMine = _lastMessageMine(conv);

    final convId = conv is Map ? conv['id']?.toString() : null;
    return PrefetchOnVisible(
      onVisible: () {
        if (convId == null || convId.isEmpty) return;
        PrefetchHelper.prefetch('conv:$convId',
            () => MessagesService.getMessages(convId));
      },
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            if (convId != null) {
              final svc = (conv is Map ? conv['service'] : null);
              Navigator.push(context, MaterialPageRoute(
                builder: (_) => ChatDetailScreen(
                  conversationId: convId,
                  name: name,
                  avatar: avatar,
                  isVendor: isVendor,
                  isVerifiedVendor: isVendor && _isVerified(conv),
                  service: svc is Map ? Map<String, dynamic>.from(svc) : null,
                  isOnline: !isVendor && _isOnline(conv),
                ),
              ));
            }
          },
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.borderLight, width: 0.5),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar with online dot
                SizedBox(
                  width: 48, height: 48,
                  child: Stack(
                    children: [
                      Container(
                        width: 48, height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary.withValues(alpha: 0.04),
                        ),
                        child: ClipOval(
                          child: SizedBox(
                            width: 48, height: 48,
                            child: avatar != null && avatar.isNotEmpty
                                ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, errorWidget: (_, __, ___) => _avatarFallback(name), placeholder: (_, __) => _avatarFallback(name))
                                : _avatarFallback(name),
                          ),
                        ),
                      ),
                      if (isOnline)
                        Positioned(
                          right: 0, bottom: 0,
                          child: Container(
                            width: 12, height: 12,
                            decoration: BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.surface, width: 2),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Content (name row + 2 lines of message preview)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              name,
                              style: GoogleFonts.inter(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                                height: 1.2,
                                letterSpacing: -0.1,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              softWrap: false,
                            ),
                          ),
                          if (isVerified) ...[
                            const SizedBox(width: 4),
                            SvgPicture.asset(
                              'assets/icons/verified-icon.svg',
                              width: 14, height: 14,
                              colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn),
                            ),
                          ],
                          if (isVendor) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFE9A3),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Vendor',
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF7A5A00),
                                  height: 1.2,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Text(
                            time,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: AppColors.textTertiary,
                              fontWeight: FontWeight.w500,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      // Last message — bold, dark
                      Text(
                        (lastIsMine && lastMsg.isNotEmpty
                            ? 'You: $lastMsg'
                            : (lastMsg.isEmpty ? 'No messages yet' : lastMsg)),
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppColors.textPrimary,
                          fontWeight: unread ? FontWeight.w600 : FontWeight.w500,
                          height: 1.35,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      // Previous message — lighter (matches design's "two lines" preview)
                      if (prevMsg.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          prevMsg,
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            color: AppColors.textTertiary,
                            fontWeight: FontWeight.w400,
                            height: 1.35,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                // Unread badge column on the right — aligned to bottom of the
                // 2-line preview area to match the design.
                if (unreadCount > 0) ...[
                  const SizedBox(width: 10),
                  Padding(
                    padding: const EdgeInsets.only(top: 28),
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          unreadCount > 9 ? '9+' : '$unreadCount',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            height: 1.0,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.04),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primaryDark, height: 1.0),
        ),
      ),
    );
  }

  Widget _buildShimmer() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: 8,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Row(children: [
          Container(width: 48, height: 48, decoration: const BoxDecoration(color: AppColors.surfaceVariant, shape: BoxShape.circle)),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(height: 14, width: 120, decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 8),
            Container(height: 10, width: 200, decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4))),
          ])),
        ]),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(18)),
            child: Center(child: SvgPicture.asset('assets/icons/chat-icon.svg', width: 28, height: 28, colorFilter: const ColorFilter.mode(AppColors.textTertiary, BlendMode.srcIn))),
          ),
          const SizedBox(height: 20),
          Text(context.tr('no_conversations'), style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.3)),
          const SizedBox(height: 6),
          Text(context.tr('start_conversation'), style: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary, height: 1.4)),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: _showNewConversationSheet,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
              child: Text(context.tr('new_message'), style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white, height: 1.2)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT DETAIL SCREEN
// Vendor and normal-user variants share most behavior but differ visually:
//   • Vendor → cream "verified vendor" trust banner + service context card +
//     "Quote / Files / Photos / Payment" action chips below composer.
//   • Normal user → "end-to-end encrypted" banner + "Gallery / Camera / File /
//     Location" action chips. Online status is shown under the name.
// ─────────────────────────────────────────────────────────────────────────────
class ChatDetailScreen extends StatefulWidget {
  final String conversationId;
  final String name;
  final String? avatar;
  final bool isVendor;
  final bool isVerifiedVendor;
  final bool isOnline;
  final Map<String, dynamic>? service;

  const ChatDetailScreen({
    super.key,
    required this.conversationId,
    required this.name,
    this.avatar,
    this.isVendor = false,
    this.isVerifiedVendor = false,
    this.isOnline = false,
    this.service,
  });

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();
  final _threadSearchCtrl = TextEditingController();
  List<dynamic> _messages = [];
  bool _loading = true;
  bool _sending = false;
  bool _showThreadSearch = false;
  String _threadSearch = '';
  Timer? _pollTimer;
  String? _currentUserId;
  // Multiple selected attachments staged for sending
  final List<File> _selectedImages = [];
  Map<String, dynamic>? _replyTo;
  bool _conversationEncrypted = true; // server flag

  // ── Voice notes ──────────────────────────────────────────────────────────
  // Uses the `record` package: tap-and-hold-to-record on the mic button. We
  // upload the resulting m4a file as a regular attachment so the server side
  // doesn't need any audio-specific changes (backward compatible).
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  Duration _recordDuration = Duration.zero;
  Timer? _recordTimer;
  String? _recordPath;

  // ── Emoji picker ─────────────────────────────────────────────────────────
  bool _showEmojiPicker = false;
  final FocusNode _composerFocus = FocusNode();

  // Scroll / new-message tracking (WhatsApp-like behavior)
  bool _isAtBottom = true;
  int _newMessagesCount = 0;
  bool _initialScrolled = false;

  // ── Helpers ───────────────────────────────────────────────────────────────

  List<String> _extractAttachmentUrls(dynamic attachments) {
    if (attachments is! List) return const [];
    return attachments
        .map<String>((item) {
          if (item is String) return item;
          if (item is Map) {
            return item['url']?.toString() ??
                item['image_url']?.toString() ??
                item['file_url']?.toString() ??
                '';
          }
          return '';
        })
        .where((url) => url.isNotEmpty)
        .toList();
  }

  bool _isImageUrl(String url) {
    final u = url.toLowerCase().split('?').first;
    return u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.png') ||
        u.endsWith('.webp') || u.endsWith('.gif') || u.endsWith('.heic');
  }

  bool _isAudioUrl(String url) {
    final u = url.toLowerCase().split('?').first;
    return u.endsWith('.m4a') || u.endsWith('.mp3') || u.endsWith('.aac') ||
        u.endsWith('.wav') || u.endsWith('.ogg') || u.endsWith('.opus');
  }

  @override
  void initState() {
    super.initState();
    _loadCurrentUserId();
    _loadMessages();
    MessagesService.markAsRead(widget.conversationId);
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _loadMessages(silent: true));
    _scrollCtrl.addListener(_onScroll);
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final pos = _scrollCtrl.position;
    final atBottom = (pos.maxScrollExtent - pos.pixels) < 80;
    if (atBottom != _isAtBottom) {
      setState(() {
        _isAtBottom = atBottom;
        if (atBottom) _newMessagesCount = 0;
      });
    } else if (atBottom && _newMessagesCount > 0) {
      setState(() => _newMessagesCount = 0);
    }
  }

  void _loadCurrentUserId() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _currentUserId = auth.user?['id']?.toString();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _scrollCtrl.removeListener(_onScroll);
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    _threadSearchCtrl.dispose();
    _recordTimer?.cancel();
    _recorder.dispose();
    _composerFocus.dispose();
    super.dispose();
  }

  // ── Voice recording ───────────────────────────────────────────────────────

  Future<void> _startRecording() async {
    try {
      if (!await _recorder.hasPermission()) {
        if (mounted) AppSnackbar.error(context, 'Microphone permission denied');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 128000, sampleRate: 44100),
        path: path,
      );
      _recordPath = path;
      _recordDuration = Duration.zero;
      setState(() => _isRecording = true);
      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _recordDuration += const Duration(seconds: 1));
      });
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Could not start recording');
    }
  }

  Future<void> _cancelRecording() async {
    try { await _recorder.stop(); } catch (_) {}
    _recordTimer?.cancel();
    if (_recordPath != null) {
      try { File(_recordPath!).deleteSync(); } catch (_) {}
    }
    _recordPath = null;
    if (mounted) setState(() { _isRecording = false; _recordDuration = Duration.zero; });
  }

  Future<void> _stopAndSendRecording() async {
    try {
      final path = await _recorder.stop();
      _recordTimer?.cancel();
      if (mounted) setState(() { _isRecording = false; _recordDuration = Duration.zero; });
      final filePath = path ?? _recordPath;
      if (filePath == null || filePath.isEmpty) return;

      // Optimistic placeholder so the user sees the voice note instantly.
      final optimisticId = 'optimistic_${DateTime.now().millisecondsSinceEpoch}';
      final optimistic = {
        'id': optimisticId,
        'content': '',
        'sender_id': _currentUserId,
        'is_sender': true,
        'created_at': DateTime.now().toIso8601String(),
        'attachments': <String>[],
        '_optimistic': true,
        '_uploading': true,
      };
      if (mounted) {
        setState(() => _messages.add(optimistic));
        _scrollToBottom();
      }

      // Upload + send as attachment — backend treats it as a generic file URL
      // so older clients still display the conversation correctly.
      final uploadRes = await UploadsService.uploadFile(filePath);
      if (uploadRes['success'] != true) {
        if (mounted) {
          setState(() => _messages.removeWhere((m) => m is Map && m['id'] == optimisticId));
          AppSnackbar.error(context, 'Failed to upload voice note');
        }
        return;
      }
      final data = uploadRes['data'];
      String? url;
      if (data is Map) {
        url = data['url']?.toString() ?? data['file_url']?.toString();
      }
      url ??= uploadRes['url']?.toString();
      if (url == null || url.isEmpty) {
        if (mounted) {
          setState(() => _messages.removeWhere((m) => m is Map && m['id'] == optimisticId));
        }
        return;
      }

      // Update placeholder with the real URL while server confirms
      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m is Map && m['id'] == optimisticId);
          if (idx >= 0) {
            (_messages[idx] as Map)['attachments'] = [url];
            (_messages[idx] as Map)['_uploading'] = false;
          }
        });
      }

      final res = await MessagesService.sendMessage(
        widget.conversationId,
        content: '',
        attachments: [url],
        encryptionVersion: _conversationEncrypted ? 'v1' : 'plain',
      );
      _recordPath = null;
      if (mounted) {
        if (res['success'] == true && res['data'] is Map) {
          final idx = _messages.indexWhere((m) => m is Map && m['id'] == optimisticId);
          if (idx >= 0) setState(() => _messages[idx] = res['data']);
        } else {
          // Reload as a safety net so it appears even if response is unexpected
          _loadMessages(silent: true);
        }
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Failed to send voice note');
    }
  }

  void _toggleEmojiPicker() {
    setState(() {
      _showEmojiPicker = !_showEmojiPicker;
      if (_showEmojiPicker) {
        FocusScope.of(context).unfocus();
      } else {
        _composerFocus.requestFocus();
      }
    });
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    // Fetch messages and call logs in parallel — call logs are rendered
    // inline as special bubbles (missed / outgoing / connected w/ duration).
    final results = await Future.wait([
      MessagesService.getMessages(widget.conversationId, limit: 100),
      CallsService.listForConversation(widget.conversationId),
    ]);
    final res = results[0] as Map<String, dynamic>;
    final callLogs = results[1] as List<dynamic>;
    if (!mounted) return;

    final prevLastId = _messages.isNotEmpty && _messages.last is Map
        ? (_messages.last as Map)['id']?.toString()
        : null;
    final prevCount = _messages.length;

    setState(() {
      if (!silent) _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        // Server now returns {messages, is_encrypted}; older servers return a
        // bare list. Handle both for backward compatibility.
        List rawMsgs;
        if (data is Map) {
          rawMsgs = (data['messages'] as List?) ?? const [];
          if (data['is_encrypted'] != null) {
            _conversationEncrypted = data['is_encrypted'] == true;
          }
        } else if (data is List) {
          rawMsgs = data;
        } else {
          rawMsgs = const [];
        }
        final serverMsgs = List<dynamic>.from(rawMsgs);

        // Preserve optimistic messages not yet confirmed by server
        final optimistic = _messages.where((m) => m is Map && m['_optimistic'] == true).toList();

        // Tag each call log so the bubble renderer can identify them, then
        // merge with messages and sort chronologically by `created_at`.
        final taggedCalls = callLogs
            .whereType<Map>()
            .map((c) => {...c, '_type': 'call_log'})
            .toList();

        _messages = [...serverMsgs, ...taggedCalls];
        _messages.sort((a, b) {
          final at = a is Map ? (a['created_at']?.toString() ?? a['sent_at']?.toString() ?? '') : '';
          final bt = b is Map ? (b['created_at']?.toString() ?? b['sent_at']?.toString() ?? '') : '';
          return at.compareTo(bt);
        });
        for (final opt in optimistic) {
          final optContent = (opt as Map)['content']?.toString() ?? '';
          final alreadyInServer = _messages.any((m) {
            if (m is! Map) return false;
            if (m['content']?.toString() == optContent) return true;
            if (m['message_text']?.toString() == optContent) return true;
            return false;
          });
          if (!alreadyInServer) _messages.add(opt);
        }
      }
    });

    // Count newly arrived messages (from others) since last poll
    int newFromOthers = 0;
    if (silent && prevLastId != null) {
      bool sawPrev = false;
      for (final m in _messages) {
        if (m is! Map) continue;
        if (!sawPrev) {
          if (m['id']?.toString() == prevLastId) sawPrev = true;
          continue;
        }
        if (!_isMine(m)) newFromOthers++;
      }
    }

    if (!silent && !_initialScrolled) {
      _initialScrolled = true;
      _scrollToBottom(animate: false);
    } else if (silent) {
      if (_isAtBottom) {
        if (_messages.length > prevCount) _scrollToBottom();
      } else if (newFromOthers > 0) {
        setState(() => _newMessagesCount += newFromOthers);
      }
    }
  }

  // ── Sending ───────────────────────────────────────────────────────────────

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    final selected = List<File>.from(_selectedImages);
    if ((text.isEmpty && selected.isEmpty) || _sending) return;

    if (mounted) setState(() => _sending = true);

    // Upload all selected images sequentially.
    final List<String> uploadedUrls = [];
    for (final file in selected) {
      final uploadRes = await UploadsService.uploadFile(file.path);
      if (!mounted) return;
      if (uploadRes['success'] != true) {
        setState(() => _sending = false);
        AppSnackbar.error(
          context,
          uploadRes['message']?.toString() ?? 'Failed to upload attachment',
        );
        return;
      }
      final data = uploadRes['data'];
      String? url;
      if (data is Map) {
        url = data['url']?.toString() ?? data['file_url']?.toString();
      }
      url ??= uploadRes['url']?.toString();
      if (url != null && url.isNotEmpty) uploadedUrls.add(url);
    }

    final replyTo = _replyTo;
    _msgCtrl.clear();

    final optimisticMsg = {
      'id': 'optimistic_${DateTime.now().millisecondsSinceEpoch}',
      'content': text,
      'sender_id': _currentUserId,
      'is_sender': true,
      'created_at': DateTime.now().toIso8601String(),
      if (uploadedUrls.isNotEmpty) 'attachments': uploadedUrls,
      if (replyTo != null) 'reply_to_id': replyTo['id'],
      if (replyTo != null)
        'reply_snapshot': {
          'text': (replyTo['content'] ?? replyTo['message_text'] ?? '').toString(),
          'sender': replyTo['_sender_name']?.toString() ?? '',
        },
      '_optimistic': true,
    };
    setState(() {
      _selectedImages.clear();
      _replyTo = null;
      _messages.add(optimisticMsg);
    });
    _scrollToBottom();

    final res = await MessagesService.sendMessage(
      widget.conversationId,
      content: text,
      attachments: uploadedUrls.isNotEmpty ? uploadedUrls : null,
      replyToId: replyTo != null ? replyTo['id']?.toString() : null,
      // Transport-framing flag. Backend stores it; payload itself is still
      // the same plaintext, so older clients keep working.
      encryptionVersion: _conversationEncrypted ? 'v1' : 'plain',
    );
    if (mounted) {
      setState(() => _sending = false);
      if (res['success'] == true) {
        final realMsg = res['data'];
        if (realMsg is Map) {
          final idx = _messages.indexWhere((m) => m is Map && m['id'] == optimisticMsg['id']);
          if (idx >= 0) {
            // Preserve "mine" flags so the bubble doesn't briefly flip to the
            // receiver side while the server response lacks is_sender/is_mine
            // or sender_id (depending on backend payload shape).
            final merged = Map<String, dynamic>.from(realMsg);
            merged['is_sender'] = true;
            merged['is_mine'] = true;
            merged['sender_id'] = merged['sender_id'] ?? _currentUserId;
            _messages[idx] = merged;
            setState(() {});
          }
        }
      } else {
        final idx = _messages.indexWhere((m) => m is Map && m['id'] == optimisticMsg['id']);
        if (idx >= 0) {
          _messages[idx] = {
            ...optimisticMsg,
            '_failed': true,
            'content': text.isNotEmpty ? '⚠ $text' : '⚠ Attachment failed to send',
          };
          setState(() {});
        }
        AppSnackbar.error(
          context,
          res['message']?.toString() ?? 'Failed to send message',
        );
      }
    }
  }

  // ── Attachment pickers ────────────────────────────────────────────────────

  Future<void> _pickFromGallery() async {
    try {
      final picked = await _picker.pickMultiImage(maxWidth: 1600);
      if (picked.isNotEmpty && mounted) {
        setState(() {
          // Cap attachments at 10 to match upload limits.
          for (final p in picked) {
            if (_selectedImages.length >= 10) break;
            _selectedImages.add(File(p.path));
          }
        });
      }
    } catch (e) {
      if (mounted) AppSnackbar.error(context, 'Could not open gallery');
    }
  }

  Future<void> _pickFromCamera() async {
    try {
      final picked = await _picker.pickImage(source: ImageSource.camera, maxWidth: 1600);
      if (picked != null && mounted) {
        setState(() => _selectedImages.add(File(picked.path)));
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Could not open camera');
    }
  }

  Future<void> _pickFile() async {
    try {
      final res = await FilePicker.platform.pickFiles(allowMultiple: true, withData: false);
      if (res == null || res.files.isEmpty || !mounted) return;
      // Files are uploaded as attachments; UI shows them as tiles.
      // For the "images only for now" rule we still let the user attach any
      // file but only render image previews — non-image files appear as a
      // generic attachment chip in the bubble.
      final files = res.files.where((f) => f.path != null).map((f) => File(f.path!));
      setState(() {
        for (final f in files) {
          if (_selectedImages.length >= 10) break;
          _selectedImages.add(f);
        }
      });
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Could not pick file');
    }
  }

  Future<void> _shareLocation() async {
    try {
      final perm = await Geolocator.checkPermission();
      LocationPermission p = perm;
      if (p == LocationPermission.denied) {
        p = await Geolocator.requestPermission();
      }
      if (p == LocationPermission.deniedForever || p == LocationPermission.denied) {
        if (mounted) AppSnackbar.error(context, 'Location permission denied');
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      // Send as a text message with a maps URL — survives any client.
      final url = 'https://maps.google.com/?q=${pos.latitude},${pos.longitude}';
      _msgCtrl.text = '📍 My location: $url';
      setState(() {});
    } catch (_) {
      if (mounted) AppSnackbar.error(context, 'Could not get location');
    }
  }

  void _showQuoteSheet() {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Send a quote',
                  style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: GoogleFonts.inter(fontSize: 15, color: AppColors.textPrimary),
                decoration: InputDecoration(
                  prefixText: 'TSh ',
                  prefixStyle: GoogleFonts.inter(fontSize: 15, color: AppColors.textSecondary),
                  hintText: 'Amount',
                  filled: true,
                  fillColor: AppColors.surfaceVariant,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    final amt = controller.text.trim();
                    if (amt.isEmpty) return;
                    Navigator.pop(ctx);
                    _msgCtrl.text = '💼 Quote: TSh $amt';
                    setState(() {});
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text('Attach quote', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _removeSelectedImage(int index) {
    setState(() {
      if (index >= 0 && index < _selectedImages.length) {
        _selectedImages.removeAt(index);
      }
    });
  }

  void _scrollToBottom({bool animate = true}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      final target = _scrollCtrl.position.maxScrollExtent;
      if (animate) {
        _scrollCtrl.animateTo(target, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
      } else {
        _scrollCtrl.jumpTo(target);
      }
      if (mounted) {
        setState(() {
          _isAtBottom = true;
          _newMessagesCount = 0;
        });
      }
    });
  }

  bool _isMine(Map msg) {
    if (msg['_optimistic'] == true) return true;
    if (msg['is_sender'] == true) return true;
    if (msg['is_mine'] == true) return true;
    final senderId = msg['sender_id']?.toString() ?? '';
    if (_currentUserId != null && _currentUserId!.isNotEmpty && senderId == _currentUserId) return true;
    final sender = msg['sender'];
    if (sender is Map) {
      final sId = sender['id']?.toString() ?? '';
      if (_currentUserId != null && sId == _currentUserId) return true;
    }
    return false;
  }

  String _getDayLabel(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final msgDay = DateTime(d.year, d.month, d.day);
    final diff = today.difference(msgDay).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  DateTime? _parseTime(String? time) {
    if (time == null || time.isEmpty) return null;
    try {
      return DateTime.parse(time.endsWith('Z') || time.contains('+') ? time : '${time}Z').toLocal();
    } catch (_) {
      return null;
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final bottomPadding = MediaQuery.of(context).viewPadding.bottom;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          _buildHeader(topPadding),
          if (_showThreadSearch) _buildThreadSearchBar(),

          Expanded(
            child: Stack(
              children: [
                _loading
                    ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                    : _buildMessagesList(),
                if (!_loading && !_isAtBottom)
                  Positioned(
                    right: 16,
                    bottom: 12,
                    child: _buildScrollToBottomPill(),
                  ),
              ],
            ),
          ),

          _buildComposer(bottomPadding),
        ],
      ),
    );
  }

  Widget _buildHeader(double topPadding) {
    final subtitle = widget.isVendor
        ? 'Typically replies in a few minutes'
        : (widget.isOnline ? 'Online' : 'Tap for contact info');
    return Container(
      padding: EdgeInsets.only(top: topPadding + 6, left: 4, right: 4, bottom: 12),
      decoration: const BoxDecoration(color: Colors.white),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: SvgPicture.asset(
                'assets/icons/chevron-left-icon.svg',
                width: 22, height: 22,
                colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
              ),
            ),
          ),
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary.withValues(alpha: 0.04),
            ),
            clipBehavior: Clip.antiAlias,
            child: widget.avatar != null && widget.avatar!.isNotEmpty
                ? CachedNetworkImage(imageUrl: widget.avatar!, fit: BoxFit.cover, errorWidget: (_, __, ___) => _fallbackAvatar(), placeholder: (_, __) => _fallbackAvatar())
                : _fallbackAvatar(),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Wrap so the full name + verified + Vendor badge are always
                // visible — no ellipsis. Smaller font keeps it on one line in
                // most cases; long names will wrap to a second line cleanly.
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 2,
                  children: [
                    Text(
                      widget.name,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        height: 1.2,
                        letterSpacing: -0.1,
                      ),
                      softWrap: true,
                    ),
                    if (widget.isVerifiedVendor || (!widget.isVendor && widget.isOnline)) ...[
                      // Verified indicator — only when relevant. Uses the SVG.
                      if (widget.isVerifiedVendor)
                        SvgPicture.asset(
                          'assets/icons/verified-icon.svg',
                          width: 13, height: 13,
                          colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn),
                        ),
                    ],
                    if (widget.isVendor)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFE9A3),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Vendor',
                          style: GoogleFonts.inter(fontSize: 9.5, fontWeight: FontWeight.w700, color: const Color(0xFF7A5A00), height: 1.2),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(fontSize: 11.5, color: AppColors.textTertiary, height: 1.1, fontWeight: FontWeight.w400),
                ),
              ],
            ),
          ),
          IconButton(
            icon: SvgPicture.asset(
              'assets/icons/call-icon.svg',
              width: 22, height: 22,
              colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
            ),
            splashRadius: 22,
            onPressed: _startVoiceCall,
            tooltip: 'Voice call',
          ),
          IconButton(
            icon: SvgPicture.asset(
              'assets/icons/video-icon.svg',
              width: 22, height: 22,
              colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
            ),
            splashRadius: 22,
            onPressed: _startVideoCall,
            tooltip: 'Video call',
          ),
          IconButton(
            icon: Icon(_showThreadSearch ? Icons.close_rounded : Icons.more_horiz_rounded, size: 22, color: AppColors.textPrimary),
            splashRadius: 22,
            onPressed: () => setState(() {
              _showThreadSearch = !_showThreadSearch;
              if (!_showThreadSearch) { _threadSearch = ''; _threadSearchCtrl.clear(); }
            }),
            tooltip: _showThreadSearch ? 'Close search' : 'More',
          ),
        ],
      ),
    );
  }

  Widget _buildThreadSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      color: AppColors.surface,
      child: TextField(
        controller: _threadSearchCtrl,
        autofocus: true,
        onChanged: (v) => setState(() => _threadSearch = v.trim().toLowerCase()),
        style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary, decorationThickness: 0),
        decoration: InputDecoration(
          isDense: true,
          hintText: 'Search in conversation…',
          hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary),
          prefixIcon: const Icon(Icons.search_rounded, size: 18, color: AppColors.textTertiary),
          filled: true,
          fillColor: AppColors.surfaceVariant,
          contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
        ),
      ),
    );
  }

  Widget _buildMessagesList() {
    if (_messages.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          SvgPicture.asset('assets/icons/chat-icon.svg', width: 32, height: 32, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
          const SizedBox(height: 14),
          Text('Say hello!', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2)),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text('Start your conversation with ${widget.name}', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textTertiary, height: 1.4), textAlign: TextAlign.center),
          ),
        ]),
      );
    }

    final visible = _threadSearch.isEmpty
        ? _messages
        : _messages.where((m) {
            if (m is! Map) return false;
            final t = (m['content']?.toString() ?? m['message_text']?.toString() ?? '').toLowerCase();
            return t.contains(_threadSearch);
          }).toList();

    // 1 banner + (optional service card) + N messages
    final headerCount = widget.isVendor && widget.service != null ? 2 : 1;

    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      itemCount: visible.length + headerCount,
      itemBuilder: (_, idx) {
        if (idx == 0) return _buildEncryptionBanner();
        if (widget.isVendor && widget.service != null && idx == 1) {
          return _buildServiceContextCard();
        }
        final i = idx - headerCount;
        final msg = visible[i];
        if (msg is! Map) return const SizedBox.shrink();
        final time = msg['created_at']?.toString() ?? msg['sent_at']?.toString() ?? '';
        final msgDate = _parseTime(time);

        bool showDateSep = false;
        if (msgDate != null) {
          if (i == 0) {
            showDateSep = true;
          } else {
            final prevMsg = visible[i - 1];
            final prevTime = prevMsg is Map ? (prevMsg['created_at']?.toString() ?? prevMsg['sent_at']?.toString() ?? '') : '';
            final prevDate = _parseTime(prevTime);
            if (prevDate == null) {
              showDateSep = true;
            } else {
              showDateSep = DateTime(msgDate.year, msgDate.month, msgDate.day) != DateTime(prevDate.year, prevDate.month, prevDate.day);
            }
          }
        }

        return Column(
          children: [
            if (showDateSep && msgDate != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Center(
                  child: Text(
                    _getDayLabel(msgDate),
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary, letterSpacing: -0.1),
                  ),
                ),
              ),
            _messageBubble(msg),
          ],
        );
      },
    );
  }

  Widget _fallbackAvatar() {
    return Container(
      color: AppColors.primary.withValues(alpha: 0.04),
      child: Center(
        child: Text(
          widget.name.isNotEmpty ? widget.name[0].toUpperCase() : '?',
          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primaryDark, height: 1.0),
        ),
      ),
    );
  }

  Future<void> _startVoiceCall() async {
    // Show a lightweight "Calling…" sheet immediately for snappy UX, then
    // hit /calls/start. Once we have the LiveKit token, push the full
    // VoiceCallScreen (which connects to LiveKit and shows mute/speaker/end).
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
      ),
    );
    final res = await CallsService.startCall(
      conversationId: widget.conversationId,
      kind: 'voice',
    );
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop(); // close spinner

    if (res['success'] != true || res['data'] is! Map) {
      AppSnackbar.error(context, res['message']?.toString() ?? 'Could not start call');
      return;
    }
    final data = res['data'] as Map;
    final call = data['call'] is Map ? data['call'] as Map : const {};
    final callId = call['id']?.toString() ?? '';
    final url = data['url']?.toString() ?? '';
    final token = data['token']?.toString() ?? '';
    if (callId.isEmpty || url.isEmpty || token.isEmpty) {
      AppSnackbar.error(context, 'Invalid call response');
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VoiceCallScreen.outgoing(
          callId: callId,
          peerName: widget.name,
          peerAvatar: widget.avatar,
          livekitUrl: url,
          livekitToken: token,
        ),
        fullscreenDialog: true,
      ),
    );
  }

  Future<void> _startVideoCall() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
      ),
    );
    final res = await CallsService.startCall(
      conversationId: widget.conversationId,
      kind: 'video',
    );
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop();

    if (res['success'] != true || res['data'] is! Map) {
      AppSnackbar.error(context, res['message']?.toString() ?? 'Could not start video call');
      return;
    }
    final data = res['data'] as Map;
    final call = data['call'] is Map ? data['call'] as Map : const {};
    final callId = call['id']?.toString() ?? '';
    final url = data['url']?.toString() ?? '';
    final token = data['token']?.toString() ?? '';
    if (callId.isEmpty || url.isEmpty || token.isEmpty) {
      AppSnackbar.error(context, 'Invalid call response');
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => VideoCallScreen.outgoing(
          callId: callId,
          peerName: widget.name,
          peerAvatar: widget.avatar,
          livekitUrl: url,
          livekitToken: token,
        ),
        fullscreenDialog: true,
      ),
    );
  }

  Widget _buildScrollToBottomPill() {
    final hasNew = _newMessagesCount > 0;
    return GestureDetector(
      onTap: () => _scrollToBottom(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: EdgeInsets.symmetric(horizontal: hasNew ? 12 : 10, vertical: hasNew ? 8 : 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.borderLight, width: 0.5),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 10, offset: const Offset(0, 3)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (hasNew) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                child: Text(_newMessagesCount > 99 ? '99+' : '$_newMessagesCount',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white, height: 1.0)),
              ),
              const SizedBox(width: 6),
              Text(_newMessagesCount == 1 ? 'new message' : 'new messages',
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.0)),
              const SizedBox(width: 6),
            ],
            Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: hasNew ? AppColors.primary : AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  /// Cream banner: vendor variant shows "verified vendor" + 3 trust pills,
  /// normal variant shows the WhatsApp-style E2EE notice.
  Widget _buildEncryptionBanner() {
    if (widget.isVendor && widget.isVerifiedVendor) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(0, 4, 0, 16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF1C7),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_rounded, size: 14, color: AppColors.textPrimary.withValues(alpha: 0.85)),
                  const SizedBox(width: 6),
                  Text("You're chatting with a verified vendor",
                      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _trustChip(Icons.verified_user_rounded, 'Verified business'),
                  _trustChip(Icons.shield_rounded, 'Secure payments'),
                  _trustChip(Icons.workspace_premium_rounded, 'Trusted by Nuru'),
                ],
              ),
            ],
          ),
        ),
      );
    }

    if (!_conversationEncrypted) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF1C7),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.lock_outline_rounded, size: 14, color: AppColors.textPrimary.withValues(alpha: 0.85)),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    'Messages and calls are end-to-end encrypted.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textPrimary.withValues(alpha: 0.85), height: 1.35, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text('Learn more',
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w600, decoration: TextDecoration.underline, decorationColor: AppColors.textPrimary.withValues(alpha: 0.4))),
          ],
        ),
      ),
    );
  }

  Widget _trustChip(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: const Color(0xFF7A5A00)),
        const SizedBox(width: 4),
        Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF7A5A00))),
      ],
    );
  }

  Widget _buildServiceContextCard() {
    final svc = widget.service ?? const {};
    final image = svc['image']?.toString();
    final title = svc['title']?.toString() ?? svc['name']?.toString() ?? 'Service';
    final eventTitle = svc['event_title']?.toString();
    final venue = svc['location']?.toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderLight, width: 1),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 60, height: 60,
                child: image != null && image.isNotEmpty
                    ? CachedNetworkImage(imageUrl: image, fit: BoxFit.cover, errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant))
                    : Container(color: AppColors.surfaceVariant, child: const Icon(Icons.event_rounded, color: AppColors.textTertiary)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(eventTitle ?? title,
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  const SizedBox(height: 2),
                  Text(venue ?? title,
                      style: GoogleFonts.inter(fontSize: 12, color: AppColors.textTertiary, height: 1.3),
                      maxLines: 2, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () {},
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.borderLight),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text('View', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _messageBubble(dynamic msg) {
    if (msg is! Map) return const SizedBox.shrink();

    // Call-log row — rendered as a centered, pill-shaped status chip rather
    // than a left/right speech bubble. See _loadMessages where we tag these.
    if (msg['_type'] == 'call_log') {
      return _callLogBubble(msg);
    }

    final text = msg['content']?.toString() ?? msg['message_text']?.toString() ?? '';
    final isMine = _isMine(msg);
    final time = msg['created_at']?.toString() ?? msg['sent_at']?.toString() ?? '';
    final attachmentUrls = _extractAttachmentUrls(msg['attachments']);
    final rawImageUrl = msg['image_url']?.toString() ?? '';
    final allUrls = <String>[
      if (rawImageUrl.isNotEmpty) rawImageUrl,
      ...attachmentUrls,
    ];
    final imageUrls = allUrls.where(_isImageUrl).toList();
    final audioUrls = allUrls.where(_isAudioUrl).toList();
    final fileUrls = allUrls.where((u) => !_isImageUrl(u) && !_isAudioUrl(u)).toList();
    final isUploading = msg['_uploading'] == true;

    final msgDate = _parseTime(time);
    String timeDisplay = '';
    if (msgDate != null) {
      final h = msgDate.hour;
      final m = msgDate.minute.toString().padLeft(2, '0');
      final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
      final ampm = h >= 12 ? 'PM' : 'AM';
      timeDisplay = '$h12:$m $ampm';
    }
    final isRead = msg['is_read'] == true || msg['read_at'] != null;
    final isFailed = msg['_failed'] == true;

    final bubbleColor = isMine ? const Color(0xFFFFF4D1) : Colors.white;
    const textColor = AppColors.textPrimary;

    // Pull reply snapshot (server) or fallback to inline preview
    final reply = msg['reply_snapshot'];
    final hasReply = reply is Map && (
      (reply['text']?.toString().isNotEmpty ?? false) ||
      (reply['sender']?.toString().isNotEmpty ?? false)
    );

    return GestureDetector(
      onLongPress: () => _onMessageLongPress(msg),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Align(
          alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.circular(16),
              border: isMine ? null : Border.all(color: const Color(0xFFEDEDEF), width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (hasReply) _replySnapshotBlock(reply as Map, isMine),
                if (imageUrls.isNotEmpty) ...[
                  _imageGrid(imageUrls),
                  if (text.isNotEmpty || fileUrls.isNotEmpty || audioUrls.isNotEmpty) const SizedBox(height: 6),
                ],
                if (audioUrls.isEmpty && isUploading)
                  _voiceChip(null, uploading: true),
                ...audioUrls.map((u) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: _voiceChip(u),
                )),
                ...fileUrls.map((u) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: _fileChip(u),
                )),
                if (text.isNotEmpty)
                  Text(
                    text,
                    style: GoogleFonts.inter(fontSize: 14.5, color: textColor, height: 1.4, fontWeight: FontWeight.w400),
                  ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (timeDisplay.isNotEmpty)
                      Text(timeDisplay,
                          style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary, height: 1.0, fontWeight: FontWeight.w400)),
                    if (isMine) ...[
                      const SizedBox(width: 4),
                      Icon(
                        isFailed ? Icons.error_outline_rounded : Icons.done_all_rounded,
                        size: 13,
                        color: isFailed ? Colors.red.shade400 : (isRead ? AppColors.primary : AppColors.textTertiary),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Centered call-log bubble: missed / outgoing / incoming + duration.
  ///
  /// `msg` is a row from `GET /calls/conversation/{id}`, tagged with
  /// `_type: 'call_log'` in [_loadMessages]. Expected shape:
  ///   { id, status, kind, caller_id, callee_id, duration_seconds,
  ///     created_at, ended_at }
  Widget _callLogBubble(Map msg) {
    final status = msg['status']?.toString() ?? 'ended';
    final callerId = msg['caller_id']?.toString() ?? '';
    final isOutgoing = _currentUserId != null && callerId == _currentUserId;
    final duration = (msg['duration_seconds'] as num?)?.toInt() ?? 0;
    final isVideo = (msg['kind']?.toString().toLowerCase() == 'video');
    final kindWord = isVideo ? 'video' : 'voice';

    // Pick label + colors from status. Missed calls are the only "loud" state.
    String label;
    Color iconColor;
    Color bgColor;
    IconData iconData = isVideo ? Icons.videocam_rounded : Icons.call_rounded;
    double iconRotate = 0;

    switch (status) {
      case 'missed':
      case 'declined':
      case 'no_answer':
        label = isOutgoing
            ? (status == 'declined' ? 'Call declined' : 'No answer')
            : 'Missed $kindWord call';
        iconColor = const Color(0xFFE53935);
        bgColor = const Color(0xFFE53935).withValues(alpha: 0.10);
        if (!isVideo) iconRotate = 2.356;
        break;
      case 'ended':
      case 'connected':
        final dur = _formatCallDuration(duration);
        final dirWord = isOutgoing ? 'Outgoing' : 'Incoming';
        label = '$dirWord ${isVideo ? 'video' : ''} call · $dur'.replaceAll('  ', ' ');
        iconColor = const Color(0xFF22C55E);
        bgColor = AppColors.primary.withValues(alpha: 0.10);
        break;
      case 'ringing':
      case 'answered':
        label = isOutgoing ? 'Calling…' : 'Ringing…';
        iconColor = AppColors.primaryDark;
        bgColor = AppColors.primary.withValues(alpha: 0.14);
        break;
      default:
        label = isVideo ? 'Video call' : 'Call';
        iconColor = AppColors.textSecondary;
        bgColor = AppColors.surfaceVariant;
    }

    final time = msg['created_at']?.toString() ?? '';
    final dt = _parseTime(time);
    String timeStr = '';
    if (dt != null) {
      final h = dt.hour;
      final m = dt.minute.toString().padLeft(2, '0');
      final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
      final ampm = h >= 12 ? 'PM' : 'AM';
      timeStr = '$h12:$m $ampm';
    }

    return GestureDetector(
      onTap: isVideo ? _startVideoCall : _startVoiceCall, // tap to call back, like WhatsApp
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Transform.rotate(
                  angle: iconRotate,
                  child: Icon(iconData, size: 14, color: iconColor),
                ),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (timeStr.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    timeStr,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: AppColors.textTertiary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatCallDuration(int seconds) {
    if (seconds <= 0) return '0:00';
    final m = (seconds ~/ 60).toString();
    final s = (seconds % 60).toString().padLeft(2, '0');
    if (seconds >= 3600) {
      final h = (seconds ~/ 3600).toString();
      final mm = ((seconds % 3600) ~/ 60).toString().padLeft(2, '0');
      return '$h:$mm:$s';
    }
    return '$m:$s';
  }

  Widget _replySnapshotBlock(Map reply, bool isMine) {
    final text = reply['text']?.toString() ?? '';
    final sender = reply['sender']?.toString() ?? 'Reply';
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      decoration: BoxDecoration(
        color: isMine ? Colors.white.withValues(alpha: 0.45) : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
        border: const Border(left: BorderSide(color: AppColors.primary, width: 3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(sender, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
          if (text.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(text,
                maxLines: 2, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary, height: 1.3)),
          ],
        ],
      ),
    );
  }

  /// Renders 1, 2, or 3+ images. For 4+ shows the first 3 with "+N" overlay
  /// on the third tile.
  Widget _imageGrid(List<String> urls) {
    final maxW = MediaQuery.of(context).size.width * 0.62;
    if (urls.length == 1) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: urls.first,
          width: maxW,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => const SizedBox.shrink(),
        ),
      );
    }
    if (urls.length == 2) {
      return SizedBox(
        width: maxW,
        child: Row(
          children: [
            Expanded(child: _gridTile(urls[0], radius: const BorderRadius.only(topLeft: Radius.circular(12), bottomLeft: Radius.circular(12)))),
            const SizedBox(width: 3),
            Expanded(child: _gridTile(urls[1], radius: const BorderRadius.only(topRight: Radius.circular(12), bottomRight: Radius.circular(12)))),
          ],
        ),
      );
    }
    final extra = urls.length - 3;
    return SizedBox(
      width: maxW,
      child: Row(
        children: [
          Expanded(child: _gridTile(urls[0], radius: const BorderRadius.only(topLeft: Radius.circular(12), bottomLeft: Radius.circular(12)))),
          const SizedBox(width: 3),
          Expanded(child: _gridTile(urls[1])),
          const SizedBox(width: 3),
          Expanded(
            child: Stack(
              children: [
                _gridTile(urls[2], radius: const BorderRadius.only(topRight: Radius.circular(12), bottomRight: Radius.circular(12))),
                if (extra > 0)
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: const BorderRadius.only(topRight: Radius.circular(12), bottomRight: Radius.circular(12)),
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.5),
                        alignment: Alignment.center,
                        child: Text('+$extra',
                            style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _gridTile(String url, {BorderRadius? radius}) {
    final child = CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      height: 110,
      errorWidget: (_, __, ___) => Container(color: AppColors.surfaceVariant),
      placeholder: (_, __) => Container(color: AppColors.surfaceVariant),
    );
    return radius == null ? child : ClipRRect(borderRadius: radius, child: child);
  }

  /// Compact voice-note chip with a play button. When [url] is null and
  /// [uploading] is true, shows an in-progress placeholder so the user sees
  /// the message land in the chat the moment they hit send.
  Widget _voiceChip(String? url, {bool uploading = false}) {
    if (uploading || url == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.65),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 30, height: 30,
              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
              child: const Padding(
                padding: EdgeInsets.all(7),
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'Sending...',
              style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }
    // In-app inline player — plays audio without opening a browser/asset link.
    return InlineVoicePlayer(url: url);
  }

  Widget _fileChip(String url) {
    final name = Uri.tryParse(url)?.pathSegments.isNotEmpty == true
        ? Uri.parse(url).pathSegments.last
        : 'File';
    return GestureDetector(
      onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.insert_drive_file_rounded, size: 18, color: AppColors.textSecondary),
            const SizedBox(width: 8),
            Flexible(
              child: Text(name,
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.download_rounded, size: 16, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }

  void _onMessageLongPress(Map msg) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply_rounded, color: AppColors.textPrimary),
              title: Text('Reply', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(ctx);
                final senderName = _isMine(msg) ? 'You' : widget.name;
                setState(() => _replyTo = {
                  'id': msg['id'],
                  'content': msg['content'] ?? msg['message_text'],
                  '_sender_name': senderName,
                });
              },
            ),
          ],
        ),
      ),
    );
  }

  // ── Composer ──────────────────────────────────────────────────────────────

  Widget _buildComposer(double bottomPadding) {
    final canSend = _msgCtrl.text.trim().isNotEmpty || _selectedImages.isNotEmpty;
    final fmtDur = '${_recordDuration.inMinutes.toString().padLeft(2, '0')}:'
        '${(_recordDuration.inSeconds % 60).toString().padLeft(2, '0')}';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_replyTo != null) _replyPreview(),
        if (_selectedImages.isNotEmpty) _attachmentStrip(),

        // Single composer row matching the design exactly: yellow "+" circle
        // OUTSIDE a single rounded pill that contains [input + emoji + mic/send].
        Container(
          padding: EdgeInsets.fromLTRB(12, 8, 12, 8 + bottomPadding),
          color: Colors.white,
          child: _isRecording
              ? Row(
                  children: [
                    GestureDetector(
                      onTap: _cancelRecording,
                      child: Container(
                        width: 44, height: 44,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFE4E4),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close_rounded, size: 22, color: Color(0xFFD83A3A)),
                      ),
                    ),
                    Expanded(
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
                            Container(width: 10, height: 10, decoration: const BoxDecoration(color: Color(0xFFD83A3A), shape: BoxShape.circle)),
                            const SizedBox(width: 10),
                            Text('Recording  $fmtDur',
                                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _stopAndSendRecording,
                      child: Container(
                        width: 44, height: 44,
                        decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                        child: Center(
                          child: SvgPicture.asset('assets/icons/send-icon.svg',
                              width: 18, height: 18,
                              colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn)),
                        ),
                      ),
                    ),
                  ],
                )
              // Single bordered pill containing EVERYTHING:
              // [yellow + circle] [text input] [smiley] [mic OR send]
              : Container(
                  constraints: const BoxConstraints(minHeight: 56),
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(color: const Color(0xFFEDEDEF), width: 1),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Yellow "+" circle — INSIDE the pill, left side.
                      GestureDetector(
                        onTap: _showAttachmentSheet,
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          width: 40, height: 40,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: SvgPicture.asset(
                              'assets/icons/plus-icon.svg',
                              width: 20, height: 20,
                              colorFilter: const ColorFilter.mode(Colors.black, BlendMode.srcIn),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _msgCtrl,
                          focusNode: _composerFocus,
                          maxLines: 4, minLines: 1,
                          onChanged: (_) => setState(() {}),
                          onTap: () {
                            if (_showEmojiPicker) setState(() => _showEmojiPicker = false);
                          },
                          style: GoogleFonts.inter(fontSize: 15, color: AppColors.textPrimary, height: 1.35, decoration: TextDecoration.none, decorationThickness: 0),
                          decoration: InputDecoration(
                            hintText: 'Type a message...',
                            hintStyle: GoogleFonts.inter(fontSize: 15, color: AppColors.textHint, height: 1.35, decoration: TextDecoration.none),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            isCollapsed: true,
                            contentPadding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      ),
                      // Emoji icon (smiley toggles to keyboard when picker open)
                      GestureDetector(
                        onTap: _toggleEmojiPicker,
                        behavior: HitTestBehavior.opaque,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: _showEmojiPicker
                              ? SvgPicture.asset(
                                  'assets/icons/keyboard-icon.svg',
                                  width: 22, height: 22,
                                  colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
                                )
                              : const Icon(
                                  Icons.sentiment_satisfied_outlined,
                                  size: 22,
                                  color: AppColors.textPrimary,
                                ),
                        ),
                      ),
                      // Mic OR Send (when there's something to send)
                      canSend
                          ? GestureDetector(
                              onTap: _sending ? null : _sendMessage,
                              child: Container(
                                width: 36, height: 36,
                                margin: const EdgeInsets.only(left: 2, right: 4),
                                decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                                child: _sending
                                    ? const Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : Center(child: SvgPicture.asset('assets/icons/send-icon.svg', width: 15, height: 15, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn))),
                              ),
                            )
                          : GestureDetector(
                              onTap: _startRecording,
                              behavior: HitTestBehavior.opaque,
                              child: Padding(
                                padding: const EdgeInsets.only(left: 6, right: 14),
                                child: SvgPicture.asset(
                                  'assets/icons/microphone-icon.svg',
                                  width: 22, height: 22,
                                  colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
                                ),
                              ),
                            ),
                    ],
                  ),
                ),
        ),

        // Emoji picker — slides in below the composer when toggled.
        if (_showEmojiPicker)
          NuruEmojiPicker(
            height: MediaQuery.of(context).viewInsets.bottom > 0
                ? (MediaQuery.of(context).size.height * 0.24).clamp(180.0, 230.0).toDouble()
                : 340,
            onClose: () => setState(() => _showEmojiPicker = false),
            onEmojiSelected: (e) {
              final sel = _msgCtrl.selection;
              final text = _msgCtrl.text;
              final pos = sel.isValid ? sel.start : text.length;
              final newText = text.substring(0, pos) + e + text.substring(pos);
              _msgCtrl.value = TextEditingValue(
                text: newText,
                selection: TextSelection.collapsed(offset: pos + e.length),
              );
              setState(() {});
            },
          ),
      ],
    );
  }

  Widget _replyPreview() {
    final reply = _replyTo!;
    final sender = reply['_sender_name']?.toString() ?? 'Reply';
    final content = (reply['content'] ?? '').toString();
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 12, 8),
      decoration: const BoxDecoration(color: AppColors.surface),
      child: Row(
        children: [
          Container(width: 3, height: 36, color: AppColors.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Replying to $sender',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
                const SizedBox(height: 2),
                Text(content,
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textSecondary),
            onPressed: () => setState(() => _replyTo = null),
          ),
        ],
      ),
    );
  }

  Widget _attachmentStrip() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      color: AppColors.surface,
      child: SizedBox(
        height: 64,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _selectedImages.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final f = _selectedImages[i];
            final isImg = ['.jpg','.jpeg','.png','.gif','.webp']
                .any((e) => f.path.toLowerCase().endsWith(e));
            return Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: isImg
                      ? Image.file(f, width: 60, height: 60, fit: BoxFit.cover)
                      : Container(
                          width: 60, height: 60,
                          color: AppColors.surfaceVariant,
                          child: const Icon(Icons.insert_drive_file_rounded, color: AppColors.textSecondary),
                        ),
                ),
                Positioned(
                  top: 0, right: 0,
                  child: GestureDetector(
                    onTap: () => _removeSelectedImage(i),
                    child: Container(
                      width: 20, height: 20,
                      decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                      child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _showAttachmentSheet() {
    final chips = widget.isVendor
        ? [
            _ActionChipSpec('Quote', icon: Icons.request_quote_outlined, onTap: _showQuoteSheet),
            _ActionChipSpec('Files', svgAsset: 'assets/icons/attach-icon.svg', onTap: _pickFile),
            _ActionChipSpec('Photos', svgAsset: 'assets/icons/photos-icon.svg', onTap: _pickFromGallery),
            _ActionChipSpec('Camera', svgAsset: 'assets/icons/camera-icon.svg', onTap: _pickFromCamera),
            _ActionChipSpec('Location', svgAsset: 'assets/icons/location-icon.svg', onTap: _shareLocation),
            _ActionChipSpec('Payment', svgAsset: 'assets/icons/card-icon.svg', onTap: _showQuoteSheet),
          ]
        : [
            _ActionChipSpec('Gallery', svgAsset: 'assets/icons/photos-icon.svg', onTap: _pickFromGallery),
            _ActionChipSpec('Camera', svgAsset: 'assets/icons/camera-icon.svg', onTap: _pickFromCamera),
            _ActionChipSpec('File', svgAsset: 'assets/icons/attach-icon.svg', onTap: _pickFile),
            _ActionChipSpec('Location', svgAsset: 'assets/icons/location-icon.svg', onTap: _shareLocation),
          ];

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36, height: 4,
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(color: const Color(0xFFE5E5E8), borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                Text('Share',
                    style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    for (final c in chips)
                      Expanded(
                        child: GestureDetector(
                          onTap: () { Navigator.pop(ctx); c.onTap(); },
                          behavior: HitTestBehavior.opaque,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 44, height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF7DC),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Center(
                                  child: c.svgAsset != null
                                      ? SvgPicture.asset(c.svgAsset!, width: 18, height: 18,
                                          colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn))
                                      : Icon(c.icon, size: 18, color: AppColors.primary),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(c.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ActionChipSpec {
  final String label;
  final String? svgAsset;
  final IconData? icon;
  final VoidCallback onTap;
  const _ActionChipSpec(this.label, {this.svgAsset, this.icon, required this.onTap});
}
