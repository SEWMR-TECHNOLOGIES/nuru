library;

import 'package:flutter/material.dart';

/// NuruSkeleton — modern shimmer skeleton loaders used across data-loading
/// screens. Provides primitive boxes plus a set of curated presets (list
/// tile, event card, grid tile, profile header, stat tiles, message row)
/// so every screen feels coherent.
///
/// Usage:
///   const NuruSkeletonList(itemCount: 6) // ready-made list skeleton
///   const NuruSkeletonEventList()        // event-card list
///   NuruSkeleton.box(height: 12, width: 120)
///   NuruSkeleton.text(width: 160)
///   NuruSkeleton.circle(size: 40)
///
/// Wrap a complex layout in NuruSkeletonGroup to share a single shimmer
/// animation controller across many child boxes (cheaper than many tickers).

const Color _kBase = Color(0xFFE8ECF1);
const Color _kHighlight = Color(0xFFF5F7FA);

/// Shared shimmer ticker provided to descendant boxes.
class NuruSkeletonGroup extends StatefulWidget {
  final Widget child;
  const NuruSkeletonGroup({super.key, required this.child});

  @override
  State<NuruSkeletonGroup> createState() => _NuruSkeletonGroupState();
}

class _NuruSkeletonGroupState extends State<NuruSkeletonGroup>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _SkeletonScope(controller: _ctrl, child: widget.child);
}

class _SkeletonScope extends InheritedWidget {
  final AnimationController controller;
  const _SkeletonScope({required this.controller, required super.child});

  static AnimationController? maybeOf(BuildContext c) =>
      c.dependOnInheritedWidgetOfExactType<_SkeletonScope>()?.controller;

  @override
  bool updateShouldNotify(_SkeletonScope old) => old.controller != controller;
}

/// A single shimmer block. Use the named constructors for common shapes.
class NuruSkeleton extends StatefulWidget {
  final double? width;
  final double height;
  final BorderRadius borderRadius;

  const NuruSkeleton({
    super.key,
    this.width,
    this.height = 12,
    this.borderRadius = const BorderRadius.all(Radius.circular(6)),
  });

  /// Rectangular block.
  factory NuruSkeleton.box({
    double? width,
    double height = 80,
    double radius = 12,
  }) => NuruSkeleton(
    width: width,
    height: height,
    borderRadius: BorderRadius.circular(radius),
  );

  /// Single text line. Default 12px tall, 4px radius.
  factory NuruSkeleton.text({double? width, double height = 12}) =>
      NuruSkeleton(
        width: width,
        height: height,
        borderRadius: BorderRadius.circular(4),
      );

  /// Circular avatar/icon placeholder.
  factory NuruSkeleton.circle({double size = 40}) => NuruSkeleton(
    width: size,
    height: size,
    borderRadius: BorderRadius.circular(size),
  );

  @override
  State<NuruSkeleton> createState() => _NuruSkeletonState();
}

class _NuruSkeletonState extends State<NuruSkeleton>
    with SingleTickerProviderStateMixin {
  AnimationController? _local;

  AnimationController _resolve(BuildContext c) {
    final shared = _SkeletonScope.maybeOf(c);
    if (shared != null) return shared;
    _local ??= AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    return _local!;
  }

  @override
  void dispose() {
    _local?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = _resolve(context);
    return AnimatedBuilder(
      animation: ctrl,
      builder: (_, __) {
        final t = ctrl.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius,
            gradient: LinearGradient(
              begin: Alignment(-1.0 + 2.0 * t, 0),
              end: Alignment(-0.3 + 2.0 * t, 0),
              colors: const [_kBase, _kHighlight, _kBase],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        );
      },
    );
  }
}

/// List of avatar + 2-line text rows. Great for follow lists, contributors,
/// messages, groups, issues, communities, circles, payment history, etc.
class NuruSkeletonList extends StatelessWidget {
  final int itemCount;
  final EdgeInsets padding;
  final bool showAvatar;
  final bool showTrailing;

  const NuruSkeletonList({
    super.key,
    this.itemCount = 6,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 24),
    this.showAvatar = true,
    this.showTrailing = false,
  });

  @override
  Widget build(BuildContext context) {
    return NuruSkeletonGroup(
      child: ListView.separated(
        padding: padding,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (_, __) => Row(
          children: [
            if (showAvatar) ...[
              NuruSkeleton.circle(size: 44),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NuruSkeleton.text(width: 140, height: 12),
                  const SizedBox(height: 8),
                  NuruSkeleton.text(width: 200, height: 10),
                ],
              ),
            ),
            if (showTrailing) ...[
              const SizedBox(width: 12),
              NuruSkeleton.box(width: 60, height: 28, radius: 8),
            ],
          ],
        ),
      ),
    );
  }
}

