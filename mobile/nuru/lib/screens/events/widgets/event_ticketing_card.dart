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
    return Container(
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
          Row(children: [
            SvgPicture.asset('assets/icons/ticket-icon.svg', width: 20, height: 20,
              colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn)),
            const SizedBox(width: 8),
            Expanded(child: Text('Event Ticketing',
              style: appText(size: 15, weight: FontWeight.w700))),
            Switch.adaptive(
              value: sellsTickets,
              onChanged: onSellsTicketsChanged,
              activeColor: AppColors.primary,
            ),
          ]),

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
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Public Event', style: appText(size: 14, weight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text('Allow anyone to discover and purchase tickets',
                    style: appText(size: 11, color: AppColors.textTertiary)),
                ])),
                Switch.adaptive(
                  value: isPublic,
                  onChanged: onIsPublicChanged,
                  activeColor: AppColors.primary,
                ),
              ]),
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
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F7FA),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Text(tc.name, style: appText(size: 14, weight: FontWeight.w600)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('TZS ${_formatPrice(tc.price)}',
                            style: appText(size: 11, weight: FontWeight.w600, color: AppColors.primary)),
                        ),
                      ]),
                      if (tc.description.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(tc.description,
                            style: appText(size: 12, color: AppColors.textTertiary),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('${tc.sold}/${tc.quantity} sold',
                          style: appText(size: 11, color: AppColors.textTertiary)),
                      ),
                    ])),
                    GestureDetector(
                      onTap: () => _openEditSheet(context, i),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        child: const Icon(Icons.edit_outlined, size: 16, color: AppColors.textTertiary),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _removeTicketClass(i),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        child: Icon(Icons.delete_outline, size: 16, color: Colors.red.shade400),
                      ),
                    ),
                  ]),
                );
              }),
            ],
            const SizedBox(height: 8),

            // Add ticket class button
            GestureDetector(
              onTap: () => _openAddSheet(context),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.primary.withOpacity(0.3), style: BorderStyle.solid),
                ),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.add, size: 18, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text('Add Ticket Class',
                    style: appText(size: 14, weight: FontWeight.w600, color: AppColors.primary)),
                ]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
