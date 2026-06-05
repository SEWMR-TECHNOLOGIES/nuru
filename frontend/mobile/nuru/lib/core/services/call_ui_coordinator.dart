class CallUiCoordinator {
  CallUiCoordinator._();

  static final Set<String> _ringingScreens = <String>{};
  static final Set<String> _activeScreens = <String>{};

  static bool showRinging(String callId) => _ringingScreens.add(callId);

  static void closeRinging(String callId) => _ringingScreens.remove(callId);

  static bool openActive(String callId) {
    _ringingScreens.remove(callId);
    return _activeScreens.add(callId);
  }

  static void closeActive(String callId) => _activeScreens.remove(callId);

  static bool isRinging(String callId) => _ringingScreens.contains(callId);

  static void reset() {
    _ringingScreens.clear();
    _activeScreens.clear();
  }
}