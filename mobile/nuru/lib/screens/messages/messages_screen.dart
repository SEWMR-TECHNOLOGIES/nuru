import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import '../../core/widgets/expanding_search_action.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/messages_service.dart';
import '../../core/services/uploads_service.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../providers/auth_provider.dart';
import '../../core/l10n/l10n_helper.dart';
import '../../core/services/events_service.dart';
import '../../core/services/social_service.dart';
import '../../core/utils/prefetch_helper.dart';

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

  @override
  void initState() {
    super.initState();
    _loadConversations();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadConversations(silent: true));
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

  List<dynamic> get _filteredConversations => _conversations;

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
                Text(context.tr('new_conversation'), style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 4),
                Text(context.tr('search_for_person'), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
                const SizedBox(height: 16),
                Container(
                  height: 46,
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
                  child: TextField(
                    controller: searchCtrl,
                    autofocus: true,
                    style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: context.tr('search_hint'),
                      hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textHint),
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
                    child: Center(child: Text(context.tr('no_users_found'), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary))),
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
                            backgroundColor: AppColors.surfaceVariant,
                            backgroundImage: avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
                            child: (avatar == null || avatar.isEmpty) ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary)) : null,
                          ),
                          title: Text(name.isNotEmpty ? name : 'Unknown', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                          subtitle: subtitle.isNotEmpty ? Text(subtitle, style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)) : null,
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
                Text('Say hello to $userName 👋', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                const SizedBox(height: 16),
                TextField(
                  controller: msgCtrl,
                  maxLines: 3,
                  autofocus: true,
                  style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Write a message to $userName...',
                    hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textHint),
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
                    label: Text(sending ? 'Sending...' : 'Start Conversation', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white)),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(context.tr('messages'), style: GoogleFonts.plusJakartaSans(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.5, height: 1.1)),
              ),
              GestureDetector(
                onTap: _showNewConversationSheet,
                child: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                  child: Center(child: SvgPicture.asset('assets/icons/plus-icon.svg', width: 18, height: 18, colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn))),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Container(
            height: 46,
            decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(24), border: Border.all(color: AppColors.borderLight, width: 0.5)),
            child: TextField(
              onChanged: _onSearchChanged,
              style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.3, decoration: TextDecoration.none, decorationThickness: 0),
              decoration: InputDecoration(
                hintText: context.tr('search_conversations'),
                hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textHint, height: 1.3, decoration: TextDecoration.none),
                border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                prefixIcon: Padding(padding: const EdgeInsets.all(12), child: SvgPicture.asset('assets/icons/search-icon.svg', width: 20, height: 20, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
                isDense: true,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),

        Expanded(
          child: _loading
              ? _buildShimmer()
              : _filteredConversations.isEmpty
                  ? _buildEmpty()
                  : RefreshIndicator(
                      onRefresh: _loadConversations,
                      color: AppColors.primary,
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(0, 4, 0, 100),
                        itemCount: _filteredConversations.length,
                        itemBuilder: (_, i) => _conversationTile(_filteredConversations[i]),
                      ),
                    ),
        ),
      ],
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

  Widget _conversationTile(dynamic conv) {
    final name = _getConversationName(conv);
    final avatar = _getConversationAvatar(conv);
    final lastMsg = _getLastMessage(conv);
    final time = _getTimeAgo(conv);
    final unread = _isUnread(conv);
    final unreadCount = _getUnreadCount(conv);
    final serviceContext = _getServiceContext(conv);

    final convId = conv is Map ? conv['id']?.toString() : null;
    return PrefetchOnVisible(
      onVisible: () {
        if (convId == null || convId.isEmpty) return;
        PrefetchHelper.prefetch('conv:$convId',
            () => MessagesService.getMessages(convId));
      },
      child: InkWell(
        onTap: () {
          if (convId != null) {
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => ChatDetailScreen(conversationId: convId, name: name, avatar: avatar),
            ));
          }
        },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: unread ? AppColors.primarySoft : Colors.transparent,
          border: const Border(bottom: BorderSide(color: AppColors.borderLight, width: 0.5)),
        ),
        child: Row(
          children: [
            Container(
              width: 48, height: 48,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
              child: ClipOval(
                child: SizedBox(
                  width: 48, height: 48,
                  child: avatar != null && avatar.isNotEmpty
                      ? CachedNetworkImage(imageUrl: avatar, fit: BoxFit.cover, errorWidget: (_, __, ___) => _avatarFallback(name), placeholder: (_, __) => _avatarFallback(name))
                      : _avatarFallback(name),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                          Text(name, style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: unread ? FontWeight.w700 : FontWeight.w600, color: AppColors.textPrimary, height: 1.3), maxLines: 1, overflow: TextOverflow.ellipsis),
                          if (serviceContext.isNotEmpty)
                            Text(serviceContext, style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.primary, height: 1.2), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ]),
                      ),
                      Text(time, style: GoogleFonts.plusJakartaSans(fontSize: 11, color: unread ? AppColors.primary : AppColors.textTertiary, fontWeight: unread ? FontWeight.w600 : FontWeight.w400, height: 1.2)),
                    ],
                  ),
                  Row(
                    children: [
                      Expanded(child: Text(lastMsg.isEmpty ? 'No messages yet' : lastMsg, style: GoogleFonts.plusJakartaSans(fontSize: 13, color: unread ? AppColors.textSecondary : AppColors.textTertiary, fontWeight: unread ? FontWeight.w500 : FontWeight.w400, height: 1.3), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      if (unreadCount > 0) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                          child: Text(unreadCount > 9 ? '9+' : '$unreadCount', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white, height: 1.0)),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Widget _avatarFallback(String name) {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textTertiary, height: 1.0))),
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
          Text(context.tr('no_conversations'), style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.3)),
          const SizedBox(height: 6),
          Text(context.tr('start_conversation'), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary, height: 1.4)),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: _showNewConversationSheet,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
              child: Text(context.tr('new_message'), style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white, height: 1.2)),
            ),
          ),
        ],
      ),
    );
  }
}

