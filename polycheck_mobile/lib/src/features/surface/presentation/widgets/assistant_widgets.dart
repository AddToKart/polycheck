import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/models/ai.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/theme/pup_tokens.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/campus_toast.dart';
import '../../data/assistant_copy.dart';

class AssistantTypingDots extends StatelessWidget {
  const AssistantTypingDots({super.key});

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Semantics(
      liveRegion: true,
      label: 'Assistant is typing',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(
                tokens.isDark ? tokens.gold : tokens.maroon,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            'Assistant is typing.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tokens.muted,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }
}

/// Collapsible tool-activity block (counts + per-tool outcome chips).
class AssistantToolActivity extends StatefulWidget {
  const AssistantToolActivity({super.key, required this.invocations});

  final List<AiToolInvocationSummary> invocations;

  @override
  State<AssistantToolActivity> createState() => _AssistantToolActivityState();
}

class _AssistantToolActivityState extends State<AssistantToolActivity> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final count = widget.invocations.length;
    if (count == 0) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        InkWell(
          onTap: () => setState(() => _open = !_open),
          borderRadius: BorderRadius.zero,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Used $count tool${count == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: tokens.muted,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(
                  _open ? Icons.expand_less : Icons.expand_more,
                  size: 14,
                  color: tokens.muted,
                ),
              ],
            ),
          ),
        ),
        if (_open)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final invocation in widget.invocations)
                  _ToolChip(invocation: invocation, tokens: tokens),
              ],
            ),
          ),
      ],
    );
  }
}

class _ToolChip extends StatelessWidget {
  const _ToolChip({required this.invocation, required this.tokens});

