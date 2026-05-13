import '../../core/widgets/nuru_refresh_indicator.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/money_format.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';
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
            icon: const Icon(
              Icons.receipt_long_rounded,
              color: AppColors.textPrimary,
            ),
            tooltip: 'Payment history',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PaymentHistoryScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(
              Icons.settings_outlined,
              color: AppColors.textPrimary,
            ),
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
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
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
                SizedBox(
                  height: 480,
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

class _BalanceHero extends StatelessWidget {
  final WalletProvider provider;
  final VoidCallback onTopUp;
  final VoidCallback onPay;
  const _BalanceHero({
    required this.provider,
    required this.onTopUp,
    required this.onPay,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceDark,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.account_balance_wallet_outlined,
                color: AppColors.textOnDarkMuted,
                size: 16,
              ),
              const SizedBox(width: 6),
              Text(
                'AVAILABLE BALANCE',
                style: TextStyle(
                  color: AppColors.textOnDarkMuted,
                  fontSize: 10,
                  letterSpacing: 1.4,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  provider.currency,
                  style: const TextStyle(
                    color: AppColors.textOnDark,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            formatMoney(provider.availableBalance, currency: provider.currency),
            style: const TextStyle(
              color: AppColors.textOnDark,
              fontSize: 30,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MiniStat(
                  label: 'Pending',
                  value: formatMoney(
                    provider.pendingBalance,
                    currency: provider.currency,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _MiniStat(
                  label: 'Reserved',
                  value: formatMoney(
                    provider.reservedBalance,
                    currency: provider.currency,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: onTopUp,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Top up'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.surfaceDark,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onPay,
                  icon: const Icon(Icons.send_outlined, size: 18),
                  label: const Text('Pay'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textOnDark,
                    side: BorderSide(color: Colors.white.withOpacity(0.25)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const PayoutProfileScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.north_east, size: 18),
                  label: const Text('Withdraw'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textOnDark,
                    side: BorderSide(color: Colors.white.withOpacity(0.25)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: AppColors.textOnDarkMuted,
              fontSize: 10,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textOnDark,
              fontSize: 14,
              fontWeight: FontWeight.w700,
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

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: controller,
        indicator: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          boxShadow: AppColors.subtleShadow,
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.all(4),
        labelColor: AppColors.textPrimary,
        unselectedLabelColor: AppColors.textSecondary,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        dividerColor: Colors.transparent,
        tabs: const [
          Tab(text: 'Ledger'),
          Tab(text: 'Transactions'),
        ],
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
      return const Center(child: CircularProgressIndicator());
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
            backgroundColor: isCredit
                ? AppColors.successSoft
                : AppColors.warningSoft,
            child: Icon(
              isCredit ? Icons.south_west : Icons.north_east,
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
      return const Center(child: CircularProgressIndicator());
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
