import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../core/theme/brand_theme.dart';
import '../../../../core/theme/brand_tokens.dart';
import '../../../../core/utils/markdown_tables.dart';

/// Token-styled markdown renderer for assistant replies.
///
/// Maroon/gold accents, zero radius and 1px borders. Tables are shown as lists:
/// on a phone their columns shrink to a few letters.
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
    final tokens = BrandTheme.of(context);
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
    );

    return MarkdownBody(
      data: flattenMarkdownTables(content),
      selectable: selectable,
      styleSheet: style,
    );
  }
}

/// Assistant bubble surface color helper (shared by the chat rows).
Color assistantBubbleColor(BuildContext context, {required bool isUser}) {
  final tokens = BrandTheme.of(context);
  if (isUser) {
    return tokens.isDark ? tokens.surface : BrandColors.brandMaroon;
  }
  return tokens.surface;
}
