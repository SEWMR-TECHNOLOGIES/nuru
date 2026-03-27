import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_snackbar.dart';

TextStyle _f({required double size, FontWeight weight = FontWeight.w500, Color color = AppColors.textPrimary, double height = 1.3}) =>
    GoogleFonts.plusJakartaSans(fontSize: size, fontWeight: weight, color: color, height: height);

/// Full-screen PDF preview with save, share, and print options.
/// Uses PdfPreview from the `printing` package for native rendering.
class ReportPreviewScreen extends StatefulWidget {
  final String title;
  final Uint8List pdfBytes;
  final String? filePath;

  const ReportPreviewScreen({
    super.key,
    required this.title,
    required this.pdfBytes,
    this.filePath,
  });

  @override
  State<ReportPreviewScreen> createState() => _ReportPreviewScreenState();
}

class _ReportPreviewScreenState extends State<ReportPreviewScreen> {
  bool _saved = false;

  Future<String> _ensureFile() async {
    if (widget.filePath != null && File(widget.filePath!).existsSync()) {
      return widget.filePath!;
    }
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/${widget.title.replaceAll(' ', '_').toLowerCase()}_${DateTime.now().millisecondsSinceEpoch}.pdf');
    await file.writeAsBytes(widget.pdfBytes);
    return file.path;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: SvgPicture.asset(
            'assets/icons/chevron-left-icon.svg',
            width: 22,
            height: 22,
            colorFilter: const ColorFilter.mode(AppColors.textPrimary, BlendMode.srcIn),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.title, style: _f(size: 15, weight: FontWeight.w700)),
            Text('Preview & share your report', style: _f(size: 11, color: AppColors.textTertiary)),
          ],
        ),
      ),
      body: Column(
        children: [
          // PDF viewer — use PdfPreview which handles rendering
          Expanded(
            child: PdfPreview(
              build: (_) => widget.pdfBytes,
              canChangeOrientation: false,
              canChangePageFormat: false,
              canDebug: false,
              pdfFileName: widget.title.replaceAll(' ', '_').toLowerCase(),
              allowPrinting: false,
              allowSharing: false,
              useActions: false,
              loadingWidget: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const CircularProgressIndicator(color: AppColors.primary),
                  const SizedBox(height: 12),
                  Text('Loading preview...', style: _f(size: 13, color: AppColors.textTertiary)),
                ]),
              ),
              onError: (context, error) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.picture_as_pdf_rounded, size: 48, color: AppColors.textHint),
                    const SizedBox(height: 16),
                    Text('Unable to preview PDF', style: _f(size: 15, weight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Text('You can still share, print, or save the report using the buttons below.',
                      style: _f(size: 13, color: AppColors.textTertiary), textAlign: TextAlign.center),
                  ]),
                ),
              ),
            ),
          ),

          // Bottom action bar
          Container(
            padding: EdgeInsets.fromLTRB(16, 14, 16, MediaQuery.of(context).padding.bottom + 14),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, -2))],
            ),
            child: Row(
              children: [
                // Share
                _actionBtn(
                  icon: Icons.share_rounded,
                  label: 'Share',
                  onTap: () async {
                    final path = await _ensureFile();
                    Share.shareXFiles([XFile(path)], subject: widget.title);
                  },
                ),
                const SizedBox(width: 10),
                // Print
                _actionBtn(
                  icon: Icons.print_rounded,
                  label: 'Print',
                  onTap: () => Printing.layoutPdf(onLayout: (_) => widget.pdfBytes),
                ),
                const SizedBox(width: 10),
                // Save
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: _saved ? null : () async {
                      await _ensureFile();
                      setState(() => _saved = true);
                      if (mounted) AppSnackbar.success(context, 'Report saved to device');
                    },
                    icon: Icon(_saved ? Icons.check_rounded : Icons.save_alt_rounded, size: 18),
                    label: Text(
                      _saved ? 'Saved' : 'Save to Device',
                      style: _f(size: 13, weight: FontWeight.w700, color: _saved ? AppColors.textTertiary : Colors.white),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _saved ? const Color(0xFFE2E8F0) : AppColors.primary,
                      foregroundColor: _saved ? AppColors.textTertiary : Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionBtn({required IconData icon, required String label, required VoidCallback onTap}) {
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label, style: _f(size: 12, weight: FontWeight.w600)),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: AppColors.primary),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }
}
