/// In-memory cache for event group workspace + chat so re-opening a group
/// is instant. Mirrors the messages cache pattern.
class EventGroupsCache {
  EventGroupsCache._();

  // My-groups list cache
  static List<dynamic>? groups;

  // Pinned group ids (process lifetime)
  static final Set<String> _pinned = <String>{};
  static bool isPinned(String id) => _pinned.contains(id);
  static void togglePin(String id) {
    if (!_pinned.remove(id)) _pinned.add(id);
  }

  // groupId -> group meta from getGroup
  static final Map<String, Map<String, dynamic>> _group = {};
  // groupId -> members list
  static final Map<String, List<dynamic>> _members = {};
  // groupId -> chat messages
  static final Map<String, List<dynamic>> _messages = {};

  static Map<String, dynamic>? getGroup(String id) => _group[id];
  static void putGroup(String id, Map<String, dynamic> g) => _group[id] = g;

  static List<dynamic>? getMembers(String id) => _members[id];
  static void putMembers(String id, List<dynamic> m) => _members[id] = List<dynamic>.from(m);

  static List<dynamic>? getMessages(String id) => _messages[id];
  static void putMessages(String id, List<dynamic> m) => _messages[id] = List<dynamic>.from(m);

  static void reset() {
    _group.clear();
    _members.clear();
    _messages.clear();
  }
}
