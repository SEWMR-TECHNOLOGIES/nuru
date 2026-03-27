import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:excel/excel.dart' as xl;
import 'events_service.dart';

/// Generates branded PDF and XLSX reports for Nuru events.
/// All 6 report types:
/// 1. Budget Report
/// 2. Contribution Report
/// 3. Expense Report
/// 4. Event Summary Report
/// 5. RSVP / Guest List Report
/// 6. Committee Report
class ReportGenerator {
  static final _currencyFormat = NumberFormat('#,##0', 'en');

  // Brand palette
  static const _brand = PdfColor.fromInt(0xFF6366F1);
  static const _brandLight = PdfColor.fromInt(0xFFEEF2FF);
  static const _green = PdfColor.fromInt(0xFF16A34A);
  static const _greenLight = PdfColor.fromInt(0xFFDCFCE7);
  static const _red = PdfColor.fromInt(0xFFDC2626);
  static const _redLight = PdfColor.fromInt(0xFFFEF2F2);
  static const _amber = PdfColor.fromInt(0xFFCA8A04);
  static const _amberLight = PdfColor.fromInt(0xFFFEF3C7);
  static const _blue = PdfColor.fromInt(0xFF2563EB);
  static const _blueLight = PdfColor.fromInt(0xFFDBEAFE);
  static const _grey = PdfColor.fromInt(0xFF6B7280);
  static const _greyLight = PdfColor.fromInt(0xFFF9FAFB);
  static const _border = PdfColor.fromInt(0xFFE5E7EB);
  static const _textDark = PdfColor.fromInt(0xFF1E293B);
  static const _textSub = PdfColor.fromInt(0xFF475569);

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static String _fmt(dynamic amount) {
    if (amount == null) return 'TZS 0';
    final n = _toNum(amount);
    return 'TZS ${_currencyFormat.format(n.round())}';
  }

  static double _toNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static String _s(dynamic v) => (v ?? '').toString();

  static String _dateNow() => DateFormat('d MMMM yyyy').format(DateTime.now());
  static String _timeNow() => DateFormat('h:mm a').format(DateTime.now());

  static String _formatDate(dynamic dateStr) {
    if (dateStr == null) return '—';
    final s = dateStr.toString();
    if (s.isEmpty) return '—';
    try {
      return DateFormat('d MMM yyyy').format(DateTime.parse(s));
    } catch (_) {
      return s;
    }
  }

  static String _formatDateLong(dynamic dateStr) {
    if (dateStr == null) return '—';
    final s = dateStr.toString();
    if (s.isEmpty) return '—';
    try {
      return DateFormat('EEEE, d MMMM yyyy').format(DateTime.parse(s));
    } catch (_) {
      return s;
    }
  }

  static Map<String, dynamic> _asMap(dynamic v) {
    if (v is Map<String, dynamic>) return v;
    if (v is Map) return Map<String, dynamic>.from(v);
    return {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // XLSX HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static xl.CellStyle _xlHeaderStyle() {
    return xl.CellStyle(
      bold: true,
      fontColorHex: xl.ExcelColor.fromHexString('#FFFFFF'),
      backgroundColorHex: xl.ExcelColor.fromHexString('#6366F1'),
      horizontalAlign: xl.HorizontalAlign.Center,
      verticalAlign: xl.VerticalAlign.Center,
      fontSize: 11,
    );
  }

  static xl.CellStyle _xlTitleStyle() {
    return xl.CellStyle(
      bold: true,
      fontSize: 14,
      fontColorHex: xl.ExcelColor.fromHexString('#1E293B'),
    );
  }

  static xl.CellStyle _xlSubtitleStyle() {
    return xl.CellStyle(
      bold: true,
      fontSize: 11,
      fontColorHex: xl.ExcelColor.fromHexString('#6366F1'),
    );
  }

  static xl.CellStyle _xlTotalStyle() {
    return xl.CellStyle(
      bold: true,
      fontSize: 11,
      fontColorHex: xl.ExcelColor.fromHexString('#1E293B'),
      backgroundColorHex: xl.ExcelColor.fromHexString('#F1F5F9'),
      topBorder: xl.Border(borderStyle: xl.BorderStyle.Thin),
    );
  }

  static void _xlSetRow(xl.Sheet sheet, int row, List<String> values, {xl.CellStyle? style}) {
    for (int col = 0; col < values.length; col++) {
      final cell = sheet.cell(xl.CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row));
      cell.value = xl.TextCellValue(values[col]);
      if (style != null) cell.cellStyle = style;
    }
  }