/// Vertical list of event-style cards: cover + title + meta line + chip.
class NuruSkeletonEventList extends StatelessWidget {
  final int itemCount;
  final EdgeInsets padding;
  const NuruSkeletonEventList({
    super.key,
    this.itemCount = 4,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 24),
  });

  @override
  Widget build(BuildContext context) {
    return NuruSkeletonGroup(
      child: ListView.separated(
        padding: padding,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (_, __) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF0F0F4)),
          ),
          child: Row(
            children: [
              NuruSkeleton.box(width: 64, height: 64, radius: 14),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    NuruSkeleton.text(width: 160, height: 13),
                    const SizedBox(height: 10),
                    NuruSkeleton.text(width: 110, height: 10),
                    const SizedBox(height: 8),
                    NuruSkeleton.text(width: 80, height: 10),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              NuruSkeleton.box(width: 54, height: 22, radius: 8),
            ],
          ),
        ),
      ),
    );
  }
}

/// Grid of square cover + 2 caption lines. Photos, moments, tickets, services.
class NuruSkeletonGrid extends StatelessWidget {
  final int itemCount;
  final int crossAxisCount;
  final EdgeInsets padding;
  final double aspectRatio;
  final bool showCaption;

  const NuruSkeletonGrid({
    super.key,
    this.itemCount = 6,
    this.crossAxisCount = 2,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 24),
    this.aspectRatio = 0.82,
    this.showCaption = true,
  });

  @override
  Widget build(BuildContext context) {
    return NuruSkeletonGroup(
      child: GridView.builder(
        padding: padding,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          childAspectRatio: aspectRatio,
        ),
        itemBuilder: (_, __) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: NuruSkeleton.box(radius: 16, height: double.infinity),
            ),
            if (showCaption) ...[
              const SizedBox(height: 10),
              NuruSkeleton.text(width: 110, height: 11),
              const SizedBox(height: 6),
              NuruSkeleton.text(width: 70, height: 10),
            ],
          ],
        ),
      ),
    );
  }
}

/// Profile header skeleton: avatar, name, handle, stats strip.
class NuruSkeletonProfileHeader extends StatelessWidget {
  const NuruSkeletonProfileHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return NuruSkeletonGroup(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                NuruSkeleton.circle(size: 72),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NuruSkeleton.text(width: 160, height: 16),
                      const SizedBox(height: 10),
                      NuruSkeleton.text(width: 110, height: 11),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            NuruSkeleton.box(height: 56, radius: 14),
            const SizedBox(height: 16),
            NuruSkeleton.text(width: 220, height: 10),
            const SizedBox(height: 6),
            NuruSkeleton.text(width: 180, height: 10),
          ],
        ),
      ),
    );
  }
}

/// Horizontal row of stat tiles (e.g. 4 KPI cards).
class NuruSkeletonStats extends StatelessWidget {
  final int count;
  final EdgeInsets padding;
  const NuruSkeletonStats({
    super.key,
    this.count = 4,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 8),
  });

  @override
  Widget build(BuildContext context) {
    return NuruSkeletonGroup(
      child: Padding(
        padding: padding,
        child: Row(
          children: List.generate(count, (i) {
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: i == count - 1 ? 0 : 10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF0F0F4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NuruSkeleton.text(width: 40, height: 10),
                      const SizedBox(height: 10),
                      NuruSkeleton.text(width: 60, height: 16),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

/// Chat / message skeleton with alternating bubble sides.
class NuruSkeletonMessages extends StatelessWidget {
  final int itemCount;
  const NuruSkeletonMessages({super.key, this.itemCount = 6});

  @override
  Widget build(BuildContext context) {
    return NuruSkeletonGroup(
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (_, i) {
          final mine = i.isOdd;
          return Row(
            mainAxisAlignment: mine
                ? MainAxisAlignment.end
                : MainAxisAlignment.start,
            children: [
              NuruSkeleton.box(
                width: 180 + (i % 3) * 30.0,
                height: 44,
                radius: 16,
              ),
            ],
          );
        },
      ),
    );
  }
}
