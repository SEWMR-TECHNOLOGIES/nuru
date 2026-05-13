import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

/// Organizer-facing tab to choose the invitation card template guests see.
/// Mirrors the two web invitation card templates: Classic & Editorial.
/// Selection persists per event in SharedPreferences and is consumed by
/// invitation_qr_screen.dart.
class CardTemplatePicker extends StatefulWidget {
  final String? eventId;
  final String? eventTypeKey;
  final String? themeColorHex; // event theme color (#RRGGBB) when known

  const CardTemplatePicker({
    super.key,
    this.eventId,
    this.eventTypeKey,
    this.themeColorHex,
  });

  @override
  State<CardTemplatePicker> createState() => _CardTemplatePickerState();
}

const _prefsKeyBase = 'invitation_card_style';

String _prefsKey(String? eventId) =>
    eventId == null ? _prefsKeyBase : '${_prefsKeyBase}_$eventId';

/// Curated default template for each event type. Used both to highlight the
/// "Recommended" card in the picker and to seed the initial selection when
/// the organizer hasn't chosen one yet.
String recommendedTemplateForEventType(String? key) {
  switch ((key ?? '').toLowerCase()) {
    case 'wedding':
    case 'graduation':
    case 'gala':
      return 'classic';
    case 'birthday':
    case 'conference':
    case 'corporate':
    case 'launch':
    case 'concert':
      return 'editorial';
    default:
      return 'classic';
  }
}

String _eventTypeLabel(String? key) {
  final v = (key ?? '').trim();
  if (v.isEmpty) return 'this event';
  return v[0].toUpperCase() + v.substring(1).toLowerCase();
}

/// Public helper used elsewhere (e.g. invitation card screen) to read the
/// organizer's chosen template for an event.
Future<String> getSelectedCardTemplate(String? eventId, String? eventTypeKey) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_prefsKey(eventId)) ??
      prefs.getString(_prefsKeyBase) ??
      recommendedTemplateForEventType(eventTypeKey);
}

