import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:nuru/core/services/meetings_service.dart';

class MeetingRoomScreen extends StatefulWidget {
  final String eventId;
  final String meetingId;
  final String roomId;

  const MeetingRoomScreen({
    super.key,
    required this.eventId,
    required this.meetingId,
    required this.roomId,
  });

  @override
  State<MeetingRoomScreen> createState() => _MeetingRoomScreenState();
}

class _MeetingRoomScreenState extends State<MeetingRoomScreen> with TickerProviderStateMixin {
  final MeetingsService _service = MeetingsService();

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  bool _loading = true;
  String? _error;
  String? _participantName;
  bool _isHost = false;

  // Join status
  String _joinStatus = '';
  String _meetingTitle = '';
  Timer? _waitingPollTimer;

  // Local controls
  bool _micEnabled = true;
  bool _cameraEnabled = true;
  bool _showParticipants = false;
  bool _showChat = false;
  bool _screenShareEnabled = false;
  bool _handRaised = false;
  bool _showReactions = false;

  // Raised hands from other participants
  final Set<String> _raisedHands = {};

  // Floating reactions with animation
  final List<_AnimatedReaction> _animatedReactions = [];

  // Join requests (host only)
  List<Map<String, dynamic>> _joinRequests = [];
  Timer? _joinRequestsPollTimer;

  // Chat
  final TextEditingController _chatController = TextEditingController();
  final List<_ChatMessage> _chatMessages = [];
  final ScrollController _chatScrollController = ScrollController();

  static const _reactionEmojis = ['👍', '👏', '❤️', '😂', '🎉', '🔥', '💯', '🙌'];

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    try {
      final joinRes = await _service.joinMeeting(widget.eventId, widget.meetingId);
      final joinData = joinRes['data'];
      final status = joinData?['status'] as String? ?? '';

      if (status == 'joined' || status == 'already_joined') {
        _meetingTitle = joinData?['title'] as String? ?? '';
        await _fetchTokenAndConnect();
      } else if (status == 'waiting') {
        setState(() {
          _joinStatus = 'waiting';
          _loading = false;
        });
        _startWaitingPoll();
      } else if (status == 'rejected') {
        setState(() {
          _error = 'Your request to join was declined by the host.';
          _loading = false;
        });
      } else {
        setState(() {
          _error = joinRes['message'] as String? ?? 'Unable to join meeting.';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to connect: $e';
        _loading = false;
      });
    }
  }

