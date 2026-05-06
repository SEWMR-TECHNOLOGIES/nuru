import 'package:flutter/material.dart';
import 'nuru_loader.dart';

/// Drop-in replacement for [RefreshIndicator] that renders the branded
/// NuruLoader (3-dot wave) instead of the default circular spinner.
///
/// API surface mirrors the most common parameters used across the app so the
/// migration is a simple class-name swap. Unsupported visual parameters
/// (color, backgroundColor, strokeWidth, etc.) are accepted and ignored.
class NuruRefreshIndicator extends StatefulWidget {
  final Future<void> Function() onRefresh;
  final Widget child;
  final double displacement;
  final double edgeOffset;

  // Accepted for API compatibility, intentionally ignored.
  final Color? color;
  final Color? backgroundColor;
  final double? strokeWidth;
  final RefreshIndicatorTriggerMode triggerMode;
  final bool Function(ScrollNotification)? notificationPredicate;

  const NuruRefreshIndicator({
    super.key,
    required this.onRefresh,
    required this.child,
    this.displacement = 40.0,
    this.edgeOffset = 0.0,
    this.color,
    this.backgroundColor,
    this.strokeWidth,
    this.triggerMode = RefreshIndicatorTriggerMode.onEdge,
    this.notificationPredicate,
  });

  @override
  State<NuruRefreshIndicator> createState() => _NuruRefreshIndicatorState();
}

class _NoGlowBehavior extends ScrollBehavior {
  const _NoGlowBehavior();
  @override
  Widget buildOverscrollIndicator(
      BuildContext context, Widget child, ScrollableDetails details) {
    return child;
  }
}

class _NuruRefreshIndicatorState extends State<NuruRefreshIndicator> {
  bool _refreshing = false;

  Future<void> _handle() async {
    if (mounted) setState(() => _refreshing = true);
    try {
      await widget.onRefresh();
    } catch (_) {}
    if (mounted) setState(() => _refreshing = false);
  }

  @override
  Widget build(BuildContext context) {
    return ScrollConfiguration(
      behavior: const _NoGlowBehavior(),
      child: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _handle,
            // Make the default spinner invisible — we render our own.
            color: Colors.transparent,
            backgroundColor: Colors.transparent,
            elevation: 0,
            strokeWidth: 0.0001,
            displacement: widget.displacement,
            edgeOffset: widget.edgeOffset,
            triggerMode: widget.triggerMode,
            notificationPredicate: widget.notificationPredicate ??
                defaultScrollNotificationPredicate,
            child: widget.child,
          ),
          if (_refreshing)
            Positioned(
              top: widget.edgeOffset + widget.displacement,
              left: 0,
              right: 0,
              child: const IgnorePointer(
                child: Center(
                  child: NuruLoader(size: 48, inline: true),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
