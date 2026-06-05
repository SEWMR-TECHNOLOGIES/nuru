import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/text_styles.dart';

class LegalSection {
  final String title;
  final String body;
  const LegalSection(this.title, this.body);
}

/// Modern document layout used by Terms, Privacy and Licenses.
///
/// - Gradient hero with title, subtitle and last-updated badge
/// - Sticky scrolling chip-based table of contents
/// - Numbered sections with anchor scrolling
class LegalDocLayout extends StatefulWidget {
  final String title;
  final String subtitle;
  final String lastUpdated;
  /// SVG asset path for the hero badge icon.
  final String heroIconAsset;
  final List<LegalSection> sections;
  final Widget? footer;

  const LegalDocLayout({
    super.key,
    required this.title,
    required this.subtitle,
    required this.lastUpdated,
    required this.sections,
    this.heroIconAsset = 'assets/icons/info-icon.svg',
    this.footer,
  });

  @override
  State<LegalDocLayout> createState() => _LegalDocLayoutState();
}

class _LegalDocLayoutState extends State<LegalDocLayout> {
  late final List<GlobalKey> _keys;
  final ScrollController _scroll = ScrollController();
  int _active = 0;

  @override
  void initState() {
    super.initState();
    _keys = List.generate(widget.sections.length, (_) => GlobalKey());
    _scroll.addListener(_updateActive);
  }

  void _updateActive() {
    for (int i = _keys.length - 1; i >= 0; i--) {
      final ctx = _keys[i].currentContext;
      if (ctx == null) continue;
      final box = ctx.findRenderObject() as RenderBox?;
      if (box == null) continue;
      final pos = box.localToGlobal(Offset.zero).dy;
      if (pos < 200) {
        if (_active != i) setState(() => _active = i);
        return;
      }
    }
  }

  Future<void> _scrollTo(int i) async {
    final ctx = _keys[i].currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      alignment: 0.05,
    );
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Header bar
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 16, 6),
              child: Row(children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: SvgPicture.asset(
                    'assets/icons/chevron-left-icon.svg',
                    width: 22, height: 22,
                    colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
                  ),
                ),
                Expanded(
                  child: Text(widget.title,
                      style: appText(size: 16, weight: FontWeight.w700)),
                ),
              ]),
            ),
            // Sticky underline tabs (matches event details design)
            _UnderlineTOC(
              titles: [for (final s in widget.sections) s.title],
              active: _active,
              onTap: _scrollTo,
            ),
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                children: [
                  // Hero
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF1A1A2E), Color(0xFF16213E)],
                      ),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: SvgPicture.asset(
                              widget.heroIconAsset,
                              width: 22, height: 22,
                              colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(widget.title,
                            style: appText(size: 22, weight: FontWeight.w800, color: Colors.white)),
                        const SizedBox(height: 6),
                        Text(widget.subtitle,
                            style: appText(size: 13, color: Colors.white70, height: 1.45)),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            SvgPicture.asset(
                              'assets/icons/clock-icon.svg',
                              width: 13, height: 13,
                              colorFilter: const ColorFilter.mode(Colors.white70, BlendMode.srcIn),
                            ),
                            const SizedBox(width: 5),
                            Text('Last updated ${widget.lastUpdated}',
                                style: appText(size: 11, color: Colors.white70, weight: FontWeight.w600)),
                          ]),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  for (int i = 0; i < widget.sections.length; i++)
                    Container(
                      key: _keys[i],
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            Container(
                              width: 28,
                              height: 28,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: AppColors.primarySoft,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text('${i + 1}',
                                  style: appText(size: 12, weight: FontWeight.w800, color: AppColors.primary)),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(widget.sections[i].title,
                                  style: appText(size: 15, weight: FontWeight.w700, color: AppColors.textPrimary)),
                            ),
                          ]),
                          const SizedBox(height: 10),
                          Text(widget.sections[i].body,
                              style: appText(size: 13, color: AppColors.textSecondary, height: 1.65)),
                        ],
                      ),
                    ),
                  if (widget.footer != null) widget.footer!,
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UnderlineTOC extends StatefulWidget {
  final List<String> titles;
  final int active;
  final ValueChanged<int> onTap;
  const _UnderlineTOC({required this.titles, required this.active, required this.onTap});
  @override
  State<_UnderlineTOC> createState() => _UnderlineTOCState();
}

class _UnderlineTOCState extends State<_UnderlineTOC> {
  final ScrollController _scrollCtrl = ScrollController();
  final List<GlobalKey> _tabKeys = [];

  void _ensureKeys() {
    while (_tabKeys.length < widget.titles.length) _tabKeys.add(GlobalKey());
  }

  @override
  void didUpdateWidget(covariant _UnderlineTOC old) {
    super.didUpdateWidget(old);
    if (old.active != widget.active) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollActiveIntoView());
    }
  }

  void _scrollActiveIntoView() {
    if (!mounted || widget.active >= _tabKeys.length) return;
    final ctx = _tabKeys[widget.active].currentContext;
    if (ctx == null || !_scrollCtrl.hasClients) return;
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null) return;
    final viewportWidth = _scrollCtrl.position.viewportDimension;
    final tabOffset = box.localToGlobal(Offset.zero, ancestor: context.findRenderObject()).dx;
    final target = (_scrollCtrl.offset + tabOffset + box.size.width / 2 - viewportWidth / 2)
        .clamp(_scrollCtrl.position.minScrollExtent, _scrollCtrl.position.maxScrollExtent);
    _scrollCtrl.animateTo(target, duration: const Duration(milliseconds: 280), curve: Curves.easeOut);
  }

  @override
  void dispose() { _scrollCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    _ensureKeys();
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.borderLight, width: 1)),
      ),
      child: SingleChildScrollView(
        controller: _scrollCtrl,
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          children: List.generate(widget.titles.length, (i) {
            final selected = i == widget.active;
            return GestureDetector(
              key: _tabKeys[i],
              behavior: HitTestBehavior.opaque,
              onTap: () => widget.onTap(i),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: IntrinsicWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.titles[i],
                        textAlign: TextAlign.center,
                        style: appText(
                          size: 13,
                          weight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: selected ? AppColors.textPrimary : AppColors.textTertiary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: selected ? AppColors.primary : Colors.transparent,
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
