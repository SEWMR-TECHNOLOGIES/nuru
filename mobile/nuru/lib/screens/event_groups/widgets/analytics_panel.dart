import '../../../core/widgets/nuru_refresh_indicator.dart';
import '../../../core/utils/money_format.dart';
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/event_groups_service.dart';

/// AnalyticsPanel — mirrors the web analytics panel for an event group.
///
/// Reuses the same `/scoreboard` endpoint as `ScoreboardPanel` so opening
/// this tab is instant after the scoreboard has loaded once. Surfaces:
///   • Status mix (completed / in-progress / pending / no pledge) — donut
///   • Cash flow (pledged / collected / outstanding) — stacked bar
///   • Distribution by completion bucket (0, 1-25, 26-50, 51-75, 76-99, 100)
///   • Top contributors by amount paid
///   • Headline KPIs (avg pledge, avg paid, collection rate, completion %)
class AnalyticsPanel extends StatefulWidget {
  final String groupId;
  const AnalyticsPanel({super.key, required this.groupId});

  @override
  State<AnalyticsPanel> createState() => _AnalyticsPanelState();
}

// Module-level cache so that flipping between Chat/Scoreboard/Analytics tabs
// does not flash a skeleton each time.
final Map<String, _AnalyticsCache> _analyticsCache = {};

class _AnalyticsCache {
  final List<Map<String, dynamic>> rows;
  final Map<String, dynamic>? summary;
  _AnalyticsCache(this.rows, this.summary);
}

