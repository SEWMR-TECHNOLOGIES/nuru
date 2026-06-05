import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/services/api_base.dart';
import '../../core/theme/app_colors.dart';
import '../home/home_screen.dart';

/// Post-signup personalisation: which kinds of events the user cares about
/// + how they engage with events on Nuru. Two short steps, event-themed,
/// emoji-led so it feels personal instead of like a tax form.
class InterestsOnboardingScreen extends StatefulWidget {
  /// When true, behaves as an in-app editor opened from Settings → Your
  /// interests: pops back instead of pushing HomeScreen, "Skip" becomes
  /// "Cancel", and the title reflects editing.
  final bool fromSettings;
  const InterestsOnboardingScreen({super.key, this.fromSettings = false});

  @override
  State<InterestsOnboardingScreen> createState() => _InterestsOnboardingScreenState();
}

class _InterestsOnboardingScreenState extends State<InterestsOnboardingScreen> {
  bool _loading = true;
  bool _saving = false;
  int _step = 0; // 0 = signup intents, 1 = interests, 2 = role
  List<Map<String, dynamic>> _catalogue = const [];
  List<Map<String, dynamic>> _roles = const [];
  List<Map<String, dynamic>> _intentsCatalogue = const [];
  final Set<String> _selected = {};
  final Set<String> _intents = {};
  String? _role;

  static const _fallbackCatalogue = <Map<String, dynamic>>[
    {'slug': 'weddings',        'label': 'Weddings',             'emoji': '💍'},
    {'slug': 'birthdays',       'label': 'Birthdays',            'emoji': '🎂'},
    {'slug': 'graduations',     'label': 'Graduations',          'emoji': '🎓'},
    {'slug': 'anniversaries',   'label': 'Anniversaries',        'emoji': '🥂'},
    {'slug': 'baby_showers',    'label': 'Baby showers',         'emoji': '🍼'},
    {'slug': 'private_parties', 'label': 'Private parties',      'emoji': '🎉'},
    {'slug': 'concerts',        'label': 'Concerts',             'emoji': '🎤'},
    {'slug': 'festivals',       'label': 'Festivals',            'emoji': '🎪'},
    {'slug': 'nightlife',       'label': 'Nightlife',            'emoji': '🪩'},
    {'slug': 'conferences',     'label': 'Conferences',          'emoji': '🎙️'},
    {'slug': 'workshops',       'label': 'Workshops',            'emoji': '🛠️'},
    {'slug': 'networking',      'label': 'Networking',           'emoji': '🤝'},
    {'slug': 'corporate',       'label': 'Corporate events',     'emoji': '💼'},
    {'slug': 'exhibitions',     'label': 'Exhibitions & expos',  'emoji': '🖼️'},
    {'slug': 'fashion_shows',   'label': 'Fashion shows',        'emoji': '👗'},
    {'slug': 'sports_events',   'label': 'Sports events',        'emoji': '🏟️'},
    {'slug': 'faith',           'label': 'Faith gatherings',     'emoji': '🙏'},
    {'slug': 'cultural',        'label': 'Cultural events',      'emoji': '🪘'},
    {'slug': 'community',       'label': 'Community meetups',    'emoji': '🫂'},
    {'slug': 'charity',         'label': 'Charity & fundraisers','emoji': '❤️'},
    {'slug': 'food_events',     'label': 'Food & dining',        'emoji': '🍽️'},
    {'slug': 'memorials',       'label': 'Memorials',            'emoji': '🕊️'},
    {'slug': 'retreats',        'label': 'Retreats & getaways',  'emoji': '🌿'},
  ];

  static const _fallbackRoles = <Map<String, dynamic>>[
    {'slug': 'attendee', 'label': 'I love attending events',  'emoji': '🎟️'},
    {'slug': 'host',     'label': 'I host my own events',     'emoji': '🎈'},
    {'slug': 'planner',  'label': 'I plan events for others', 'emoji': '📋'},
    {'slug': 'vendor',   'label': "I'm a vendor or service",  'emoji': '🛎️'},
  ];