// CHAT DETAIL SCREEN — with date grouping (Today / Yesterday / date)
class ChatDetailScreen extends StatefulWidget {
  final String conversationId;
  final String name;
  final String? avatar;

  const ChatDetailScreen({
    super.key,
    required this.conversationId,
    required this.name,
    this.avatar,
  });

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();
  List<dynamic> _messages = [];
  bool _loading = true;
  bool _sending = false;
  Timer? _pollTimer;
  String? _currentUserId;
  File? _selectedImage;

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

  @override
  void initState() {
    super.initState();
    _loadCurrentUserId();
    _loadMessages();
    MessagesService.markAsRead(widget.conversationId);
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _loadMessages(silent: true));
  }

  void _loadCurrentUserId() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _currentUserId = auth.user?['id']?.toString();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final res = await MessagesService.getMessages(widget.conversationId, limit: 100);
    if (mounted) {
      setState(() {
        if (!silent) _loading = false;
        if (res['success'] == true) {
          final data = res['data'];
          final newMessages = data is List ? data : (data is Map ? (data['messages'] ?? []) : []);
          final serverMsgs = List<dynamic>.from(newMessages as List);
          
          // Preserve optimistic messages not yet confirmed by server
          final optimistic = _messages.where((m) => m is Map && m['_optimistic'] == true).toList();
          
          // Build final list: server messages + unconfirmed optimistic
          _messages = serverMsgs;
          for (final opt in optimistic) {
            final optContent = (opt as Map)['content']?.toString() ?? '';
            final optTime = opt['created_at']?.toString() ?? '';
            // Check if server already has this message (by matching content + close timestamp)
            final alreadyInServer = _messages.any((m) {
              if (m is! Map) return false;
              if (m['content']?.toString() == optContent) return true;
              // Also match by message_text field
              if (m['message_text']?.toString() == optContent) return true;
              return false;
            });
            if (!alreadyInServer) _messages.add(opt);
          }
        }
      });
      if (!silent || _messages.isNotEmpty) _scrollToBottom();
    }
  }

  Future<void> _sendMessage() async {
    final text = _msgCtrl.text.trim();
    final selectedImage = _selectedImage;
    if ((text.isEmpty && selectedImage == null) || _sending) return;

    if (mounted) setState(() => _sending = true);

    String? uploadedUrl;
    if (selectedImage != null) {
      final uploadRes = await UploadsService.uploadFile(selectedImage.path);
      if (!mounted) return;

      if (uploadRes['success'] != true) {
        setState(() => _sending = false);
        AppSnackbar.error(
          context,
          uploadRes['message']?.toString() ?? 'Failed to upload image',
        );
        return;
      }

      final data = uploadRes['data'];
      if (data is Map) {
        uploadedUrl = data['url']?.toString() ?? data['file_url']?.toString();
      }
      uploadedUrl ??= uploadRes['url']?.toString();

      if (uploadedUrl == null || uploadedUrl!.isEmpty) {
        setState(() => _sending = false);
        AppSnackbar.error(context, 'Failed to upload image');
        return;
      }
    }

    _msgCtrl.clear();

    // Optimistic: add message to UI immediately
    final optimisticMsg = {
      'id': 'optimistic_${DateTime.now().millisecondsSinceEpoch}',
      'content': text,
      'sender_id': _currentUserId,
      'is_sender': true,
      'created_at': DateTime.now().toIso8601String(),
      if (uploadedUrl != null) 'attachments': [uploadedUrl],
      if (uploadedUrl != null) 'image_url': uploadedUrl,
      '_optimistic': true,
    };
    setState(() {
      _selectedImage = null;
      _messages.add(optimisticMsg);
    });
    _scrollToBottom();

    final res = await MessagesService.sendMessage(
      widget.conversationId,
      content: text,
      attachments: uploadedUrl != null ? [uploadedUrl] : null,
    );
    if (mounted) {
      setState(() => _sending = false);
      if (res['success'] == true) {
        // Replace optimistic message with real one if returned
        final realMsg = res['data'];
        if (realMsg is Map) {
          final idx = _messages.indexWhere((m) => m is Map && m['id'] == optimisticMsg['id']);
          if (idx >= 0) {
            _messages[idx] = realMsg;
            setState(() {});
          }
        }
      } else {
        // Mark failed
        final idx = _messages.indexWhere((m) => m is Map && m['id'] == optimisticMsg['id']);
        if (idx >= 0) {
          _messages[idx] = {
            ...optimisticMsg,
            '_failed': true,
            'content': text.isNotEmpty ? '⚠ $text' : '⚠ Photo failed to send',
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

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1200);
    if (picked != null && mounted) {
      setState(() => _selectedImage = File(picked.path));
    }
  }

  void _removeSelectedImage() {
    setState(() => _selectedImage = null);
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  bool _isMine(Map msg) {
    // Check _optimistic first (our own messages added before server confirms)
    if (msg['_optimistic'] == true) return true;
    if (msg['is_sender'] == true) return true;
    final senderId = msg['sender_id']?.toString() ?? '';
    if (_currentUserId != null && _currentUserId!.isNotEmpty && senderId == _currentUserId) return true;
    // Also check sender object
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

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final bottomPadding = MediaQuery.of(context).viewPadding.bottom;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // Custom app bar
          Container(
            padding: EdgeInsets.only(top: topPadding + 8, left: 8, right: 16, bottom: 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: const Border(bottom: BorderSide(color: AppColors.borderLight, width: 0.5)),
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 24, height: 24, colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                  ),
                ),
                Container(
                  width: 36, height: 36,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
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
                      Text(widget.name, style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.3), maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text('Chat', style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary, height: 1.2)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Messages with date grouping
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                : _messages.isEmpty
                    ? Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          SvgPicture.asset('assets/icons/chat-icon.svg', width: 32, height: 32, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn)),
                          const SizedBox(height: 14),
                          Text('Say hello!', style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary, height: 1.2)),
                          const SizedBox(height: 6),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 32),
                            child: Text('Start your conversation with ${widget.name}', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary, height: 1.4), textAlign: TextAlign.center),
                          ),
                        ]),
                      )
                    : ListView.builder(
                        controller: _scrollCtrl,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) {
                          final msg = _messages[i];
                          if (msg is! Map) return const SizedBox.shrink();
                          final time = msg['created_at']?.toString() ?? msg['sent_at']?.toString() ?? '';
                          final msgDate = _parseTime(time);
                          
                          // Date separator logic
                          bool showDateSep = false;
                          if (msgDate != null) {
                            if (i == 0) {
                              showDateSep = true;
                            } else {
                              final prevMsg = _messages[i - 1];
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
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  child: Center(
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                                      decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                                      child: Text(_getDayLabel(msgDate), style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textTertiary)),
                                    ),
                                  ),
                                ),
                              _messageBubble(msg),
                            ],
                          );
                        },
                      ),
          ),

          // Composer
          _buildComposer(bottomPadding),
        ],
      ),
    );
  }

  Widget _fallbackAvatar() {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(widget.name.isNotEmpty ? widget.name[0].toUpperCase() : '?', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textTertiary, height: 1.0))),
    );
  }

  Widget _messageBubble(dynamic msg) {
    if (msg is! Map) return const SizedBox.shrink();

    final text = msg['content']?.toString() ?? msg['message_text']?.toString() ?? '';
    final isMine = _isMine(msg);
    final time = msg['created_at']?.toString() ?? msg['sent_at']?.toString() ?? '';
    final attachmentUrls = _extractAttachmentUrls(msg['attachments']);
    final rawImageUrl = msg['image_url']?.toString() ?? '';
    final imageUrl = rawImageUrl.isNotEmpty
        ? rawImageUrl
        : (attachmentUrls.isNotEmpty ? attachmentUrls.first : null);
    final msgDate = _parseTime(time);
    final timeDisplay = msgDate != null ? '${msgDate.hour.toString().padLeft(2, '0')}:${msgDate.minute.toString().padLeft(2, '0')}' : '';

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            Container(
              width: 28, height: 28,
              margin: const EdgeInsets.only(right: 8, bottom: 8),
              decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.surfaceVariant),
              clipBehavior: Clip.antiAlias,
              child: widget.avatar != null && widget.avatar!.isNotEmpty
                  ? CachedNetworkImage(imageUrl: widget.avatar!, fit: BoxFit.cover, errorWidget: (_, __, ___) => _smallAvatarFallback(), placeholder: (_, __) => _smallAvatarFallback())
                  : _smallAvatarFallback(),
            ),
          ],
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
            decoration: BoxDecoration(
              color: isMine ? AppColors.primary : AppColors.surface,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16), topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMine ? 16 : 4), bottomRight: Radius.circular(isMine ? 4 : 16),
              ),
              border: isMine ? null : Border.all(color: AppColors.borderLight, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (imageUrl != null && imageUrl.isNotEmpty) ...[
                  ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(imageUrl, width: 200, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink())),
                  if (text.isNotEmpty) const SizedBox(height: 6),
                ],
                if (text.isNotEmpty)
                  Text(text, style: GoogleFonts.plusJakartaSans(fontSize: 14, color: isMine ? Colors.white : AppColors.textPrimary, height: 1.4)),
                if (timeDisplay.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(timeDisplay, style: GoogleFonts.plusJakartaSans(fontSize: 9, color: isMine ? Colors.white70 : AppColors.textHint, height: 1.0)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _smallAvatarFallback() {
    return Container(
      color: AppColors.surfaceVariant,
      child: Center(child: Text(widget.name.isNotEmpty ? widget.name[0].toUpperCase() : '?', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, height: 1.0))),
    );
  }

  Widget _buildComposer(double bottomPadding) {
    final canSend = _msgCtrl.text.trim().isNotEmpty || _selectedImage != null;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_selectedImage != null)
          Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            decoration: const BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.borderLight, width: 0.5))),
            child: Row(children: [
              ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(_selectedImage!, width: 60, height: 60, fit: BoxFit.cover)),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _removeSelectedImage,
                child: Container(
                  width: 24, height: 24,
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
                  child: Center(child: SvgPicture.asset('assets/icons/close-icon.svg', width: 12, height: 12, colorFilter: const ColorFilter.mode(AppColors.textSecondary, BlendMode.srcIn))),
                ),
              ),
            ]),
          ),
        Container(
          padding: EdgeInsets.only(left: 12, right: 8, top: 10, bottom: 10 + bottomPadding),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: _selectedImage == null ? const Border(top: BorderSide(color: AppColors.borderLight, width: 1)) : null,
          ),
          child: Row(
            children: [
              GestureDetector(
                onTap: _pickImage,
                child: Padding(padding: const EdgeInsets.all(6), child: SvgPicture.asset('assets/icons/image-icon.svg', width: 22, height: 22, colorFilter: const ColorFilter.mode(AppColors.textHint, BlendMode.srcIn))),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: TextField(
                    controller: _msgCtrl,
                    maxLines: 4, minLines: 1,
                     onChanged: (_) => setState(() {}),
                    style: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textPrimary, height: 1.4, decoration: TextDecoration.none, decorationThickness: 0),
                    decoration: InputDecoration(
                      hintText: context.tr('type_message'),
                      hintStyle: GoogleFonts.plusJakartaSans(fontSize: 14, color: AppColors.textHint, height: 1.4, decoration: TextDecoration.none),
                      border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(vertical: 10), isDense: true,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: canSend && !_sending ? _sendMessage : null,
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: canSend ? AppColors.primary : AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: _sending
                      ? const Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Center(
                          child: SvgPicture.asset(
                            'assets/icons/send-icon.svg',
                            width: 18,
                            height: 18,
                            colorFilter: ColorFilter.mode(
                              canSend ? Colors.white : AppColors.textHint,
                              BlendMode.srcIn,
                            ),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
