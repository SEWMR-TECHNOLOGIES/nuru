import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';

/// Lightweight mobile parity for the web Card Templates picker.
/// Presents 11 invitation-card themes with a tappable swatch grid.
/// Selection is persisted per-event in SharedPreferences and consumed
/// by the invitation_qr_screen / invitation card renderer.
class CardTemplatePicker extends StatefulWidget {
  final String? eventId; // optional — when null, persists as a global default
  final String? eventTypeKey; // 'wedding' | 'birthday' | ... — chooses default

  const CardTemplatePicker({super.key, this.eventId, this.eventTypeKey});

  @override
  State<CardTemplatePicker> createState() => _CardTemplatePickerState();
}

class _CardTemplate {
  final String id;
  final String label;
  final List<Color> palette;
  const _CardTemplate(this.id, this.label, this.palette);
}

const List<_CardTemplate> _kTemplates = [
  _CardTemplate('royal-gold', 'Royal Gold',
      [Color(0xFFB8860B), Color(0xFF1A1A2E), Color(0xFFFFD700)]),
  _CardTemplate('crimson-rose', 'Crimson Rose',
      [Color(0xFFB91C1C), Color(0xFFFEE2E2), Color(0xFF7F1D1D)]),
  _CardTemplate('sapphire-night', 'Sapphire Night',
      [Color(0xFF1E3A8A), Color(0xFF0F172A), Color(0xFF60A5FA)]),
  _CardTemplate('blush-garden', 'Blush Garden',
      [Color(0xFFFCE7F3), Color(0xFFEC4899), Color(0xFFFDF2F8)]),
  _CardTemplate('emerald-crown', 'Emerald Crown',
      [Color(0xFF065F46), Color(0xFF10B981), Color(0xFFD1FAE5)]),
  _CardTemplate('amber-heritage', 'Amber Heritage',
      [Color(0xFFB45309), Color(0xFFFEF3C7), Color(0xFF92400E)]),
  _CardTemplate('violet-dynasty', 'Violet Dynasty',
      [Color(0xFF6D28D9), Color(0xFFEDE9FE), Color(0xFF4C1D95)]),
  _CardTemplate('noir-gold', 'Noir & Gold',
      [Color(0xFF000000), Color(0xFFD4AF37), Color(0xFF1F1F1F)]),
  _CardTemplate('tropical-celebration', 'Tropical',
      [Color(0xFFF59E0B), Color(0xFF10B981), Color(0xFFEC4899)]),
  _CardTemplate('ivory-pearl', 'Ivory Pearl',
      [Color(0xFFFAF7F2), Color(0xFFD4C5A0), Color(0xFF8B7355)]),
  _CardTemplate('crimson-dahlia-sendoff', 'Crimson Dahlia',
      [Color(0xFF991B1B), Color(0xFFDC2626), Color(0xFFFEE2E2)]),
];

const Map<String, String> _kEventDefaults = {
  'wedding': 'royal-gold',
  'birthday': 'tropical-celebration',
  'corporate': 'noir-gold',
  'memorial': 'ivory-pearl',
  'anniversary': 'blush-garden',
  'conference': 'sapphire-night',
  'graduation': 'emerald-crown',
  'sendoff': 'crimson-dahlia-sendoff',
};

String _prefsKey(String? eventId) =>
    eventId == null ? 'card_template_default' : 'card_template_$eventId';

/// Public helper used by invitation rendering to read the selected template.
Future<String> getSelectedCardTemplate(String? eventId, String? eventTypeKey) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_prefsKey(eventId)) ??
      _kEventDefaults[eventTypeKey] ??
      'royal-gold';
}

class _CardTemplatePickerState extends State<CardTemplatePicker> {
  String? _selected;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_prefsKey(widget.eventId));
    setState(() {
      _selected = stored ?? _kEventDefaults[widget.eventTypeKey] ?? 'royal-gold';
      _loading = false;
    });
  }

  Future<void> _select(String id) async {
    setState(() => _selected = id);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey(widget.eventId), id);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(
          height: 80, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Invitation card style',
                    style: appText(size: 14, weight: FontWeight.w700)),
              ),
              Text(
                _kTemplates.firstWhere((t) => t.id == _selected,
                    orElse: () => _kTemplates.first).label,
                style: appText(size: 12, color: AppColors.textTertiary),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('Choose a theme for invitation cards. You can change this later.',
              style: appText(size: 12, color: AppColors.textTertiary)),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.78,
            ),
            itemCount: _kTemplates.length,
            itemBuilder: (_, i) {
              final t = _kTemplates[i];
              final selected = t.id == _selected;
              return GestureDetector(
                onTap: () => _select(t.id),
                child: Column(
                  children: [
                    Expanded(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: t.palette,
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: selected ? AppColors.primary : Colors.transparent,
                            width: selected ? 2.5 : 1,
                          ),
                          boxShadow: selected
                              ? [
                                  BoxShadow(
                                      color: AppColors.primary.withOpacity(0.18),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4))
                                ]
                              : null,
                        ),
                        child: selected
                            ? const Center(
                                child: Icon(Icons.check_rounded,
                                    color: Colors.white, size: 18))
                            : null,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(t.label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: appText(
                            size: 10,
                            weight: selected ? FontWeight.w700 : FontWeight.w500,
                            color: selected
                                ? AppColors.primary
                                : AppColors.textSecondary)),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