  void _startWaitingPoll() {
    _waitingPollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        final res = await _service.checkJoinStatus(widget.eventId, widget.meetingId);
        final status = res['data']?['status'] as String? ?? '';
        if (status == 'approved') {
          _waitingPollTimer?.cancel();
          setState(() {
            _joinStatus = 'approved';
            _loading = true;
          });
          await _fetchTokenAndConnect();
        } else if (status == 'rejected') {
          _waitingPollTimer?.cancel();
          setState(() {
            _joinStatus = 'rejected';
            _error = 'Your request to join was declined by the host.';
          });
        }
      } catch (_) {}
    });
  }

  Future<void> _fetchTokenAndConnect() async {
    try {
      final res = await _service.getMeetingToken(widget.eventId, widget.meetingId);
      if (res['success'] != true || res['data'] == null) {
        setState(() {
          _error = 'Failed to get meeting token.';
          _loading = false;
        });
        return;
      }

      final token = res['data']['token'] as String;
      final url = res['data']['url'] as String;
      _participantName = res['data']['participant_name'] as String?;
      _isHost = res['data']['is_host'] as bool? ?? false;

      final room = Room(
        roomOptions: const RoomOptions(
          adaptiveStream: true,
          dynacast: true,
          defaultAudioPublishOptions: AudioPublishOptions(dtx: true),
          defaultVideoPublishOptions: VideoPublishOptions(simulcast: true),
        ),
      );

      _listener = room.createListener();
      _setupListeners();

      await room.connect(url, token);
      await room.localParticipant?.setCameraEnabled(true);
      await room.localParticipant?.setMicrophoneEnabled(true);

      setState(() {
        _room = room;
        _loading = false;
        _joinStatus = 'joined';
      });

      if (_isHost) {
        _startJoinRequestsPoll();
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to connect: $e';
        _loading = false;
      });
    }
  }

  void _startJoinRequestsPoll() {
    _pollJoinRequests();
    _joinRequestsPollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollJoinRequests());
  }

  Future<void> _pollJoinRequests() async {
    try {
      final res = await _service.listJoinRequests(widget.eventId, widget.meetingId);
      if (res['success'] == true && res['data'] != null) {
        setState(() {
          _joinRequests = List<Map<String, dynamic>>.from(res['data']);
        });
      }
    } catch (_) {}
  }

  Future<void> _approveJoinRequest(String requestId) async {
    try {
      await _service.reviewJoinRequest(widget.eventId, widget.meetingId, requestId, 'approve');
      setState(() {
        _joinRequests.removeWhere((r) => r['id'] == requestId);
      });
    } catch (_) {}
  }

  Future<void> _rejectJoinRequest(String requestId) async {
    try {
      await _service.reviewJoinRequest(widget.eventId, widget.meetingId, requestId, 'reject');
      setState(() {
        _joinRequests.removeWhere((r) => r['id'] == requestId);
      });
    } catch (_) {}
  }

  void _setupListeners() {
    _listener
      ?..on<ParticipantConnectedEvent>((event) => setState(() {}))
      ..on<ParticipantDisconnectedEvent>((event) => setState(() {}))
      ..on<TrackPublishedEvent>((event) => setState(() {}))
      ..on<TrackUnpublishedEvent>((event) => setState(() {}))
      ..on<TrackSubscribedEvent>((event) => setState(() {}))
      ..on<TrackUnsubscribedEvent>((event) => setState(() {}))
      ..on<TrackMutedEvent>((event) => setState(() {}))
      ..on<TrackUnmutedEvent>((event) => setState(() {}))
      ..on<ActiveSpeakersChangedEvent>((event) => setState(() {}))
      ..on<DataReceivedEvent>((event) {
        try {
          final text = String.fromCharCodes(event.data);
          try {
            final msg = jsonDecode(text) as Map<String, dynamic>;
            final type = msg['type'] as String?;
            final senderIdentity = event.participant?.identity ?? '';
            final senderName = event.participant?.name ?? 'Unknown';

            if (type == 'reaction') {
              final emoji = msg['payload'] as String? ?? '👍';
              _showAnimatedReaction(emoji, senderName);
            } else if (type == 'hand_raise') {
              setState(() => _raisedHands.add(senderIdentity));
            } else if (type == 'hand_lower') {
              setState(() => _raisedHands.remove(senderIdentity));
            }
            return;
          } catch (_) {}

          final senderName = (event.participant?.name?.isNotEmpty == true)
              ? event.participant!.name
              : (event.participant?.identity ?? 'Unknown');
          setState(() {
            _chatMessages.add(
              _ChatMessage(sender: senderName, text: text, time: DateTime.now()),
            );
          });
          _scrollChatToBottom();
        } catch (_) {}
      })
      ..on<RoomDisconnectedEvent>((event) {
        if (mounted) Navigator.pop(context);
      });
  }

  void _showAnimatedReaction(String emoji, String sender) {
    final controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );
    final xPos = 20.0 + Random().nextDouble() * 60.0;
    final reaction = _AnimatedReaction(
      emoji: emoji,
      sender: sender,
      controller: controller,
      xPercent: xPos,
    );
    setState(() {
      _animatedReactions.add(reaction);
      if (_animatedReactions.length > 10) {
        _animatedReactions.first.controller.dispose();
        _animatedReactions.removeAt(0);
      }
    });
    controller.forward().then((_) {
      if (mounted) {
        setState(() => _animatedReactions.remove(reaction));
        controller.dispose();
      }
    });
  }

  void _scrollChatToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScrollController.hasClients) {
        _chatScrollController.animateTo(
          _chatScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _toggleMic() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    await lp.setMicrophoneEnabled(!_micEnabled);
    setState(() => _micEnabled = !_micEnabled);
  }

  Future<void> _toggleCamera() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    await lp.setCameraEnabled(!_cameraEnabled);
    setState(() => _cameraEnabled = !_cameraEnabled);
  }

  Future<void> _toggleScreenShare() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    try {
      await lp.setScreenShareEnabled(!_screenShareEnabled);
      setState(() => _screenShareEnabled = !_screenShareEnabled);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Screen share failed: $e'), behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  Future<void> _switchCamera() async {
    final lp = _room?.localParticipant;
    if (lp == null) return;
    // Find the camera track publication
    final cameraPub = lp.trackPublications.values
        .where((pub) => pub.source == TrackSource.camera && pub.track != null)
        .firstOrNull;
    if (cameraPub?.track is LocalVideoTrack) {
      final videoTrack = cameraPub!.track as LocalVideoTrack;
      try {
        await videoTrack.setCameraPosition(CameraPosition.back);
      } catch (_) {
        // Toggle approach
        await lp.setCameraEnabled(false);
        await Future.delayed(const Duration(milliseconds: 200));
        await lp.setCameraEnabled(true);
      }
    }
  }

  void _toggleHandRaise() {
    setState(() => _handRaised = !_handRaised);
    final identity = _room?.localParticipant?.identity ?? '';
    if (_handRaised) {
      _raisedHands.add(identity);
    } else {
      _raisedHands.remove(identity);
    }
    _sendDataMessage({
      'type': _handRaised ? 'hand_raise' : 'hand_lower',
    });
  }

  void _sendReaction(String emoji) {
    _sendDataMessage({'type': 'reaction', 'payload': emoji});
    _showAnimatedReaction(emoji, 'You');
    setState(() => _showReactions = false);
  }

  void _sendDataMessage(Map<String, dynamic> msg) {
    final data = Uint8List.fromList(utf8.encode(jsonEncode(msg)));
    _room?.localParticipant?.publishData(data, reliable: true);
  }

  Future<void> _sendChatMessage() async {
    final text = _chatController.text.trim();
    if (text.isEmpty || _room == null) return;

    await _room!.localParticipant?.publishData(
      Uint8List.fromList(text.codeUnits),
      reliable: true,
    );

    setState(() {
      _chatMessages.add(
        _ChatMessage(sender: _participantName ?? 'You', text: text, time: DateTime.now(), isMe: true),
      );
    });
    _chatController.clear();
    _scrollChatToBottom();
  }

  Future<void> _leaveRoom() async {
    try {
      await _service.leaveMeeting(widget.eventId, widget.meetingId);
    } catch (_) {}
    await _room?.disconnect();
    if (mounted) Navigator.pop(context);
  }

  @override
  void dispose() {
    _waitingPollTimer?.cancel();
    _joinRequestsPollTimer?.cancel();
    for (final r in _animatedReactions) {
      r.controller.dispose();
    }
    _listener?.dispose();
    _room?.disconnect();
    _room?.dispose();
    _chatController.dispose();
    _chatScrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: SafeArea(
        child: _loading
            ? _buildLoading()
            : _joinStatus == 'waiting'
                ? _buildWaitingRoom()
                : _error != null
                    ? _buildError()
                    : _buildMeetingRoom(),
      ),
    );
  }

  Widget _buildLoading() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 16),
          const Text('Connecting to meeting...', style: TextStyle(color: Colors.white70, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildWaitingRoom() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Center(
                child: CircularProgressIndicator(
                  color: Theme.of(context).colorScheme.primary,
                  strokeWidth: 3,
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Waiting to be admitted', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Text('The host will let you in shortly.', style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(4))),
                const SizedBox(width: 8),
                Text('Waiting for host approval...', style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12)),
              ],
            ),
            const SizedBox(height: 32),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white70, side: const BorderSide(color: Colors.white24)),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64, height: 64,
              decoration: BoxDecoration(color: Colors.red.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
              child: SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 32, height: 32, colorFilter: const ColorFilter.mode(Colors.red, BlendMode.srcIn)),
            ),
            const SizedBox(height: 16),
            const Text('Unable to join meeting', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.white54, fontSize: 13), textAlign: TextAlign.center),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: const Text('Go Back'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white70, side: const BorderSide(color: Colors.white24)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMeetingRoom() {
    return Stack(
      children: [
        Column(
          children: [
            _buildTopBar(),
            Expanded(
              child: _showParticipants
                  ? _buildParticipantsSheet()
                  : _showChat
                      ? _buildChatSheet()
                      : _buildVideoGrid(),
            ),
            _buildControlBar(),
          ],
        ),
        // Google Meet-style floating reactions
        ..._animatedReactions.map((r) => AnimatedBuilder(
          animation: r.controller,
          builder: (context, child) {
            final progress = r.controller.value;
            final screenHeight = MediaQuery.of(context).size.height;
            final yOffset = progress * screenHeight * 0.4;
            final opacity = progress < 0.7 ? 1.0 : (1.0 - (progress - 0.7) / 0.3);
            final scale = progress < 0.2 ? (progress / 0.2) * 1.3 : 1.3 - (progress - 0.2) * 0.4;
            return Positioned(
              left: MediaQuery.of(context).size.width * r.xPercent / 100,
              bottom: 100 + yOffset,
              child: Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: scale.clamp(0.5, 1.5),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(r.emoji, style: const TextStyle(fontSize: 36)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(r.sender, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.w500)),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        )),
        // Reaction picker
        if (_showReactions)
          Positioned(
            bottom: 90,
            left: 16, right: 16,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E1E),
                  border: Border.all(color: Colors.white12),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 4))],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: _reactionEmojis.map((e) => GestureDetector(
                    onTap: () => _sendReaction(e),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      child: Text(e, style: const TextStyle(fontSize: 28)),
                    ),
                  )).toList(),
                ),
              ),
            ),
          ),
        // Join requests notification (host only)
        if (_isHost && _joinRequests.isNotEmpty)
          Positioned(
            top: 52, right: 8, left: 8,
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1A),
                border: Border.all(color: Colors.white10),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 16)],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.amber.withOpacity(0.1),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.person_add_rounded, size: 16, color: Colors.amber),
                        const SizedBox(width: 8),
                        Text('${_joinRequests.length} waiting to join', style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  ..._joinRequests.take(5).map((req) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: Row(
                      children: [
                        _buildAvatar(req['name'] as String? ?? '?', req['avatar_url'] as String?, 14),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(req['name'] as String? ?? 'Unknown', style: const TextStyle(color: Colors.white, fontSize: 13), overflow: TextOverflow.ellipsis),
                        ),
                        GestureDetector(
                          onTap: () => _approveJoinRequest(req['id'] as String),
                          child: Container(
                            width: 32, height: 32,
                            decoration: BoxDecoration(color: Colors.green.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.check_rounded, size: 18, color: Colors.green),
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => _rejectJoinRequest(req['id'] as String),
                          child: Container(
                            width: 32, height: 32,
                            decoration: BoxDecoration(color: Colors.red.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.close_rounded, size: 18, color: Colors.red),
                          ),
                        ),
                      ],
                    ),
                  )),
                  const SizedBox(height: 6),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAvatar(String name, String? avatarUrl, double radius) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.15),
      backgroundImage: (avatarUrl != null && avatarUrl.isNotEmpty) ? NetworkImage(avatarUrl) : null,
      child: (avatarUrl == null || avatarUrl.isEmpty)
          ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: radius * 0.8, fontWeight: FontWeight.w600))
          : null,
    );
  }

  Widget _buildTopBar() {
    final participantCount = (_room?.remoteParticipants.length ?? 0) + 1;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF111111),
        border: Border(bottom: BorderSide(color: Colors.white10)),
      ),
      child: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: SvgPicture.asset('assets/icons/video_chat_icon.svg', width: 18, height: 18,
              colorFilter: ColorFilter.mode(Theme.of(context).colorScheme.primary, BlendMode.srcIn)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _meetingTitle.isNotEmpty ? _meetingTitle : 'Meeting',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                ),
                if (_isHost)
                  Row(
                    children: [
                      Icon(Icons.shield_rounded, size: 10, color: Colors.amber.shade300),
                      const SizedBox(width: 3),
                      Text('Host', style: TextStyle(color: Colors.amber.shade300, fontSize: 10, fontWeight: FontWeight.w700)),
                    ],
                  ),
              ],
            ),
          ),
          if (_isHost && _joinRequests.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.amber.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
              child: Text('${_joinRequests.length} waiting', style: const TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(width: 8),
          ],
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.people_outline_rounded, size: 14, color: Colors.white70),
                const SizedBox(width: 5),
                Text('$participantCount', style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoGrid() {
    final room = _room;
    if (room == null) return const SizedBox();

    final List<Participant<TrackPublication>> participants = <Participant<TrackPublication>>[
      room.localParticipant! as Participant<TrackPublication>,
      ...room.remoteParticipants.values.cast<Participant<TrackPublication>>(),
    ];

    if (participants.length == 1) {
      return Padding(
        padding: const EdgeInsets.all(6),
        child: _buildParticipantTile(participants[0], fullSize: true),
      );
    }

    if (participants.length == 2) {
      return Padding(
        padding: const EdgeInsets.all(6),
        child: Column(
          children: participants.map((p) => Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: _buildParticipantTile(p),
            ),
          )).toList(),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(6),
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: participants.length <= 4 ? 2 : 3,
          mainAxisSpacing: 6,
          crossAxisSpacing: 6,
          childAspectRatio: 4 / 3,
        ),
        itemCount: participants.length,
        itemBuilder: (_, i) => _buildParticipantTile(participants[i]),
      ),
    );
  }

  Widget _buildParticipantTile(Participant<TrackPublication> participant, {bool fullSize = false}) {
    final videoTrack = participant.trackPublications.values
        .where((pub) => pub.source == TrackSource.camera && pub.track != null && !pub.muted)
        .firstOrNull?.track as VideoTrack?;

    final screenTrack = participant.trackPublications.values
        .where((pub) => pub.source == TrackSource.screenShareVideo && pub.track != null)
        .firstOrNull?.track as VideoTrack?;

    final isMuted = participant.trackPublications.values
        .where((pub) => pub.source == TrackSource.microphone)
        .firstOrNull?.muted ?? true;

    final isLocal = participant is LocalParticipant;
    final displayName = participant.name.isNotEmpty
        ? (isLocal ? 'You' : participant.name)
        : (isLocal ? 'You' : 'Participant');

    final isSpeaking = participant.isSpeaking;
    final isHandUp = _raisedHands.contains(participant.identity);
    final trackToShow = screenTrack ?? videoTrack;

    // Parse avatar from metadata
    String? avatarUrl;
    try {
      if (participant.metadata != null && participant.metadata!.isNotEmpty) {
        final meta = jsonDecode(participant.metadata!) as Map<String, dynamic>;
        avatarUrl = meta['avatar_url'] as String?;
      }
    } catch (_) {}

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(16),
        border: isSpeaking ? Border.all(color: Colors.green.withOpacity(0.6), width: 2) : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Video or avatar placeholder (solid bg, no opacity)
          if (trackToShow != null)
            VideoTrackRenderer(
              trackToShow,
              fit: VideoViewFit.cover,
              mirrorMode: isLocal && screenTrack == null
                  ? VideoViewMirrorMode.mirror
                  : VideoViewMirrorMode.off,
            )
          else
            Container(
              color: const Color(0xFF1A1A1A),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildAvatar(displayName, avatarUrl, fullSize ? 36 : 24),
                    const SizedBox(height: 8),
                    Text(displayName, style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          // Speaking indicator
          if (isSpeaking)
            Positioned(
              top: 8, right: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.3), borderRadius: BorderRadius.circular(6)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.volume_up_rounded, size: 12, color: Colors.green),
                    const SizedBox(width: 2),
                    ...List.generate(3, (i) => Container(
                      width: 2, height: 6 + Random().nextDouble() * 6,
                      margin: const EdgeInsets.only(left: 1),
                      decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(1)),
                    )),
                  ],
                ),
              ),
            ),
          // Hand raise badge
          if (isHandUp)
            Positioned(
              top: 8, left: 8,
              child: Container(
                width: 30, height: 30,
                decoration: BoxDecoration(color: Colors.amber.withOpacity(0.3), borderRadius: BorderRadius.circular(10)),
                child: const Center(child: Text('✋', style: TextStyle(fontSize: 16))),
              ),
            ),
          // Name label
          Positioned(
            left: 8, bottom: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isMuted) ...[
                    const Icon(Icons.mic_off_rounded, size: 12, color: Colors.redAccent),
                    const SizedBox(width: 4),
                  ],
                  Text(displayName, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ),
          // Switch camera for local
          if (isLocal && videoTrack != null)
            Positioned(
              right: 8, top: 8,
              child: GestureDetector(
                onTap: _switchCamera,
                child: Container(
                  width: 34, height: 34,
                  decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.flip_camera_ios_rounded, size: 16, color: Colors.white70),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Full-screen participants panel (replaces side panel on mobile) ──
  Widget _buildParticipantsSheet() {
    final room = _room;
    if (room == null) return const SizedBox();

    final List<Participant<TrackPublication>> all = <Participant<TrackPublication>>[
      room.localParticipant! as Participant<TrackPublication>,
      ...room.remoteParticipants.values.cast<Participant<TrackPublication>>(),
    ];

    return Container(
      color: const Color(0xFF0F0F0F),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Icon(Icons.people_rounded, size: 20, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 10),
                Text('Participants (${all.length})', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                const Spacer(),
                GestureDetector(
                  onTap: () => setState(() => _showParticipants = false),
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.close_rounded, size: 18, color: Colors.white60),
                  ),
                ),
              ],
            ),
          ),
          // List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              separatorBuilder: (_, __) => const Divider(height: 1, color: Colors.white10, indent: 64),
              itemCount: all.length,
              itemBuilder: (_, i) {
                final p = all[i];
                final isLocal = p is LocalParticipant;
                final isMuted = p.trackPublications.values
                    .where((pub) => pub.source == TrackSource.microphone)
                    .firstOrNull?.muted ?? true;
                final pName = p.name.isNotEmpty ? p.name : 'Participant';
                final isHandUp = _raisedHands.contains(p.identity);

                String? avatarUrl;
                try {
                  if (p.metadata != null && p.metadata!.isNotEmpty) {
                    final meta = jsonDecode(p.metadata!) as Map<String, dynamic>;
                    avatarUrl = meta['avatar_url'] as String?;
                  }
                } catch (_) {}

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      _buildAvatar(pName, avatarUrl, 20),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('$pName${isLocal ? " (You)" : ""}',
                              style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
                            if (isLocal && _isHost)
                              Text('Host', style: TextStyle(color: Colors.amber.shade300, fontSize: 11, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      if (isHandUp)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Container(
                            width: 28, height: 28,
                            decoration: BoxDecoration(color: Colors.amber.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                            child: const Center(child: Text('✋', style: TextStyle(fontSize: 14))),
                          ),
                        ),
                      if (p.isSpeaking)
                        const Padding(
                          padding: EdgeInsets.only(right: 8),
                          child: Icon(Icons.volume_up_rounded, size: 16, color: Colors.green),
                        ),
                      Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: isMuted ? Colors.red.withOpacity(0.1) : Colors.green.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          isMuted ? Icons.mic_off_rounded : Icons.mic_rounded,
                          size: 16,
                          color: isMuted ? Colors.redAccent : Colors.green,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Full-screen chat panel ──
  Widget _buildChatSheet() {
    return Container(
      color: const Color(0xFF0F0F0F),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                Icon(Icons.chat_rounded, size: 20, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 10),
                const Text('Chat', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                const Spacer(),
                GestureDetector(
                  onTap: () => setState(() => _showChat = false),
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.close_rounded, size: 18, color: Colors.white60),
                  ),
                ),
              ],
            ),
          ),
          // Messages
          Expanded(
            child: _chatMessages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.chat_bubble_outline_rounded, size: 40, color: Colors.white.withOpacity(0.12)),
                        const SizedBox(height: 12),
                        Text('No messages yet', style: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 13)),
                        const SizedBox(height: 4),
                        Text('Start the conversation', style: TextStyle(color: Colors.white.withOpacity(0.15), fontSize: 11)),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _chatScrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _chatMessages.length,
                    itemBuilder: (_, i) {
                      final msg = _chatMessages[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: msg.isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(msg.isMe ? 'You' : msg.sender,
                                  style: TextStyle(
                                    color: msg.isMe ? Theme.of(context).colorScheme.primary : Colors.white70,
                                    fontSize: 12, fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '${msg.time.hour.toString().padLeft(2, '0')}:${msg.time.minute.toString().padLeft(2, '0')}',
                                  style: const TextStyle(color: Colors.white24, fontSize: 10),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: msg.isMe
                                    ? Theme.of(context).colorScheme.primary.withOpacity(0.15)
                                    : Colors.white.withOpacity(0.06),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Text(msg.text, style: const TextStyle(color: Colors.white, fontSize: 14)),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          // Input
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Colors.white10))),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _chatController,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Type a message...',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.25), fontSize: 14),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.06),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    onSubmitted: (_) => _sendChatMessage(),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: _sendChatMessage,
                  child: Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.send_rounded, size: 18, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF111111),
        border: Border(top: BorderSide(color: Colors.white10)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _controlButton(icon: _micEnabled ? Icons.mic_rounded : Icons.mic_off_rounded, label: _micEnabled ? 'Mute' : 'Unmute', active: _micEnabled, onTap: _toggleMic),
          _controlButton(icon: _cameraEnabled ? Icons.videocam_rounded : Icons.videocam_off_rounded, label: 'Camera', active: _cameraEnabled, onTap: _toggleCamera),
          _controlButton(icon: Icons.screen_share_rounded, label: 'Share', active: _screenShareEnabled, onTap: _toggleScreenShare),
          _controlButton(icon: Icons.pan_tool_rounded, label: 'Hand', active: _handRaised, highlight: _handRaised, onTap: _toggleHandRaise),
          _controlButton(icon: Icons.emoji_emotions_outlined, label: 'React', active: _showReactions, onTap: () => setState(() => _showReactions = !_showReactions)),
          _controlButton(icon: Icons.people_outline_rounded, label: 'People', active: _showParticipants, onTap: () => setState(() {
            _showParticipants = !_showParticipants;
            if (_showParticipants) _showChat = false;
          })),
          _controlButton(icon: Icons.chat_bubble_outline_rounded, label: 'Chat', active: _showChat, onTap: () => setState(() {
            _showChat = !_showChat;
            if (_showChat) _showParticipants = false;
          })),
          _controlButton(icon: Icons.call_end_rounded, label: 'Leave', color: Colors.red, onTap: _leaveRoom),
        ],
      ),
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? color,
    bool active = true,
    bool highlight = false,
  }) {
    final btnColor = highlight
        ? Colors.amber
        : color ?? (active ? Colors.white70 : Colors.white38);
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: highlight
                  ? Colors.amber.withOpacity(0.2)
                  : color != null
                      ? color.withOpacity(0.15)
                      : active
                          ? Colors.white.withOpacity(0.08)
                          : Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: btnColor, size: 18),
          ),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(color: btnColor, fontSize: 9, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _ChatMessage {
  final String sender;
  final String text;
  final DateTime time;
  final bool isMe;

  _ChatMessage({required this.sender, required this.text, required this.time, this.isMe = false});
}

class _AnimatedReaction {
  final String emoji;
  final String sender;
  final AnimationController controller;
  final double xPercent;

  _AnimatedReaction({required this.emoji, required this.sender, required this.controller, required this.xPercent});
}
