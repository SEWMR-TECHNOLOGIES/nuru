import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../core/services/wallet_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/money_format.dart';
import '../../core/widgets/nuru_subpage_app_bar.dart';

/// ReceiptScreen — premium printable receipt for a single transaction.
/// Mirrors the web `/wallet/receipt/:transaction_code` page with QR + share + print.
class ReceiptScreen extends StatefulWidget {
  final String transactionCode;
  const ReceiptScreen({super.key, required this.transactionCode});

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  Map<String, dynamic>? _tx;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await WalletService.getStatus(widget.transactionCode);
    if (!mounted) return;
    if (res['success'] == true && res['data'] != null) {
      setState(() {
        _tx = Map<String, dynamic>.from(res['data'] as Map);
        _loading = false;
      });
    } else {
      setState(() {
        _error = res['message']?.toString() ?? 'Receipt not found';
        _loading = false;
      });
    }
  }

  String get _verifyUrl =>
      'https://nuru.tz/wallet/receipt/${widget.transactionCode}';

  Future<void> _share() async {
    await Share.share('Nuru receipt ${widget.transactionCode}\n$_verifyUrl');
  }

  Future<void> _printOrSavePdf() async {
    if (_tx == null) return;
    final tx = _tx!;
    // Pre-load brand logo for QR overlay so we don't await inside the PDF builder.
    pw.MemoryImage? logoImage;
    try {
      final bytes = await rootBundle.load('assets/images/nuru-logo-square.png');
      logoImage = pw.MemoryImage(bytes.buffer.asUint8List());
    } catch (_) {}
    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async {
        final doc = pw.Document();
        doc.addPage(
          pw.Page(pageFormat: format, build: (ctx) => _buildPdf(tx, logoImage)),
        );
        return doc.save();
      },
      name: 'Nuru-Receipt-${widget.transactionCode}',
    );
  }

  pw.Widget _buildPdf(Map<String, dynamic> tx, pw.MemoryImage? logoImage) {
    final currency = (tx['currency_code'] ?? '').toString();
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  'NURU RECEIPT',
                  style: pw.TextStyle(
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 12),
                pw.Text(
                  formatMoney(
                    (tx['gross_amount'] ?? 0) as num,
                    currency: currency,
                  ),
                  style: pw.TextStyle(
                    fontSize: 28,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  (tx['description'] ??
                          (tx['target_type'] ?? '').toString().replaceAll(
                            '_',
                            ' ',
                          ))
                      .toString(),
                ),
              ],
            ),
            // Branded QR with sun overlay (high error correction so the logo cutout is safe)
            pw.Stack(
              alignment: pw.Alignment.center,
              children: [
                pw.BarcodeWidget(
                  barcode: pw.Barcode.qrCode(
                    errorCorrectLevel: pw.BarcodeQRCorrectionLevel.high,
                  ),
                  data: _verifyUrl,
                  width: 96,
                  height: 96,
                  drawText: false,
                ),
                if (logoImage != null)
                  pw.Container(
                    width: 22,
                    height: 22,
                    decoration: pw.BoxDecoration(
                      color: PdfColors.white,
                      shape: pw.BoxShape.circle,
                    ),
                    padding: const pw.EdgeInsets.all(2),
                    child: pw.Image(logoImage),
                  ),
              ],
            ),
          ],
        ),
        pw.Divider(),
        _pdfRow('Reference', (tx['transaction_code'] ?? '').toString()),
        _pdfRow('Date', (tx['initiated_at'] ?? '').toString()),
        if (tx['completed_at'] != null)
          _pdfRow('Completed', tx['completed_at'].toString()),
        _pdfRow('Status', (tx['status'] ?? '').toString().toUpperCase()),
        if (tx['provider'] != null)
          _pdfRow('Method', (tx['provider']['display_name'] ?? '').toString()),
        pw.Divider(),
        _pdfRow(
          'Subtotal',
          formatMoney((tx['net_amount'] ?? 0) as num, currency: currency),
        ),
        _pdfRow(
          'Service fee',
          formatMoney(
            ((tx['gross_amount'] ?? 0) as num) -
                ((tx['net_amount'] ?? 0) as num),
            currency: currency,
          ),
        ),
        _pdfRow(
          'Total',
          formatMoney((tx['gross_amount'] ?? 0) as num, currency: currency),
          bold: true,
        ),
        pw.SizedBox(height: 24),
        pw.Text(
          'Verify at $_verifyUrl',
          style: const pw.TextStyle(fontSize: 9),
        ),
      ],
    );
  }

  pw.Widget _pdfRow(String label, String value, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            label,
            style: const pw.TextStyle(fontSize: 11, color: PdfColors.grey700),
          ),
          pw.Text(
            value,
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: bold ? pw.FontWeight.bold : null,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: NuruSubPageAppBar(
        title: 'Receipt',
        actions: [
          IconButton(
            icon: const Icon(
              Icons.share_outlined,
              color: AppColors.textPrimary,
            ),
            onPressed: _share,
          ),
          IconButton(
            icon: const Icon(
              Icons.picture_as_pdf_outlined,
              color: AppColors.textPrimary,
            ),
            onPressed: _printOrSavePdf,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            )
          : _ReceiptCard(tx: _tx!, verifyUrl: _verifyUrl),
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  final Map<String, dynamic> tx;
  final String verifyUrl;
  const _ReceiptCard({required this.tx, required this.verifyUrl});

  @override
  Widget build(BuildContext context) {
    final status = (tx['status'] ?? '').toString();
    final currency = (tx['currency_code'] ?? '').toString();
    final fee =
        ((tx['gross_amount'] ?? 0) as num) - ((tx['net_amount'] ?? 0) as num);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: AppColors.subtleShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hero
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'RECEIPT',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            letterSpacing: 1.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const Spacer(),
                      _StatusPill(status: status),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'AMOUNT',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 10,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatMoney(
                      (tx['gross_amount'] ?? 0) as num,
                      currency: currency,
                    ),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    (tx['description'] ??
                            (tx['target_type'] ?? '').toString().replaceAll(
                              '_',
                              ' ',
                            ))
                        .toString(),
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
            // Body
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _Detail(
                              label: 'Reference',
                              value: (tx['transaction_code'] ?? '').toString(),
                              mono: true,
                            ),
                            const SizedBox(height: 10),
                            _Detail(
                              label: 'Date',
                              value: _fmt(tx['initiated_at']),
                            ),
                            if (tx['completed_at'] != null) ...[
                              const SizedBox(height: 10),
                              _Detail(
                                label: 'Completed',
                                value: _fmt(tx['completed_at']),
                              ),
                            ],
                            if (tx['provider'] != null) ...[
                              const SizedBox(height: 10),
                              _Detail(
                                label: 'Method',
                                value: (tx['provider']['display_name'] ?? '')
                                    .toString(),
                              ),
                            ],
                          ],
                        ),
                      ),
                      // QR code
                      Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border.all(color: AppColors.border),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: QrImageView(
                              data: verifyUrl,
                              version: QrVersions.auto,
                              size: 92,
                              backgroundColor: Colors.white,
                              errorCorrectionLevel: QrErrorCorrectLevel.H,
                              embeddedImage: const AssetImage(
                                'assets/images/nuru-logo-square.png',
                              ),
                              embeddedImageStyle: const QrEmbeddedImageStyle(
                                size: Size(18, 18),
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'SCAN TO VERIFY',
                            style: TextStyle(
                              fontSize: 8,
                              letterSpacing: 1.2,
                              color: AppColors.textTertiary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        _SummaryRow(
                          label: 'Subtotal',
                          value: formatMoney(
                            (tx['net_amount'] ?? 0) as num,
                            currency: currency,
                          ),
                        ),
                        const Divider(height: 1, color: AppColors.divider),
                        _SummaryRow(
                          label: 'Service fee',
                          value: fee > 0
                              ? formatMoney(fee, currency: currency)
                              : '—',
                          muted: true,
                        ),
                        const Divider(height: 1, color: AppColors.divider),
                        _SummaryRow(
                          label: 'Total',
                          value: formatMoney(
                            (tx['gross_amount'] ?? 0) as num,
                            currency: currency,
                          ),
                          bold: true,
                        ),
                      ],
                    ),
                  ),
                  if (tx['failure_reason'] != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.errorSoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        tx['failure_reason'].toString(),
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Center(
                    child: Text(
                      'Verify this receipt at\n$verifyUrl',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(dynamic v) {
    if (v == null) return '';
    try {
      final d = DateTime.parse(v.toString()).toLocal();
      return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return v.toString();
    }
  }
}

class _StatusPill extends StatelessWidget {
  final String status;
  const _StatusPill({required this.status});
  @override
  Widget build(BuildContext context) {
    final label =
        {
          'succeeded': 'Paid',
          'pending': 'Pending',
          'processing': 'Processing',
          'failed': 'Failed',
          'cancelled': 'Cancelled',
          'refunded': 'Refunded',
        }[status] ??
        status;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  final String label;
  final String value;
  final bool mono;
  const _Detail({required this.label, required this.value, this.mono = false});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 9,
            letterSpacing: 1.2,
            color: AppColors.textTertiary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w600,
            fontFamily: mono ? 'monospace' : null,
          ),
        ),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final bool muted;
  const _SummaryRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.muted = false,
  });
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: muted ? AppColors.textTertiary : AppColors.textPrimary,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              color: muted ? AppColors.textTertiary : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