class _AnalyticsPanelState extends State<AnalyticsPanel> {
  List<Map<String, dynamic>> _rows = [];
  Map<String, dynamic>? _summary;
  bool _loading = true;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    final cached = _analyticsCache[widget.groupId];
    if (cached != null) {
      _rows = cached.rows;
      _summary = cached.summary;
      _loading = false;
    }
    _load(silent: cached != null);
    _poll = Timer.periodic(const Duration(seconds: 12), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    final res = await EventGroupsService.scoreboard(widget.groupId);
    if (!mounted) return;
    if (res['success'] == true && res['data'] is Map) {
      final data = res['data'] as Map;
      final rows = (data['rows'] as List? ?? [])
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .toList();
      final summary = data['summary'] is Map ? Map<String, dynamic>.from(data['summary']) : null;
      _analyticsCache[widget.groupId] = _AnalyticsCache(rows, summary);
      setState(() {
        _rows = rows;
        _summary = summary;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  String _money(num v) => NumberFormat('#,##0', 'en_US').format(v.round());

  String _classify(Map<String, dynamic> r) {
    final pledged = (r['pledged'] as num?)?.toDouble() ?? 0;
    final paid = (r['paid'] as num?)?.toDouble() ?? 0;
    if (pledged <= 0) return 'no_pledge';
    if (paid >= pledged) return 'completed';
    if (paid > 0) return 'in_progress';
    return 'pending';
  }

  // ───────────────────────── build ─────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading && _rows.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_rows.isEmpty) {
      return _empty();
    }

    final buckets = {'completed': 0, 'in_progress': 0, 'pending': 0, 'no_pledge': 0};
    double pledgeSum = 0, paidSum = 0;
    for (final r in _rows) {
      buckets[_classify(r)] = (buckets[_classify(r)] ?? 0) + 1;
      pledgeSum += (r['pledged'] as num?)?.toDouble() ?? 0;
      paidSum += (r['paid'] as num?)?.toDouble() ?? 0;
    }
    final outstanding = math.max(0.0, pledgeSum - paidSum);
    final collectionRate = pledgeSum > 0 ? (paidSum / pledgeSum * 100) : 0.0;

    final summaryPledged = (_summary?['total_pledged'] as num?)?.toDouble() ?? pledgeSum;
    final summaryPaid = (_summary?['total_paid'] as num?)?.toDouble() ?? paidSum;
    final summaryOutstanding = (_summary?['outstanding'] as num?)?.toDouble() ?? outstanding;
    final summaryRate = (_summary?['collection_rate'] as num?)?.toDouble() ?? collectionRate;

    final avgPledge = _rows.isEmpty ? 0 : (pledgeSum / _rows.length);
    final avgPaid = _rows.isEmpty ? 0 : (paidSum / _rows.length);
    final completionPct = _rows.isEmpty ? 0 : ((buckets['completed'] ?? 0) / _rows.length * 100);

    final top = [..._rows]..sort((a, b) =>
        ((b['paid'] as num?) ?? 0).compareTo(((a['paid'] as num?) ?? 0)));
    final topFive = top.take(5).toList();

    return NuruRefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => _load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Headline KPIs — 4 cards
          _kpiGrid(
            collectionRate: summaryRate,
            avgPledge: avgPledge.toDouble(),
            avgPaid: avgPaid.toDouble(),
            completionPct: completionPct.toDouble(),
          ),
          const SizedBox(height: 16),

          // Status mix donut
          _sectionCard(
            title: 'Contributor status',
            child: _donut(buckets),
          ),
          const SizedBox(height: 16),

          // Cash flow stacked bar
          _sectionCard(
            title: 'Cash flow',
            child: _cashFlow(summaryPledged, summaryPaid, summaryOutstanding),
          ),
          const SizedBox(height: 16),

          // Top contributors
          _sectionCard(
            title: 'Top contributors',
            child: Column(children: [
              for (var i = 0; i < topFive.length; i++) _topRow(i + 1, topFive[i]),
              if (topFive.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text('No contributions yet',
                      style: GoogleFonts.inter(color: AppColors.textTertiary, fontSize: 12)),
                ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _empty() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Analytics will appear once contributions start coming in.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: AppColors.textTertiary, fontSize: 13)),
        ),
      );

  Widget _kpiGrid({
    required double collectionRate,
    required double avgPledge,
    required double avgPaid,
    required double completionPct,
  }) {
    final items = [
      _Kpi('Collection rate', '${collectionRate.toStringAsFixed(0)}%', AppColors.primary, Icons.trending_up_rounded),
      _Kpi('Completion', '${completionPct.toStringAsFixed(0)}%', AppColors.success, Icons.check_circle_outline),
      _Kpi('Avg. pledge', '${getActiveCurrency()} ${_money(avgPledge)}', AppColors.info, Icons.flag_outlined),
      _Kpi('Avg. paid', '${getActiveCurrency()} ${_money(avgPaid)}', AppColors.warning, Icons.payments_outlined),
    ];

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 1.7,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: items
          .map((k) => Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: k.color.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: k.color.withOpacity(0.15)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(k.label,
                            style: GoogleFonts.inter(
                                fontSize: 10,
                                color: AppColors.textTertiary,
                                fontWeight: FontWeight.w600)),
                        Icon(k.icon, size: 14, color: k.color),
                      ],
                    ),
                    Text(k.value,
                        style: GoogleFonts.inter(
                            fontWeight: FontWeight.w800, fontSize: 16, color: k.color)),
                  ],
                ),
              ))
          .toList(),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: GoogleFonts.inter(
                fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
        const SizedBox(height: 12),
        child,
      ]),
    );
  }

  Widget _donut(Map<String, int> buckets) {
    final total = buckets.values.fold<int>(0, (a, b) => a + b);
    final entries = [
      _Slice('Completed', buckets['completed'] ?? 0, AppColors.primary),
      _Slice('In progress', buckets['in_progress'] ?? 0, const Color(0xFFE8A33D)),
      _Slice('Pending', buckets['pending'] ?? 0, AppColors.textTertiary),
      _Slice('No pledge', buckets['no_pledge'] ?? 0, AppColors.borderLight),
    ];

    return Row(
      children: [
        SizedBox(
          width: 120,
          height: 120,
          child: CustomPaint(
            painter: _DonutPainter(entries, total),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('$total',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.textPrimary)),
                  Text('people',
                      style: GoogleFonts.inter(
                          fontSize: 10, color: AppColors.textTertiary)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            children: entries.map((s) {
              final pct = total == 0 ? 0 : (s.value / total * 100);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: s.color, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(s.label,
                        style: GoogleFonts.inter(fontSize: 11, color: AppColors.textPrimary)),
                  ),
                  Text('${s.value} · ${pct.toStringAsFixed(0)}%',
                      style: GoogleFonts.inter(
                          fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textTertiary)),
                ]),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _cashFlow(double pledged, double paid, double outstanding) {
    final total = math.max(pledged, paid + outstanding);
    final paidPct = total <= 0 ? 0.0 : (paid / total).clamp(0.0, 1.0);
    final outstandingPct = total <= 0 ? 0.0 : (outstanding / total).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Stacked bar
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            height: 14,
            child: Row(children: [
              Expanded(
                flex: (paidPct * 1000).round().clamp(1, 1000),
                child: Container(color: AppColors.primary),
              ),
              if (outstandingPct > 0)
                Expanded(
                  flex: (outstandingPct * 1000).round().clamp(1, 1000),
                  child: Container(color: const Color(0xFFE8A33D)),
                ),
              if (paidPct + outstandingPct < 1)
                Expanded(
                  flex: ((1 - paidPct - outstandingPct) * 1000).round().clamp(1, 1000),
                  child: Container(color: AppColors.borderLight),
                ),
            ]),
          ),
        ),
        const SizedBox(height: 14),
        _cashRow('Pledged', pledged, AppColors.textPrimary),
        const SizedBox(height: 6),
        _cashRow('Collected', paid, AppColors.primary),
        const SizedBox(height: 6),
        _cashRow('Outstanding', outstanding, const Color(0xFFE8A33D)),
      ],
    );
  }

  Widget _cashRow(String label, double v, Color c) => Row(
        children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: GoogleFonts.inter(fontSize: 12, color: AppColors.textPrimary))),
          Text('${getActiveCurrency()} ${_money(v)}',
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: c)),
        ],
      );

  Widget _topRow(int rank, Map<String, dynamic> r) {
    final name = (r['display_name'] ?? r['name'] ?? '?').toString();
    final paid = (r['paid'] as num?)?.toDouble() ?? 0;
    final pledged = (r['pledged'] as num?)?.toDouble() ?? 0;
    final pct = pledged > 0 ? (paid / pledged * 100).clamp(0, 999) : (paid > 0 ? 100.0 : 0.0);
    final initials = name.trim().split(RegExp(r'\s+')).take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();
    final avatar = r['avatar_url'] as String?;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SizedBox(width: 18, child: Text('$rank.', style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: AppColors.textTertiary, fontSize: 12))),
        CircleAvatar(
          radius: 14,
          backgroundColor: AppColors.primarySoft,
          backgroundImage: (avatar != null && avatar.isNotEmpty) ? NetworkImage(avatar) : null,
          child: (avatar == null || avatar.isEmpty)
              ? Text(initials, style: GoogleFonts.inter(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700))
              : null,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            Text('${pct.toStringAsFixed(0)}% of pledge',
                style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary)),
          ]),
        ),
        Text('${getActiveCurrency()} ${_money(paid)}',
            style: GoogleFonts.inter(fontWeight: FontWeight.w800, color: AppColors.primary, fontSize: 12)),
      ]),
    );
  }
}

class _Kpi {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  _Kpi(this.label, this.value, this.color, this.icon);
}

class _Slice {
  final String label;
  final int value;
  final Color color;
  _Slice(this.label, this.value, this.color);
}

class _DonutPainter extends CustomPainter {
  final List<_Slice> slices;
  final int total;
  _DonutPainter(this.slices, this.total);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(8, 8, size.width - 16, size.height - 16);
    final stroke = 18.0;
    if (total == 0) {
      final paint = Paint()
        ..color = AppColors.borderLight
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke;
      canvas.drawArc(rect, 0, 2 * math.pi, false, paint);
      return;
    }
    var start = -math.pi / 2;
    for (final s in slices) {
      if (s.value == 0) continue;
      final sweep = (s.value / total) * 2 * math.pi;
      final paint = Paint()
        ..color = s.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, start, sweep, false, paint);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) =>
      old.slices != slices || old.total != total;
}