  static Future<Map<String, dynamic>> _saveXlsx(xl.Excel excel, String prefix) async {
    final bytes = excel.save();
    if (bytes == null) return {'success': false, 'message': 'Failed to generate Excel file'};
    final dir = await getApplicationDocumentsDirectory();
    final ts = DateTime.now().millisecondsSinceEpoch;
    final file = File('${dir.path}/${prefix}_$ts.xlsx');
    await file.writeAsBytes(bytes);
    return {'success': true, 'message': 'Report generated', 'path': file.path};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Uint8List?> _loadLogo() async {
    try {
      final data = await rootBundle.load('assets/images/nuru-logo-square.png');
      return data.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  static pw.Widget _pdfHeader(String title, String subtitle, {Uint8List? logoBytes}) {
    return pw.Container(
      decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _brand, width: 2))),
      padding: const pw.EdgeInsets.only(bottom: 14),
      margin: const pw.EdgeInsets.only(bottom: 20),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            if (logoBytes != null)
              pw.Image(pw.MemoryImage(logoBytes), height: 36, width: 36)
            else
              pw.Text('Nuru', style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold, color: _brand)),
            pw.SizedBox(height: 2),
            pw.Text('Plan Smarter', style: pw.TextStyle(fontSize: 8, color: _grey, fontStyle: pw.FontStyle.italic)),
          ]),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text(title, style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _textDark)),
            pw.SizedBox(height: 4),
            pw.Text(subtitle, style: pw.TextStyle(fontSize: 10, color: _textSub)),
            pw.SizedBox(height: 2),
            pw.Text('${_dateNow()}, ${_timeNow()}', style: pw.TextStyle(fontSize: 9, color: _grey)),
          ]),
        ],
      ),
    );
  }

  static pw.Widget _pdfFooter() {
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 24),
      padding: const pw.EdgeInsets.only(top: 8),
      decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(color: _border, width: 0.5))),
      child: pw.Center(
        child: pw.Text(
          'Generated by Nuru Events  |  ${DateTime.now().year} Nuru | SEWMR TECHNOLOGIES',
          style: pw.TextStyle(fontSize: 8, color: _grey),
        ),
      ),
    );
  }

  static pw.Widget _summaryCard(String label, String value, {PdfColor valueColor = _textDark, PdfColor? bgColor}) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.all(12),
        decoration: pw.BoxDecoration(color: bgColor ?? _greyLight, borderRadius: pw.BorderRadius.circular(8)),
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text(label.toUpperCase(), style: pw.TextStyle(fontSize: 7, color: _grey, letterSpacing: 0.6)),
          pw.SizedBox(height: 4),
          pw.Text(value, style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, color: valueColor)),
        ]),
      ),
    );
  }

  static pw.Widget _sectionTitle(String text) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 8, top: 4),
      padding: const pw.EdgeInsets.only(bottom: 6),
      decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _border, width: 0.5))),
      child: pw.Text(text.toUpperCase(), style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: _brand, letterSpacing: 0.8)),
    );
  }

  static pw.Widget _buildTable({required List<String> headers, required List<List<String>> data}) {
    return pw.TableHelper.fromTextArray(
      headerStyle: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
      headerDecoration: const pw.BoxDecoration(color: _brand),
      cellStyle: const pw.TextStyle(fontSize: 9),
      cellHeight: 28,
      cellAlignments: <int, pw.Alignment>{},
      cellDecoration: (index, d, rowNum) => pw.BoxDecoration(
        color: rowNum % 2 == 0 ? PdfColors.white : _greyLight,
        border: const pw.Border(bottom: pw.BorderSide(color: _border, width: 0.3)),
      ),
      headers: headers,
      data: data,
    );
  }

  static pw.Widget _totalRow(String label, String value, {PdfColor? valueColor}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: const pw.BoxDecoration(
        color: _greyLight,
        border: pw.Border(top: pw.BorderSide(color: _textDark, width: 1.5)),
      ),
      child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text(label, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _textDark)),
        pw.Text(value, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: valueColor ?? _textDark)),
      ]),
    );
  }

  static Future<Map<String, dynamic>> _savePdf(pw.Document pdf, String prefix) async {
    final bytes = await pdf.save();
    final dir = await getApplicationDocumentsDirectory();
    final ts = DateTime.now().millisecondsSinceEpoch;
    final file = File('${dir.path}/${prefix}_$ts.pdf');
    await file.writeAsBytes(bytes);
    return {'success': true, 'message': 'Report generated', 'path': file.path, 'bytes': Uint8List.fromList(bytes)};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. BUDGET REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> generateBudgetReport(
    String eventId, {
    required String format,
    List<dynamic>? budgetItems,
    Map<String, dynamic>? summary,
    List<dynamic>? expenses,
    Map<String, dynamic>? expenseSummary,
  }) async {
    try {
      budgetItems ??= [];
      expenses ??= [];
      if (budgetItems.isEmpty) {
        final results = await Future.wait([
          EventsService.getBudget(eventId),
          EventsService.getExpenses(eventId),
        ]);
        if (results[0]['success'] == true) {
          budgetItems = results[0]['data']?['items'] ?? results[0]['data']?['budget_items'] ?? [];
          summary = _asMap(results[0]['data']?['summary']);
        }
        if (results[1]['success'] == true) {
          expenses = results[1]['data']?['expenses'] ?? [];
          expenseSummary = _asMap(results[1]['data']?['summary']);
        }
      }
      summary ??= {};
      expenseSummary ??= {};

      if (format == 'xlsx') {
        return await _budgetXlsx(budgetItems!, summary, expenses!);
      } else {
        return await _budgetPdf(budgetItems!, summary, expenses!, expenseSummary);
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed: $e'};
    }
  }

  static Future<Map<String, dynamic>> _budgetPdf(
    List<dynamic> items, Map<String, dynamic> summary,
    List<dynamic> expenses, Map<String, dynamic> expSummary,
  ) async {
    final logo = await _loadLogo();
    final pdf = pw.Document();
    final sorted = items.map(_asMap).toList()
      ..sort((a, b) => _s(a['category']).compareTo(_s(b['category'])));

    final totalEstimated = _toNum(summary['total_estimated']);
    final totalActual = _toNum(summary['total_actual']);
    final variance = _toNum(summary['variance']);

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (ctx) => _pdfHeader('Budget Report', 'Financial Overview', logoBytes: logo),
      footer: (ctx) => _pdfFooter(),
      build: (ctx) => [
        pw.Row(children: [
          _summaryCard('Total Estimated', _fmt(totalEstimated)),
          pw.SizedBox(width: 8),
          _summaryCard('Total Actual', _fmt(totalActual), valueColor: _brand),
          pw.SizedBox(width: 8),
          _summaryCard('Variance', _fmt(variance), valueColor: variance >= 0 ? _green : _red, bgColor: variance >= 0 ? _greenLight : _redLight),
        ]),
        pw.SizedBox(height: 20),
        _sectionTitle('Budget Items'),
        _buildTable(
          headers: ['#', 'Category', 'Item', 'Vendor', 'Estimated', 'Actual', 'Status'],
          data: sorted.asMap().entries.map((e) {
            final item = e.value;
            return [
              '${e.key + 1}',
              _s(item['category']),
              _s(item['description'] ?? item['item_name']),
              _s(item['vendor_name']),
              _fmt(item['estimated_cost']),
              _fmt(item['actual_cost']),
              _s(item['status'] ?? 'pending').replaceAll('_', ' '),
            ];
          }).toList(),
        ),
        _totalRow('Total (${sorted.length} items)', _fmt(totalActual > 0 ? totalActual : totalEstimated)),
      ],
    ));

    return _savePdf(pdf, 'budget_report');
  }

  static Future<Map<String, dynamic>> _budgetXlsx(
    List<dynamic> items, Map<String, dynamic> summary, List<dynamic> expenses,
  ) async {
    final excel = xl.Excel.createExcel();
    final sheet = excel['Budget Report'];

    int row = 0;
    _xlSetRow(sheet, row++, ['BUDGET REPORT'], style: _xlTitleStyle());
    _xlSetRow(sheet, row++, ['Generated: ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}']);
    row++;
    _xlSetRow(sheet, row++, ['SUMMARY'], style: _xlSubtitleStyle());
    _xlSetRow(sheet, row++, ['Total Estimated', _fmt(_toNum(summary['total_estimated']))]);
    _xlSetRow(sheet, row++, ['Total Actual', _fmt(_toNum(summary['total_actual']))]);
    _xlSetRow(sheet, row++, ['Variance', _fmt(_toNum(summary['variance']))]);
    row++;
    _xlSetRow(sheet, row++, ['BUDGET ITEMS'], style: _xlSubtitleStyle());
    _xlSetRow(sheet, row++, ['Category', 'Description', 'Estimated', 'Actual', 'Status', 'Vendor'], style: _xlHeaderStyle());

    for (final raw in items) {
      final item = _asMap(raw);
      _xlSetRow(sheet, row++, [
        _s(item['category']), _s(item['description'] ?? item['item_name']),
        _toNum(item['estimated_cost']).toStringAsFixed(0),
        _toNum(item['actual_cost']).toStringAsFixed(0),
        _s(item['status'] ?? 'pending'), _s(item['vendor_name']),
      ]);
    }

    if (expenses.isNotEmpty) {
      row++;
      _xlSetRow(sheet, row++, ['EXPENSES'], style: _xlSubtitleStyle());
      _xlSetRow(sheet, row++, ['Category', 'Description', 'Amount', 'Vendor', 'Date'], style: _xlHeaderStyle());
      for (final raw in expenses) {
        final exp = _asMap(raw);
        _xlSetRow(sheet, row++, [
          _s(exp['category']), _s(exp['description']),
          _toNum(exp['amount']).toStringAsFixed(0),
          _s(exp['vendor_name']),
          _formatDate(exp['expense_date'] ?? exp['created_at']),
        ]);
      }
    }

    // Auto-width
    for (int c = 0; c < 6; c++) {
      sheet.setColumnWidth(c, 20);
    }

    // Remove default Sheet1
    if (excel.sheets.containsKey('Sheet1')) excel.delete('Sheet1');
    return _saveXlsx(excel, 'budget_report');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CONTRIBUTIONS REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> generateContributionsReport(
    String eventId, {
    required String format,
    List<dynamic>? contributions,
    Map<String, dynamic>? summary,
    double? eventBudget,
  }) async {
    try {
      if (contributions == null || contributions.isEmpty) {
        final res = await EventsService.getEventContributors(eventId);
        if (res['success'] == true) {
          contributions = res['data']?['event_contributors'] ?? [];
          summary = _asMap(res['data']?['summary']);
        }
      }
      contributions ??= [];
      summary ??= {};

      if (format == 'xlsx') {
        return await _contributionsXlsx(contributions, summary, eventBudget);
      } else {
        return await _contributionsPdf(contributions, summary, eventBudget);
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed: $e'};
    }
  }

  static Future<Map<String, dynamic>> _contributionsPdf(
    List<dynamic> items, Map<String, dynamic> summary, double? eventBudget,
  ) async {
    final logo = await _loadLogo();
    final pdf = pw.Document();
    final sorted = items.map(_asMap).toList()
      ..sort((a, b) {
        final nameA = _s(a['contributor'] is Map ? (a['contributor'] as Map)['name'] : a['contributor_name']);
        final nameB = _s(b['contributor'] is Map ? (b['contributor'] as Map)['name'] : b['contributor_name']);
        return nameA.compareTo(nameB);
      });

    final totalPledged = _toNum(summary['total_pledged'] ?? summary['total_amount']);
    final totalPaid = _toNum(summary['total_paid'] ?? summary['total_confirmed']);
    final outstanding = (totalPledged - totalPaid).clamp(0.0, double.infinity);

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (ctx) => _pdfHeader('Contribution Report', 'Financial Overview', logoBytes: logo),
      footer: (ctx) => _pdfFooter(),
      build: (ctx) => [
        pw.Row(children: [
          _summaryCard('Total Pledged', _fmt(totalPledged), valueColor: _brand, bgColor: _brandLight),
          pw.SizedBox(width: 8),
          _summaryCard('Total Collected', _fmt(totalPaid), valueColor: _green, bgColor: _greenLight),
          pw.SizedBox(width: 8),
          _summaryCard('Outstanding', _fmt(outstanding), valueColor: _amber, bgColor: _amberLight),
        ]),
        pw.SizedBox(height: 20),
        _sectionTitle('Contributor Details'),
        _buildTable(
          headers: ['#', 'Contributor', 'Pledged', 'Paid', 'Balance'],
          data: sorted.asMap().entries.map((e) {
            final c = e.value;
            final name = c['contributor'] is Map ? _s((c['contributor'] as Map)['name']) : _s(c['contributor_name']);
            final pledged = _toNum(c['pledge_amount']);
            final paid = _toNum(c['total_paid'] ?? c['amount']);
            return [
              '${e.key + 1}',
              name.isEmpty ? 'Anonymous' : name,
              _fmt(pledged), _fmt(paid), _fmt((pledged - paid).clamp(0.0, double.infinity)),
            ];
          }).toList(),
        ),
        _totalRow('Total (${sorted.length} contributors)', _fmt(totalPaid), valueColor: _green),
      ],
    ));

    return _savePdf(pdf, 'contributions_report');
  }

  static Future<Map<String, dynamic>> _contributionsXlsx(
    List<dynamic> items, Map<String, dynamic> summary, double? eventBudget,
  ) async {
    final excel = xl.Excel.createExcel();
    final sheet = excel['Contributions'];
    final totalPledged = _toNum(summary['total_pledged'] ?? summary['total_amount']);
    final totalPaid = _toNum(summary['total_paid'] ?? summary['total_confirmed']);

    int row = 0;
    _xlSetRow(sheet, row++, ['CONTRIBUTIONS REPORT'], style: _xlTitleStyle());
    _xlSetRow(sheet, row++, ['Generated: ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}']);
    row++;
    _xlSetRow(sheet, row++, ['Total Pledged', _fmt(totalPledged)]);
    _xlSetRow(sheet, row++, ['Total Paid', _fmt(totalPaid)]);
    if (eventBudget != null) _xlSetRow(sheet, row++, ['Event Budget', _fmt(eventBudget)]);
    _xlSetRow(sheet, row++, ['Contributors', '${items.length}']);
    row++;
    _xlSetRow(sheet, row++, ['Contributor', 'Pledged', 'Paid', 'Balance'], style: _xlHeaderStyle());

    for (final raw in items) {
      final c = _asMap(raw);
      final name = c['contributor'] is Map ? _s((c['contributor'] as Map)['name']) : _s(c['contributor_name']);
      final pledged = _toNum(c['pledge_amount']);
      final paid = _toNum(c['total_paid'] ?? c['amount']);
      _xlSetRow(sheet, row++, [
        name.isEmpty ? 'Anonymous' : name,
        pledged.toStringAsFixed(0), paid.toStringAsFixed(0),
        (pledged - paid).clamp(0.0, double.infinity).toStringAsFixed(0),
      ]);
    }

    _xlSetRow(sheet, row, ['TOTAL', totalPledged.toStringAsFixed(0), totalPaid.toStringAsFixed(0), ''], style: _xlTotalStyle());

    for (int c = 0; c < 4; c++) sheet.setColumnWidth(c, 22);
    if (excel.sheets.containsKey('Sheet1')) excel.delete('Sheet1');
    return _saveXlsx(excel, 'contributions_report');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. EXPENSES REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> generateExpensesReport(
    String eventId, {
    required String format,
    List<dynamic>? expenses,
    Map<String, dynamic>? summary,
  }) async {
    try {
      if (expenses == null || expenses.isEmpty) {
        final res = await EventsService.getExpenses(eventId);
        if (res['success'] == true) {
          expenses = res['data']?['expenses'] ?? [];
          summary = _asMap(res['data']?['summary']);
        }
      }
      expenses ??= [];
      summary ??= {};

      if (format == 'xlsx') {
        return await _expensesXlsx(expenses, summary);
      } else {
        return await _expensesPdf(expenses, summary);
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed: $e'};
    }
  }

  static Future<Map<String, dynamic>> _expensesPdf(
    List<dynamic> items, Map<String, dynamic> summary,
  ) async {
    final logo = await _loadLogo();
    final pdf = pw.Document();
    final sorted = items.map(_asMap).toList();
    final totalExpenses = _toNum(summary['total_expenses']);

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (ctx) => _pdfHeader('Expense Report', 'Financial Overview', logoBytes: logo),
      footer: (ctx) => _pdfFooter(),
      build: (ctx) => [
        pw.Row(children: [
          _summaryCard('Total Expenses', _fmt(totalExpenses), valueColor: _red, bgColor: _redLight),
          pw.SizedBox(width: 8),
          _summaryCard('Total Items', '${sorted.length}'),
        ]),
        pw.SizedBox(height: 20),
        _sectionTitle('Expense Details'),
        _buildTable(
          headers: ['#', 'Date', 'Vendor', 'Category', 'Description', 'Amount'],
          data: sorted.asMap().entries.map((e) {
            final exp = e.value;
            return [
              '${e.key + 1}',
              _formatDate(exp['expense_date'] ?? exp['created_at']),
              _s(exp['vendor_name']),
              _s(exp['category']),
              _s(exp['description']),
              _fmt(exp['amount']),
            ];
          }).toList(),
        ),
        _totalRow('Total (${sorted.length} expenses)', _fmt(totalExpenses), valueColor: _red),
      ],
    ));

    return _savePdf(pdf, 'expenses_report');
  }

  static Future<Map<String, dynamic>> _expensesXlsx(
    List<dynamic> items, Map<String, dynamic> summary,
  ) async {
    final excel = xl.Excel.createExcel();
    final sheet = excel['Expenses'];

    int row = 0;
    _xlSetRow(sheet, row++, ['EXPENSES REPORT'], style: _xlTitleStyle());
    _xlSetRow(sheet, row++, ['Generated: ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}']);
    row++;
    _xlSetRow(sheet, row++, ['Total Expenses', _fmt(_toNum(summary['total_expenses']))]);
    row++;
    _xlSetRow(sheet, row++, ['Date', 'Category', 'Description', 'Amount', 'Vendor'], style: _xlHeaderStyle());

    for (final raw in items) {
      final exp = _asMap(raw);
      _xlSetRow(sheet, row++, [
        _formatDate(exp['expense_date'] ?? exp['created_at']),
        _s(exp['category']), _s(exp['description']),
        _toNum(exp['amount']).toStringAsFixed(0), _s(exp['vendor_name']),
      ]);
    }

    for (int c = 0; c < 5; c++) sheet.setColumnWidth(c, 20);
    if (excel.sheets.containsKey('Sheet1')) excel.delete('Sheet1');
    return _saveXlsx(excel, 'expenses_report');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. EVENT SUMMARY REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> generateEventReport(
    String eventId, {
    required String format,
    Map<String, dynamic>? eventData,
  }) async {
    try {
      if (eventData == null || eventData.isEmpty) {
        final res = await EventsService.getEventById(eventId);
        if (res['success'] == true) eventData = _asMap(res['data']);
      }
      eventData ??= {};

      final results = await Future.wait([
        EventsService.getGuests(eventId, limit: 1),
        EventsService.getEventContributors(eventId, limit: 1),
        EventsService.getCommittee(eventId),
      ]);

      final guestData = _asMap(results[0]);
      final contribData = _asMap(results[1]);
      final committeeData = _asMap(results[2]);

      final guestDataInner = _asMap(guestData['data']);
      final guestSummary = _asMap(guestDataInner['summary']);
      final guestPagination = _asMap(guestDataInner['pagination']);

      final guestCount = _toNum(guestPagination['totalItems'] ?? guestDataInner['total']).toInt();
      final confirmedGuests = _toNum(guestSummary['confirmed'] ?? guestSummary['attending']).toInt();
      final pendingGuests = _toNum(guestSummary['pending']).toInt();
      final declinedGuests = _toNum(guestSummary['declined']).toInt();
      final checkedIn = _toNum(guestSummary['checked_in']).toInt();

      final contribDataInner = _asMap(contribData['data']);
      final contribSummary = _asMap(contribDataInner['summary']);
      final totalCollected = _toNum(contribSummary['total_paid'] ?? contribSummary['total_confirmed']);
      final contribList = contribDataInner['event_contributors'];
      final contribCount = contribList is List ? contribList.length : _toNum(contribDataInner['total']).toInt();

      final committeeDataInner = _asMap(committeeData['data']);
      final membersList = committeeDataInner['members'] ?? committeeDataInner;
      final committeeCount = membersList is List ? membersList.length : 0;

      if (format == 'xlsx') {
        return await _eventXlsx(eventData!, guestCount, confirmedGuests, pendingGuests, declinedGuests, checkedIn, totalCollected, contribCount, committeeCount);
      } else {
        return await _eventPdf(eventData!, guestCount, confirmedGuests, pendingGuests, declinedGuests, checkedIn, totalCollected, contribCount, committeeCount);
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed: $e'};
    }
  }

  static Future<Map<String, dynamic>> _eventPdf(
    Map<String, dynamic> event, int guestCount, int confirmed, int pending, int declined, int checkedIn,
    double totalCollected, int contribCount, int committeeCount,
  ) async {
    final logo = await _loadLogo();
    final pdf = pw.Document();
    final title = _s(event['title']);
    final status = _s(event['status'] ?? 'draft');
    final budget = _toNum(event['budget']);

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (ctx) => _pdfHeader('Event Report', title.isEmpty ? 'Event' : title, logoBytes: logo),
      footer: (ctx) => _pdfFooter(),
      build: (ctx) => [
        _sectionTitle('Event Overview'),
        pw.Text(title, style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _textDark)),
        pw.SizedBox(height: 12),
        _sectionTitle('Guest Summary'),
        pw.Row(children: [
          _summaryCard('Total RSVPs', '$guestCount'),
          pw.SizedBox(width: 6),
          _summaryCard('Confirmed', '$confirmed', valueColor: _green, bgColor: _greenLight),
          pw.SizedBox(width: 6),
          _summaryCard('Pending', '$pending', valueColor: _amber, bgColor: _amberLight),
          pw.SizedBox(width: 6),
          _summaryCard('Declined', '$declined', valueColor: _red, bgColor: _redLight),
        ]),
        pw.SizedBox(height: 20),
        _sectionTitle('Financial Summary'),
        pw.Row(children: [
          _summaryCard('Event Budget', budget > 0 ? _fmt(budget) : '—', valueColor: _brand, bgColor: _brandLight),
          pw.SizedBox(width: 8),
          _summaryCard('Total Collected', _fmt(totalCollected), valueColor: _green, bgColor: _greenLight),
          pw.SizedBox(width: 8),
          _summaryCard('Contributors', '$contribCount'),
        ]),
        pw.SizedBox(height: 8),
        pw.Row(children: [
          _summaryCard('Committee', '$committeeCount'),
          pw.SizedBox(width: 8),
          _summaryCard('Checked In', '$checkedIn', valueColor: _blue, bgColor: _blueLight),
          pw.SizedBox(width: 8),
          pw.Expanded(child: pw.SizedBox()),
        ]),
        if (budget > 0) ...[
          pw.SizedBox(height: 12),
          pw.Text('Budget Coverage: ${(totalCollected / budget * 100).toStringAsFixed(1)}%',
            style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _green)),
        ],
      ],
    ));

    return _savePdf(pdf, 'event_report');
  }

  static Future<Map<String, dynamic>> _eventXlsx(
    Map<String, dynamic> event, int guestCount, int confirmed, int pending, int declined, int checkedIn,
    double totalCollected, int contribCount, int committeeCount,
  ) async {
    final excel = xl.Excel.createExcel();
    final sheet = excel['Event Summary'];

    int row = 0;
    _xlSetRow(sheet, row++, ['EVENT SUMMARY REPORT'], style: _xlTitleStyle());
    _xlSetRow(sheet, row++, ['Generated: ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}']);
    row++;
    _xlSetRow(sheet, row++, ['Title', _s(event['title'])]);
    _xlSetRow(sheet, row++, ['Status', _s(event['status'])]);
    _xlSetRow(sheet, row++, ['Start Date', _s(event['start_date'])]);
    _xlSetRow(sheet, row++, ['End Date', _s(event['end_date'])]);
    _xlSetRow(sheet, row++, ['Location', _s(event['location'] ?? event['venue'])]);
    row++;
    _xlSetRow(sheet, row++, ['GUEST SUMMARY'], style: _xlSubtitleStyle());
    _xlSetRow(sheet, row++, ['Total RSVPs', '$guestCount']);
    _xlSetRow(sheet, row++, ['Confirmed', '$confirmed']);
    _xlSetRow(sheet, row++, ['Pending', '$pending']);
    _xlSetRow(sheet, row++, ['Declined', '$declined']);
    _xlSetRow(sheet, row++, ['Checked In', '$checkedIn']);
    row++;
    _xlSetRow(sheet, row++, ['FINANCIAL SUMMARY'], style: _xlSubtitleStyle());
    _xlSetRow(sheet, row++, ['Budget', _fmt(_toNum(event['budget']))]);
    _xlSetRow(sheet, row++, ['Total Collected', _fmt(totalCollected)]);
    _xlSetRow(sheet, row++, ['Contributors', '$contribCount']);
    _xlSetRow(sheet, row++, ['Committee Members', '$committeeCount']);

    for (int c = 0; c < 2; c++) sheet.setColumnWidth(c, 25);
    if (excel.sheets.containsKey('Sheet1')) excel.delete('Sheet1');
    return _saveXlsx(excel, 'event_report');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RSVP / GUEST LIST REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> generateRsvpReport(
    String eventId, {
    required String format,
    List<dynamic>? guests,
    String? eventTitle,
  }) async {
    try {
      if (guests == null || guests.isEmpty) {
        final res = await EventsService.getGuests(eventId, limit: 500);
        if (res['success'] == true) {
          final data = _asMap(res['data']);
          guests = data['guests'] ?? data['items'] ?? [];
        }
      }
      guests ??= [];

      if (format == 'xlsx') {
        return await _rsvpXlsx(guests, eventTitle);
      } else {
        return await _rsvpPdf(guests, eventTitle);
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed: $e'};
    }
  }

  static Future<Map<String, dynamic>> _rsvpPdf(List<dynamic> guests, String? eventTitle) async {
    final logo = await _loadLogo();
    final pdf = pw.Document();
    final sorted = guests.map(_asMap).toList()
      ..sort((a, b) => _s(a['name']).compareTo(_s(b['name'])));

    final total = sorted.length;
    final attending = sorted.where((g) => ['attending', 'confirmed'].contains(_s(g['rsvp_status']))).length;
    final pending = sorted.where((g) => _s(g['rsvp_status']) == 'pending' || g['rsvp_status'] == null).length;
    final declined = sorted.where((g) => _s(g['rsvp_status']) == 'declined').length;
    final checkedIn = sorted.where((g) => g['checked_in'] == true).length;

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (ctx) => _pdfHeader('RSVP Report', eventTitle ?? 'Event', logoBytes: logo),
      footer: (ctx) => _pdfFooter(),
      build: (ctx) => [
        _sectionTitle('Attendance Summary'),
        pw.Row(children: [
          _summaryCard('Total Invited', '$total'),
          pw.SizedBox(width: 6),
          _summaryCard('Attending', '$attending', valueColor: _green, bgColor: _greenLight),
          pw.SizedBox(width: 6),
          _summaryCard('Pending', '$pending', valueColor: _amber, bgColor: _amberLight),
          pw.SizedBox(width: 6),
          _summaryCard('Declined', '$declined', valueColor: _red, bgColor: _redLight),
        ]),
        pw.SizedBox(height: 20),
        _sectionTitle('Guest List ($total)'),
        _buildTable(
          headers: ['#', 'Full Name', 'Phone', 'Status', 'Plus Ones', 'Checked In'],
          data: sorted.asMap().entries.map((e) {
            final g = e.value;
            return [
              '${e.key + 1}',
              _s(g['name']),
              _s(g['phone']),
              _s(g['rsvp_status'] ?? 'pending').replaceAll('_', ' '),
              _toNum(g['plus_ones']).toInt() > 0 ? '+${_toNum(g['plus_ones']).toInt()}' : '—',
              g['checked_in'] == true ? 'Yes' : 'No',
            ];
          }).toList(),
        ),
      ],
    ));

    return _savePdf(pdf, 'rsvp_report');
  }

  static Future<Map<String, dynamic>> _rsvpXlsx(List<dynamic> guests, String? eventTitle) async {
    final excel = xl.Excel.createExcel();
    final sheet = excel['RSVP Report'];

    int row = 0;
    _xlSetRow(sheet, row++, ['RSVP REPORT', eventTitle ?? ''], style: _xlTitleStyle());
    _xlSetRow(sheet, row++, ['Generated: ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}']);
    row++;
    _xlSetRow(sheet, row++, ['Name', 'Phone', 'RSVP Status', 'Plus Ones', 'Checked In'], style: _xlHeaderStyle());

    for (final raw in guests) {
      final g = _asMap(raw);
      _xlSetRow(sheet, row++, [
        _s(g['name']), _s(g['phone']),
        _s(g['rsvp_status'] ?? 'pending'),
        '${_toNum(g['plus_ones']).toInt()}',
        g['checked_in'] == true ? 'Yes' : 'No',
      ]);
    }

    for (int c = 0; c < 5; c++) sheet.setColumnWidth(c, 20);
    if (excel.sheets.containsKey('Sheet1')) excel.delete('Sheet1');
    return _saveXlsx(excel, 'rsvp_report');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. COMMITTEE REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  static Future<Map<String, dynamic>> generateCommitteeReport(
    String eventId, {
    required String format,
    List<dynamic>? members,
    String? eventTitle,
  }) async {
    try {
      if (members == null || members.isEmpty) {
        final res = await EventsService.getCommittee(eventId);
        if (res['success'] == true) {
          final data = res['data'];
          if (data is Map) {
            members = (data as Map)['members'] ?? [];
          } else if (data is List) {
            members = data;
          }
        }
      }
      members ??= [];

      if (format == 'xlsx') {
        return await _committeeXlsx(members, eventTitle);
      } else {
        return await _committeePdf(members, eventTitle);
      }
    } catch (e) {
      return {'success': false, 'message': 'Failed: $e'};
    }
  }

  static Future<Map<String, dynamic>> _committeePdf(List<dynamic> members, String? eventTitle) async {
    final logo = await _loadLogo();
    final pdf = pw.Document();
    final sorted = members.map(_asMap).toList()
      ..sort((a, b) => _s(a['name']).compareTo(_s(b['name'])));

    final active = sorted.where((m) => _s(m['status']) == 'active').length;
    final invited = sorted.where((m) => _s(m['status']) == 'invited').length;

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      header: (ctx) => _pdfHeader('Committee Report', eventTitle ?? 'Event', logoBytes: logo),
      footer: (ctx) => _pdfFooter(),
      build: (ctx) => [
        pw.Row(children: [
          _summaryCard('Total Members', '${sorted.length}'),
          pw.SizedBox(width: 8),
          _summaryCard('Active', '$active', valueColor: _green, bgColor: _greenLight),
          pw.SizedBox(width: 8),
          _summaryCard('Invited', '$invited', valueColor: _amber, bgColor: _amberLight),
        ]),
        pw.SizedBox(height: 20),
        _sectionTitle('Committee Members'),
        _buildTable(
          headers: ['#', 'Name', 'Role', 'Phone', 'Email', 'Status'],
          data: sorted.asMap().entries.map((e) {
            final m = e.value;
            return [
              '${e.key + 1}',
              _s(m['name']), _s(m['role']), _s(m['phone']), _s(m['email']),
              _s(m['status']),
            ];
          }).toList(),
        ),
      ],
    ));

    return _savePdf(pdf, 'committee_report');
  }

  static Future<Map<String, dynamic>> _committeeXlsx(List<dynamic> members, String? eventTitle) async {
    final excel = xl.Excel.createExcel();
    final sheet = excel['Committee'];

    int row = 0;
    _xlSetRow(sheet, row++, ['COMMITTEE REPORT', eventTitle ?? ''], style: _xlTitleStyle());
    _xlSetRow(sheet, row++, ['Generated: ${DateFormat('MMM d, yyyy HH:mm').format(DateTime.now())}']);
    row++;
    _xlSetRow(sheet, row++, ['Name', 'Role', 'Phone', 'Email', 'Status'], style: _xlHeaderStyle());

    for (final raw in members) {
      final m = _asMap(raw);
      _xlSetRow(sheet, row++, [
        _s(m['name']), _s(m['role']), _s(m['phone']), _s(m['email']), _s(m['status']),
      ]);
    }

    for (int c = 0; c < 5; c++) sheet.setColumnWidth(c, 20);
    if (excel.sheets.containsKey('Sheet1')) excel.delete('Sheet1');
    return _saveXlsx(excel, 'committee_report');
  }
}
