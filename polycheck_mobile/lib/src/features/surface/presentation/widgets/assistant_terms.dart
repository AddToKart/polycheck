import 'package:flutter/material.dart';

import '../../../../core/theme/brand_theme.dart';
import '../../../../core/utils/ai_terms.dart';
import '../../../../core/widgets/campus_button.dart';
import '../../../../core/widgets/legal_links_row.dart';

/// Shown before a person's first message: how their information is handled.
class AssistantTermsPanel extends StatelessWidget {
  const AssistantTermsPanel({
    super.key,
    required this.onAccept,
    required this.accepting,
    this.provider,
    this.error,
  });

  /// Host name of the provider that will receive messages.
  final String? provider;
  final bool accepting;
  final String? error;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final text = Theme.of(context).textTheme;
    final accent = tokens.isDark ? tokens.gold : tokens.maroon;

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            key: const ValueKey<String>('assistant-terms'),
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              Icon(Icons.verified_user_outlined, color: accent),
              const SizedBox(height: 8),
              Text(
                aiTermsTitle,
                style: text.titleLarge?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                aiTermsIntro,
                style: text.bodyMedium?.copyWith(color: tokens.muted),
              ),
              if (provider != null && provider!.isNotEmpty) ...<Widget>[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.only(left: 10),
                  decoration: BoxDecoration(
                    border: Border(left: BorderSide(color: accent, width: 3)),
                  ),
                  child: Text(
                    'AI provider in use: $provider',
                    style: text.bodyMedium?.copyWith(
                      color: tokens.onSurface,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              for (final section in aiTermsSections) ...<Widget>[
                const SizedBox(height: 16),
                Text(
                  section.heading.toUpperCase(),
                  style: text.labelMedium?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
                ),
                for (final point in section.points)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          '•  ',
                          style: text.bodyMedium?.copyWith(color: tokens.muted),
                        ),
                        Expanded(
                          child: Text(
                            point,
                            style: text.bodyMedium?.copyWith(
                              color: tokens.onSurface,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
              const SizedBox(height: 12),
              const LegalLinksRow(alignment: WrapAlignment.start),
              Text(
                'Terms version $aiTermsVersion',
                style: text.bodySmall?.copyWith(color: tokens.muted),
              ),
            ],
          ),
        ),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: tokens.surface,
            border: Border(top: BorderSide(color: tokens.borderSubtle)),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              if (error != null) ...<Widget>[
                Text(
                  error!,
                  style: text.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
                const SizedBox(height: 8),
              ],
              CampusButton(
                key: const ValueKey<String>('assistant-terms-accept'),
                label: accepting ? 'Saving…' : aiTermsAcceptLabel,
                onPressed: accepting ? null : onAccept,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
