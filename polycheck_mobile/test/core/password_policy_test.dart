import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/password_policy.dart';

void main() {
  test('mirrors the backend strong-password policy', () {
    expect(validatePasswordPolicy('StrongPassw0rd!'), isNull);
    expect(isPasswordPolicyCompliant('StrongPassw0rd!'), isTrue);

    for (final password in <String>[
      'Short1!',
      'alllowercase1!',
      'ALLUPPERCASE1!',
      'NoNumbersHere!',
      'NoSpecialChar123',
    ]) {
      expect(isPasswordPolicyCompliant(password), isFalse, reason: password);
    }
  });

  test('reports the first unmet rule in display order', () {
    expect(validatePasswordPolicy('short'), PasswordRule.minLength.label);
    expect(
      validatePasswordPolicy('alllowercase1!'),
      PasswordRule.uppercase.label,
    );
    expect(
      validatePasswordPolicy('ALLUPPERCASE1!'),
      PasswordRule.lowercase.label,
    );
    expect(validatePasswordPolicy('NoNumbersHere!'), PasswordRule.number.label);
    expect(
      validatePasswordPolicy('NoSpecialChar12'),
      PasswordRule.special.label,
    );
  });

  test('caps the accepted length at the backend maximum', () {
    final tooLong = 'Aa1!${'x' * 126}';
    expect(tooLong.length, greaterThan(passwordMaxLength));
    expect(isPasswordPolicyCompliant(tooLong), isFalse);
  });
}
