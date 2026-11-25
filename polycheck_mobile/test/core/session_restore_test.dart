import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';

import '../helpers/auth_harness.dart';

/// `me()` is never reached for these cases: restore fails while decoding the
/// cached profile, before any network call.
class _NeverCalledSessionApi extends FakeSessionApi {}

Future<
  ({ProviderContainer container, AppDatabase database, MemoryTokenStore tokens})
>
_harness({
  required AppDatabase database,
  required MemoryTokenStore tokens,
}) async {
  final container = ProviderContainer(
    overrides: <Override>[
      sessionApiProvider.overrideWithValue(_NeverCalledSessionApi()),
      tokenStoreProvider.overrideWithValue(tokens),
      deviceIdentityProvider.overrideWithValue(TestDeviceIdentity()),
      appDatabaseProvider.overrideWithValue(database),
    ],
  );
  addTearDown(container.dispose);
  return (container: container, database: database, tokens: tokens);
}

/// Overwrites the stored profile JSON with bytes that cannot decode into a
/// `User` (a corrupt cache from an interrupted write or a downgraded build).
Future<void> _corruptProfile(AppDatabase database, String userId) async {
  await (database.update(database.cachedMeta)
        ..where((row) => row.userId.equals(userId)))
      .write(const CachedMetaCompanion(profileJson: Value('{not json')));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('FLR-02 restore failure handling', () {
    test('a corrupt cached profile lands signedOut, not restoring', () async {
      final database = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(database.close);
      const student = User(
        id: 'u1',
        fullName: 'Student One',
        role: UserRole.student,
      );
      await database.writeProfile(student);
      await _corruptProfile(database, 'u1');
      final harness = await _harness(
        database: database,
        tokens: MemoryTokenStore('stale-token'),
      );

      await harness.container.read(sessionProvider.notifier).restore();

      final state = harness.container.read(sessionProvider);
      expect(state.status, SessionStatus.signedOut);
      expect(state.user, isNull);
      expect(state.isRestoring, isFalse);
      expect(await harness.tokens.read(), isNull, reason: 'fail closed');

      // The corrupt cache is gone: the next cold start cannot re-fail on it.
      expect(await database.readActiveProfile(), isNull);
      expect(await database.readProfile('u1'), isNull);
    });

    test(
      'the owner pointer is cleared so a stale row cannot resurrect',
      () async {
        final database = AppDatabase.forTesting(NativeDatabase.memory());
        addTearDown(database.close);
        const student = User(
          id: 'u1',
          fullName: 'Student One',
          role: UserRole.student,
        );
        await database.writeProfile(student);
        await _corruptProfile(database, 'u1');
        final harness = await _harness(
          database: database,
          tokens: MemoryTokenStore('stale-token'),
        );

        await harness.container.read(sessionProvider.notifier).restore();

        final global = await database.readMeta(AppDatabase.globalMetaOwnerId);
        expect(global?.activeProfileUserId, isNull);
      },
    );

    test(
      'queued attendance evidence survives the corrupt-cache purge',
      () async {
        final database = AppDatabase.forTesting(NativeDatabase.memory());
        addTearDown(database.close);
        const student = User(
          id: 'u1',
          fullName: 'Student One',
          role: UserRole.student,
        );
        await database.writeProfile(student);
        await database.enqueueAttendanceScan(
          clientReceiptId: 'r-keep',
          userId: 'u1',
          sessionId: 'sess-1',
          studentId: 'u1',
          scannedToken: 'signed-token',
          inputChannel: 'camera',
          scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
        );
        await _corruptProfile(database, 'u1');
        final harness = await _harness(
          database: database,
          tokens: MemoryTokenStore('stale-token'),
        );

        await harness.container.read(sessionProvider.notifier).restore();

        expect(await database.attendanceQueueEntry('r-keep'), isNotNull);
      },
    );

    test('a successful restore still lands signedIn', () async {
      final database = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(database.close);
      const student = User(
        id: 'u1',
        fullName: 'Student One',
        role: UserRole.student,
      );
      await database.writeProfile(student);
      final container = ProviderContainer(
        overrides: <Override>[
          sessionApiProvider.overrideWithValue(
            FakeSessionApi(onMe: () async => student),
          ),
          tokenStoreProvider.overrideWithValue(MemoryTokenStore('valid-token')),
          deviceIdentityProvider.overrideWithValue(TestDeviceIdentity()),
          appDatabaseProvider.overrideWithValue(database),
        ],
      );
      addTearDown(container.dispose);

      await container.read(sessionProvider.notifier).restore();

      final state = container.read(sessionProvider);
      expect(state.status, SessionStatus.signedIn);
      expect(state.user?.id, 'u1');
    });

    test('no token at all is a plain signedOut with no cache access', () async {
      final database = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(database.close);
      final harness = await _harness(
        database: database,
        tokens: MemoryTokenStore(),
      );

      await harness.container.read(sessionProvider.notifier).restore();

      expect(
        harness.container.read(sessionProvider).status,
        SessionStatus.signedOut,
      );
    });
  });
}
