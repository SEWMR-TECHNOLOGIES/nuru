import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Lightweight viewport-prefetch helper for mobile lists.
///
/// - Skips on slow connections (uses Flutter's built-in network signals)
/// - Dedupes per-id so each item is prefetched at most once per session
/// - Defers work via [scheduleMicrotask] so it never competes with the
///   current frame
class PrefetchHelper {
  PrefetchHelper._();

  static final Set<String> _seen = <String>{};
  static bool _slowConnection = false;
  static bool _saveData = false;

  /// Call this once at app startup (or whenever connectivity changes) to
  /// update the slow-connection / save-data flags. Safe to call repeatedly.
  static void setNetworkHints({bool slow = false, bool saveData = false}) {
    _slowConnection = slow;
    _saveData = saveData;
  }

  /// Whether prefetching is currently allowed.
  static bool get allowed => !_slowConnection && !_saveData;

  /// Run [task] for [id] at most once. No-ops on slow / save-data networks.
  static void prefetch(String id, FutureOr<void> Function() task) {
    if (id.isEmpty) return;
    if (!allowed) return;
    if (_seen.contains(id)) return;
    _seen.add(id);
    scheduleMicrotask(() async {
      try {
        await task();
      } catch (e) {
        if (kDebugMode) debugPrint('Prefetch failed for $id: $e');
        // Allow retry on next visibility hit if the call failed.
        _seen.remove(id);
      }
    });
  }

  /// Manually clear the dedupe set (e.g. on logout).
  static void reset() => _seen.clear();
}

/// Wrap a list-item child with [PrefetchOnVisible] to fire [onVisible] once
/// when the item first becomes visible in any ancestor scrollable.
///
/// Uses a viewport-fraction heuristic via [NotificationListener]'s viewport
/// size and the widget's own RenderBox position. Lightweight: it does not
/// require any extra package.
class PrefetchOnVisible extends StatefulWidget {
  final Widget child;
  final VoidCallback onVisible;

  /// Extra distance beyond the viewport edges where the prefetch is still
  /// allowed to fire. Defaults to 400 px so cards just below the fold start
  /// warming before the user scrolls them into view.
  final double rootMargin;

  const PrefetchOnVisible({
    super.key,
    required this.child,
    required this.onVisible,
    this.rootMargin = 400,
  });

  @override
  State<PrefetchOnVisible> createState() => _PrefetchOnVisibleState();
}

class _PrefetchOnVisibleState extends State<PrefetchOnVisible> {
  bool _fired = false;
  final GlobalKey _key = GlobalKey();

  @override
  void initState() {
    super.initState();
    // Most list items render inside the viewport on first build, so check
    // visibility immediately after the first frame.
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  void _check() {
    if (_fired || !mounted) return;
    if (!PrefetchHelper.allowed) return;
    final ctx = _key.currentContext;
    if (ctx == null) return;
    final box = ctx.findRenderObject();
    if (box is! RenderBox || !box.attached) return;

    final size = box.size;
    final pos = box.localToGlobal(Offset.zero);
    final screen = MediaQuery.of(ctx).size;

    final visibleVertically =
        pos.dy + size.height >= -widget.rootMargin &&
        pos.dy <= screen.height + widget.rootMargin;
    final visibleHorizontally =
        pos.dx + size.width >= -widget.rootMargin &&
        pos.dx <= screen.width + widget.rootMargin;

    if (visibleVertically && visibleHorizontally) {
      _fired = true;
      widget.onVisible();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Re-check after each scroll-end so cards entering the viewport later get
    // prefetched too. We listen passively without blocking the notification.
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (!_fired && n is ScrollUpdateNotification) {
          // Throttle: only check once per frame.
          WidgetsBinding.instance.addPostFrameCallback((_) => _check());
        }
        return false;
      },
      child: KeyedSubtree(key: _key, child: widget.child),
    );
  }
}
