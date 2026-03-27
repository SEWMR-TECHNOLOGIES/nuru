import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/services/social_service.dart';

class RemovedContentScreen extends StatefulWidget {
  const RemovedContentScreen({super.key});

  @override
  State<RemovedContentScreen> createState() => _RemovedContentScreenState();
}

class _RemovedContentScreenState extends State<RemovedContentScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _removedPosts = [];
  List<dynamic> _removedMoments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() { _tabController.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      SocialService.getMyRemovedPosts(),
      SocialService.getMyRemovedMoments(),
    ]);
    if (mounted) {
      setState(() {
        _loading = false;
        if (results[0]['success'] == true) {
          final data = results[0]['data'];
          _removedPosts = data is List ? data : (data is Map ? (data['posts'] ?? []) : []);
        }
        if (results[1]['success'] == true) {
          final data = results[1]['data'];
          _removedMoments = data is List ? data : (data is Map ? (data['moments'] ?? []) : []);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: NuruSubPageAppBar(
        title: 'Removed Content',
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textTertiary,
          indicatorColor: AppColors.primary,
          labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: [
            Tab(text: 'Posts (${_removedPosts.length})'),
            Tab(text: 'Moments (${_removedMoments.length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : TabBarView(
              controller: _tabController,
              children: [
                _contentList(_removedPosts, isPost: true),
                _contentList(_removedMoments, isPost: false),
              ],
            ),
    );
  }

  Widget _contentList(List<dynamic> items, {required bool isPost}) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(28)),
              child: const Icon(Icons.visibility_off_outlined, size: 24, color: AppColors.textHint),
            ),
            const SizedBox(height: 14),
            Text('No removed ${isPost ? "posts" : "moments"}',
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (_, i) => _removedItem(items[i], isPost: isPost),
    );
  }

  Widget _removedItem(dynamic item, {required bool isPost}) {
    final m = item is Map<String, dynamic> ? item : <String, dynamic>{};
    final content = m['content']?.toString() ?? m['caption']?.toString() ?? '';
    final reason = m['removal_reason']?.toString() ?? m['reason']?.toString() ?? 'Policy violation';
    final removedAt = m['removed_at']?.toString() ?? m['updated_at']?.toString() ?? '';
    final hasAppeal = m['appeal_status'] != null;
    final appealStatus = m['appeal_status']?.toString() ?? '';
    final id = m['id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.errorSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.error),
              const SizedBox(width: 6),
              Expanded(child: Text('Removed: $reason', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.error, height: 1.3))),
            ],
          ),
          if (content.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(content, maxLines: 3, overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (removedAt.isNotEmpty)
                Text(SocialService.getTimeAgo(removedAt), style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textTertiary)),
              const Spacer(),
              if (hasAppeal)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(6)),
                  child: Text('Appeal: $appealStatus', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                )
              else
                GestureDetector(
                  onTap: () => _showAppealDialog(id, isPost),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(8)),
                    child: Text('Appeal', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAppealDialog(String id, bool isPost) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Submit Appeal', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
        content: TextField(
          controller: ctrl,
          maxLines: 4,
          decoration: InputDecoration(hintText: 'Explain why this should be restored...',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () async {
              if (ctrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              if (isPost) {
                await SocialService.submitPostAppeal(id, ctrl.text.trim());
              } else {
                await SocialService.submitMomentAppeal(id, ctrl.text.trim());
              }
              _load();
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }
}
