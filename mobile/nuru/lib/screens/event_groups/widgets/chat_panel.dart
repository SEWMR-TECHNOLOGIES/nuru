import 'dart:async';
// Image uploads use UploadsService.uploadFile(filePath).
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/event_groups_service.dart';
import '../../../core/services/uploads_service.dart';

const _quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const _fullEmojis = [
  '👍','❤️','😂','😮','😢','🙏','🎉','🔥','💯','👏',
  '🤝','💪','✨','🥳','💸','💰','🤔','😎','😭','😡',
  '🙌','👀','🚀','💡','✅','❌',
];

class ChatPanel extends StatefulWidget {
  final String groupId;
  final String? meMemberId;
  final bool isClosed;
  const ChatPanel({super.key, required this.groupId, this.meMemberId, this.isClosed = false});

  @override
  State<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends State<ChatPanel> {
  final _scroll = ScrollController();
  final _input = TextEditingController();
  final _picker = ImagePicker();
  List<dynamic> _messages = [];
  bool _loading = true;
  bool _sending = false;
  bool _uploading = false;
  String? _cursor;
  Timer? _poll;
  Map<String, dynamic>? _replyTo;
  bool _stickToBottom = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      _stickToBottom = _scroll.hasClients &&
          _scroll.position.maxScrollExtent - _scroll.position.pixels < 80;
    });
    _initial();
    _poll = Timer.periodic(const Duration(seconds: 6), (_) => _pollNew());
  }

  Future<void> _initial() async {
    final res = await EventGroupsService.messages(widget.groupId, limit: 50);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (res['success'] == true) {
        final data = res['data'];
        _messages = data is Map ? List.from(data['messages'] ?? []) : [];
        if (_messages.isNotEmpty) _cursor = _messages.last['created_at'];
      }
    });
    _scrollEnd();
    EventGroupsService.markRead(widget.groupId);
  }

  Future<void> _pollNew() async {
    if (_cursor == null) return;
    final res = await EventGroupsService.messages(widget.groupId, after: _cursor, limit: 50);
    if (!mounted) return;
    if (res['success'] == true) {
      final data = res['data'];
      final fresh = data is Map ? List.from(data['messages'] ?? []) : [];
      if (fresh.isEmpty) return;
      setState(() {
        final ids = _messages.map((m) => m['id']).toSet();
        for (final m in fresh) {
          if (!ids.contains(m['id'])) _messages.add(m);
        }
        _cursor = fresh.last['created_at'];
      });
      if (_stickToBottom) _scrollEnd();
      EventGroupsService.markRead(widget.groupId);
    }
  }

  void _scrollEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _scroll.dispose();
    _input.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending || widget.isClosed) return;
    // Optimistic — clear input + show pending bubble immediately (WhatsApp-style).
    final tempId = 'tmp-${DateTime.now().microsecondsSinceEpoch}';
    final reply = _replyTo;
    final optimistic = <String, dynamic>{
      'id': tempId,
      'message_type': 'text',
      'content': text,
      'sender_member_id': widget.meMemberId,
      'sender_name': 'You',
      'reply_to': reply,
      'reactions': [],
      'created_at': DateTime.now().toUtc().toIso8601String(),
      '_pending': true,
    };
    setState(() {
      _messages.add(optimistic);
      _input.clear();
      _replyTo = null;
      _stickToBottom = true;
      _sending = true;
    });
    _scrollEnd();
    final res = await EventGroupsService.sendMessage(widget.groupId,
        content: text, replyToId: reply?['id']);
    if (!mounted) return;
    setState(() {
      _sending = false;
      final idx = _messages.indexWhere((m) => m['id'] == tempId);
      if (res['success'] == true && res['data'] is Map) {
        final real = Map<String, dynamic>.from(res['data']);
        if (idx >= 0) _messages[idx] = real; else _messages.add(real);
        _cursor = real['created_at'];
      } else if (idx >= 0) {
        _messages.removeAt(idx);
        _input.text = text;
      }
    });
    _scrollEnd();
  }

  Future<void> _pickAndSendImage() async {
    if (widget.isClosed) return;
    final XFile? file = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, imageQuality: 85);
    if (file == null) return;
    setState(() => _uploading = true);
    try {
      final upRes = await UploadsService.uploadFile(file.path);
      final url = upRes['data']?['url'] ?? upRes['data']?['file_url'] ?? upRes['data']?['public_url'];
      if (url == null) throw 'Upload failed';
      final res = await EventGroupsService.sendMessage(widget.groupId, imageUrl: url);
      if (mounted && res['success'] == true && res['data'] is Map) {
        setState(() {
          _messages.add(Map<String, dynamic>.from(res['data']));
          _cursor = res['data']['created_at'];
          _stickToBottom = true;
        });
        _scrollEnd();
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Image upload failed')));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _react(Map msg, String emoji) async {
    setState(() {
      final reactions = List<Map<String, dynamic>>.from((msg['reactions'] ?? []) as List);
      final idx = reactions.indexWhere((r) => r['emoji'] == emoji);
      if (idx >= 0) {
        final r = Map<String, dynamic>.from(reactions[idx]);
        r['mine'] = !(r['mine'] == true);
        r['count'] = (r['count'] as int) + (r['mine'] == true ? 1 : -1);
        if ((r['count'] as int) <= 0) reactions.removeAt(idx); else reactions[idx] = r;
      } else {
        reactions.add({'emoji': emoji, 'count': 1, 'mine': true});
      }
      msg['reactions'] = reactions;
    });
    await EventGroupsService.react(widget.groupId, msg['id'], emoji);
  }

  Future<void> _delete(Map msg) async {
    setState(() {
      msg['is_deleted'] = true;
      msg['content'] = '(deleted)';
    });
    await EventGroupsService.deleteMessage(widget.groupId, msg['id']);
  }

  void _showReactPicker(Map msg) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 36, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final e in _fullEmojis)
              GestureDetector(
                onTap: () { Navigator.pop(context); _react(msg, e); },
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(10)),
                  child: Text(e, style: const TextStyle(fontSize: 22)),
                ),
              ),
          ]),
        ]),
      ),
    );
  }

  String _formatTime(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  bool _sameDay(String a, String b) {
    final da = DateTime.tryParse(a); final db = DateTime.tryParse(b);
    if (da == null || db == null) return false;
    return da.year == db.year && da.month == db.month && da.day == db.day;
  }

  String _dayLabel(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return '';
    final now = DateTime.now();
    if (_sameDay(iso, now.toIso8601String())) return 'Today';
    if (_sameDay(iso, now.subtract(const Duration(days: 1)).toIso8601String())) return 'Yesterday';
    return '${d.day}/${d.month}/${d.year}';
  }

  String _initials(String n) =>
      n.trim().split(RegExp(r'\s+')).take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                      width: 56, height: 56,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primarySoft),
                      child: Icon(Icons.send_outlined, color: AppColors.primary),
                    ),
                    const SizedBox(height: 12),
                    Text('No messages yet', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                    Text('Say hi to your group 👋', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
                  ]),
                )
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.all(12),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final m = _messages[i];
                    final prev = i > 0 ? _messages[i - 1] : null;
                    final showDay = prev == null || !_sameDay(prev['created_at'], m['created_at']);
                    final mine = m['sender_member_id'] != null && m['sender_member_id'] == widget.meMemberId;
                    final isSystem = m['message_type'] == 'system';
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (showDay) Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(20)),
                              child: Text(_dayLabel(m['created_at']),
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 0.6)),
                            ),
                          ),
                        ),
                        if (isSystem)
                          Center(
                            child: Container(
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(20)),
                              child: Text(m['content'] ?? '',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
                            ),
                          )
                        else
                          _bubble(m, mine),
                      ],
                    );
                  },
                ),
        ),
        if (_replyTo != null) _replyPreview(),
        _composer(),
      ],
    );
  }

  Widget _bubble(Map m, bool mine) {
    final reactions = (m['reactions'] ?? []) as List;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: AppColors.primarySoft,
              backgroundImage: m['sender_avatar_url'] != null ? NetworkImage(m['sender_avatar_url']) : null,
              child: m['sender_avatar_url'] == null
                  ? Text(_initials(m['sender_name'] ?? '?'), style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.w700))
                  : null,
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: widget.isClosed ? null : () => _showActionSheet(m, mine),
              child: Column(
                crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  if (!mine && m['sender_name'] != null)
                    Padding(
                      padding: const EdgeInsets.only(left: 4, bottom: 2),
                      child: Text(m['sender_name'],
                          style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary)),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: mine ? AppColors.primary : AppColors.surface,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: Radius.circular(mine ? 16 : 4),
                        bottomRight: Radius.circular(mine ? 4 : 16),
                      ),
                      border: mine ? null : Border.all(color: AppColors.border),
                    ),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (m['reply_to'] != null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: (mine ? Colors.white : AppColors.primary).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                              border: Border(left: BorderSide(color: mine ? Colors.white : AppColors.primary, width: 2)),
                            ),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(m['reply_to']['sender_name'] ?? '',
                                  style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700,
                                      color: mine ? Colors.white.withOpacity(0.85) : AppColors.primary)),
                              Text(m['reply_to']['content'] ?? '',
                                  maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.plusJakartaSans(fontSize: 11,
                                      color: mine ? Colors.white.withOpacity(0.8) : AppColors.textSecondary)),
                            ]),
                          ),
                        if (m['image_url'] != null) ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: CachedNetworkImage(imageUrl: m['image_url'], fit: BoxFit.cover, width: 220),
                        ),
                        if (m['content'] != null && (m['content'] as String).isNotEmpty)
                          Padding(
                            padding: EdgeInsets.only(top: m['image_url'] != null ? 6 : 0),
                            child: Text(m['content'],
                                style: GoogleFonts.plusJakartaSans(
                                  color: mine ? Colors.white : AppColors.textPrimary,
                                  fontSize: 14, height: 1.3,
                                )),
                          ),
                        const SizedBox(height: 4),
                        Row(mainAxisSize: MainAxisSize.min, children: [
                          Text(_formatTime(m['created_at']),
                              style: GoogleFonts.plusJakartaSans(fontSize: 9,
                                  color: mine ? Colors.white.withOpacity(0.75) : AppColors.textTertiary)),
                          if (mine) ...[
                            const SizedBox(width: 3),
                            Icon(Icons.done_all, size: 11, color: Colors.white.withOpacity(0.75)),
                          ],
                        ]),
                      ],
                    ),
                  ),
                  if (reactions.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Wrap(spacing: 4, children: [
                        for (final r in reactions)
                          GestureDetector(
                            onTap: () => _react(m, r['emoji']),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: r['mine'] == true ? AppColors.primarySoft : AppColors.surface,
                                border: Border.all(color: r['mine'] == true ? AppColors.primary : AppColors.border),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                Text(r['emoji'], style: const TextStyle(fontSize: 11)),
                                const SizedBox(width: 3),
                                Text('${r['count']}',
                                    style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700,
                                        color: r['mine'] == true ? AppColors.primary : AppColors.textSecondary)),
                              ]),
                            ),
                          ),
                      ]),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showActionSheet(Map m, bool mine) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 36, height: 4, margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2))),
            // Quick reactions row
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                for (final e in _quickEmojis)
                  GestureDetector(
                    onTap: () { Navigator.pop(context); _react(m, e); },
                    child: Text(e, style: const TextStyle(fontSize: 26)),
                  ),
                GestureDetector(
                  onTap: () { Navigator.pop(context); _showReactPicker(m); },
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(color: AppColors.surfaceVariant, shape: BoxShape.circle),
                    child: const Icon(Icons.add, size: 18),
                  ),
                ),
              ]),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Reply'),
              onTap: () { Navigator.pop(context); setState(() => _replyTo = Map<String, dynamic>.from(m)); },
            ),
            if (mine) ListTile(
              leading: Icon(Icons.delete_outline, color: AppColors.error),
              title: Text('Delete', style: TextStyle(color: AppColors.error)),
              onTap: () { Navigator.pop(context); _delete(m); },
            ),
          ]),
        ),
      ),
    );
  }

  Widget _replyPreview() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      color: AppColors.surfaceVariant,
      child: Row(children: [
        Container(width: 3, height: 30, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text('Replying to ${_replyTo!['sender_name'] ?? ''}',
                style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w700)),
            Text(_replyTo!['content'] ?? 'Image',
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ),
        IconButton(
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          icon: const Icon(Icons.close, size: 18),
          onPressed: () => setState(() => _replyTo = null),
        ),
      ]),
    );
  }

  Widget _composer() {
    if (widget.isClosed) {
      return Container(
        padding: const EdgeInsets.all(12),
        color: AppColors.surface,
        child: Center(
          child: Text('🔒 This event has ended. Group is read-only.',
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary)),
        ),
      );
    }
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      padding: EdgeInsets.fromLTRB(8, 8, 8, 8 + MediaQuery.of(context).padding.bottom),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        IconButton(
          onPressed: _uploading ? null : _pickAndSendImage,
          icon: _uploading
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Icon(Icons.image_outlined, color: AppColors.textSecondary),
        ),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(22),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: TextField(
              controller: _input,
              minLines: 1, maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(border: InputBorder.none, hintText: 'Write a message…'),
              style: GoogleFonts.plusJakartaSans(fontSize: 14),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Material(
          color: AppColors.primary,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _sending ? null : _send,
            child: const Padding(padding: EdgeInsets.all(10), child: Icon(Icons.send, size: 18, color: Colors.white)),
          ),
        ),
      ]),
    );
  }
}