class _CardTemplatePickerState extends State<CardTemplatePicker> {
  String _selected = 'classic';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_prefsKey(widget.eventId)) ??
        prefs.getString(_prefsKeyBase);
    final fallback = recommendedTemplateForEventType(widget.eventTypeKey);
    setState(() {
      _selected = stored ?? fallback;
      if (_selected != 'editorial' && _selected != 'classic') {
        _selected = fallback;
      }
      _loading = false;
    });
  }

  Future<void> _select(String id) async {
    setState(() => _selected = id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey(widget.eventId), id);
  }

  Color _themeColor() {
    final hex = widget.themeColorHex;
    if (hex == null || hex.isEmpty) return const Color(0xFFD4AF37);
    var h = hex.replaceAll('#', '');
    if (h.length == 6) h = 'FF$h';
    final v = int.tryParse(h, radix: 16);
    return v == null ? const Color(0xFFD4AF37) : Color(v);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
          height: 80, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    final accent = _themeColor();
    // IMPORTANT: This widget is embedded inside the Step 4 SingleChildScrollView
    // on the create-event flow. Using a top-level ListView here creates a
    // nested unbounded scrollable that (a) causes phantom "infinite scroll"
    // on the page and (b) on some Android OEMs absorbs taps, breaking the
    // EventTicketing toggle. Render as a plain Column instead.
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Invitation Cards',
              style: appText(size: 20, weight: FontWeight.w800, letterSpacing: -0.4)),
          const SizedBox(height: 4),
          Text(
            'Choose how guest invitation cards look. Confirmed guests can preview and download their card from the app.',
            style: appText(size: 12.5, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle, border: Border.all(color: AppColors.borderLight)),
            ),
            const SizedBox(width: 8),
            Text(
              'Cards use your event theme color',
              style: appText(size: 11.5, color: AppColors.textTertiary, weight: FontWeight.w500),
            ),
          ]),
          const SizedBox(height: 18),
          _templateCard(
            id: 'classic',
            label: 'Classic',
            tagline: 'Ornate gold frame · serif typography · floral corners',
            accent: accent,
            preview: _classicPreview(accent),
            recommended: recommendedTemplateForEventType(widget.eventTypeKey) == 'classic',
          ),
          const SizedBox(height: 14),
          _templateCard(
            id: 'editorial',
            label: 'Editorial',
            tagline: 'Modern hero panel · script accents · footer QR strip',
            accent: accent,
            preview: _editorialPreview(accent),
            recommended: recommendedTemplateForEventType(widget.eventTypeKey) == 'editorial',
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withOpacity(0.3)),
            ),
            child: Row(children: [
              Icon(Icons.info_outline_rounded, size: 18, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Guests can switch between Classic and Editorial when downloading their card.',
                  style: appText(size: 12, color: AppColors.textSecondary),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _templateCard({
    required String id,
    required String label,
    required String tagline,
    required Color accent,
    required Widget preview,
    bool recommended = false,
  }) {
    final selected = _selected == id;
    return GestureDetector(
      onTap: () => _select(id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.borderLight,
            width: selected ? 2 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.18),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(aspectRatio: 0.72, child: preview),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: selected ? AppColors.primary : AppColors.borderLight,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  selected ? 'SELECTED' : 'TAP TO USE',
                  style: appText(
                      size: 9.5,
                      letterSpacing: 1.2,
                      weight: FontWeight.w800,
                      color: selected ? Colors.white : AppColors.textSecondary),
                ),
              ),
              if (recommended) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: accent.withOpacity(0.4)),
                  ),
                  child: Text(
                    'RECOMMENDED · ${_eventTypeLabel(widget.eventTypeKey).toUpperCase()}',
                    style: appText(
                        size: 9, letterSpacing: 1.1, weight: FontWeight.w800, color: accent),
                  ),
                ),
              ],
              const Spacer(),
              if (selected)
                Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20),
            ]),
            const SizedBox(height: 8),
            Text(label,
                style: appText(size: 17, weight: FontWeight.w800, letterSpacing: -0.3)),
            const SizedBox(height: 2),
            Text(tagline,
                style: appText(size: 12, color: AppColors.textTertiary)),
          ],
        ),
      ),
    );
  }

  Widget _classicPreview(Color accent) {
    final cream = const Color(0xFFFBF7F0);
    final ink = const Color(0xFF2C1810);
    return Container(
      color: cream,
      child: Stack(children: [
        Positioned.fill(
          child: Container(
            margin: const EdgeInsets.all(6),
            decoration: BoxDecoration(border: Border.all(color: accent, width: 1.2)),
          ),
        ),
        Positioned(top: 0, left: 0, right: 0, child: Container(height: 3, color: accent)),
        Positioned(bottom: 0, left: 0, right: 0, child: Container(height: 3, color: accent)),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text('YOU ARE INVITED',
                  style: GoogleFonts.inter(
                      fontSize: 8, letterSpacing: 3, color: accent, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text('Sarah & James',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.playfairDisplay(
                      fontSize: 18, color: ink, fontWeight: FontWeight.w700, height: 1.1)),
              const SizedBox(height: 4),
              Text('WEDDING CEREMONY',
                  style: GoogleFonts.inter(
                      fontSize: 7, letterSpacing: 3, color: accent, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              Text('SAT, 24 MAY 2025',
                  style: GoogleFonts.inter(fontSize: 9, color: ink, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('Dar es Salaam',
                  style: GoogleFonts.inter(fontSize: 9, color: ink.withOpacity(0.7))),
              const Spacer(),
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: accent),
                    borderRadius: BorderRadius.circular(4)),
                child: CustomPaint(painter: _MockQrPainter(color: ink)),
              ),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _editorialPreview(Color accent) {
    final paper = const Color(0xFFFDFAF3);
    final ink = const Color(0xFF1A1A1A);
    return Container(
      color: paper,
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(14, 16, 14, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [accent.withOpacity(0.95), accent.withOpacity(0.6), Colors.black87],
              ),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text("You're",
                  style: GoogleFonts.greatVibes(
                      fontSize: 18, color: Colors.white, height: 0.9)),
              Text('Invited',
                  style: GoogleFonts.greatVibes(
                      fontSize: 30, color: Colors.white, height: 0.9)),
            ]),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                children: [
                  Text('JOIN US FOR',
                      style: GoogleFonts.inter(
                          fontSize: 7,
                          letterSpacing: 2.5,
                          color: ink.withOpacity(0.6),
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('SUMMER GALA',
                      style: GoogleFonts.playfairDisplay(
                          fontSize: 13, color: ink, fontWeight: FontWeight.w800)),
                  const Spacer(),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF111111),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(children: [
                      Container(
                          width: 22,
                          height: 22,
                          color: Colors.white,
                          child: CustomPaint(painter: _MockQrPainter(color: ink))),
                      const SizedBox(width: 6),
                      Text('SCAN',
                          style: GoogleFonts.inter(
                              fontSize: 7,
                              letterSpacing: 2,
                              color: accent,
                              fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MockQrPainter extends CustomPainter {
  final Color color;
  _MockQrPainter({required this.color});
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = color;
    final cell = size.width / 7;
    final pattern = [
      [1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 1, 0, 1, 1],
      [1, 1, 0, 0, 1, 1, 0],
      [0, 1, 1, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 0, 1],
      [1, 1, 0, 0, 1, 1, 1],
      [0, 1, 1, 0, 1, 0, 0],
    ];
    for (int y = 0; y < 7; y++) {
      for (int x = 0; x < 7; x++) {
        if (pattern[y][x] == 1) {
          canvas.drawRect(Rect.fromLTWH(x * cell, y * cell, cell, cell), p);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _MockQrPainter oldDelegate) => false;
}
