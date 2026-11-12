import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/ai.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/features/surface/data/assistant_copy.dart';

void main() {
  group('assistant visibility', () {
    test('null capabilities hide the assistant for every role', () {
      for (final role in UserRole.values) {
        expect(shouldShowAssistantEntry(role, null), isFalse);
      }
    });

    test('policy-blocked capabilities hide even super admins', () {
      const capabilities = AiCapabilities(
        enabled: false,
        policyBlocked: true,
        reason: 'Disabled by administrator',
      );
      for (final role in UserRole.values) {
        expect(shouldShowAssistantEntry(role, capabilities), isFalse);
      }
    });

    test('unconfigured capabilities surface only for super admins', () {
      const capabilities = AiCapabilities(enabled: false);
      expect(
        shouldShowAssistantEntry(UserRole.superAdmin, capabilities),
        isTrue,
      );
      expect(shouldShowAssistantEntry(UserRole.teacher, capabilities), isFalse);
      expect(shouldShowAssistantEntry(UserRole.student, capabilities), isFalse);
    });

    test('ready capabilities surface for all roles', () {
      const capabilities = AiCapabilities(enabled: true, model: 'test');
      for (final role in UserRole.values) {
        expect(shouldShowAssistantEntry(role, capabilities), isTrue);
      }
    });

    test('setup hint is super-admin-only and hidden when ready', () {
      expect(
        showsAssistantSetupHint(
          UserRole.superAdmin,
          const AiCapabilities(enabled: false),
        ),
        isTrue,
      );
      expect(
        showsAssistantSetupHint(
          UserRole.teacher,
          const AiCapabilities(enabled: false),
        ),
        isFalse,
      );
      expect(
        showsAssistantSetupHint(
          UserRole.superAdmin,
          const AiCapabilities(enabled: true),
        ),
        isFalse,
      );
      expect(showsAssistantSetupHint(UserRole.superAdmin, null), isFalse);
    });

    test('availability distinguishes unreachable, blocked, unconfigured', () {
      expect(
        assistantAvailabilityFor(UserRole.student, null),
        AssistantAvailability.unreachable,
      );
      expect(
        assistantAvailabilityFor(
          UserRole.student,
          const AiCapabilities(enabled: false, policyBlocked: true),
        ),
        AssistantAvailability.policyBlocked,
      );
      expect(
        assistantAvailabilityFor(
          UserRole.student,
          const AiCapabilities(enabled: false),
        ),
        AssistantAvailability.unconfigured,
      );
      expect(
        assistantAvailabilityFor(
          UserRole.student,
          const AiCapabilities(enabled: true),
        ),
        AssistantAvailability.ready,
      );
    });

    test('role copies mirror the web/Android starter prompts', () {
      expect(
        starterPromptsFor(AssistantRole.student).first,
        'Why was I marked absent recently?',
      );
      expect(
        starterPromptsFor(AssistantRole.teacher).first,
        'List my sections',
      );
      expect(
        starterPromptsFor(AssistantRole.superAdmin).first,
        'Give me an institution overview',
      );
      expect(starterPromptsFor(null), isEmpty);
      expect(assistantRoleCopy.length, AssistantRole.values.length);
      expect(
        assistantRoleCopy[AssistantRole.student]!.emptyTitle,
        'Ask about your attendance',
      );
    });

    test('user roles map onto assistant roles', () {
      expect(
        AssistantRole.forUserRole(UserRole.superAdmin),
        AssistantRole.superAdmin,
      );
      expect(
        AssistantRole.forUserRole(UserRole.teacher),
        AssistantRole.teacher,
      );
      expect(
        AssistantRole.forUserRole(UserRole.student),
        AssistantRole.student,
      );
      expect(AssistantRole.forUserRole(null), isNull);
    });
  });
}
