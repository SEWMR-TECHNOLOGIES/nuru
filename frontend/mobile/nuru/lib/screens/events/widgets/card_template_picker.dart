import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../tickets/widgets/dashed_divider.dart';

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

  // ── Mini ticket card previews (mirror invitation_qr_screen.dart) ──

  Widget _classicPreview(Color accent) => _ticketMini(
        accent: accent,
        paper: Colors.white,
        ink: const Color(0xFF1F1B16),
        greeting: 'Together with their families',
        greetingScript: false,
        title: 'Sarah & James',
        eventTypeBadge: 'WEDDING',
        dateLabel: 'SAT, 24 MAY',
        timeLabel: '4:00 PM',
        venueLabel: 'Dar es Salaam',
        nameItalic: true,
      );

  Widget _editorialPreview(Color accent) => _ticketMini(
        accent: accent,
        paper: const Color(0xFFFDFAF3),
        ink: const Color(0xFF14110D),
        greeting: "You're Invited",
        greetingScript: true,
        title: 'Summer Gala',
        eventTypeBadge: 'GALA',
        dateLabel: 'FRI, 12 JUL',
        timeLabel: '7:30 PM',
        venueLabel: 'Serena Hotel',
        nameItalic: false,
      );

  Widget _ticketMini({
    required Color accent,
    required Color paper,
    required Color ink,
    required String greeting,
    required bool greetingScript,
    required String title,
    required String eventTypeBadge,
    required String dateLabel,
    required String timeLabel,
    required String venueLabel,
    required bool nameItalic,
  }) {
    return LayoutBuilder(builder: (context, c) {
      // Scale factor relative to a full-size ticket (~360 logical px wide).
      final s = (c.maxWidth / 360).clamp(0.5, 1.2);
      double sz(double v) => v * s;
      final heroH = sz(140);
      final dashColor = ink.withOpacity(0.18);

      return ClipPath(
        clipper: TicketShapeClipper(
          notchY: heroH,
          notchRadius: sz(10),
          scallopedBottom: true,
          scallopRadius: sz(6),
        ),
        child: Container(
          color: paper,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero block
              SizedBox(
                height: heroH,
                child: Stack(children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [accent.withOpacity(0.9), const Color(0xFF1F1F2E)],
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.black.withOpacity(0.25), Colors.black.withOpacity(0.65)],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: sz(12), right: sz(12), top: sz(10),
                    child: Row(children: [
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: sz(8), vertical: sz(3)),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.18),
                          border: Border.all(color: Colors.white.withOpacity(0.45), width: 0.6),
                          borderRadius: BorderRadius.circular(100),
                        ),
                        child: Text(eventTypeBadge,
                            style: GoogleFonts.inter(
                                fontSize: sz(8),
                                letterSpacing: 2,
                                color: Colors.white,
                                fontWeight: FontWeight.w700)),
                      ),
                      const Spacer(),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: sz(8), vertical: sz(3)),
                        decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(6)),
                        child: Text('INVITATION',
                            style: GoogleFonts.inter(
                                fontSize: sz(7.5),
                                letterSpacing: 1.4,
                                color: Colors.white,
                                fontWeight: FontWeight.w800)),
                      ),
                    ]),
                  ),
                  Positioned(
                    left: sz(12), right: sz(12), bottom: sz(12),
                    child: Text(title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.playfairDisplay(
                            fontSize: sz(18),
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            height: 1.15)),
                  ),
                ]),
              ),
              SizedBox(height: sz(14)),
              // Greeting + ornament
              Padding(
                padding: EdgeInsets.symmetric(horizontal: sz(14)),
                child: Column(children: [
                  Text(greeting,
                      textAlign: TextAlign.center,
                      style: greetingScript
                          ? GoogleFonts.greatVibes(fontSize: sz(26), color: ink, height: 1.0)
                          : GoogleFonts.playfairDisplay(
                              fontSize: sz(15),
                              color: ink,
                              fontStyle: nameItalic ? FontStyle.italic : FontStyle.normal,
                              fontWeight: FontWeight.w700,
                              height: 1.15)),
                  SizedBox(height: sz(6)),
                  _miniOrnament(accent, sz(70)),
                ]),
              ),
              SizedBox(height: sz(12)),
              Padding(
                padding: EdgeInsets.fromLTRB(sz(14), 0, sz(14), sz(12)),
                child: DashedDivider(color: dashColor, dashWidth: sz(4), dashSpace: sz(3)),
              ),
              // Info row
              Padding(
                padding: EdgeInsets.symmetric(horizontal: sz(14)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _miniInfo('DATE', dateLabel, ink, sz),
                    _miniInfo('TIME', timeLabel, ink, sz),
                    _miniInfo('VENUE', venueLabel, ink, sz),
                  ],
                ),
              ),
              SizedBox(height: sz(12)),
              Padding(
                padding: EdgeInsets.fromLTRB(sz(14), 0, sz(14), sz(12)),
                child: DashedDivider(color: dashColor, dashWidth: sz(4), dashSpace: sz(3)),
              ),
              // QR pad
              Center(
                child: Container(
                  padding: EdgeInsets.all(sz(6)),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(sz(8)),
                    border: Border.all(color: const Color(0xFFEDEDF2)),
                  ),
                  child: SizedBox(
                    width: sz(56),
                    height: sz(56),
                    child: CustomPaint(painter: _MockQrPainter(color: ink)),
                  ),
                ),
              ),
              SizedBox(height: sz(8)),
              Text('SCAN TO CHECK IN',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                      fontSize: sz(8.5),
                      letterSpacing: 2.4,
                      color: accent,
                      fontWeight: FontWeight.w800)),
              SizedBox(height: sz(18)),
            ],
          ),
        ),
      );
    });
  }

  Widget _miniInfo(String label, String value, Color ink, double Function(double) sz) {
    return Expanded(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: sz(3)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: sz(8),
                    letterSpacing: 1.2,
                    color: ink.withOpacity(0.5),
                    fontWeight: FontWeight.w800)),
            SizedBox(height: sz(4)),
            Text(value,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                    fontSize: sz(10),
                    color: ink,
                    fontWeight: FontWeight.w700,
                    height: 1.25)),
          ],
        ),
      ),
    );
  }

  Widget _miniOrnament(Color accent, double width) {
    return SizedBox(
      width: width,
      child: Row(children: [
        Expanded(child: Container(height: 1, color: accent.withOpacity(0.5))),
        const SizedBox(width: 4),
        Transform.rotate(
          angle: 0.785,
          child: Container(width: 4, height: 4, color: accent),
        ),
        const SizedBox(width: 4),
        Expanded(child: Container(height: 1, color: accent.withOpacity(0.5))),
      ]),
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
