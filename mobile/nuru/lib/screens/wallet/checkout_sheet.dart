import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/wallet_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/money_format.dart';
import '../../providers/wallet_provider.dart';
import 'receipt_screen.dart';

/// CheckoutSheet — bottom sheet that mirrors the web `<CheckoutModal>`.
///
/// Lets the user pay via Wallet, Mobile Money (STK push), or Bank transfer.
/// Polls `/payments/{code}/status` until the gateway returns a terminal state.
class CheckoutSheet extends StatefulWidget {
  final String targetType;
  final String? targetId;
  final num? amount;
  final bool amountEditable;
  final bool allowWallet;
  final String title;
  final String? description;
  final void Function(Map<String, dynamic> tx)? onSuccess;

  const CheckoutSheet({
    super.key,
    required this.targetType,
    this.targetId,
    this.amount,
    this.amountEditable = false,
    this.allowWallet = true,
    required this.title,
    this.description,
    this.onSuccess,
  });

  @override
  State<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<CheckoutSheet> {
  String _method = 'wallet';
  String? _providerId;
  final _amountCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _accountCtrl = TextEditingController();
  bool _busy = false;
  bool _loadingProviders = false;
  List<Map<String, dynamic>> _providers = [];

  @override
  void initState() {
    super.initState();
    _method = widget.allowWallet ? 'wallet' : 'mobile_money';
    if (widget.amount != null) {
      _amountCtrl.text = widget.amount!.toString();
    }
    _loadProviders();
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _phoneCtrl.dispose();
    _accountCtrl.dispose();
    super.dispose();
  }

  String get _currency => context.read<WalletProvider>().currency;
  String get _country => _currency == 'KES' ? 'KE' : 'TZ';

  Future<void> _loadProviders() async {
    if (_method == 'wallet') return;
    setState(() => _loadingProviders = true);
    final res = await WalletService.listProviders(countryCode: _country);
    if (!mounted) return;
    final list = ((res['data']?['providers'] as List?) ?? const [])
        .cast<Map<String, dynamic>>();
    final filtered = list
        .where((p) =>
            (p['provider_type'] ?? '') ==
            (_method == 'mobile_money' ? 'mobile_money' : 'bank'))
        .toList();
    setState(() {
      _providers = filtered;
      _loadingProviders = false;
      if (filtered.isNotEmpty &&
          !filtered.any((p) => p['id'] == _providerId)) {
        _providerId = filtered.first['id'] as String;
      }
    });
  }

  Future<Map<String, dynamic>?> _pollUntilTerminal(String code) async {
    final start = DateTime.now();
    while (DateTime.now().difference(start) < const Duration(seconds: 90)) {
      await Future.delayed(const Duration(milliseconds: 2500));
      final res = await WalletService.getStatus(code);
      if (res['success'] == true && res['data'] != null) {
        final tx = Map<String, dynamic>.from(res['data'] as Map);
        if (['succeeded', 'failed', 'cancelled', 'refunded'].contains(tx['status'])) {
          return tx;
        }
      }
    }
    return null;
  }

  Future<void> _submit() async {
    final amount = num.tryParse(_amountCtrl.text.replaceAll(',', '').trim()) ?? widget.amount ?? 0;
    if (amount <= 0) {
      _toast('Enter a valid amount');
      return;
    }
    if (_method == 'mobile_money' && _phoneCtrl.text.trim().isEmpty) {
      _toast('Enter your mobile number');
      return;
    }
    if (_method == 'bank' && _accountCtrl.text.trim().isEmpty) {
      _toast('Enter your account number');
      return;
    }

    setState(() => _busy = true);
    try {
      final res = await WalletService.initiatePayment(
        targetType: widget.targetType,
        targetId: widget.targetId,
        amount: amount,
        useWallet: _method == 'wallet',
        providerId: _method != 'wallet' ? _providerId : null,
        phone: _method == 'mobile_money' ? _phoneCtrl.text.trim() : null,
        accountNumber: _method == 'bank' ? _accountCtrl.text.trim() : null,
      );
      if (res['success'] != true || res['data'] == null) {
        _toast(res['message']?.toString() ?? 'Failed to start payment');
        return;
      }
      final data = Map<String, dynamic>.from(res['data'] as Map);
      final tx = Map<String, dynamic>.from(data['transaction'] as Map);

      // Wallet payments settle synchronously.
      if (_method == 'wallet' || tx['status'] == 'succeeded') {
        if (!mounted) return;
        widget.onSuccess?.call(tx);
        Navigator.of(context).pop();
        _openReceipt(tx['transaction_code'].toString());
        return;
      }

      _toast(data['user_message']?.toString() ?? 'Check your phone to approve the payment');
      final final_ = await _pollUntilTerminal(tx['transaction_code'].toString());
      if (!mounted) return;
      if (final_?['status'] == 'succeeded') {
        widget.onSuccess?.call(final_!);
        Navigator.of(context).pop();
        _openReceipt(final_['transaction_code'].toString());
      } else if (final_ != null) {
        _toast(final_['failure_reason']?.toString() ?? 'Payment ${final_['status']}');
      } else {
        _toast('Still processing — check Wallet › Transactions in a moment');
        Navigator.of(context).pop();
      }
    } catch (e) {
      _toast('Something went wrong');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openReceipt(String code) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => ReceiptScreen(transactionCode: code),
    ));
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final amount = num.tryParse(_amountCtrl.text.replaceAll(',', '').trim()) ?? widget.amount ?? 0;
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
              Center(
                child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(color: AppColors.borderLight, borderRadius: BorderRadius.circular(4)),
                ),
              ),
              const SizedBox(height: 14),
              Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              if (widget.description != null) ...[
                const SizedBox(height: 4),
                Text(widget.description!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
              const SizedBox(height: 16),

              // Amount
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('AMOUNT',
                      style: TextStyle(fontSize: 10, letterSpacing: 1.2, color: AppColors.textTertiary, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    if (widget.amountEditable)
                      TextField(
                        controller: _amountCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                        decoration: InputDecoration(
                          prefixText: '$_currency  ',
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                          hintText: '0',
                        ),
                        onChanged: (_) => setState(() {}),
                      )
                    else
                      Text(formatMoney(amount, currency: _currency),
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Method picker
              if (widget.allowWallet)
                _MethodTile(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Nuru Wallet',
                  subtitle: 'Instant · No fee',
                  selected: _method == 'wallet',
                  onTap: () => setState(() => _method = 'wallet'),
                ),
              _MethodTile(
                icon: Icons.smartphone,
                title: 'Mobile Money',
                subtitle: 'M-Pesa, Tigo Pesa, Airtel Money',
                selected: _method == 'mobile_money',
                onTap: () { setState(() => _method = 'mobile_money'); _loadProviders(); },
              ),
              _MethodTile(
                icon: Icons.account_balance_outlined,
                title: 'Bank Transfer',
                subtitle: 'CRDB, NMB, Equity, KCB',
                selected: _method == 'bank',
                onTap: () { setState(() => _method = 'bank'); _loadProviders(); },
              ),

              if (_method != 'wallet') ...[
                const SizedBox(height: 14),
                if (_loadingProviders)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                else if (_providers.isEmpty)
                  const Text('No providers available for your country.', style: TextStyle(color: AppColors.textTertiary, fontSize: 12))
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
                const SizedBox(height: 12),
                if (_method == 'mobile_money')
                  TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Mobile number',
                      hintText: '07XXXXXXXX',
                      border: OutlineInputBorder(),
                    ),
                  ),
                if (_method == 'bank')
                  TextField(
                    controller: _accountCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Account number',
                      border: OutlineInputBorder(),
                    ),
                  ),
              ],

              const SizedBox(height: 16),
              Row(
                children: const [
                  Icon(Icons.shield_outlined, size: 14, color: AppColors.textTertiary),
                  SizedBox(width: 6),
                  Expanded(child: Text(
                    'Secured by Nuru. Funds held in escrow until delivery.',
                    style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                  )),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textOnPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  child: _busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Pay ${formatMoney(amount, currency: _currency)}'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MethodTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  const _MethodTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? AppColors.primarySoft : AppColors.surface,
            border: Border.all(color: selected ? AppColors.primary : AppColors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: selected ? AppColors.primary : AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: selected ? AppColors.textOnPrimary : AppColors.textPrimary, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    Text(subtitle, style: const TextStyle(color: AppColors.textTertiary, fontSize: 11)),
                  ],
                ),
              ),
              Container(
                width: 18, height: 18,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: selected ? AppColors.primary : AppColors.border, width: 2),
                  color: selected ? AppColors.primary : Colors.transparent,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
