import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/app_snackbar.dart';

class TicketClassData {
  String? id;
  String name;
  String description;
  double price;
  int quantity;
  int sold;

  TicketClassData({
    this.id,
    this.name = '',
    this.description = '',
    this.price = 0,
    this.quantity = 0,
    this.sold = 0,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'description': description,
    'price': price,
    'quantity': quantity,
  };

  factory TicketClassData.fromJson(Map<String, dynamic> json) {
    return TicketClassData(
      id: json['id']?.toString(),
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      price: double.tryParse(json['price']?.toString() ?? '0') ?? 0,
      quantity: int.tryParse(json['quantity']?.toString() ?? '0') ?? 0,
      sold: int.tryParse(json['sold']?.toString() ?? '0') ?? 0,
    );
  }
}

class TicketClassFormSheet extends StatefulWidget {
  final TicketClassData? editData;
  final void Function(TicketClassData data) onSave;

  const TicketClassFormSheet({super.key, this.editData, required this.onSave});

  @override
  State<TicketClassFormSheet> createState() => _TicketClassFormSheetState();
}

class _TicketClassFormSheetState extends State<TicketClassFormSheet> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();

  bool get _isEdit => widget.editData != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      final d = widget.editData!;
      _nameCtrl.text = d.name;
      _descCtrl.text = d.description;
      _priceCtrl.text = d.price > 0 ? d.price.toStringAsFixed(0) : '';
      _qtyCtrl.text = d.quantity > 0 ? d.quantity.toString() : '';
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _qtyCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (_nameCtrl.text.trim().isEmpty) {
      AppSnackbar.error(context, 'Ticket class name is required');
      return;
    }
    final price = double.tryParse(_priceCtrl.text.replaceAll(',', '')) ?? 0;
    if (price <= 0) {
      AppSnackbar.error(context, 'Price must be greater than 0');
      return;
    }
    final qty = int.tryParse(_qtyCtrl.text.replaceAll(',', '')) ?? 0;
    if (qty <= 0) {
      AppSnackbar.error(context, 'Quantity must be greater than 0');
      return;
    }

    widget.onSave(TicketClassData(
      id: widget.editData?.id,
      name: _nameCtrl.text.trim(),
      description: _descCtrl.text.trim(),
      price: price,
      quantity: qty,
      sold: widget.editData?.sold ?? 0,
    ));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4,
              decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 20),
            Text(_isEdit ? 'Edit Ticket Class' : 'Add Ticket Class',
              style: appText(size: 18, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Set the name, price, and available quantity',
              style: appText(size: 13, color: AppColors.textTertiary)),
            const SizedBox(height: 20),
            _fieldLabel('Class Name *'),
            _textField(_nameCtrl, 'e.g. VIP, Regular, Early Bird'),
            const SizedBox(height: 14),
            _fieldLabel('Description'),
            _textField(_descCtrl, 'What is included in this ticket?', maxLines: 2),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _fieldLabel('Price (TZS) *'),
                _textField(_priceCtrl, '50,000', keyboard: TextInputType.number),
              ])),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _fieldLabel('Quantity *'),
                _textField(_qtyCtrl, '100', keyboard: TextInputType.number),
              ])),
            ]),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text('Cancel', style: appText(size: 14, weight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(_isEdit ? 'Update' : 'Add Class',
                    style: appText(size: 14, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _fieldLabel(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: appText(size: 13, weight: FontWeight.w600, color: AppColors.textSecondary)),
  );

  Widget _textField(TextEditingController ctrl, String hint, {int maxLines = 1, TextInputType? keyboard}) {
    return TextFormField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboard,
      style: appText(size: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: appText(size: 13, color: AppColors.textHint),
        filled: true,
        fillColor: const Color(0xFFF5F7FA),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}
