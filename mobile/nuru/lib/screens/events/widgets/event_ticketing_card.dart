import '../../../core/utils/money_format.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import 'ticket_class_form.dart';

class EventTicketingCard extends StatelessWidget {
  final bool sellsTickets;
  final ValueChanged<bool> onSellsTicketsChanged;
  final bool isPublic;
  final ValueChanged<bool> onIsPublicChanged;
  final List<TicketClassData> ticketClasses;
  final ValueChanged<List<TicketClassData>> onTicketClassesChanged;

  const EventTicketingCard({
    super.key,
    required this.sellsTickets,
    required this.onSellsTicketsChanged,
    required this.isPublic,
    required this.onIsPublicChanged,
    required this.ticketClasses,
    required this.onTicketClassesChanged,
  });

  String _formatPrice(double price) {
    return price.toStringAsFixed(0).replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  void _openAddSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => TicketClassFormSheet(
        onSave: (data) {
          final updated = [...ticketClasses, data];
          onTicketClassesChanged(updated);
        },
      ),
    );
  }

  void _openEditSheet(BuildContext context, int index) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => TicketClassFormSheet(
        editData: ticketClasses[index],
        onSave: (data) {
          final updated = [...ticketClasses];
          updated[index] = data;
          onTicketClassesChanged(updated);
        },
      ),
    );
  }

  void _removeTicketClass(int index) {
    final updated = [...ticketClasses];
    updated.removeAt(index);
    onTicketClassesChanged(updated);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border.withOpacity(0.5), width: 0.7),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => onSellsTicketsChanged(!sellsTickets),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(children: [
                SvgPicture.asset('assets/icons/ticket-icon.svg', width: 20, height: 20,
                  colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
                const SizedBox(width: 8),
                Expanded(child: Text('Event Ticketing',
                  style: appText(size: 15, weight: FontWeight.w700))),
                Switch(
                  key: const ValueKey('event_ticketing_toggle'),
                  value: sellsTickets,
                  onChanged: onSellsTicketsChanged,
                  activeColor: AppColors.primary,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ]),
            ),
          ),

          if (sellsTickets) ...[
            const SizedBox(height: 16),

            // Public event toggle
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F7FA),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: InkWell(
                onTap: () => onIsPublicChanged(!isPublic),
                borderRadius: BorderRadius.circular(10),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Public Event', style: appText(size: 14, weight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text('Allow anyone to discover and purchase tickets',
                      style: appText(size: 11, color: AppColors.textTertiary)),
                  ])),
                  Switch(
                    key: const ValueKey('event_public_toggle'),
                    value: isPublic,
                    onChanged: onIsPublicChanged,
                    activeColor: AppColors.primary,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 14),

            // Warning if no ticket classes
            if (ticketClasses.isEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFCD34D)),
                ),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.info_outline, size: 16, color: Color(0xFF92400E)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(
                    'Add at least one ticket class with pricing to sell tickets.',
                    style: appText(size: 12, color: const Color(0xFF92400E)),
                  )),
                ]),
              ),

            // Ticket classes list
            if (ticketClasses.isNotEmpty) ...[
              ...ticketClasses.asMap().entries.map((entry) {
                final i = entry.key;
                final tc = entry.value;
                final pct = tc.quantity > 0 ? (tc.sold / tc.quantity).clamp(0.0, 1.0) : 0.0;
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.025), blurRadius: 6, offset: const Offset(0, 2))],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => _openEditSheet(context, i),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Container(
                              width: 40, height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withOpacity(0.10),
                                borderRadius: BorderRadius.circular(11),
                              ),
                              child: Center(
                                child: SvgPicture.asset('assets/icons/ticket-icon.svg', width: 18, height: 18,
                                  colorFilter: const ColorFilter.mode(AppColors.primary, BlendMode.srcIn)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(tc.name, style: appText(size: 14.5, weight: FontWeight.w700)),
                                if (tc.description.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text(tc.description,
                                      style: appText(size: 12, color: AppColors.textTertiary),
                                      maxLines: 2, overflow: TextOverflow.ellipsis),
                                  ),
                              ]),
                            ),
                            const SizedBox(width: 8),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text('${getActiveCurrency()} ${_formatPrice(tc.price)}',
                                style: appText(size: 13.5, weight: FontWeight.w800, color: AppColors.primary)),
                              const SizedBox(height: 2),
                              Text('per ticket', style: appText(size: 10, color: AppColors.textTertiary)),
                            ]),
                          ]),
                          const SizedBox(height: 12),
                          // Capacity progress
                          Row(children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: LinearProgressIndicator(
                                  value: pct,
                                  minHeight: 5,
                                  backgroundColor: AppColors.border.withOpacity(0.5),
                                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text('${tc.sold}/${tc.quantity}',
                              style: appText(size: 11, weight: FontWeight.w600, color: AppColors.textSecondary)),
                          ]),
                          const SizedBox(height: 10),
                          Row(children: [
                            _chipAction(
                              context,
                              icon: Icons.edit_outlined,
                              label: 'Edit',
                              onTap: () => _openEditSheet(context, i),
                            ),
                            const SizedBox(width: 8),
                            _chipAction(
                              context,
                              icon: Icons.delete_outline_rounded,
                              label: 'Remove',
                              danger: true,
                              onTap: () => _removeTicketClass(i),
                            ),
                          ]),
                        ]),
                      ),
                    ),
                  ),
                );
              }),
            ],
            const SizedBox(height: 4),

            // Add ticket class button
            Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                onTap: () => _openAddSheet(context),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.primary.withOpacity(0.25)),
                  ),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const Icon(Icons.add_rounded, size: 18, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(ticketClasses.isEmpty ? 'Add your first ticket class' : 'Add another ticket class',
                      style: appText(size: 14, weight: FontWeight.w700, color: AppColors.primary)),
                  ]),
                ),
              ),
            ),
          ],
        ],
      ),
      ),
    );
  }

  Widget _chipAction(BuildContext context, {required IconData icon, required String label, required VoidCallback onTap, bool danger = false}) {
    final color = danger ? Colors.red.shade500 : AppColors.textSecondary;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: (danger ? Colors.red : AppColors.textSecondary).withOpacity(0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 5),
              Text(label, style: appText(size: 12, weight: FontWeight.w600, color: color)),
            ]),
          ),
        ),
      ),
    );
  }
}
