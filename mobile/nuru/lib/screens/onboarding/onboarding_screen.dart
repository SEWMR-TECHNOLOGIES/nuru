import 'dart:math' show min, pi, cos, sin, sqrt;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_logo.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _page = 0;

  late final AnimationController _textController;

  static const _titles = [
    'Plan events\nall in one place',
    'Every event type\none platform',
    'Explore and manage\nyour events',
  ];

  static const _subtitles = [
    'Manage vendors, contributions, invitations, and RSVPs from one premium workspace.',
    'Weddings, corporate, birthdays, memorials, and more. Nuru handles them all seamlessly.',
    'Tickets, guests, budgets, and insights, everything neatly organized. Start planning with confidence.',
  ];

  @override
  void initState() {
    super.initState();
    _textController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    )..forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _textController.dispose();
    super.dispose();
  }

  void _onPageChanged(int page) {
    setState(() => _page = page);
    _textController
      ..reset()
      ..forward();
  }

  void _skip() {
    context.read<AuthProvider>().completeOnboarding();
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 350),
        pageBuilder: (_, a, __) => const LoginScreen(),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: a, child: child),
      ),
    );
  }

  void _next() {
    if (_page < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
      return;
    }
    _skip();
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _page == 2;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: const Color(0xFFE8EEF5),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EEF5),
        body: SafeArea(
          child: LayoutBuilder(
            builder: (context, box) {
              final hp = box.maxWidth < 360 ? 18.0 : 24.0;

              return Column(
                children: [
                  // ── Top bar: logo only + skip ──
                  Padding(
                    padding: EdgeInsets.fromLTRB(hp, 8, hp, 0),
                    child: SizedBox(
                      height: 44,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const Center(child: NuruLogo(size: 22)),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: _skip,
                              style: TextButton.styleFrom(
                                foregroundColor: AppColors.textTertiary,
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                minimumSize: const Size(52, 36),
                              ),
                              child: Text('Skip',
                                  style: _font(size: 13, weight: FontWeight.w600)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Pages ──
                  Expanded(
                    child: PageView.builder(
                      controller: _pageController,
                      itemCount: 3,
                      onPageChanged: _onPageChanged,
                      itemBuilder: (_, index) => _OnboardingPage(
                        index: index,
                        title: _titles[index],
                        subtitle: _subtitles[index],
                        textController: _textController,
                      ),
                    ),
                  ),

                  // ── Dots ──
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _DotRow(activeIndex: _page),
                  ),

                  // ── CTA ──
                  Padding(
                    padding: EdgeInsets.fromLTRB(hp, 0, hp, 14),
                    child: SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: ElevatedButton(
                        onPressed: _next,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        child: Text(
                          isLast ? 'Get Started' : 'Next',
                          style: _font(
                              size: 17,
                              weight: FontWeight.w700,
                              color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page wrapper
// ─────────────────────────────────────────────────────────────────────────────

class _OnboardingPage extends StatelessWidget {
  final int index;
  final String title;
  final String subtitle;
  final AnimationController textController;

  const _OnboardingPage({
    required this.index,
    required this.title,
    required this.subtitle,
    required this.textController,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final hp = box.maxWidth < 360 ? 18.0 : 24.0;
        final titleSize = (box.maxHeight * 0.05).clamp(26.0, 38.0);
        final subtitleSize = (box.maxHeight * 0.021).clamp(13.0, 16.0);

        return Padding(
          padding: EdgeInsets.symmetric(horizontal: hp),
          child: Column(
            children: [
              SizedBox(height: box.maxHeight * 0.01),
              // Scene takes ~55% of available height
              Flexible(
                flex: 55,
                child: _sceneByIndex(index),
              ),
              SizedBox(height: box.maxHeight * 0.02),
              // Text takes ~40%
              Flexible(
                flex: 40,
                child: FadeTransition(
                  opacity: CurvedAnimation(
                    parent: textController,
                    curve: Curves.easeOut,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          textAlign: TextAlign.center,
                          style: _font(
                            size: titleSize,
                            weight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            height: 1.1,
                            letterSpacing: -0.6,
                          ),
                        ),
                      ),
                      SizedBox(height: box.maxHeight * 0.018),
                      Flexible(
                        child: Text(
                          subtitle,
                          textAlign: TextAlign.center,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: _font(
                            size: subtitleSize,
                            weight: FontWeight.w500,
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: box.maxHeight * 0.01),
            ],
          ),
        );
      },
    );
  }

  Widget _sceneByIndex(int i) {
    switch (i) {
      case 0:
        return const _WorkspaceScene();
      case 1:
        return const _MultiEventScene();
      case 2:
        return const _TicketsScene();
      default:
        return const SizedBox.shrink();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — Stacked cards (like reference: rotated card stack with CTA chip)
// ─────────────────────────────────────────────────────────────────────────────

class _WorkspaceScene extends StatefulWidget {
  const _WorkspaceScene();

  @override
  State<_WorkspaceScene> createState() => _WorkspaceSceneState();
}

class _WorkspaceSceneState extends State<_WorkspaceScene> {
  int _frontIndex = 2; // Start with Vendors (front card) on top

  // Card order: index 0 = back-most, index 2 = front-most
  static const _cardConfigs = [
    _CardConfig('Contributions', 'Track & manage', 'assets/images/onboarding_contributions.png'),
    _CardConfig('Invitations', 'Send & track RSVPs', 'assets/images/onboarding_invitations.png'),
    _CardConfig('Vendors', 'Discover & book', 'assets/images/onboarding_vendors.png'),
  ];

  void _swipeNext() {
    setState(() => _frontIndex = (_frontIndex + 1) % _cardConfigs.length);
  }

  void _swipePrev() {
    setState(() => _frontIndex = (_frontIndex - 1 + _cardConfigs.length) % _cardConfigs.length);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final sceneW = box.maxWidth;
        final sceneH = box.maxHeight;
        final cardW = (sceneW * 0.62).clamp(160.0, 260.0);
        final cardH = (cardW * 1.15).clamp(180.0, 300.0);

        // Build the 3 card positions with rotation/offset
        final positions = [
          // Back card (rotated left)
          _CardPosition(
            left: sceneW * 0.08,
            top: sceneH * 0.12,
            angle: -0.18,
            color: const Color(0xFFD5DEE8),
            highlighted: false,
            chipText: null,
          ),
          // Middle card (slight rotation)
          _CardPosition(
            left: sceneW * 0.14,
            top: sceneH * 0.06,
            angle: -0.06,
            color: const Color(0xFFE4EAF1),
            highlighted: false,
            chipText: null,
          ),
          // Front card (prominent)
          _CardPosition(
            right: sceneW * 0.06,
            top: sceneH * 0.03,
            angle: 0.06,
            color: Colors.white,
            highlighted: true,
            chipText: 'View Details',
          ),
        ];

        // Map card configs to positions based on _frontIndex
        final orderedCards = <Widget>[];
        for (int posIdx = 0; posIdx < 3; posIdx++) {
          // posIdx 0 = back, 1 = middle, 2 = front
          final cardIdx = (_frontIndex - 2 + posIdx + _cardConfigs.length * 2) % _cardConfigs.length;
          final card = _cardConfigs[cardIdx];
          final pos = positions[posIdx];

          orderedCards.add(
            AnimatedPositioned(
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeOutCubic,
              left: pos.left,
              right: pos.right,
              top: pos.top,
              child: AnimatedRotation(
                turns: pos.angle / (2 * pi),
                duration: const Duration(milliseconds: 350),
                curve: Curves.easeOutCubic,
                child: _StackedCard(
                  width: cardW,
                  height: cardH,
                  color: pos.color,
                  label: card.label,
                  sublabel: card.sublabel,
                  highlighted: pos.highlighted,
                  chipText: pos.chipText,
                  backgroundImage: card.image,
                ),
              ),
            ),
          );
        }

        return GestureDetector(
          onHorizontalDragEnd: (details) {
            if (details.primaryVelocity != null) {
              if (details.primaryVelocity! < -100) {
                _swipeNext();
              } else if (details.primaryVelocity! > 100) {
                _swipePrev();
              }
            }
          },
          child: Center(
            child: SizedBox(
              width: sceneW,
              height: sceneH,
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: orderedCards,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CardConfig {
  final String label;
  final String sublabel;
  final String image;
  const _CardConfig(this.label, this.sublabel, this.image);
}

class _CardPosition {
  final double? left;
  final double? right;
  final double top;
  final double angle;
  final Color color;
  final bool highlighted;
  final String? chipText;

  const _CardPosition({
    this.left,
    this.right,
    required this.top,
    required this.angle,
    required this.color,
    required this.highlighted,
    this.chipText,
  });
}

class _StackedCard extends StatelessWidget {
  final double width;
  final double height;
  final Color color;
  final String label;
  final String sublabel;
  final bool highlighted;
  final String? chipText;
  final String? backgroundImage;

  const _StackedCard({
    required this.width,
    required this.height,
    required this.color,
    required this.label,
    required this.sublabel,
    this.highlighted = false,
    this.chipText,
    this.backgroundImage,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: highlighted
              ? AppColors.border.withOpacity(0.4)
              : AppColors.border.withOpacity(0.25),
          width: 0.7,
        ),
        boxShadow: highlighted
            ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Stack(
          children: [
            if (backgroundImage != null)
              Positioned.fill(
                child: Opacity(
                  opacity: 0.35,
                  child: Image.asset(
                    backgroundImage!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              ),
            Padding(
              padding: EdgeInsets.all(width * 0.08),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset(
                      'assets/images/nuru-logo-square.png',
                      width: (width * 0.14).clamp(24.0, 40.0),
                      height: (width * 0.14).clamp(24.0, 40.0),
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: (width * 0.14).clamp(24.0, 40.0),
                        height: (width * 0.14).clamp(24.0, 40.0),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    label,
                    style: _font(
                      size: (width * 0.08).clamp(14.0, 20.0),
                      weight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  SizedBox(height: height * 0.01),
                  Text(
                    sublabel,
                    style: _font(
                      size: (width * 0.052).clamp(10.0, 13.0),
                      weight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (chipText != null) ...[
                    SizedBox(height: height * 0.04),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: (width * 0.06).clamp(10.0, 16.0),
                        vertical: (height * 0.025).clamp(6.0, 10.0),
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A2E),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        chipText!,
                        style: _font(
                          size: (width * 0.048).clamp(9.0, 12.0),
                          weight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — Profile-style rows (like reference: avatar + name + follow)
// Adapted for Nuru: event feature rows without specific event type names
// ─────────────────────────────────────────────────────────────────────────────

class _MultiEventScene extends StatelessWidget {
  const _MultiEventScene();

  @override
  Widget build(BuildContext context) {
    final features = [
      _FeatureRow(
        label: 'Vendor Management',
        sub: '2,400+ vendors',
        highlighted: false,
      ),
      _FeatureRow(
        label: 'Event Planning',
        sub: 'All event types',
        highlighted: true,
      ),
      _FeatureRow(
        label: 'Guest Management',
        sub: 'Unlimited guests',
        highlighted: false,
      ),
    ];

    return LayoutBuilder(
      builder: (context, box) {
        final cardW = min(box.maxWidth * 0.9, 360.0);

        return Center(
          child: SizedBox(
            width: cardW,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Tilted badge
                Align(
                  alignment: Alignment.centerRight,
                  child: Transform.rotate(
                    angle: 0.1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.06),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        'Unlimited Events',
                        style: _font(
                            size: 10,
                            weight: FontWeight.w700,
                            color: AppColors.textPrimary),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Feature rows
                ...List.generate(features.length, (i) {
                  final f = features[i];
                  return Padding(
                    padding: EdgeInsets.only(bottom: i < features.length - 1 ? 10 : 0),
                    child: _EventFeatureCard(
                      label: f.label,
                      sub: f.sub,
                      highlighted: f.highlighted,
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _FeatureRow {
  final String label;
  final String sub;
  final bool highlighted;

  const _FeatureRow({
    required this.label,
    required this.sub,
    required this.highlighted,
  });
}

class _EventFeatureCard extends StatelessWidget {
  final String label;
  final String sub;
  final bool highlighted;

  const _EventFeatureCard({
    required this.label,
    required this.sub,
    required this.highlighted,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: highlighted ? Colors.white : const Color(0xFFF2F5F8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: highlighted
              ? AppColors.border.withOpacity(0.5)
              : AppColors.border.withOpacity(0.3),
          width: 0.7,
        ),
        boxShadow: highlighted
            ? [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          // Avatar circle with Nuru logo
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFE8EEF5),
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.border.withOpacity(0.4),
                width: 0.7,
              ),
            ),
            child: Center(
              child: ClipOval(
                child: Image.asset(
                  'assets/images/nuru-logo-square.png',
                  width: 24,
                  height: 24,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 24,
                    height: 24,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: _font(
                    size: 14,
                    weight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sub,
                  style: _font(
                    size: 11.5,
                    weight: FontWeight.w500,
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: highlighted
                  ? const Color(0xFF1A1A2E)
                  : const Color(0xFFE8EEF5),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              highlighted ? 'Active' : 'Explore',
              style: _font(
                size: 11,
                weight: FontWeight.w700,
                color: highlighted ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — Orbital diagram (like reference: central circle + satellite nodes)
// No Nuru logo in center, use abstract icon instead
// ─────────────────────────────────────────────────────────────────────────────

class _TicketsScene extends StatelessWidget {
  const _TicketsScene();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final sceneSize = min(box.maxWidth, box.maxHeight) * 0.85;
        final centerR = sceneSize * 0.14;
        final orbitR = sceneSize * 0.35;
        final nodeR = sceneSize * 0.065;

        // Satellite positions equally spaced (72° apart)
        final satellites = [
          _Satellite('Tickets', -pi / 2),                    // top
          _Satellite('Revenue', -pi / 2 + 2 * pi / 5),      // top-right
          _Satellite('Budgets', -pi / 2 + 4 * pi / 5),      // bottom-right
          _Satellite('Insights', -pi / 2 + 6 * pi / 5),     // bottom-left
          _Satellite('Guests', -pi / 2 + 8 * pi / 5),       // top-left
        ];

        return Center(
          child: SizedBox(
            width: sceneSize,
            height: sceneSize,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Dotted lines connecting satellite nodes
                CustomPaint(
                  size: Size(sceneSize, sceneSize),
                  painter: _DottedConnectionPainter(
                    satellites: satellites,
                    orbitR: orbitR,
                    center: Offset(sceneSize / 2, sceneSize / 2),
                  ),
                ),
                // Orbit ring (outer)
                Container(
                  width: orbitR * 2 + nodeR * 2,
                  height: orbitR * 2 + nodeR * 2,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.border.withOpacity(0.35),
                      width: 0.8,
                    ),
                  ),
                ),
                // Inner orbit ring
                Container(
                  width: orbitR * 1.3,
                  height: orbitR * 1.3,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.border.withOpacity(0.2),
                      width: 0.7,
                    ),
                  ),
                ),

                // Central dark circle
                Container(
                  width: centerR * 2,
                  height: centerR * 2,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFF1A1A2E),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1A1A2E).withOpacity(0.2),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Icon(
                      Icons.language_rounded,
                      size: centerR * 0.9,
                      color: Colors.white.withOpacity(0.8),
                    ),
                  ),
                ),

                // Badge
                Positioned(
                  top: sceneSize * 0.04,
                  right: sceneSize * 0.15,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Text(
                      'All-in-One',
                      style: _font(
                        size: 10,
                        weight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ),

                // Satellite nodes
                ...satellites.map((sat) {
                  final x = cos(sat.angle) * orbitR;
                  final y = sin(sat.angle) * orbitR;

                  return Positioned(
                    left: sceneSize / 2 + x - nodeR,
                    top: sceneSize / 2 + y - nodeR,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: nodeR * 2,
                          height: nodeR * 2,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: AppColors.border.withOpacity(0.4),
                              width: 0.7,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Icon(
                              _iconForSatellite(sat.label),
                              size: nodeR * 0.85,
                              color: const Color(0xFF6E8EAE),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  IconData _iconForSatellite(String label) {
    switch (label) {
      case 'Tickets':
        return Icons.confirmation_num_outlined;
      case 'Revenue':
        return Icons.trending_up_rounded;
      case 'Guests':
        return Icons.people_outline_rounded;
      case 'Budgets':
        return Icons.account_balance_wallet_outlined;
      case 'Insights':
        return Icons.insights_rounded;
      default:
        return Icons.circle_outlined;
    }
  }
}

class _Satellite {
  final String label;
  final double angle;

  const _Satellite(this.label, this.angle);
}

class _DottedConnectionPainter extends CustomPainter {
  final List<_Satellite> satellites;
  final double orbitR;
  final Offset center;

  _DottedConnectionPainter({
    required this.satellites,
    required this.orbitR,
    required this.center,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.border.withOpacity(0.5)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    // Draw dotted lines from each satellite to the center
    for (int i = 0; i < satellites.length; i++) {
      final x1 = center.dx + cos(satellites[i].angle) * orbitR;
      final y1 = center.dy + sin(satellites[i].angle) * orbitR;

      _drawDottedLine(canvas, Offset(x1, y1), center, paint);
    }

    // Also draw dotted lines between adjacent satellites
    for (int i = 0; i < satellites.length; i++) {
      final next = (i + 1) % satellites.length;
      final x1 = center.dx + cos(satellites[i].angle) * orbitR;
      final y1 = center.dy + sin(satellites[i].angle) * orbitR;
      final x2 = center.dx + cos(satellites[next].angle) * orbitR;
      final y2 = center.dy + sin(satellites[next].angle) * orbitR;

      _drawDottedLine(canvas, Offset(x1, y1), Offset(x2, y2), paint);
    }
  }

  void _drawDottedLine(Canvas canvas, Offset start, Offset end, Paint paint) {
    final dx = end.dx - start.dx;
    final dy = end.dy - start.dy;
    final len = sqrt(dx * dx + dy * dy);
    if (len == 0) return;

    final ux = dx / len;
    final uy = dy / len;

    const dashLen = 4.0;
    const gapLen = 4.0;
    double d = 0;
    while (d < len) {
      final segEnd = (d + dashLen).clamp(0.0, len);
      canvas.drawLine(
        Offset(start.dx + ux * d, start.dy + uy * d),
        Offset(start.dx + ux * segEnd, start.dy + uy * segEnd),
        paint,
      );
      d += dashLen + gapLen;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dots
// ─────────────────────────────────────────────────────────────────────────────

class _DotRow extends StatelessWidget {
  final int activeIndex;

  const _DotRow({required this.activeIndex});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (i) {
        final active = i == activeIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 24 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? AppColors.primary : const Color(0xFFD2DCE7),
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared font helper
// ─────────────────────────────────────────────────────────────────────────────

TextStyle _font({
  required double size,
  FontWeight weight = FontWeight.w500,
  Color color = AppColors.textPrimary,
  double height = 1.2,
  double letterSpacing = 0,
}) {
  return GoogleFonts.plusJakartaSans(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: letterSpacing,
  );
}
