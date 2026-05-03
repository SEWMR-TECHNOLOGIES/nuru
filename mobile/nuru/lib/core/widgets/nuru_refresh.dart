import 'package:flutter/material.dart';
import 'nuru_loader.dart';
import '../theme/app_colors.dart';

/// Branded pull-to-refresh that shows the NuruLoader (3-dot wave) instead of
/// the default circular spinner. Wraps any scrollable child and triggers
/// [onRefresh] when the user pulls past [triggerDistance].
class NuruRefresh extends StatefulWidget {
  final Future<void> Function() onRefresh;
  final Widget child;
  final double triggerDistance;

  const NuruRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
    this.triggerDistance = 80,
  });

  @override
  State<NuruRefresh> createState() => _NuruRefreshState();
}

class _NuruRefreshState extends State<NuruRefresh>
    with SingleTickerProviderStateMixin {
  double _drag = 0;
  bool _refreshing = false;

  bool _onNotification(ScrollNotification n) {
    if (_refreshing) return false;

    if (n is OverscrollNotification && n.metrics.pixels <= 0) {
      setState(() {
        _drag = (_drag - n.overscroll * 0.5)
            .clamp(0.0, widget.triggerDistance * 1.4);
      });
      return true;
    }

    if (n is ScrollUpdateNotification && n.metrics.pixels < 0 && _drag > 0) {
      setState(() {
        _drag = (-n.metrics.pixels).clamp(0.0, widget.triggerDistance * 1.4);
      });
      return false;
    }

    if (n is ScrollEndNotification) {
      if (_drag >= widget.triggerDistance) {
        _trigger();
      } else if (_drag > 0) {
        setState(() => _drag = 0);
      }
    }
    return false;
  }

  Future<void> _trigger() async {
    setState(() {
      _refreshing = true;
      _drag = widget.triggerDistance;
    });
    try {
      await widget.onRefresh();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _refreshing = false;
      _drag = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_drag / widget.triggerDistance).clamp(0.0, 1.0);
    final showIndicator = _drag > 4 || _refreshing;

    return Stack(
      children: [
        NotificationListener<ScrollNotification>(
          onNotification: _onNotification,
          child: widget.child,
        ),
        if (showIndicator)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                height: _refreshing
                    ? widget.triggerDistance * 0.85
                    : (_drag * 0.85),
                alignment: Alignment.center,
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 120),
                  opacity: _refreshing ? 1.0 : progress,
                  child: _refreshing
                      ? const NuruLoader(size: 56, inline: true)
                      : Transform.rotate(
                          angle: progress * 3.14,
                          child: Container(
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.primary
                                    .withOpacity(0.3 + 0.7 * progress),
                                width: 2.5,
                              ),
                            ),
                          ),
                        ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
