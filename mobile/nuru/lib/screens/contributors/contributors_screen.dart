import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import '../../core/services/secure_token_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/services/user_services_service.dart';
import '../../core/services/social_service.dart';
import '../../core/services/api_service.dart';
import '../../core/l10n/l10n_helper.dart';
import 'widgets/my_contribution_payments_tab.dart';

class ContributorsScreen extends StatefulWidget {
  const ContributorsScreen({super.key});

  @override
  State<ContributorsScreen> createState() => _ContributorsScreenState();
}

class _ContributorsScreenState extends State<ContributorsScreen> {
  List<dynamic> _contributors = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await UserServicesService.getContributors();
    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          final data = res['data'];
          if (data is Map) {
            _contributors = data['contributors'] ?? [];
          } else if (data is List) {
            _contributors = data;
          } else {
            _contributors = [];
          }
        }
      });
    }
  }

  Future<Map<String, String>> _headers() async {
    final token = await SecureTokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> _deleteContributor(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.trw('delete_contributor'), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700)),
        content: Text(context.trw('confirm_remove_contributor'), style: GoogleFonts.plusJakartaSans()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.trw('delete'), style: GoogleFonts.plusJakartaSans(color: AppColors.error, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      final headers = await _headers();
      await http.delete(Uri.parse('${ApiService.baseUrl}/user-contributors/$id'), headers: headers);
      if (mounted) {
        AppSnackbar.success(context, context.tr('contributor_removed'));
        _load();
      }
    } catch (_) {
      if (mounted) AppSnackbar.error(context, context.tr('failed_delete'));
    }
  }

  void _editContributor(Map<String, dynamic> c) {
    final nameCtrl = TextEditingController(text: c['name']?.toString() ?? '');
    final emailCtrl = TextEditingController(text: c['email']?.toString() ?? '');
    final phoneCtrl = TextEditingController(text: c['phone']?.toString() ?? '');
    final notesCtrl = TextEditingController(text: c['notes']?.toString() ?? '');
    final id = c['id']?.toString() ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 20),
              Text(context.trw('edit_contributor'), style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              _editField(nameCtrl, 'Name'),
              const SizedBox(height: 10),
              _editField(phoneCtrl, 'Phone', type: TextInputType.phone),
              const SizedBox(height: 10),
              _editField(emailCtrl, 'Email', type: TextInputType.emailAddress),
              const SizedBox(height: 10),
              _editField(notesCtrl, 'Notes'),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    try {
                      final headers = await _headers();
                      await http.put(
                        Uri.parse('${ApiService.baseUrl}/user-contributors/$id'),
                        headers: headers,
                        body: jsonEncode({
                          'name': nameCtrl.text.trim(),
                          'email': emailCtrl.text.trim(),
                          'phone': phoneCtrl.text.trim(),
                          'notes': notesCtrl.text.trim(),
                        }),
                      );
                      if (mounted) {
                        AppSnackbar.success(context, context.tr('contributor_updated'));
                        _load();
                      }
                    } catch (_) {
                      if (mounted) AppSnackbar.error(context, context.tr('failed_update'));
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: Text(context.trw('save_changes'), style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _editField(TextEditingController ctrl, String label, {TextInputType type = TextInputType.text}) {
    return TextField(
      controller: ctrl,
      keyboardType: type,
      style: GoogleFonts.plusJakartaSans(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary),
        filled: true,
        fillColor: AppColors.surfaceVariant,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.surface,
        appBar: NuruSubPageAppBar(
          title: context.tr('contributors'),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(46),
            child: Container(
              color: AppColors.surface,
              child: TabBar(
                indicatorColor: AppColors.primary,
                indicatorWeight: 3,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textTertiary,
                labelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w700),
                unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
                tabs: const [
                  Tab(text: 'Contributors'),
                  Tab(text: 'My Contributions'),
                ],
              ),
            ),
          ),
        ),
        body: TabBarView(
          children: [
            RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : _contributors.isEmpty
                      ? ListView(children: [
                          SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                          _emptyState(),
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _contributors.length,
                          itemBuilder: (_, i) => _contributorCard(_contributors[i]),
                        ),
            ),
            const MyContributionPaymentsTab(),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    return Column(
      children: [
        Container(
          width: 64, height: 64,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(32)),
          child: const Center(child: Icon(Icons.volunteer_activism_outlined, size: 28, color: AppColors.textHint)),
        ),
        const SizedBox(height: 16),
        Text('No contributors yet', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        Text('Your contributor address book will appear here', style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.textTertiary)),
      ],
    );
  }

  Widget _contributorCard(dynamic contributor) {
    final c = contributor is Map<String, dynamic> ? contributor : <String, dynamic>{};
    final name = c['name']?.toString() ?? 'Unknown';
    final email = c['email']?.toString() ?? '';
    final phone = c['phone']?.toString() ?? '';
    final notes = c['notes']?.toString() ?? '';
    final createdAt = c['created_at']?.toString() ?? '';
    final id = c['id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          Container(
            width: 44, height: 44,
            decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.primarySoft),
            child: Center(child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primary),
            )),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.3)),
                if (phone.isNotEmpty)
                  Text(phone, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary, height: 1.3)),
                if (email.isNotEmpty)
                  Text(email, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: AppColors.textTertiary, height: 1.3)),
                if (notes.isNotEmpty)
                  Text(notes, style: GoogleFonts.plusJakartaSans(fontSize: 11, color: AppColors.textHint, height: 1.3),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                if (createdAt.isNotEmpty)
                  Text(SocialService.getTimeAgo(createdAt), style: GoogleFonts.plusJakartaSans(fontSize: 10, color: AppColors.textHint)),
              ],
            ),
          ),
          // Edit/Delete actions
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textHint),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            onSelected: (action) {
              if (action == 'edit') _editContributor(c);
              if (action == 'delete' && id.isNotEmpty) _deleteContributor(id);
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'edit', child: Row(children: [
                const Icon(Icons.edit_rounded, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(context.trw('edit'), style: GoogleFonts.plusJakartaSans(fontSize: 13)),
              ])),
              PopupMenuItem(value: 'delete', child: Row(children: [
                const Icon(Icons.delete_rounded, size: 16, color: AppColors.error),
                const SizedBox(width: 8),
                Text(context.trw('delete'), style: GoogleFonts.plusJakartaSans(fontSize: 13, color: AppColors.error)),
              ])),
            ],
          ),
        ],
      ),
    );
  }
}
