import 'package:flutter/material.dart';

import '../../../../core/theme/pup_theme.dart';
import '../../../../core/utils/password_policy.dart';

/// Live backend-policy checklist for the forced password rotation screen.
class PasswordPolicyChecklist extends StatelessWidget {
  const PasswordPolicyChecklist({super.key, required this.password});

  final String password;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final rule in PasswordRule.values)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  passwordMeetsRule(password, rule)
                      ? Icons.check_box_outlined
                      : Icons.check_box_outline_blank,
                  size: 16,
                  color: passwordMeetsRule(password, rule)
                      ? (tokens.isDark ? tokens.gold : tokens.maroon)
                      : tokens.muted,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    rule.label,
                    style: textTheme.bodySmall?.copyWith(
                      color: passwordMeetsRule(password, rule)
                          ? tokens.onSurface
                          : tokens.muted,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
