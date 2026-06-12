import '../../core/widgets/nuru_refresh_indicator.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/money_format.dart';
import '../../core/widgets/app_icon.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
import '../../core/widgets/nuru_skeleton.dart';
import '../../providers/wallet_provider.dart';
import '../bookings/bookings_screen.dart';
import 'make_payment_screen.dart';
import 'receipt_screen.dart';
import 'payout_profile_screen.dart';
import 'payment_history_screen.dart';
import '../migration/migration_banner.dart';

/// WalletScreen — premium dashboard mirroring the web `/wallet` page.
/// Shows balance hero, quick actions, ledger + transactions tabs.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WalletProvider>().refresh();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _openTopUp() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MakePaymentScreen(
          targetType: 'wallet_topup',
          title: 'Top up wallet',
          amountEditable: true,
          allowWallet: false,
          showFee: false,
          onSuccess: (_) => context.read<WalletProvider>().refresh(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: NuruSubPageAppBar(
        title: 'Wallet',
        actions: [
          IconButton(
            icon: const AppIcon('list', size: 22, color: AppColors.textPrimary),
            tooltip: 'Payment history',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PaymentHistoryScreen()),
              );
            },
          ),
          IconButton(
            icon: const AppIcon('wallet', size: 22, color: AppColors.textPrimary),
            tooltip: 'Payout settings',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PayoutProfileScreen()),
              );
            },
          ),
        ],
      ),
      body: Consumer<WalletProvider>(
        builder: (context, p, _) {
          return NuruRefreshIndicator(
            onRefresh: p.refresh,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Static (non-scrolling) header — like event detail page.
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const MigrationBanner(
                        surface: MigrationSurface.wallet,
                        margin: EdgeInsets.only(bottom: 12),
                      ),
                      _BalanceHero(
                        provider: p,
                        onTopUp: _openTopUp,
                        onPay: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const BookingsScreen()),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _ActivityTabs(controller: _tabs),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
                // Each tab scrolls itself, matching event detail behaviour.
                Expanded(
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      _LedgerList(
                        entries: p.ledger,
                        currency: p.currency,
                        loading: p.loading,
                      ),
                      _TransactionList(
                        transactions: p.transactions,
                        loading: p.loading,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── Balance hero ─────────────────────────────────────────────────────────────

class _BalanceHero extends StatefulWidget {
  final WalletProvider provider;
  final VoidCallback onTopUp;
  final VoidCallback onPay;
  const _BalanceHero({
    required this.provider,
    required this.onTopUp,
    required this.onPay,
  });

  @override
  State<_BalanceHero> createState() => _BalanceHeroState();
}

class _BalanceHeroState extends State<_BalanceHero> {
  bool _hidden = false;

  static const _gradStart = Color(0xFF1A1530);
  static const _gradEnd = Color(0xFF3B2A6B);
  static const _accent = Color(0xFFFFD66B);

  String _mask(num value) {
    if (_hidden) return '••••••';
    return formatMoney(value, currency: widget.provider.currency);
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.provider;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_gradStart, _gradEnd],
        ),
        boxShadow: [
          BoxShadow(
            color: _gradEnd.withOpacity(0.28),
            blurRadius: 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative orbs
          Positioned(
            right: -40, top: -50,
            child: Container(
              width: 170, height: 170,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.05),
              ),
            ),
          ),
          Positioned(
            right: 60, bottom: -60,
            child: Container(
              width: 130, height: 130,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _accent.withOpacity(0.06),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 16, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: label + currency pill + eye toggle
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AppIcon('wallet',
                              size: 13,
                              color: Colors.white.withOpacity(0.95)),
                          const SizedBox(width: 6),
                          Text(
                            'AVAILABLE BALANCE',
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.95),
                              fontSize: 10,
                              letterSpacing: 1.2,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _accent.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        p.currency,
                        style: const TextStyle(
                          color: _accent,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      padding: EdgeInsets.zero,
                      constraints:
                          const BoxConstraints(minWidth: 36, minHeight: 36),
                      tooltip: _hidden ? 'Show balance' : 'Hide balance',
                      onPressed: () => setState(() => _hidden = !_hidden),
                      icon: AppIcon(
                        _hidden ? 'eye-off' : 'eye-on',
                        size: 18,
                        color: Colors.white.withOpacity(0.9),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  _mask(p.availableBalance),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.8,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _MiniStat(
                        label: 'PENDING',
                        value: _mask(p.pendingBalance),
                        dotColor: const Color(0xFFFFC857),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _MiniStat(
                        label: 'RESERVED',
                        value: _mask(p.reservedBalance),
                        dotColor: const Color(0xFF7DD3FC),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _HeroAction(
                        label: 'Top up',
                        icon: 'plus',
                        filled: true,
                        onTap: widget.onTopUp,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _HeroAction(
                        label: 'Pay',
                        icon: 'send',
                        onTap: widget.onPay,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _HeroAction(
                        label: 'Withdraw',
                        icon: 'arrow-right',
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const PayoutProfileScreen(),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroAction extends StatelessWidget {
  final String label;
  final String icon;
  final VoidCallback onTap;
  final bool filled;
  const _HeroAction({
    required this.label,
    required this.icon,
    required this.onTap,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    final fg = filled ? const Color(0xFF1A1530) : Colors.white;
    return Material(
      color: filled ? Colors.white : Colors.white.withOpacity(0.10),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: filled
                ? null
                : Border.all(color: Colors.white.withOpacity(0.18)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AppIcon(icon, size: 16, color: fg),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: fg,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color dotColor;
  const _MiniStat({
    required this.label,
    required this.value,
    required this.dotColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6, height: 6,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.62),
                  fontSize: 9.5,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Activity tabs ────────────────────────────────────────────────────────────

class _ActivityTabs extends StatelessWidget {
  final TabController controller;
  const _ActivityTabs({required this.controller});

  static const _labels = ['Ledger', 'Transactions'];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: AnimatedBuilder(
        animation: controller,
        builder: (_, __) => Row(
          children: List.generate(_labels.length, (i) {
            final active = controller.index == i;
            return Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => controller.animateTo(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    _labels[i],
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ).copyWith(
                      color: active ? Colors.white : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

// ─── Ledger list ──────────────────────────────────────────────────────────────

class _LedgerList extends StatelessWidget {
  final List<Map<String, dynamic>> entries;
  final String currency;
  final bool loading;
  const _LedgerList({
    required this.entries,
    required this.currency,
    required this.loading,
  });

  @override
  Widget build(BuildContext context) {
    if (loading && entries.isEmpty)
      return const NuruSkeletonList(itemCount: 6, showTrailing: true);
    if (entries.isEmpty)
      return const _EmptyState(text: 'No wallet activity yet.');
    return ListView.separated(
      itemCount: entries.length,
      padding: const EdgeInsets.symmetric(vertical: 8),
      separatorBuilder: (_, __) =>
          const Divider(height: 1, color: AppColors.divider),
      itemBuilder: (_, i) {
        final e = entries[i];
        final type = (e['entry_type'] ?? '').toString();
        final isCredit = ['credit', 'release', 'settlement'].contains(type);
        final amount = (e['amount'] ?? 0) as num;
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 4,
            vertical: 4,
          ),
          leading: CircleAvatar(
            backgroundColor:
                isCredit ? AppColors.successSoft : AppColors.warningSoft,
            child: AppIcon(
              isCredit ? 'download' : 'arrow-right',
              color: isCredit ? AppColors.success : AppColors.warning,
              size: 18,
            ),
          ),
          title: Text(
            (e['description'] ?? type.replaceAll('_', ' ')).toString(),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
          subtitle: Text(
            '${e['reference_code'] ?? '—'} · ${_fmtDate(e['created_at'])}',
            style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
          ),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : '−'} ${formatMoney(amount, currency: currency)}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isCredit ? AppColors.success : AppColors.textPrimary,
                ),
              ),
              Text(
                'Bal ${formatMoney((e['balance_after'] ?? 0) as num, currency: currency)}',
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textTertiary,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Transaction list ─────────────────────────────────────────────────────────

class _TransactionList extends StatelessWidget {
  final List<Map<String, dynamic>> transactions;
  final bool loading;
  const _TransactionList({required this.transactions, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (loading && transactions.isEmpty)
      return const NuruSkeletonList(itemCount: 6, showTrailing: true);
    if (transactions.isEmpty)
      return const _EmptyState(text: 'No transactions yet.');
    return ListView.separated(
      itemCount: transactions.length,
      padding: const EdgeInsets.symmetric(vertical: 8),
      separatorBuilder: (_, __) =>
          const Divider(height: 1, color: AppColors.divider),
      itemBuilder: (_, i) {
        final tx = transactions[i];
        final status = (tx['status'] ?? '').toString();
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 4,
            vertical: 4,
          ),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ReceiptScreen(
                  transactionCode: (tx['transaction_code'] ?? '').toString(),
                ),
              ),
            );
          },
          title: Text(
            (tx['description'] ??
                    (tx['target_type'] ?? '').toString().replaceAll('_', ' '))
                .toString(),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
          subtitle: Text(
            '${tx['transaction_code']} · ${_fmtDate(tx['initiated_at'])}',
            style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
          ),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatMoney(
                  (tx['gross_amount'] ?? 0) as num,
                  currency: (tx['currency_code'] ?? '').toString(),
                ),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              _StatusChip(status: status),
            ],
          ),
        );
      },
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg, fg;
    switch (status) {
      case 'succeeded':
        bg = AppColors.successSoft;
        fg = AppColors.success;
        break;
      case 'pending':
      case 'processing':
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
        break;
      case 'failed':
      case 'cancelled':
        bg = AppColors.errorSoft;
        fg = AppColors.error;
        break;
      default:
        bg = AppColors.surfaceMuted;
        fg = AppColors.textSecondary;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status,
        style: TextStyle(color: fg, fontSize: 9, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String text;
  const _EmptyState({required this.text});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Text(text, style: const TextStyle(color: AppColors.textTertiary)),
    ),
  );
}

String _fmtDate(dynamic v) {
  if (v == null) return '';
  try {
    final d = DateTime.parse(v.toString()).toLocal();
    return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    return v.toString();
  }
}
