import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';

/// Horizontally scrollable underline tab bar that mirrors the event-detail
/// pattern: tap to activate, the active tab smoothly centers itself.
///
/// Use this for any tab strip across the app instead of the older
/// `TabBar` + black indicator look or the in-line `_underlineTabs` helpers.
class NuruScrollableTabs extends StatefulWidget {
  final List<String> labels;
  final int activeIndex;
  final ValueChanged<int> onChanged;
  final EdgeInsetsGeometry padding;
  final bool showBottomBorder;

  const NuruScrollableTabs({
    super.key,
    required this.labels,
    required this.activeIndex,
    required this.onChanged,
    this.padding = const EdgeInsets.symmetric(horizontal: 8),
    this.showBottomBorder = true,
  });

  @override
  State<NuruScrollableTabs> createState() => _NuruScrollableTabsState();
}

class _NuruScrollableTabsState extends State<NuruScrollableTabs> {
  final ScrollController _scrollCtrl = ScrollController();
  final List<GlobalKey> _tabKeys = [];

  @override
  void initState() {
    super.initState();
    _ensureKeys();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollActiveIntoView());
  }

  void _ensureKeys() {
    while (_tabKeys.length < widget.labels.length) {
      _tabKeys.add(GlobalKey());
    }
  }

  @override
  void didUpdateWidget(covariant NuruScrollableTabs oldWidget) {
    super.didUpdateWidget(oldWidget);
    _ensureKeys();
    if (oldWidget.activeIndex != widget.activeIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollActiveIntoView());
    }
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollActiveIntoView() {
    if (!mounted || widget.activeIndex >= _tabKeys.length) return;
    final ctx = _tabKeys[widget.activeIndex].currentContext;
    if (ctx == null || !_scrollCtrl.hasClients) return;
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null) return;
    final viewportWidth = _scrollCtrl.position.viewportDimension;
    final tabOffset =
        box.localToGlobal(Offset.zero, ancestor: context.findRenderObject()).dx;
    final tabWidth = box.size.width;
    final currentScroll = _scrollCtrl.offset;
    final tabCenterAbs = currentScroll + tabOffset + tabWidth / 2;
    final target = (tabCenterAbs - viewportWidth / 2).clamp(
      _scrollCtrl.position.minScrollExtent,
      _scrollCtrl.position.maxScrollExtent,
    );
    _scrollCtrl.animateTo(target,
        duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    _ensureKeys();
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: widget.showBottomBorder
            ? const Border(
                bottom: BorderSide(color: AppColors.borderLight, width: 1),
              )
            : null,
      ),
      child: SingleChildScrollView(
        controller: _scrollCtrl,
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: widget.padding,
        child: Row(
          children: List.generate(widget.labels.length, (i) {
            final selected = i == widget.activeIndex;
            return GestureDetector(
              key: _tabKeys[i],
              behavior: HitTestBehavior.opaque,
              onTap: () {
                widget.onChanged(i);
                WidgetsBinding.instance.addPostFrameCallback(
                    (_) => _scrollActiveIntoView());
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: IntrinsicWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.labels[i],
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight:
                              selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected
                              ? AppColors.textPrimary
                              : AppColors.textTertiary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: selected
                              ? AppColors.primary
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
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