  final AiToolInvocationSummary invocation;
  final PupTokens tokens;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, border) = switch (invocation.outcome) {
      AiToolOutcome.succeeded => (
        tokens.campus,
        tokens.isDark ? const Color(0xFF86EFAC) : const Color(0xFF15803D),
        const Color(0xFF16A34A),
      ),
      AiToolOutcome.denied => (
        tokens.campus,
        tokens.isDark ? tokens.gold : const Color(0xFF92400E),
        tokens.gold,
      ),
      AiToolOutcome.failed => (
        tokens.campus,
        tokens.isDark ? const Color(0xFFFCA5A5) : const Color(0xFFB91C1C),
        const Color(0xFFDC2626),
      ),
    };
    final label =
        '${invocation.tool.replaceAll('_', ' ')} \u00b7 ${invocation.outcome.wire}';
    return Tooltip(
      message: invocation.detail ?? label,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: background,
          border: Border.all(color: border),
          borderRadius: BorderRadius.zero,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: foreground,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

/// Downloadable assistant attachment card. The parent owns byte fetching and
/// sharing so this widget stays testable without platform plugins.
class AssistantAttachmentCards extends StatelessWidget {
  const AssistantAttachmentCards({
    super.key,
    required this.attachments,
    required this.states,
    required this.onDownload,
  });

  final List<AiChatAttachment> attachments;
  final Map<String, AttachmentDownloadState> states;
  final void Function(AiChatAttachment attachment) onDownload;

  @override
  Widget build(BuildContext context) {
    if (attachments.isEmpty) return const SizedBox.shrink();
    final tokens = PupTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        for (final attachment in attachments)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: InkWell(
              onTap: () => onDownload(attachment),
              borderRadius: BorderRadius.zero,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                decoration: BoxDecoration(
                  color: tokens.campus,
                  border: Border.all(color: tokens.borderSubtle),
                  borderRadius: BorderRadius.zero,
                ),
                child: Row(
                  children: [
                    Icon(
                      attachment.format == AiAttachmentFormat.csv
                          ? Icons.table_chart_outlined
                          : Icons.description_outlined,
                      size: 18,
                      color: tokens.isDark ? tokens.gold : tokens.maroon,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            attachment.label.isEmpty
                                ? attachment.filename
                                : attachment.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: tokens.onSurface,
                                ),
                          ),
                          Text(
                            '${attachment.format.wire} \u00b7 '
                            '${attachment.filename}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: tokens.muted),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    _AttachmentStateIcon(
                      state:
                          states[attachment.id] ?? AttachmentDownloadState.idle,
                      tokens: tokens,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

enum AttachmentDownloadState { idle, loading, done }

class _AttachmentStateIcon extends StatelessWidget {
  const _AttachmentStateIcon({required this.state, required this.tokens});

  final AttachmentDownloadState state;
  final PupTokens tokens;

  @override
  Widget build(BuildContext context) {
    if (state == AttachmentDownloadState.loading) {
      return SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(
            tokens.isDark ? tokens.gold : tokens.maroon,
          ),
        ),
      );
    }
    return Icon(
      state == AttachmentDownloadState.done
          ? Icons.check_circle_outline
          : Icons.ios_share,
      size: 17,
      color: state == AttachmentDownloadState.done
          ? const Color(0xFF16A34A)
          : (tokens.isDark ? tokens.gold : tokens.maroon),
    );
  }
}

class AssistantMessageActions extends StatelessWidget {
  const AssistantMessageActions({
    super.key,
    required this.content,
    this.onRegenerate,
    this.onRetry,
    this.regenerateDisabled = false,
  });

  final String content;
  final VoidCallback? onRegenerate;
  final VoidCallback? onRetry;
  final bool regenerateDisabled;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Wrap(
      spacing: 2,
      children: [
        IconButton(
          tooltip: 'Copy message',
          visualDensity: VisualDensity.compact,
          onPressed: content.trim().isEmpty ? null : () => _copy(context),
          icon: Icon(Icons.copy_all_outlined, size: 16, color: tokens.muted),
        ),
        if (onRegenerate != null)
          IconButton(
            tooltip: 'Regenerate reply',
            visualDensity: VisualDensity.compact,
            onPressed: regenerateDisabled ? null : onRegenerate,
            icon: Icon(
              Icons.refresh,
              size: 16,
              color: regenerateDisabled ? tokens.muted : tokens.maroon,
            ),
          ),
        if (onRetry != null)
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              minimumSize: const Size(48, 32),
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
            child: const Text('Retry'),
          ),
      ],
    );
  }

  Future<void> _copy(BuildContext context) async {
    try {
      await Clipboard.setData(ClipboardData(text: content));
      if (!context.mounted) return;
      CampusToast.showIn(context, 'Message copied to clipboard');
    } catch (_) {
      if (!context.mounted) return;
      CampusToast.showIn(
        context,
        'Could not copy the message',
        tone: CampusToastTone.error,
      );
    }
  }
}

/// Role-tuned empty state with the starter prompts and can/cannot lists.
class AssistantEmptyState extends StatelessWidget {
  const AssistantEmptyState({
    super.key,
    required this.role,
    required this.prompts,
    required this.onSelectPrompt,
  });

  final AssistantRole role;
  final List<String> prompts;
  final ValueChanged<String> onSelectPrompt;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final copy = assistantRoleCopy[role]!;
    final theme = Theme.of(context).textTheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                border: Border.all(color: tokens.gold),
                color: tokens.isDark
                    ? tokens.gold.withValues(alpha: 0.12)
                    : tokens.gold.withValues(alpha: 0.18),
                borderRadius: BorderRadius.zero,
              ),
              child: Icon(
                Icons.auto_awesome_outlined,
                size: 22,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            copy.emptyTitle,
            textAlign: TextAlign.center,
            style: theme.titleMedium?.copyWith(
              color: tokens.isDark ? tokens.gold : tokens.maroon,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            copy.emptyDescription,
            textAlign: TextAlign.center,
            style: theme.bodySmall?.copyWith(color: tokens.muted),
          ),
          const SizedBox(height: 18),
          Text(
            'TRY ASKING',
            style: theme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          for (final prompt in prompts.take(4))
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(
                onPressed: () => onSelectPrompt(prompt),
                style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                ),
                child: Text(
                  prompt,
                  style: theme.bodySmall?.copyWith(
                    color: tokens.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _CapabilityList(
                  title: 'CAN',
                  items: copy.can,
                  positive: true,
                  tokens: tokens,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _CapabilityList(
                  title: "CAN'T",
                  items: copy.cant,
                  positive: false,
                  tokens: tokens,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'READ-ONLY \u00b7 SCOPED TO YOUR ACCOUNT',
            textAlign: TextAlign.center,
            style: theme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _CapabilityList extends StatelessWidget {
  const _CapabilityList({
    required this.title,
    required this.items,
    required this.positive,
    required this.tokens,
  });

  final String title;
  final List<String> items;
  final bool positive;
  final PupTokens tokens;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.labelSmall;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: tokens.borderSubtle),
        borderRadius: BorderRadius.zero,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: style?.copyWith(
              color: positive
                  ? (tokens.isDark
                        ? const Color(0xFF86EFAC)
                        : const Color(0xFF15803D))
                  : tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 6),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    positive ? Icons.check : Icons.close,
                    size: 12,
                    color: positive
                        ? (tokens.isDark
                              ? const Color(0xFF86EFAC)
                              : const Color(0xFF15803D))
                        : tokens.muted,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: tokens.onSurface,
                        height: 1.3,
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
}

/// Error strip with an optional retry action.
class AssistantErrorBanner extends StatelessWidget {
  const AssistantErrorBanner({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Retry',
    this.busy = false,
  });

  final String message;
  final VoidCallback? onRetry;
  final String retryLabel;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: tokens.isDark
              ? tokens.gold.withValues(alpha: 0.08)
              : tokens.gold.withValues(alpha: 0.16),
          border: Border.all(
            color: tokens.isDark
                ? tokens.gold.withValues(alpha: 0.35)
                : tokens.gold,
          ),
          borderRadius: BorderRadius.zero,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.error_outline,
              size: 16,
              color: tokens.isDark ? tokens.gold : tokens.maroon,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.isDark ? tokens.gold : tokens.maroon,
                  height: 1.35,
                ),
              ),
            ),
            if (onRetry != null)
              TextButton(
                onPressed: busy ? null : onRetry,
                style: TextButton.styleFrom(
                  minimumSize: const Size(48, 32),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                child: Text(retryLabel),
              ),
          ],
        ),
      ),
    );
  }
}

/// Shared "assistant unavailable" panel with the super-admin setup affordance.
class AssistantUnavailablePanel extends StatelessWidget {
  const AssistantUnavailablePanel({
    super.key,
    required this.title,
    required this.message,
    this.onRetry,
    this.onOpenSettings,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                border: Border.all(color: tokens.gold),
                color: tokens.isDark
                    ? tokens.gold.withValues(alpha: 0.10)
                    : tokens.gold.withValues(alpha: 0.16),
                borderRadius: BorderRadius.zero,
              ),
              child: Icon(
                Icons.auto_awesome_outlined,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: tokens.onSurface,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
            ),
            const SizedBox(height: 16),
            if (onRetry != null)
              CampusButton(
                label: 'Try again',
                variant: CampusButtonVariant.outline,
                expand: false,
                icon: Icons.refresh,
                onPressed: onRetry,
              ),
            if (onOpenSettings != null) ...[
              const SizedBox(height: 8),
              CampusButton(
                label: 'Open Institution Settings',
                variant: CampusButtonVariant.gold,
                expand: false,
                icon: Icons.settings_outlined,
                onPressed: onOpenSettings,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