  static const _fallbackIntents = <Map<String, dynamic>>[
    {'slug': 'plan_event',      'label': 'Plan my own event',         'emoji': '🗓️', 'hint': 'Weddings, birthdays, meetups…'},
    {'slug': 'buy_tickets',     'label': 'Buy tickets to events',     'emoji': '🎟️', 'hint': 'Concerts, festivals, shows'},
    {'slug': 'discover_events', 'label': "Discover what's happening", 'emoji': '🔭', 'hint': "See what's on near me"},
    {'slug': 'offer_service',   'label': 'Offer a service or vendor', 'emoji': '🛎️', 'hint': 'Photography, catering, DJ…'},
    {'slug': 'host_community',  'label': 'Build a community',         'emoji': '🫂', 'hint': 'Bring people together'},
    {'slug': 'share_moments',   'label': 'Share my event moments',    'emoji': '📸', 'hint': 'Photos, videos, memories'},
    {'slug': 'network',         'label': 'Meet people & network',     'emoji': '🤝', 'hint': 'New connections & friends'},
    {'slug': 'just_exploring',  'label': 'Just exploring for now',    'emoji': '✨', 'hint': 'Looking around'},
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await ApiBase.get('/users/profile/interests');
    if (!mounted) return;
    final data = res['data'];
    final cat = (data is Map ? data['catalogue'] : null);
    final sel = (data is Map ? data['selected'] : null);
    final roles = (data is Map ? data['roles'] : null);
    final role = (data is Map ? data['role'] : null);
    final intentsCat = (data is Map ? data['intents_catalogue'] : null);
    final intentsSel = (data is Map ? data['intents'] : null);
    setState(() {
      _loading = false;
      _catalogue = (cat is List && cat.isNotEmpty)
          ? cat.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
          : _fallbackCatalogue;
      _roles = (roles is List && roles.isNotEmpty)
          ? roles.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
          : _fallbackRoles;
      _intentsCatalogue = (intentsCat is List && intentsCat.isNotEmpty)
          ? intentsCat.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
          : _fallbackIntents;
      if (sel is List) _selected.addAll(sel.map((e) => e.toString()));
      if (intentsSel is List) _intents.addAll(intentsSel.map((e) => e.toString()));
      if (role is String && role.isNotEmpty) _role = role;
    });
  }

