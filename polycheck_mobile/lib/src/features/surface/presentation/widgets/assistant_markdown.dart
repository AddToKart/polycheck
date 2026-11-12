import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../core/theme/pup_theme.dart';
import '../../../../core/theme/pup_tokens.dart';

/// Token-styled markdown renderer for assistant replies.
///
/// Maroon/gold accents, zero radius, 1px borders, and zebra-striped tables
/// (the package's default table renderer has no alternating rows).
class AssistantMarkdown extends StatelessWidget {
  const AssistantMarkdown({
    super.key,
    required this.content,
    this.selectable = true,
  });

  final String content;
  final bool selectable;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final theme = Theme.of(context);
    final body = theme.textTheme.bodyMedium?.copyWith(
      color: tokens.onSurface,
      height: 1.45,
    );
    final base = MarkdownStyleSheet.fromTheme(theme);
    final style = base.copyWith(
      p: body,
      a: body?.copyWith(
        color: tokens.isDark ? tokens.gold : tokens.maroon,
        decoration: TextDecoration.underline,
        decorationColor: tokens.isDark ? tokens.gold : tokens.maroon,
      ),
      strong: body?.copyWith(fontWeight: FontWeight.w700),
      em: body?.copyWith(fontStyle: FontStyle.italic),
      del: body?.copyWith(decoration: TextDecoration.lineThrough),
      h1: theme.textTheme.titleLarge?.copyWith(
        color: tokens.isDark ? tokens.gold : tokens.maroon,
        fontWeight: FontWeight.w700,
      ),
      h2: theme.textTheme.titleMedium?.copyWith(
        color: tokens.isDark ? tokens.gold : tokens.maroon,
        fontWeight: FontWeight.w700,
      ),
      h3: theme.textTheme.titleSmall?.copyWith(
        color: tokens.isDark ? tokens.gold : tokens.maroon,
        fontWeight: FontWeight.w700,
      ),
      h4: body?.copyWith(fontWeight: FontWeight.w700),
      h5: body?.copyWith(fontWeight: FontWeight.w700),
      h6: body?.copyWith(fontWeight: FontWeight.w700),
      blockSpacing: 8,
      listIndent: 20,
      listBullet: body,
      code: body?.copyWith(
        fontFamily: 'monospace',
        fontSize: (body.fontSize ?? 14) - 1,
        backgroundColor: tokens.campus,
        color: tokens.onSurface,
      ),
      codeblockDecoration: BoxDecoration(
        color: tokens.campus,
        border: Border.all(color: tokens.borderSubtle),
        borderRadius: BorderRadius.zero,
      ),
      blockquote: body?.copyWith(color: tokens.muted),
      blockquoteDecoration: BoxDecoration(
        color: tokens.campus,
        border: Border(
          left: BorderSide(
            color: tokens.isDark ? tokens.gold : tokens.maroon,
            width: 3,
          ),
        ),
      ),
      blockquotePadding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(top: BorderSide(color: tokens.borderSubtle)),
      ),
      tableHead: body?.copyWith(fontWeight: FontWeight.w700),
      tableBody: body,
      tableBorder: TableBorder.all(color: tokens.borderSubtle, width: 1),
      tableColumnWidth: const FlexColumnWidth(),
      tableCellsPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      tableCellsDecoration: const BoxDecoration(),
    );

    return MarkdownBody(
      data: content,
      selectable: selectable,
      styleSheet: style,
      builders: {
        'table': ZebraMarkdownTableBuilder(
          isDark: tokens.isDark,
          tokens: tokens,
        ),
      },
    );
  }
}

/// Renders markdown tables with a gold head row and alternating body rows.
///
/// Registered only for the `table` tag; if the AST shape is unexpected it
/// returns null so flutter_markdown falls back to its default renderer.
class ZebraMarkdownTableBuilder extends MarkdownElementBuilder {
  ZebraMarkdownTableBuilder({required this.isDark, required this.tokens});

  final bool isDark;
  final PupTokens tokens;

  @override
  bool isBlockElement() => true;

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    dynamic element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    try {
      final headerRows = <List<String>>[];
      final bodyRows = <List<String>>[];
      for (final section in element.children as List<dynamic>) {
        final tag = section.tag;
        if (tag == 'thead') {
          for (final row in section.children as List<dynamic>) {
            headerRows.add(_cells(row));
          }
        } else if (tag == 'tbody') {
          for (final row in section.children as List<dynamic>) {
            bodyRows.add(_cells(row));
          }
        } else if (tag == 'tr') {
          bodyRows.add(_cells(section));
        }
      }
      if (headerRows.isEmpty && bodyRows.isEmpty) return null;

      final textStyle = Theme.of(
        context,
      ).textTheme.bodySmall?.copyWith(color: tokens.onSurface, height: 1.35);
      final headerStyle = textStyle?.copyWith(
        color: tokens.deepMaroon,
        fontWeight: FontWeight.w700,
      );
      final columns = [
        for (final row in [...headerRows, ...bodyRows])
          if (row.isNotEmpty) row.length,
      ].fold<int>(1, (max, length) => length > max ? length : max);

      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Table(
            defaultColumnWidth: const FlexColumnWidth(),
            border: TableBorder.all(color: tokens.borderSubtle, width: 1),
            children: [
              for (final row in headerRows)
                _tableRow(row, columns, headerStyle, tokens.gold, null),
              for (var index = 0; index < bodyRows.length; index += 1)
                _tableRow(
                  bodyRows[index],
                  columns,
                  textStyle,
                  index.isEven ? tokens.surface : tokens.campus,
                  tokens.borderSubtle,
                ),
            ],
          ),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  List<String> _cells(dynamic row) {
    final cells = <String>[];
    for (final cell in row.children as List<dynamic>) {
      final text = (cell.textContent as String).trim();
      cells.add(text);
    }
    return cells;
  }

  TableRow _tableRow(
    List<String> values,
    int columns,
    TextStyle? style,
    Color background,
    Color? borderColor,
  ) {
    return TableRow(
      decoration: BoxDecoration(
        color: background,
        border: borderColor == null
            ? null
            : Border(bottom: BorderSide(color: borderColor)),
      ),
      children: [
        for (var index = 0; index < columns; index += 1)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Text(
              index < values.length ? values[index] : '',
              style: style,
            ),
          ),
      ],
    );
  }
}

/// Assistant bubble surface color helper (shared by the chat rows).
Color assistantBubbleColor(BuildContext context, {required bool isUser}) {
  final tokens = PupTheme.of(context);
  if (isUser) {
    return tokens.isDark ? tokens.surface : PupColors.pupMaroon;
  }
  return tokens.surface;
}
