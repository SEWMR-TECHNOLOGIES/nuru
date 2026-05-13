/// In-memory cache for the Event Groups list so re-opening the screen feels
/// instant (WhatsApp-style). Refreshed silently in the background.
class EventGroupsCache {
  EventGroupsCache._();

  static List<dynamic>? groups;
  static final Set<String> _pinned = <String>{};

  static Set<String> get pinned => _pinned;

  static bool isPinned(String id) => _pinned.contains(id);

  static void togglePin(String id) {
    if (_pinned.contains(id)) {
      _pinned.remove(id);
    } else {
      _pinned.add(id);
    }
  }

  static void seedPinned(Iterable<String> ids) {
    _pinned
      ..clear()
      ..addAll(ids);
  }

  static void reset() {
    groups = null;
    _pinned.clear();
  }
}
