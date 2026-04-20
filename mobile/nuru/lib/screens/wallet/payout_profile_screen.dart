import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/wallet_service.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/wallet_provider.dart';

/// PayoutProfileScreen — manage saved mobile money / bank accounts that Nuru
/// uses to send the user money. Mirrors the web `SettingsPayments` page.
class PayoutProfileScreen extends StatefulWidget {
  const PayoutProfileScreen({super.key});

  @override
  State<PayoutProfileScreen> createState() => _PayoutProfileScreenState();
}

class _PayoutProfileScreenState extends State<PayoutProfileScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _profiles = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await WalletService.listProfiles();
    if (!mounted) return;
    setState(() {
      _profiles = ((res['data']?['profiles'] as List?) ?? const [])
          .cast<Map<String, dynamic>>();
      _loading = false;
    });
  }

  Future<void> _setDefault(String id) async {
    final res = await WalletService.setDefaultProfile(id);
    if (res['success'] == true) {
      _load();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message']?.toString() ?? 'Failed to set default')),
      );
    }
  }

  Future<void> _delete(String id) async {
    final res = await WalletService.deleteProfile(id);
    if (res['success'] == true) _load();
  }

  void _openAdd() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddProfileSheet(onSaved: _load),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const BackButton(color: AppColors.textPrimary),
        title: const Text('Payout methods',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAdd,
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textOnPrimary,
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _profiles.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text(
                      'No payout methods yet.\nTap Add to register a mobile money or bank account.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textTertiary),
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _profiles.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final p = _profiles[i];
                    final isMobile = (p['method_type'] ?? '') == 'mobile_money';
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.primarySoft,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              isMobile ? Icons.smartphone : Icons.account_balance_outlined,
                              color: AppColors.primary, size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  Text((p['account_name'] ?? '').toString(),
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                                  const SizedBox(width: 6),
                                  if (p['is_default'] == true)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(color: AppColors.successSoft, borderRadius: BorderRadius.circular(4)),
                                      child: const Text('Default',
                                        style: TextStyle(color: AppColors.success, fontSize: 9, fontWeight: FontWeight.w700)),
                                    ),
                                ]),
                                const SizedBox(height: 2),
                                Text((p['account_number'] ?? '').toString(),
                                  style: const TextStyle(color: AppColors.textTertiary, fontSize: 12)),
                                Text(
                                  '${(p['provider']?['display_name'] ?? p['provider_id'] ?? '').toString()} · ${(p['currency_code'] ?? '').toString()}',
                                  style: const TextStyle(color: AppColors.textTertiary, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          PopupMenuButton<String>(
                            onSelected: (v) {
                              if (v == 'default') _setDefault(p['id'] as String);
                              if (v == 'delete') _delete(p['id'] as String);
                            },
                            itemBuilder: (_) => [
                              if (p['is_default'] != true)
                                const PopupMenuItem(value: 'default', child: Text('Set as default')),
                              const PopupMenuItem(value: 'delete', child: Text('Delete')),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

class _AddProfileSheet extends StatefulWidget {
  final VoidCallback onSaved;
  const _AddProfileSheet({required this.onSaved});

  @override
  State<_AddProfileSheet> createState() => _AddProfileSheetState();
}

class _AddProfileSheetState extends State<_AddProfileSheet> {
  String _method = 'mobile_money';
  String? _providerId;
  bool _busy = false;
  bool _loadingProviders = false;
  bool _setDefault = true;
  List<Map<String, dynamic>> _providers = [];

  final _name = TextEditingController();
  final _number = TextEditingController();
  final _phone = TextEditingController();
  final _branch = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProviders();
  }

  Future<void> _loadProviders() async {
    setState(() => _loadingProviders = true);
    final country = context.read<WalletProvider>().currency == 'KES' ? 'KE' : 'TZ';
    final res = await WalletService.listProviders(countryCode: country, payout: true);
    if (!mounted) return;
    final list = ((res['data']?['providers'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .where((p) => (p['provider_type'] ?? '') == (_method == 'mobile_money' ? 'mobile_money' : 'bank'))
        .toList();
    setState(() {
      _providers = list;
      _loadingProviders = false;
      if (list.isNotEmpty && !list.any((p) => p['id'] == _providerId)) {
        _providerId = list.first['id'] as String;
      }
    });
  }

  Future<void> _save() async {
    if (_providerId == null) {
      _toast('Select a provider');
      return;
    }
    if (_name.text.trim().isEmpty || _number.text.trim().isEmpty) {
      _toast('Account name and number are required');
      return;
    }
    setState(() => _busy = true);
    final country = context.read<WalletProvider>().currency == 'KES' ? 'KE' : 'TZ';
    final res = await WalletService.createProfile({
      'method_type': _method,
      'provider_id': _providerId,
      'country_code': country,
      'account_name': _name.text.trim(),
      'account_number': _number.text.trim(),
      if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
      if (_branch.text.trim().isNotEmpty) 'bank_branch': _branch.text.trim(),
      'set_default': _setDefault,
    });
    setState(() => _busy = false);
    if (!mounted) return;
    if (res['success'] == true) {
      widget.onSaved();
      Navigator.pop(context);
    } else {
      _toast(res['message']?.toString() ?? 'Failed to save');
    }
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 36, height: 4,
                decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(4)))),
              const SizedBox(height: 14),
              const Text('Add payout method',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              const SizedBox(height: 14),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'mobile_money', label: Text('Mobile money'), icon: Icon(Icons.smartphone, size: 16)),
                  ButtonSegment(value: 'bank_account', label: Text('Bank'), icon: Icon(Icons.account_balance_outlined, size: 16)),
                ],
                selected: {_method == 'mobile_money' ? 'mobile_money' : 'bank_account'},
                onSelectionChanged: (s) {
                  setState(() => _method = s.first == 'bank_account' ? 'bank_account' : 'mobile_money');
                  _loadProviders();
                },
              ),
              const SizedBox(height: 14),
              if (_loadingProviders)
                const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
              else
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _providers.map((p) {
                    final selected = _providerId == p['id'];
                    return GestureDetector(
                      onTap: () => setState(() => _providerId = p['id'] as String),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: selected ? AppColors.primarySoft : AppColors.surfaceVariant,
                          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(p['display_name']?.toString() ?? '',
                          style: TextStyle(fontWeight: FontWeight.w600, color: selected ? AppColors.primary : AppColors.textPrimary, fontSize: 12)),
                      ),
                    );
                  }).toList(),
                ),
              const SizedBox(height: 14),
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Account name', border: OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: _number, decoration: const InputDecoration(labelText: 'Account number', border: OutlineInputBorder())),
              const SizedBox(height: 10),
              if (_method == 'mobile_money')
                TextField(controller: _phone, keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone (international)', hintText: '+255712345678', border: OutlineInputBorder())),
              if (_method == 'bank_account')
                TextField(controller: _branch, decoration: const InputDecoration(labelText: 'Branch (optional)', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              SwitchListTile(
                value: _setDefault,
                onChanged: (v) => setState(() => _setDefault = v),
                title: const Text('Set as default', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                contentPadding: EdgeInsets.zero,
                activeColor: AppColors.primary,
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textOnPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Save', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
