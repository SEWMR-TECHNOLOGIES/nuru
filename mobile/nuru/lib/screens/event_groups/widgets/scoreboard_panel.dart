import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/services/event_groups_service.dart';

/// Premium scoreboard panel — podium top 3 + ranked leaderboard.
class ScoreboardPanel extends StatefulWidget {
  final String groupId;
  const ScoreboardPanel({super.key, required this.groupId});

  @override
  State<ScoreboardPanel> createState() => _ScoreboardPanelState();
}

class _ScoreboardPanelState extends State<ScoreboardPanel> {
  List<dynamic> _rows = [];
  Map<String, dynamic>? _summary;
  bool _loading = true;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _load(silent: true));
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
    setState(() {
      _loading = false;
      if (res['success'] == true && res['data'] is Map) {
        _rows = List.from(res['data']['rows'] ?? []);
        _summary = Map<String, dynamic>.from(res['data']['summary'] ?? {});
      }
    });
  }

  String _money(num? v) {
    final f = NumberFormat('#,##0', 'en_US');
    return f.format((v ?? 0).round());
  }

  String _initials(String n) =>
      n.trim().split(RegExp(r'\s+')).take(2).map((s) => s.isEmpty ? '' : s[0].toUpperCase()).join();

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary, fontWeight: FontWeight.w600)),
          Icon(icon, size: 14, color: color),
        ]),
        const SizedBox(height: 6),
        Text(value, style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 16, color: color)),
      ]),
    );
  }

  Widget _podiumSlot({required Map row, required int rank, required double height, required Color ring}) {
    return Expanded(
      child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: ring,
          child: CircleAvatar(
            radius: 23,
            backgroundColor: AppColors.surface,
            backgroundImage: row['avatar_url'] != null ? NetworkImage(row['avatar_url']) : null,
            child: row['avatar_url'] == null
                ? Text(_initials(row['display_name'] ?? '?'), style: GoogleFonts.inter(fontWeight: FontWeight.w800, color: AppColors.primary))
                : null,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          height: height,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [ring.withOpacity(0.35), ring.withOpacity(0.05)],
            ),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            border: Border.all(color: ring.withOpacity(0.4)),
          ),
          child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
            Text('#$rank', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 12)),
            const SizedBox(height: 2),
            Text(row['display_name'] ?? '',
                maxLines: 1, overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 11, color: AppColors.textPrimary)),
            Text(_money(row['paid']),
                style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 11, color: AppColors.primary)),
          ]),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final top3 = _rows.take(3).toList();
    // Show ALL contributors in the leaderboard list (not just rank 4+).
    final rest = _rows;
    final rate = (_summary?['collection_rate'] ?? 0).toDouble();

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          // Stat grid
          GridView.count(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2, mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 2.2,
            children: [
              _statCard('Total Pledged', _money(_summary?['total_pledged']), Icons.trending_up, AppColors.primary),
              _statCard('Cash in Hand', _money(_summary?['total_paid']), Icons.account_balance_wallet, AppColors.success),
              _statCard('Outstanding', _money(_summary?['outstanding']), Icons.hourglass_empty, AppColors.warning),
              _statCard('Contributors', '${_summary?['contributors'] ?? 0}', Icons.group, AppColors.blue),
            ],
          ),
          const SizedBox(height: 12),
          if ((_summary?['total_pledged'] ?? 0) > 0)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text('Collection Progress', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                  Text('${rate.round()}%', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.primary)),
                ]),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (rate / 100).clamp(0.0, 1.0),
                    minHeight: 6, color: AppColors.primary, backgroundColor: AppColors.surfaceVariant,
                  ),
                ),
              ]),
            ),
          const SizedBox(height: 16),
          if (top3.isNotEmpty) ...[
            SizedBox(
              height: 180,
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                if (top3.length >= 2) _podiumSlot(row: top3[1], rank: 2, height: 80, ring: const Color(0xFFB6C0CE))
                else const Spacer(),
                if (top3.isNotEmpty) _podiumSlot(row: top3[0], rank: 1, height: 110, ring: const Color(0xFFFFB72D))
                else const Spacer(),
                if (top3.length >= 3) _podiumSlot(row: top3[2], rank: 3, height: 60, ring: const Color(0xFFFF9F66))
                else const Spacer(),
              ]),
            ),
            const SizedBox(height: 16),
          ],
          // Leaderboard
          Container(
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: Column(children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Icon(Icons.emoji_events_outlined, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text('Leaderboard', style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                  const Spacer(),
                  Text('${_rows.length}', style: GoogleFonts.inter(fontSize: 11, color: AppColors.textTertiary)),
                ]),
              ),
              const Divider(height: 1),
              if (_rows.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('No contributors yet', style: GoogleFonts.inter(color: AppColors.textTertiary)),
                )
              else
                ...rest.asMap().entries.map((e) {
                  final r = e.value as Map;
                  final rank = e.key + 1;
                  final pct = (r['pledged'] ?? 0) > 0 ? ((r['paid'] ?? 0) / (r['pledged'] ?? 1) * 100).clamp(0, 100).toInt() : 0;
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: AppColors.borderLight))),
                    child: Row(children: [
                      SizedBox(width: 24, child: Text('#$rank', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textTertiary))),
                      const SizedBox(width: 4),
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: AppColors.primarySoft,
                        backgroundImage: r['avatar_url'] != null ? NetworkImage(r['avatar_url']) : null,
                        child: r['avatar_url'] == null
                            ? Text(_initials(r['display_name'] ?? '?'), style: GoogleFonts.inter(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w700))
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(
                              child: Text(r['display_name'] ?? '',
                                  maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13)),
                            ),
                            Text(_money(r['paid']),
                                style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.primary)),
                          ]),
                          const SizedBox(height: 4),
                          Row(children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: pct / 100, minHeight: 4,
                                  color: AppColors.primary, backgroundColor: AppColors.surfaceVariant,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            SizedBox(width: 28, child: Text('$pct%', textAlign: TextAlign.right,
                                style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary, fontWeight: FontWeight.w600))),
                          ]),
                          const SizedBox(height: 2),
                          Text('Pledged ${_money(r['pledged'])} · Bal ${_money(r['balance'])}',
                              style: GoogleFonts.inter(fontSize: 10, color: AppColors.textTertiary)),
                        ]),
                      ),
                    ]),
                  );
                }),
            ]),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
