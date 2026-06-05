import 'package:flutter/foundation.dart';

/// Global notifier that fires when the backend returns 429.
/// Listened to by [RateLimitOverlay] mounted at the root of the app.
class RateLimitEvent {
  final int retryAfterSeconds;
  final bool isAuth;
  final String? message;

  const RateLimitEvent({
    required this.retryAfterSeconds,
    required this.isAuth,
    this.message,
  });
}

class RateLimitNotifier extends ValueNotifier<RateLimitEvent?> {
  RateLimitNotifier() : super(null);

  static final RateLimitNotifier instance = RateLimitNotifier();

  void trigger({required int retryAfter, required bool isAuth, String? message}) {
    final clamped = retryAfter.clamp(1, 600);
    value = RateLimitEvent(
      retryAfterSeconds: clamped,
      isAuth: isAuth,
      message: message,
    );
  }

  void clear() {
    value = null;
  }
}
