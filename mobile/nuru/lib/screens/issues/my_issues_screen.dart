import '../../core/widgets/nuru_refresh_indicator.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/social_service.dart';
import '../../core/l10n/l10n_helper.dart';

class MyIssuesScreen extends StatefulWidget {
  const MyIssuesScreen({super.key});

  @override
  State<MyIssuesScreen> createState() => _MyIssuesScreenState();
}

class _MyIssuesScreenState extends State<MyIssuesScreen> {
  bool _loading = true;
  List<dynamic> _issues = [];
  List<dynamic> _categories = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      SocialService.getMyIssues(),
      SocialService.getIssueCategories(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        if (results[0]['success'] == true) {
          final data = results[0]['data'];
          _issues = data is List ? data : (data is Map ? (data['issues'] ?? []) : []);
        }
        if (results[1]['success'] == true) {
          final data = results[1]['data'];
          _categories = data is List ? data : [];
        }
      });
    }
  }

  String _str(dynamic v, {String fallback = ''}) {
    if (v == null) return fallback;
    if (v is String) return v.isEmpty ? fallback : v;
    if (v is Map) return (v['name'] ?? v['title'] ?? v['label'] ?? v.values.first)?.toString() ?? fallback;
    return v.toString();
  }

  TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
      GoogleFonts.inter(fontSize: size, fontWeight: weight, color: color, height: height);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface, elevation: 0,
        leading: IconButton(
          icon: SvgPicture.asset('assets/icons/chevron-left-icon.svg', width: 22, height: 22,
            colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('My Issues', style: _f(size: 18, weight: FontWeight.w700)),
        centerTitle: false,
        actions: [
          IconButton(
            icon: SvgPicture.asset('assets/icons/plus-icon.svg', width: 20, height: 20,
              colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
            onPressed: () => _showNewIssueDialog(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _issues.isEmpty
              ? Center(child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_outline_rounded, size: 48, color: AppColors.textHint),
                    const SizedBox(height: 12),
                    Text('No issues reported', style: _f(size: 14, color: AppColors.textTertiary)),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _showNewIssueDialog,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: Text('Report an Issue', style: _f(size: 13, weight: FontWeight.w600, color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      ),
                    ),
                  ],
                ))
              : NuruRefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                    itemCount: _issues.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _issueCard(_issues[i] as Map<String, dynamic>),
                  ),
                ),
    );
  }

  Widget _issueCard(Map<String, dynamic> issue) {
    final title = _str(issue['title'], fallback: _str(issue['subject'], fallback: 'Issue'));
    final description = _str(issue['description']);
    final status = _str(issue['status'], fallback: 'open').toLowerCase();
    final createdAt = issue['created_at']?.toString() ?? '';
    final priority = _str(issue['priority']);
    final category = _str(issue['category']);

    Color statusColor;
    switch (status) {
      case 'resolved': case 'closed': statusColor = Colors.green; break;
      case 'in_progress': statusColor = Colors.amber; break;
      default: statusColor = AppColors.primary;
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: _f(size: 14, weight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                child: Text(status.replaceAll('_', ' '), style: _f(size: 10, weight: FontWeight.w600, color: statusColor)),
              ),
            ],
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(description, style: _f(size: 12, color: AppColors.textSecondary, height: 1.4), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              if (category.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4)),
                  child: Text(category, style: _f(size: 10, color: AppColors.textTertiary)),
                ),
                const SizedBox(width: 8),
              ],
              if (priority.isNotEmpty) ...[
                Text(priority, style: _f(size: 11, color: AppColors.textTertiary)),
                const SizedBox(width: 12),
              ],
              if (createdAt.isNotEmpty)
                Text(SocialService.getTimeAgo(createdAt), style: _f(size: 11, color: AppColors.textTertiary)),
            ],
          ),
        ],
      ),
    );
  }

  void _showNewIssueDialog() {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String? selectedCat;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Report an Issue', style: _f(size: 18, weight: FontWeight.w700)),
              const SizedBox(height: 16),
              if (_categories.isNotEmpty) ...[
                Text('Category', style: _f(size: 12, weight: FontWeight.w600, color: AppColors.textSecondary)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _categories.map((c) {
                    final cId = c['id']?.toString();
                    final cName = _str(c['name']);
                    final sel = selectedCat == cId;
                    return GestureDetector(
                      onTap: () => setModalState(() => selectedCat = cId),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: sel ? AppColors.primary : AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(cName, style: _f(size: 12, weight: FontWeight.w500, color: sel ? Colors.white : AppColors.textSecondary)),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),
              ],
              TextField(
                controller: titleCtrl,
                style: _f(size: 14),
                decoration: InputDecoration(
                  hintText: 'Issue title', hintStyle: _f(size: 14, color: AppColors.textHint),
                  filled: true, fillColor: AppColors.surfaceVariant,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: descCtrl,
                maxLines: 4,
                style: _f(size: 14),
                decoration: InputDecoration(
                  hintText: 'Describe the issue...', hintStyle: _f(size: 14, color: AppColors.textHint),
                  filled: true, fillColor: AppColors.surfaceVariant,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    if (titleCtrl.text.trim().isEmpty) return;
                    final res = await SocialService.createIssue(
                      title: titleCtrl.text.trim(),
                      description: descCtrl.text.trim(),
                      categoryId: selectedCat,
                    );
                    if (ctx.mounted) Navigator.pop(ctx);
                    if (res['success'] == true) _load();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text('Submit', style: _f(size: 14, weight: FontWeight.w600, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