  Future<void> _finish() async {
    if (_saving) return;
    setState(() => _saving = true);
    HapticFeedback.lightImpact();
    try {
      await ApiBase.put('/users/profile/interests', {
        'interests': _selected.toList(),
        'intents': _intents.toList(),
        if (_role != null) 'role': _role,
      });
    } catch (_) {}
    if (!mounted) return;
    if (widget.fromSettings) {
      Navigator.of(context).pop(true);
      return;
    }
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
      (_) => false,
    );
  }

  void _next() {
    if (_step == 0 && _intents.isNotEmpty) {
      setState(() => _step = 1);
      return;
    }
    if (_step == 1 && _selected.length >= 3) {
      setState(() => _step = 2);
      return;
    }
    _finish();
  }

  String get _primaryCta {
    if (_step == 0) {
      if (_intents.isEmpty) return 'Pick at least one';
      return 'Continue';
    }
    if (_step == 1) {
      if (_selected.length < 3) return 'Pick ${3 - _selected.length} more';
      return 'Continue';
    }
    return _role == null
        ? (widget.fromSettings ? 'Save' : 'Finish')
        : (widget.fromSettings ? 'Save changes' : "Let's go");
  }

  bool get _canPrimary {
    if (_saving) return false;
    if (_step == 0) return _intents.isNotEmpty;
    if (_step == 1) return _selected.length >= 3;
    return true; // role is optional on step 2
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBFAF7),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _header(),
                  const SizedBox(height: 8),
                  _progress(),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: _step == 0
                          ? _stepIntents()
                          : (_step == 1 ? _stepInterests() : _stepRole()),
                    ),
                  ),
                  _footer(),
                ],
              ),
      ),
    );
  }

  // ── Header ──
  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          if (_step >= 1)
            GestureDetector(
              onTap: () => setState(() => _step -= 1),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFEDEDF2)),
                ),
                child: SvgPicture.asset('assets/icons/chevron-left-icon.svg',
                    width: 18, height: 18,
                    colorFilter: const ColorFilter.mode(
                        AppColors.textPrimary, BlendMode.srcIn)),
              ),
            ),
          const Spacer(),
          TextButton(
            onPressed: _saving
                ? null
                : (widget.fromSettings
                    ? () => Navigator.of(context).pop()
                    : _finish),
            child: Text(widget.fromSettings ? 'Cancel' : 'Skip for now',
                style: GoogleFonts.inter(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textTertiary)),
          ),
        ],
      ),
    );
  }

  Widget _progress() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(children: [
        Expanded(child: _bar(active: true)),
        const SizedBox(width: 6),
        Expanded(child: _bar(active: _step >= 1)),
        const SizedBox(width: 6),
        Expanded(child: _bar(active: _step >= 2)),
      ]),
    );
  }

  Widget _bar({required bool active}) => AnimatedContainer(
        duration: const Duration(milliseconds: 260),
        height: 4,
        decoration: BoxDecoration(
          color: active ? AppColors.primary : const Color(0xFFEDEDF2),
          borderRadius: BorderRadius.circular(4),
        ),
      );

  // ── Step 0: Signup intents ──
  Widget _stepIntents() {
    return ListView(
      key: const ValueKey('s0'),
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 16),
      children: [
        Text("What brings you to Nuru?",
            style: GoogleFonts.inter(
                fontSize: 26,
                height: 1.15,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        Text(
          "No wrong answer — pick anything that fits. You can choose more than one.",
          style: GoogleFonts.inter(
              fontSize: 13.5,
              color: AppColors.textSecondary,
              height: 1.45),
        ),
        const SizedBox(height: 18),
        ..._intentsCatalogue.map(_intentCard),
      ],
    );
  }

  Widget _intentCard(Map<String, dynamic> r) {
    final slug = r['slug']?.toString() ?? '';
    final label = r['label']?.toString() ?? slug;
    final emoji = r['emoji']?.toString() ?? '';
    final hint = r['hint']?.toString() ?? '';
    final on = _intents.contains(slug);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() {
            if (on) {
              _intents.remove(slug);
            } else {
              _intents.add(slug);
            }
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: on ? AppColors.primary.withOpacity(0.08) : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
                color: on ? AppColors.primary : const Color(0xFFEDEDF2),
                width: on ? 1.5 : 1),
          ),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFFBFAF7),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(emoji.isEmpty ? '✨' : emoji,
                  style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: GoogleFonts.inter(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary)),
                  if (hint.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(hint,
                        style: GoogleFonts.inter(
                            fontSize: 12.5,
                            color: AppColors.textTertiary)),
                  ],
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 22, height: 22,
              decoration: BoxDecoration(
                color: on ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                    color: on ? AppColors.primary : const Color(0xFFD8D6CD),
                    width: 1.5),
              ),
              child: on
                  ? const Icon(Icons.check_rounded, size: 14, color: Colors.black)
                  : null,
            ),
          ]),
        ),
      ),
    );
  }

  // ── Step 1: Interests ──
  Widget _stepInterests() {
    return ListView(
      key: const ValueKey('s1'),
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 16),
      children: [
        Text('What kind of events interest you?',
            style: GoogleFonts.inter(
                fontSize: 26,
                height: 1.15,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        Text(
          'Pick at least 3 — we\'ll personalise your feed, communities and event recommendations around them.',
          style: GoogleFonts.inter(
              fontSize: 13.5,
              color: AppColors.textSecondary,
              height: 1.45),
        ),
        const SizedBox(height: 18),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _catalogue.map(_chip).toList(),
        ),
      ],
    );
  }

  Widget _chip(Map<String, dynamic> item) {
    final slug = item['slug']?.toString() ?? '';
    final label = item['label']?.toString() ?? slug;
    final emoji = item['emoji']?.toString() ?? '';
    final on = _selected.contains(slug);
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() {
          if (on) {
            _selected.remove(slug);
          } else {
            _selected.add(slug);
          }
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: on ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: on ? AppColors.primary : const Color(0xFFE8E6DE),
          ),
          boxShadow: on
              ? [
                  BoxShadow(
                      color: AppColors.primary.withOpacity(0.18),
                      blurRadius: 14,
                      offset: const Offset(0, 4))
                ]
              : null,
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (emoji.isNotEmpty) ...[
            Text(emoji, style: const TextStyle(fontSize: 15)),
            const SizedBox(width: 7),
          ],
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: on ? Colors.black : AppColors.textPrimary)),
        ]),
      ),
    );
  }

  // ── Step 2: Role ──
  Widget _stepRole() {
    return ListView(
      key: const ValueKey('s2'),
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 16),
      children: [
        Text('How do you usually do events?',
            style: GoogleFonts.inter(
                fontSize: 26,
                height: 1.15,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary)),
        const SizedBox(height: 8),
        Text(
          'This helps us show the right tools — discovery for attendees, planning surfaces for hosts.',
          style: GoogleFonts.inter(
              fontSize: 13.5,
              color: AppColors.textSecondary,
              height: 1.45),
        ),
        const SizedBox(height: 20),
        ..._roles.map(_roleCard),
      ],
    );
  }

  Widget _roleCard(Map<String, dynamic> r) {
    final slug = r['slug']?.toString() ?? '';
    final label = r['label']?.toString() ?? slug;
    final emoji = r['emoji']?.toString() ?? '';
    final on = _role == slug;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() => _role = on ? null : slug);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            color: on ? AppColors.primary.withOpacity(0.08) : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
                color: on ? AppColors.primary : const Color(0xFFEDEDF2),
                width: on ? 1.5 : 1),
          ),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFFFBFAF7),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(emoji.isEmpty ? '✨' : emoji,
                  style: const TextStyle(fontSize: 22)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary)),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 22, height: 22,
              decoration: BoxDecoration(
                color: on ? AppColors.primary : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(
                    color: on ? AppColors.primary : const Color(0xFFD8D6CD),
                    width: 1.5),
              ),
              child: on
                  ? const Icon(Icons.check_rounded, size: 14, color: Colors.black)
                  : null,
            ),
          ]),
        ),
      ),
    );
  }

  // ── Footer ──
  Widget _footer() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: SizedBox(
          height: 54,
          child: ElevatedButton(
            onPressed: _canPrimary ? _next : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.textPrimary,
              foregroundColor: Colors.white,
              disabledBackgroundColor: const Color(0xFFE5E5EA),
              disabledForegroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(28)),
              textStyle:
                  GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Text(_primaryCta),
          ),
        ),
      ),
    );
  }
}
