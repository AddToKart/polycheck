/// Backend strong-password policy mirror
/// (`backend/src/common/decorators/strong-password.decorator.ts`).
///
/// The server remains authoritative; this helper drives live validation and
/// the checklist on the forced first-login rotation screen.
enum PasswordRule {
  minLength('Use at least 12 characters.'),
  lowercase('Include a lowercase letter.'),
  uppercase('Include an uppercase letter.'),
  number('Include a number.'),
  special('Include a special character.');

  const PasswordRule(this.label);

  final String label;
}

const int passwordMinLength = 12;
const int passwordMaxLength = 128;

bool passwordMeetsRule(String value, PasswordRule rule) {
  return switch (rule) {
    PasswordRule.minLength =>
      value.length >= passwordMinLength && value.length <= passwordMaxLength,
    PasswordRule.lowercase => RegExp('[a-z]').hasMatch(value),
    PasswordRule.uppercase => RegExp('[A-Z]').hasMatch(value),
    PasswordRule.number => RegExp('[0-9]').hasMatch(value),
    PasswordRule.special => RegExp('[^A-Za-z0-9]').hasMatch(value),
  };
}

List<PasswordRule> unmetPasswordRules(String value) => [
  for (final rule in PasswordRule.values)
    if (!passwordMeetsRule(value, rule)) rule,
];

/// First policy violation in declaration order, or null when compliant.
String? validatePasswordPolicy(String value) {
  final unmet = unmetPasswordRules(value);
  return unmet.isEmpty ? null : unmet.first.label;
}

bool isPasswordPolicyCompliant(String value) =>
    unmetPasswordRules(value).isEmpty;
