import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class AiMarkdownContent extends StatelessWidget {
  final String content;
  final Color textColor;
  final Color accentColor;
  final double fontSize;
  final double lineHeight;

  const AiMarkdownContent({
    super.key,
    required this.content,
    this.textColor = AppColors.textPrimary,
    this.accentColor = AppColors.primary,
    this.fontSize = 13,
    this.lineHeight = 1.5,
  });

  @override
  Widget build(BuildContext context) {
    final blocks = _parseBlocks(content);
    if (blocks.isEmpty) {
      return SelectableText(content, style: _baseStyle);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i < blocks.length; i++) ...[
          _buildBlock(blocks[i]),
          if (i != blocks.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }

  TextStyle get _baseStyle => TextStyle(
        fontSize: fontSize,
        height: lineHeight,
        color: textColor,
      );

  Widget _buildBlock(_MarkdownBlock block) {
    switch (block.type) {
      case _BlockType.table:
        return _buildTable(block.lines);
      case _BlockType.list:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: block.lines
              .map(
                (line) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 7),
                        child: Container(
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(color: accentColor, shape: BoxShape.circle),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SelectableText.rich(
                          TextSpan(style: _baseStyle, children: _inlineSpans(_stripListPrefix(line))),
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        );
      case _BlockType.paragraph:
        final text = block.lines.join('\n').trim();
        final isHeader = text.startsWith('#');
        final cleanText = text.replaceFirst(RegExp(r'^#+\s*'), '');
        return SelectableText.rich(
          TextSpan(
            style: _baseStyle.copyWith(
              fontSize: isHeader ? fontSize + 1.5 : fontSize,
              fontWeight: isHeader ? FontWeight.w700 : FontWeight.w500,
            ),
            children: _inlineSpans(cleanText),
          ),
        );
    }
  }

  Widget _buildTable(List<String> lines) {
    final rows = <List<String>>[];
    for (final line in lines) {
      final trimmed = line.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
      if (RegExp(r'^\|[\s:\-]+\|$').hasMatch(trimmed)) continue;
      final cells = trimmed.substring(1, trimmed.length - 1).split('|').map((cell) => cell.trim().replaceAll('**', '')).toList();
      if (cells.isNotEmpty) rows.add(cells);
    }

    if (rows.isEmpty) return SelectableText(content, style: _baseStyle);

    final headers = rows.first;
    final dataRows = rows.length > 1 ? rows.sublist(1) : <List<String>>[];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.borderLight),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Table(
            defaultVerticalAlignment: TableCellVerticalAlignment.middle,
            columnWidths: {for (int i = 0; i < headers.length; i++) i: const IntrinsicColumnWidth()},
            children: [
              TableRow(
                decoration: const BoxDecoration(color: AppColors.surfaceVariant),
                children: headers.map((header) => _tableCell(header, isHeader: true)).toList(),
              ),
              ...dataRows.asMap().entries.map(
                    (entry) => TableRow(
                      decoration: BoxDecoration(color: entry.key.isEven ? Colors.white : AppColors.surface),
                      children: entry.value.map((cell) => _tableCell(cell, emphasize: cell.toUpperCase().contains('TOTAL'))).toList(),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tableCell(String value, {bool isHeader = false, bool emphasize = false}) {
    return Container(
      constraints: const BoxConstraints(minWidth: 110, maxWidth: 220),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: const BoxDecoration(
        border: Border(
          right: BorderSide(color: AppColors.borderLight),
          bottom: BorderSide(color: AppColors.borderLight),
        ),
      ),
      child: SelectableText.rich(
        TextSpan(
          style: _baseStyle.copyWith(
            fontSize: isHeader ? fontSize - 0.5 : fontSize - 0.2,
            fontWeight: isHeader || emphasize ? FontWeight.w700 : FontWeight.w500,
          ),
          children: _inlineSpans(value),
        ),
      ),
    );
  }

  List<_MarkdownBlock> _parseBlocks(String raw) {
    final lines = raw.replaceAll('\r\n', '\n').split('\n');
    final blocks = <_MarkdownBlock>[];
    final buffer = <String>[];
    _BlockType? currentType;

    void flush() {
      if (buffer.isEmpty || currentType == null) return;
      blocks.add(_MarkdownBlock(type: currentType!, lines: List<String>.from(buffer)));
      buffer.clear();
      currentType = null;
    }

    for (final line in lines) {
      final normalized = line.trim();
      if (normalized.isEmpty) {
        flush();
        continue;
      }

      final nextType = _detectType(normalized);
      if (currentType != null && currentType != nextType) flush();
      currentType = nextType;
      buffer.add(normalized);
    }

    flush();
    return blocks;
  }

  _BlockType _detectType(String line) {
    if (line.startsWith('|') && line.endsWith('|') && line.contains('|')) return _BlockType.table;
    if (RegExp(r'^(-|\*)\s+').hasMatch(line) || RegExp(r'^\d+\.\s+').hasMatch(line)) return _BlockType.list;
    return _BlockType.paragraph;
  }

  String _stripListPrefix(String line) {
    return line.replaceFirst(RegExp(r'^(-|\*)\s+'), '').replaceFirst(RegExp(r'^\d+\.\s+'), '');
  }

  List<InlineSpan> _inlineSpans(String text) {
    final parts = text.split('**');
    final spans = <InlineSpan>[];
    for (int i = 0; i < parts.length; i++) {
      if (parts[i].isEmpty) continue;
      spans.add(TextSpan(text: parts[i], style: i.isOdd ? const TextStyle(fontWeight: FontWeight.w700) : null));
    }
    if (spans.isEmpty) spans.add(TextSpan(text: text));
    return spans;
  }
}

enum _BlockType { paragraph, list, table }

class _MarkdownBlock {
  final _BlockType type;
  final List<String> lines;

  const _MarkdownBlock({required this.type, required this.lines});
}