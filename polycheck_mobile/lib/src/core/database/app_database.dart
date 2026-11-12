import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../models/attendance.dart';
import '../models/notification.dart';
import '../models/section_role.dart';
import '../models/session.dart';
import '../models/subject.dart';
import '../models/support/wire_enum.dart';
import '../models/system_report.dart';
import '../models/user.dart';
import '../sync/attendance_pin_vault.dart';

part 'app_database.g.dart';

/// Local cache/outbox status for attendance records awaiting server sync.
///
/// Wire values are stable so an app upgrade can keep queued evidence; unknown
/// stored values fail loudly via the A1 strict decoder instead of silently
/// dropping a student's check-in.
enum AttendanceSyncStatus {
  pending('PENDING'),
  syncing('SYNCING'),
  confirmed('CONFIRMED'),

  /// Reconciled — the server accepted the record but stamped it `disputed`
  /// (instructor review), e.g. `delayed_offline_sync`. Synced, therefore never
  /// re-queued, but never reported as a plain confirmation either.
  confirmedFlagged('CONFIRMED_FLAGGED'),
  disputedDuplicate('DISPUTED_DUPLICATE'),
  failed('FAILED');

  const AttendanceSyncStatus(this.wire);

  final String wire;

  static final Map<String, AttendanceSyncStatus> byWire = wireLookup(
    values,
    (value) => value.wire,
  );

  static AttendanceSyncStatus fromWire(String value) =>
      decodeWireEnum('AttendanceSyncStatus', value, byWire);
}

/// Status for the non-attendance outboxes (system reports and excuses).
enum OutboxStatus {
  pending('PENDING'),
  sending('SENDING'),
  submitted('SUBMITTED'),
  failed('FAILED');

  const OutboxStatus(this.wire);

  final String wire;

  static final Map<String, OutboxStatus> byWire = wireLookup(
    values,
    (value) => value.wire,
  );

  static OutboxStatus fromWire(String value) =>
      decodeWireEnum('OutboxStatus', value, byWire);
}

class AttendanceSyncStatusConverter
    extends TypeConverter<AttendanceSyncStatus, String> {
  const AttendanceSyncStatusConverter();

  @override
  AttendanceSyncStatus fromSql(String fromDb) =>
      AttendanceSyncStatus.fromWire(fromDb);

  @override
  String toSql(AttendanceSyncStatus value) => value.wire;
}

class OutboxStatusConverter extends TypeConverter<OutboxStatus, String> {
  const OutboxStatusConverter();

  @override
  OutboxStatus fromSql(String fromDb) => OutboxStatus.fromWire(fromDb);

  @override
  String toSql(OutboxStatus value) => value.wire;
}

class NotificationTypeColumnConverter
    extends TypeConverter<NotificationType, String> {
  const NotificationTypeColumnConverter();

  @override
  NotificationType fromSql(String fromDb) =>
      decodeWireEnum('NotificationType', fromDb, NotificationType.byWire);

  @override
  String toSql(NotificationType value) => value.wire;
}

@DataClassName('CachedSubjectRow')
class CachedSubjects extends Table {
  TextColumn get userId => text()();
  TextColumn get id => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, id};
}

@DataClassName('CachedSectionRow')
@TableIndex(name: 'cached_sections_subject', columns: {#subjectId})
class CachedSections extends Table {
  TextColumn get userId => text()();
  TextColumn get id => text()();
  TextColumn get subjectId => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, id};
}

/// Calendar/schedule payload cache (one row per fetched date range).
@DataClassName('CachedScheduleRow')
class CachedSchedules extends Table {
  TextColumn get userId => text()();
  TextColumn get rangeKey => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, rangeKey};
}

/// Session cache (mirrors the Android `cached_sessions_v2` table).
@DataClassName('CachedSessionRow')
@TableIndex(name: 'cached_sessions_section', columns: {#sectionId})
class CachedSessions extends Table {
  TextColumn get userId => text()();
  TextColumn get id => text()();
  TextColumn get sectionId => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, id};
}

@DataClassName('CachedRosterRow')
@TableIndex(name: 'cached_rosters_section', columns: {#sectionId})
class CachedRosters extends Table {
  TextColumn get userId => text()();
  TextColumn get sectionId => text()();
  TextColumn get studentId => text()();
  TextColumn get payloadJson => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, sectionId, studentId};
}

/// Confirmed attendance cache (mirrors Android `cached_attendance_v2`).
///
/// The plan's table list omits this table, but the required "my attendance"
/// watcher and offline-first reads need a confirmed-record store separate
/// from the pending outbox.
@DataClassName('CachedAttendanceRow')
@TableIndex(name: 'cached_attendance_student', columns: {#studentId})
@TableIndex(name: 'cached_attendance_section', columns: {#sectionId})
@TableIndex(name: 'cached_attendance_session', columns: {#sessionId})
class CachedAttendance extends Table {
  TextColumn get userId => text()();
  TextColumn get id => text()();
  TextColumn get studentId => text()();
  TextColumn get sectionId => text()();
  TextColumn get sessionId => text()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(true))();
  TextColumn get payloadJson => text()();
  DateTimeColumn get cachedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {userId, id};
}

@DataClassName('OfflineAttendanceQueueRow')
@TableIndex(
  name: 'offline_attendance_session_student',
  columns: {#sessionId, #studentId},
)
@TableIndex(name: 'offline_attendance_sync_status', columns: {#syncStatus})
class OfflineAttendanceQueue extends Table {
  TextColumn get clientReceiptId => text()();
  TextColumn get userId => text()();
  TextColumn get sessionId => text()();
  TextColumn get studentId => text()();
  TextColumn get scannedToken => text()();
  TextColumn get checkpoint => text().nullable()();
  TextColumn get pinHash => text().nullable()();

  /// Meeting PIN persisted *encrypted at rest* (AES-256-GCM envelope,
  /// `AttendancePinCipher`) so a PIN-protected offline scan survives a cold
  /// start — RN parity: the plaintext PIN lives inside the encrypted
  /// `sync_queue_v2` payload on Android. Never contains plaintext; a failed
  /// decrypt drains without the PIN (server then stamps terminal
  /// `pin_required`, evidence retained).
  TextColumn get pinEncrypted => text().nullable()();
  RealColumn get latitude => real().nullable()();
  RealColumn get longitude => real().nullable()();
  RealColumn get accuracy => real().nullable()();

  /// Trusted-clock timestamp of the GNSS fix that produced [latitude] /
  /// [longitude] (in-person scans only — online sessions stay location-free,
  /// RA 10173). The backend's `missingCoreEvidence` gate stamps
  /// `disputed / missing_scan_evidence` on an in-person replay without it.
  DateTimeColumn get locationCapturedAt => dateTime().nullable()();
  RealColumn get haversineDistance => real().nullable()();
  BoolColumn get isMocked => boolean().withDefault(const Constant(false))();

  /// How the QR was captured (`camera` / `image` / `manual`) at scan time.
  /// Replayed verbatim, because the backend's `missingCoreEvidence` gate
  /// stamps `disputed / missing_scan_evidence` on any scan without it. Null
  /// only for rows queued before schema v3 — the channel was never captured
  /// then, and a replay of such a row truthfully reports the missing
  /// evidence instead of inventing a channel.
  TextColumn get inputChannel => text().nullable()();
  DateTimeColumn get scannedAtUtc => dateTime()();
  TextColumn get syncStatus =>
      text().map(const AttendanceSyncStatusConverter())();
  TextColumn get serverError => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastSentAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {clientReceiptId};
}

@DataClassName('SystemReportQueueRow')
class SystemReportQueue extends Table {
  TextColumn get clientReceiptId => text()();
  TextColumn get userId => text()();
  TextColumn get category => text()();
  TextColumn get severity => text()();
  TextColumn get title => text()();
  TextColumn get description => text()();
  TextColumn get screenshotData => text().nullable()();
  TextColumn get deviceInfo => text().nullable()();
  TextColumn get appVersion => text().nullable()();
  TextColumn get route => text().nullable()();
  TextColumn get networkType => text().nullable()();
  TextColumn get syncStatus => text().map(const OutboxStatusConverter())();
  TextColumn get serverError => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastSentAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {clientReceiptId};
}

@DataClassName('ExcuseQueueRow')
class ExcuseQueue extends Table {
  TextColumn get clientReceiptId => text()();
  TextColumn get userId => text()();
  TextColumn get recordId => text()();
  TextColumn get reason => text()();
  TextColumn get description => text()();
  TextColumn get evidenceData => text().nullable()();
  TextColumn get syncStatus => text().map(const OutboxStatusConverter())();
  TextColumn get serverError => text().nullable()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  DateTimeColumn get lastSentAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {clientReceiptId};
}

@DataClassName('NotificationInboxRow')
@TableIndex(name: 'notifications_created_at', columns: {#createdAt})
class NotificationsInbox extends Table {
  TextColumn get userId => text()();
  TextColumn get notificationId => text()();
  TextColumn get type => text().map(const NotificationTypeColumnConverter())();
  TextColumn get title => text().withDefault(const Constant(''))();
  TextColumn get body => text().withDefault(const Constant(''))();
  TextColumn get payloadJson => text()();
  DateTimeColumn get readAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  TextColumn get deepLink => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {userId, notificationId};
}

/// Owner-scoped metadata. The row with [AppDatabase.globalMetaOwnerId] is
/// ownerless and holds the device-wide trusted-clock offset so a logout purge
/// never discards the last measured server offset.
@DataClassName('CachedMetaRow')
class CachedMeta extends Table {
  TextColumn get userId => text()();
  IntColumn get clockOffsetMs => integer().nullable()();
  DateTimeColumn get clockOffsetUpdatedAt => dateTime().nullable()();
  DateTimeColumn get lastSyncAt => dateTime().nullable()();
  TextColumn get enrolledSectionIdsJson => text().nullable()();
  TextColumn get profileJson => text().nullable()();
  TextColumn get activeProfileUserId => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {userId};
}

@DriftDatabase(
  tables: [
    CachedSubjects,
    CachedSections,
    CachedSchedules,
    CachedSessions,
    CachedRosters,
    CachedAttendance,
    OfflineAttendanceQueue,
    SystemReportQueue,
    ExcuseQueue,
    NotificationsInbox,
    CachedMeta,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase.forTesting(super.executor, {this.pinCipher});

  AppDatabase._(super.executor, {this.pinCipher});

  /// Ownerless metadata row (global trusted-clock offset lives here).
  static const String globalMetaOwnerId = '';

  /// Encrypts the meeting PIN before it is written to [OfflineAttendanceQueue]
  /// and decrypts it at drain time (`core/sync` consumes the result only).
  /// Null when the cipher is unavailable or encryption fails — the queue row
  /// still persists (fail-open to the pin_required terminal evidence path,
  /// never to a crash).
  final AttendancePinCipher? pinCipher;

  /// Opens the on-device SQLite cache.
  factory AppDatabase.open() {
    return AppDatabase._(
      LazyDatabase(() async {
        final directory = await getApplicationSupportDirectory();
        final file = File(p.join(directory.path, 'polycheck.sqlite'));
        return NativeDatabase.createInBackground(file);
      }),
      pinCipher: SecureAttendancePinCipher(),
    );
  }

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration {
    return MigrationStrategy(
      onCreate: (Migrator m) async {
        await m.createAll();
      },
      onUpgrade: (Migrator m, int from, int to) async {
        // v2 — encrypted meeting-PIN persistence (`pinEncrypted`).
        if (from <= 1 && to >= 2) {
          await _addOfflineQueueColumn(
            'pin_encrypted',
            () => m.addColumn(
              offlineAttendanceQueue,
              offlineAttendanceQueue.pinEncrypted,
            ),
          );
        }
        // v3 — replayed scan evidence the backend requires
        // (`missingCoreEvidence`): the capture channel and, for in-person
        // scans, the GNSS fix timestamp.
        if (from <= 2 && to >= 3) {
          await _addOfflineQueueColumn(
            'input_channel',
            () => m.addColumn(
              offlineAttendanceQueue,
              offlineAttendanceQueue.inputChannel,
            ),
          );
          await _addOfflineQueueColumn(
            'location_captured_at',
            () => m.addColumn(
              offlineAttendanceQueue,
              offlineAttendanceQueue.locationCapturedAt,
            ),
          );
        }
      },
    );
  }

  /// Adds one column to `offline_attendance_queue` exactly once.
  ///
  /// A dirty development database that already ran the ALTER (or a migration
  /// interrupted between its steps) must not block the open, so a failed
  /// ALTER is only re-thrown when the column is genuinely absent.
  Future<void> _addOfflineQueueColumn(
    String columnName,
    Future<void> Function() alter,
  ) async {
    try {
      await alter();
    } catch (_) {
      final exists = await customSelect(
        "SELECT COUNT(*) AS n FROM pragma_table_info('offline_attendance_queue') "
        'WHERE name = ?',
        variables: [Variable<String>(columnName)],
      ).getSingleOrNull();
      final count = exists?.data['n'];
      if (!(count is num && count > 0)) rethrow;
    }
  }

  // ── Metadata ──

  Future<CachedMetaRow?> readMeta(String userId) {
    return (select(
      cachedMeta,
    )..where((row) => row.userId.equals(userId))).getSingleOrNull();
  }

  Future<int?> readClockOffsetMs() async {
    final row = await readMeta(globalMetaOwnerId);
    return row?.clockOffsetMs;
  }

  Future<DateTime?> readClockOffsetAt() async {
    final row = await readMeta(globalMetaOwnerId);
    return row?.clockOffsetUpdatedAt;
  }

  Future<void> writeClockOffset(int offsetMs, {DateTime? updatedAt}) async {
    final now = updatedAt ?? DateTime.now().toUtc();
    await transaction(() async {
      final updated =
          await (update(
            cachedMeta,
          )..where((row) => row.userId.equals(globalMetaOwnerId))).write(
            CachedMetaCompanion(
              clockOffsetMs: Value(offsetMs),
              clockOffsetUpdatedAt: Value(now),
            ),
          );
      if (updated == 0) {
        await into(cachedMeta).insert(
          CachedMetaCompanion.insert(
            userId: globalMetaOwnerId,
            clockOffsetMs: Value(offsetMs),
            clockOffsetUpdatedAt: Value(now),
          ),
        );
      }
    });
  }

  Future<void> writeProfile(User user) async {
    final enrolled = jsonEncode(user.enrolledSectionIds);
    final profile = jsonEncode(user.toJson());
    await transaction(() async {
      final updated =
          await (update(
            cachedMeta,
          )..where((row) => row.userId.equals(user.id))).write(
            CachedMetaCompanion(
              profileJson: Value(profile),
              enrolledSectionIdsJson: Value(enrolled),
            ),
          );
      if (updated == 0) {
        await into(cachedMeta).insert(
          CachedMetaCompanion.insert(
            userId: user.id,
            profileJson: Value(profile),
            enrolledSectionIdsJson: Value(enrolled),
          ),
        );
      }
      // Point the ownerless row at the cached profile so a cold start can find
      // the correct owner row before `/auth/me` responds.
      final pointed =
          await (update(cachedMeta)
                ..where((row) => row.userId.equals(globalMetaOwnerId)))
              .write(CachedMetaCompanion(activeProfileUserId: Value(user.id)));
      if (pointed == 0) {
        await into(cachedMeta).insert(
          CachedMetaCompanion.insert(
            userId: globalMetaOwnerId,
            activeProfileUserId: Value(user.id),
          ),
        );
      }
    });
  }

  Future<({String userId, User user})?> readActiveProfile() async {
    final global = await readMeta(globalMetaOwnerId);
    final userId = global?.activeProfileUserId;
    if (userId == null || userId.isEmpty) return null;
    final user = await readProfile(userId);
    if (user == null) return null;
    return (userId: userId, user: user);
  }

  Future<User?> readProfile(String userId) async {
    final row = await readMeta(userId);
    final raw = row?.profileJson;
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    return User.fromJson(decoded.cast<String, dynamic>());
  }

  Future<List<String>> readEnrolledSectionIds(String userId) async {
    final row = await readMeta(userId);
    final raw = row?.enrolledSectionIdsJson;
    if (raw == null || raw.isEmpty) return const <String>[];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const <String>[];
    return decoded.whereType<String>().toList(growable: false);
  }

  Future<void> writeEnrolledSectionIds(
    String userId,
    List<String> sectionIds,
  ) async {
    final encoded = jsonEncode(sectionIds);
    await transaction(() async {
      final updated =
          await (update(
            cachedMeta,
          )..where((row) => row.userId.equals(userId))).write(
            CachedMetaCompanion(enrolledSectionIdsJson: Value(encoded)),
          );
      if (updated == 0) {
        await into(cachedMeta).insert(
          CachedMetaCompanion.insert(
            userId: userId,
            enrolledSectionIdsJson: Value(encoded),
          ),
        );
      }
    });
  }

  Future<void> writeLastSync(String userId, DateTime at) async {
    final updated =
        await (update(cachedMeta)..where((row) => row.userId.equals(userId)))
            .write(CachedMetaCompanion(lastSyncAt: Value(at)));
    if (updated == 0) {
      await into(cachedMeta).insert(
        CachedMetaCompanion.insert(userId: userId, lastSyncAt: Value(at)),
      );
    }
  }

  /// Logout/session-eviction purge. Removes every owner-scoped row and the
  /// owner's metadata while preserving the ownerless trusted-clock row.
  ///
  /// [preserveAttendanceQueue] keeps queued offline check-ins through an
  /// authoritative 401/expiry so re-authentication can still drain evidence;
  /// an explicit sign-out uses the default purge.
  Future<void> clearOwner(
    String userId, {
    bool preserveAttendanceQueue = false,
  }) async {
    await transaction(() async {
      await (delete(
        cachedSubjects,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        cachedSections,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        cachedSchedules,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        cachedSessions,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        cachedRosters,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        cachedAttendance,
      )..where((row) => row.userId.equals(userId))).go();
      if (!preserveAttendanceQueue) {
        await (delete(
          offlineAttendanceQueue,
        )..where((row) => row.userId.equals(userId))).go();
      }
      await (delete(
        systemReportQueue,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        excuseQueue,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        notificationsInbox,
      )..where((row) => row.userId.equals(userId))).go();
      await (delete(
        cachedMeta,
      )..where((row) => row.userId.equals(userId))).go();
      await (update(cachedMeta)..where(
            (row) =>
                row.userId.equals(globalMetaOwnerId) &
                row.activeProfileUserId.equals(userId),
          ))
          .write(const CachedMetaCompanion(activeProfileUserId: Value(null)));
    });
  }

  // ── Read caches ──

  Future<void> replaceSubjects(String userId, List<Subject> subjects) async {
    await transaction(() async {
      await (delete(
        cachedSubjects,
      )..where((row) => row.userId.equals(userId))).go();
      await upsertSubjects(userId, subjects);
    });
  }

  Future<void> upsertSubjects(String userId, List<Subject> subjects) async {
    if (subjects.isEmpty) return;
    final now = DateTime.now().toUtc();
    await batch((batch) {
      batch.insertAllOnConflictUpdate(cachedSubjects, [
        for (final subject in subjects)
          CachedSubjectsCompanion.insert(
            userId: userId,
            id: subject.id,
            payloadJson: jsonEncode(subject.toJson()),
            cachedAt: now,
          ),
      ]);
    });
  }

  Future<void> replaceSections(String userId, List<Section> sections) async {
    await transaction(() async {
      await (delete(
        cachedSections,
      )..where((row) => row.userId.equals(userId))).go();
      await upsertSections(userId, sections);
    });
  }

  Future<void> upsertSections(String userId, List<Section> sections) async {
    if (sections.isEmpty) return;
    final now = DateTime.now().toUtc();
    await batch((batch) {
      batch.insertAllOnConflictUpdate(cachedSections, [
        for (final section in sections)
          CachedSectionsCompanion.insert(
            userId: userId,
            id: section.id,
            subjectId: section.subjectId,
            payloadJson: jsonEncode(section.toJson()),
            cachedAt: now,
          ),
      ]);
    });
  }

  Future<void> putScheduleCache(
    String userId,
    String rangeKey,
    List<Object?> events,
  ) async {
    await into(cachedSchedules).insertOnConflictUpdate(
      CachedSchedulesCompanion.insert(
        userId: userId,
        rangeKey: rangeKey,
        payloadJson: jsonEncode(events),
        cachedAt: DateTime.now().toUtc(),
      ),
    );
  }

  Future<List<Object?>?> readScheduleCache(
    String userId,
    String rangeKey,
  ) async {
    final row =
        await (select(cachedSchedules)..where(
              (row) =>
                  row.userId.equals(userId) & row.rangeKey.equals(rangeKey),
            ))
            .getSingleOrNull();
    if (row == null) return null;
    final decoded = jsonDecode(row.payloadJson);
    return decoded is List ? decoded : null;
  }

  Future<void> upsertSessions(String userId, List<Session> sessions) async {
    if (sessions.isEmpty) return;
    final now = DateTime.now().toUtc();
    await batch((batch) {
      batch.insertAllOnConflictUpdate(cachedSessions, [
        for (final session in sessions)
          CachedSessionsCompanion.insert(
            userId: userId,
            id: session.id,
            sectionId: session.sectionId,
            payloadJson: jsonEncode(session.toJson()),
            cachedAt: now,
          ),
      ]);
    });
  }

  Future<void> replaceSessionsForSection(
    String userId,
    String sectionId,
    List<Session> sessions,
  ) async {
    await transaction(() async {
      await (delete(cachedSessions)..where(
            (row) =>
                row.userId.equals(userId) & row.sectionId.equals(sectionId),
          ))
          .go();
      await upsertSessions(userId, sessions);
    });
  }

  Future<void> replaceRoster(
    String userId,
    String sectionId,
    List<User> students,
  ) async {
    final now = DateTime.now().toUtc();
    await transaction(() async {
      await (delete(cachedRosters)..where(
            (row) =>
                row.userId.equals(userId) & row.sectionId.equals(sectionId),
          ))
          .go();
      if (students.isEmpty) return;
      await batch((batch) {
        batch.insertAllOnConflictUpdate(cachedRosters, [
          for (final student in students)
            CachedRostersCompanion.insert(
              userId: userId,
              sectionId: sectionId,
              studentId: student.id,
              payloadJson: jsonEncode(student.toJson()),
              cachedAt: now,
            ),
        ]);
      });
    });
  }

  Future<void> upsertAttendance(
    String userId,
    List<AttendanceRecord> records,
  ) async {
    if (records.isEmpty) return;
    final now = DateTime.now().toUtc();
    await batch((batch) {
      batch.insertAllOnConflictUpdate(cachedAttendance, [
        for (final record in records)
          CachedAttendanceCompanion.insert(
            userId: userId,
            id: record.id,
            studentId: record.studentId,
            sectionId: record.sectionId,
            sessionId: record.sessionId,
            isSynced: Value(record.isSynced),
            payloadJson: jsonEncode(record.toJson()),
            cachedAt: now,
          ),
      ]);
    });
  }

  Future<void> replaceAttendanceForStudent(
    String userId,
    String studentId,
    List<AttendanceRecord> records,
  ) async {
    await transaction(() async {
      await (delete(cachedAttendance)..where(
            (row) =>
                row.userId.equals(userId) & row.studentId.equals(studentId),
          ))
          .go();
      await upsertAttendance(userId, records);
    });
  }

  Future<void> removeAttendanceForSessionStudent(
    String userId,
    String sessionId,
    String studentId,
  ) async {
    await (delete(cachedAttendance)..where(
          (row) =>
              row.userId.equals(userId) &
              row.sessionId.equals(sessionId) &
              row.studentId.equals(studentId),
        ))
        .go();
  }

  // ── Watchers (the reads screens subscribe to) ──

  Stream<List<Subject>> watchSubjects(String userId) {
    final query = select(cachedSubjects)
      ..where((row) => row.userId.equals(userId))
      ..orderBy([(row) => OrderingTerm.asc(row.cachedAt)]);
    return query.watch().map(
      (rows) => rows
          .map((row) => Subject.fromJson(_decodePayload(row.payloadJson)))
          .toList(growable: false),
    );
  }

  Stream<List<Section>> watchSections(String userId, {String? subjectId}) {
    final query = select(cachedSections)
      ..where(
        (row) => subjectId == null
            ? row.userId.equals(userId)
            : row.userId.equals(userId) & row.subjectId.equals(subjectId),
      )
      ..orderBy([(row) => OrderingTerm.asc(row.cachedAt)]);
    return query.watch().map(
      (rows) => rows
          .map((row) => Section.fromJson(_decodePayload(row.payloadJson)))
          .toList(growable: false),
    );
  }

  Stream<List<Session>> watchSessionsForSection(
    String userId,
    String sectionId,
  ) {
    final query = select(cachedSessions)
      ..where(
        (row) => row.userId.equals(userId) & row.sectionId.equals(sectionId),
      )
      ..orderBy([(row) => OrderingTerm.asc(row.cachedAt)]);
    return query.watch().map(
      (rows) => rows
          .map((row) => Session.fromJson(_decodePayload(row.payloadJson)))
          .toList(growable: false),
    );
  }

  Stream<List<User>> watchRoster(String userId, String sectionId) {
    final query = select(cachedRosters)
      ..where(
        (row) => row.userId.equals(userId) & row.sectionId.equals(sectionId),
      )
      ..orderBy([(row) => OrderingTerm.asc(row.cachedAt)]);
    return query.watch().map(
      (rows) => rows
          .map((row) => User.fromJson(_decodePayload(row.payloadJson)))
          .toList(growable: false),
    );
  }

  Stream<List<AttendanceRecord>> watchMyAttendance(
    String userId,
    String studentId,
  ) {
    final query = select(cachedAttendance)
      ..where(
        (row) => row.userId.equals(userId) & row.studentId.equals(studentId),
      )
      ..orderBy([(row) => OrderingTerm.desc(row.cachedAt)]);
    return query.watch().map(
      (rows) => rows
          .map(
            (row) => AttendanceRecord.fromJson(_decodePayload(row.payloadJson)),
          )
          .toList(growable: false),
    );
  }

  Stream<int> watchPendingQueueCount(String userId) {
    final count = offlineAttendanceQueue.clientReceiptId.count();
    final query = selectOnly(offlineAttendanceQueue)
      ..addColumns([count])
      ..where(
        offlineAttendanceQueue.userId.equals(userId) &
            (offlineAttendanceQueue.syncStatus.equalsValue(
                  AttendanceSyncStatus.pending,
                ) |
                (offlineAttendanceQueue.syncStatus.equalsValue(
                      AttendanceSyncStatus.failed,
                    ) &
                    (offlineAttendanceQueue.serverError.isNull() |
                        offlineAttendanceQueue.serverError
                            .like('terminal:%')
                            .not()))),
      );
    return query.watchSingle().map((row) => row.read(count) ?? 0);
  }

  Stream<int> watchUnreadNotificationCount(String userId) {
    final count = notificationsInbox.notificationId.count();
    final query = selectOnly(notificationsInbox)
      ..addColumns([count])
      ..where(
        notificationsInbox.userId.equals(userId) &
            notificationsInbox.readAt.isNull(),
      );
    return query.watchSingle().map((row) => row.read(count) ?? 0);
  }

  Stream<List<AppNotification>> watchNotifications(
    String userId, {
    int limit = 100,
  }) {
    final query = select(notificationsInbox)
      ..where((row) => row.userId.equals(userId))
      ..orderBy([(row) => OrderingTerm.desc(row.createdAt)])
      ..limit(limit);
    return query.watch().map(
      (rows) => rows
          .map(
            (row) => AppNotification.fromJson(_decodePayload(row.payloadJson)),
          )
          .toList(growable: false),
    );
  }

  // ── Notifications ──

  Future<void> upsertNotifications(
    String userId,
    List<AppNotification> notifications,
  ) async {
    if (notifications.isEmpty) return;
    final existing = await (select(
      notificationsInbox,
    )..where((row) => row.userId.equals(userId))).get();
    final readAtById = {
      for (final row in existing) row.notificationId: row.readAt,
    };
    await batch((batch) {
      batch.insertAllOnConflictUpdate(notificationsInbox, [
        for (final notification in notifications)
          NotificationsInboxCompanion.insert(
            userId: userId,
            notificationId: notification.id,
            type: notification.type,
            title: Value(notification.title),
            body: Value(notification.body),
            payloadJson: jsonEncode(notification.toJson()),
            readAt: Value(
              readAtById[notification.id] ??
                  _parseNullableDate(notification.readAt),
            ),
            createdAt:
                _parseNullableDate(notification.createdAt) ??
                DateTime.now().toUtc(),
            deepLink: Value(notification.link),
          ),
      ]);
    });
  }

  Future<void> markNotificationRead(
    String userId,
    String notificationId, {
    DateTime? readAt,
  }) async {
    await (update(notificationsInbox)..where(
          (row) =>
              row.userId.equals(userId) &
              row.notificationId.equals(notificationId),
        ))
        .write(
          NotificationsInboxCompanion(
            readAt: Value(readAt ?? DateTime.now().toUtc()),
          ),
        );
  }

  Future<void> markAllNotificationsRead(
    String userId, {
    DateTime? readAt,
  }) async {
    await (update(
      notificationsInbox,
    )..where((row) => row.userId.equals(userId) & row.readAt.isNull())).write(
      NotificationsInboxCompanion(
        readAt: Value(readAt ?? DateTime.now().toUtc()),
      ),
    );
  }

  /// Replaces the local inbox while preserving already-read stamps.
  Future<void> replaceNotifications(
    String userId,
    List<AppNotification> notifications,
  ) async {
    await upsertNotifications(userId, notifications);
  }

  // ── Offline attendance queue ──

  Future<void> enqueueAttendanceScan({
    required String clientReceiptId,
    required String userId,
    required String sessionId,
    required String studentId,
    required String scannedToken,
    required String inputChannel,
    String? checkpoint,
    String? pinHash,
    String? pin,
    double? latitude,
    double? longitude,
    double? accuracy,
    DateTime? locationCapturedAt,
    double? haversineDistance,
    bool isMocked = false,
    required DateTime scannedAtUtc,
    DateTime? createdAt,
  }) async {
    // RN parity: the PIN is persisted encrypted at rest, never in plaintext.
    String? pinEncrypted;
    if (pin != null && pin.trim().isNotEmpty) {
      final cipher = pinCipher;
      try {
        pinEncrypted = cipher == null ? null : await cipher.encrypt(pin.trim());
      } catch (_) {
        pinEncrypted = null;
      }
    }
    await into(offlineAttendanceQueue).insert(
      OfflineAttendanceQueueCompanion.insert(
        clientReceiptId: clientReceiptId,
        userId: userId,
        sessionId: sessionId,
        studentId: studentId,
        scannedToken: scannedToken,
        checkpoint: Value(checkpoint),
        pinHash: Value(pinHash),
        latitude: Value(latitude),
        longitude: Value(longitude),
        accuracy: Value(accuracy),
        locationCapturedAt: Value(locationCapturedAt),
        haversineDistance: Value(haversineDistance),
        isMocked: Value(isMocked),
        inputChannel: Value(inputChannel),
        pinEncrypted: Value(pinEncrypted),
        scannedAtUtc: scannedAtUtc,
        syncStatus: AttendanceSyncStatus.pending,
        createdAt: createdAt ?? DateTime.now().toUtc(),
      ),
      mode: InsertMode.insertOrIgnore,
    );
  }

  /// Drain-side decrypt helper: resolves the persisted ciphertext back to the
  /// meeting PIN when replaying a PIN-protected scan. Returns null — and the
  /// drain continues WITHOUT the pin (server then stamps terminal
  /// `pin_required`, evidence retained) — for absent, foreign or tampered
  /// ciphertext; never throws.
  Future<String?> decryptQueuePin(OfflineAttendanceQueueRow row) async {
    final cipher = pinCipher;
    final stored = row.pinEncrypted;
    if (cipher == null || stored == null || stored.isEmpty) return null;
    try {
      return await cipher.decrypt(stored);
    } catch (_) {
      return null;
    }
  }

  /// Clears the persisted PIN ciphertext once the queue row reached a
  /// terminal reconciliation (CONFIRMED / DISPUTED_DUPLICATE / terminal
  /// FAILED). Retryable failures keep it — the replay still needs the PIN.
  Future<void> clearQueuePin(String clientReceiptId) {
    return (update(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      const OfflineAttendanceQueueCompanion(pinEncrypted: Value(null)),
    );
  }

  Future<OfflineAttendanceQueueRow?> attendanceQueueEntry(
    String clientReceiptId,
  ) {
    return (select(offlineAttendanceQueue)
          ..where((row) => row.clientReceiptId.equals(clientReceiptId)))
        .getSingleOrNull();
  }

  Future<List<OfflineAttendanceQueueRow>> pendingAttendanceQueue(
    String userId, {
    int limit = 100,
  }) {
    return (select(offlineAttendanceQueue)
          ..where(
            (row) =>
                row.userId.equals(userId) &
                row.syncStatus.equalsValue(AttendanceSyncStatus.pending),
          )
          ..orderBy([(row) => OrderingTerm.asc(row.scannedAtUtc)])
          ..limit(limit))
        .get();
  }

  /// Rows the drain may attempt: pending rows plus retryable failures.
  ///
  /// Terminal failures are stamped `terminal:` in [serverError] (the RN
  /// contract) and stay in the table as review evidence; they are never
  /// re-attempted and never inflate the pending count.
  Future<List<OfflineAttendanceQueueRow>> drainableAttendanceQueue(
    String userId, {
    int limit = 100,
  }) {
    return (select(offlineAttendanceQueue)
          ..where(
            (row) =>
                row.userId.equals(userId) &
                (row.syncStatus.equalsValue(AttendanceSyncStatus.pending) |
                    (row.syncStatus.equalsValue(AttendanceSyncStatus.failed) &
                        (row.serverError.isNull() |
                            row.serverError.like('terminal:%').not()))),
          )
          ..orderBy([(row) => OrderingTerm.asc(row.scannedAtUtc)])
          ..limit(limit))
        .get();
  }

  /// Number of queue rows still eligible for a drain (pending + retryable).
  Future<int> countDrainableAttendance(String userId) async {
    final count = offlineAttendanceQueue.clientReceiptId.count();
    final query = selectOnly(offlineAttendanceQueue)
      ..addColumns([count])
      ..where(
        offlineAttendanceQueue.userId.equals(userId) &
            (offlineAttendanceQueue.syncStatus.equalsValue(
                  AttendanceSyncStatus.pending,
                ) |
                (offlineAttendanceQueue.syncStatus.equalsValue(
                      AttendanceSyncStatus.failed,
                    ) &
                    (offlineAttendanceQueue.serverError.isNull() |
                        offlineAttendanceQueue.serverError
                            .like('terminal:%')
                            .not()))),
      );
    final row = await query.getSingle();
    return row.read(count) ?? 0;
  }

  Future<void> markQueueSyncing(String clientReceiptId, {DateTime? sentAt}) {
    return (update(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      OfflineAttendanceQueueCompanion(
        syncStatus: const Value(AttendanceSyncStatus.syncing),
        lastSentAt: Value(sentAt ?? DateTime.now().toUtc()),
      ),
    );
  }

  /// Returns a stuck `SYNCING` claim to `PENDING` (crash-safe drain start).
  Future<int> resetStaleSyncingAttendance(
    String userId, {
    required DateTime olderThan,
  }) {
    return (update(offlineAttendanceQueue)..where(
          (row) =>
              row.userId.equals(userId) &
              row.syncStatus.equalsValue(AttendanceSyncStatus.syncing) &
              (row.lastSentAt.isNull() |
                  row.lastSentAt.isSmallerThanValue(olderThan)),
        ))
        .write(
          const OfflineAttendanceQueueCompanion(
            syncStatus: Value(AttendanceSyncStatus.pending),
          ),
        );
  }

  /// Releases a claimed row without counting a failed attempt (401/maintenance
  /// aborts keep the original evidence exactly as queued).
  Future<void> markQueuePending(String clientReceiptId) {
    return (update(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      const OfflineAttendanceQueueCompanion(
        syncStatus: Value(AttendanceSyncStatus.pending),
      ),
    );
  }

  /// Reconciles an accepted receipt. [flagged] records a synced-but-disputed
  /// record (`CONFIRMED_FLAGGED`): the server persisted it under instructor
  /// review, so the row is done — never re-queued — but it is not a plain
  /// confirmation and the drain report must say so. [serverError] carries the
  /// server's dispute reason for the flagged row.
  Future<void> markQueueConfirmed(
    String clientReceiptId, {
    bool flagged = false,
    String? serverError,
  }) {
    return (update(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      OfflineAttendanceQueueCompanion(
        syncStatus: Value(
          flagged
              ? AttendanceSyncStatus.confirmedFlagged
              : AttendanceSyncStatus.confirmed,
        ),
        serverError: Value(flagged ? serverError : null),
      ),
    );
  }

  Future<void> markQueueDisputedDuplicate(
    String clientReceiptId, {
    String? serverError,
  }) {
    return (update(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      OfflineAttendanceQueueCompanion(
        syncStatus: const Value(AttendanceSyncStatus.disputedDuplicate),
        serverError: Value(serverError),
      ),
    );
  }

  Future<void> markQueueFailed(
    String clientReceiptId, {
    required String serverError,
    bool incrementRetry = true,
  }) async {
    final row =
        await (select(offlineAttendanceQueue)
              ..where((row) => row.clientReceiptId.equals(clientReceiptId)))
            .getSingleOrNull();
    if (row == null) return;
    await (update(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      OfflineAttendanceQueueCompanion(
        syncStatus: const Value(AttendanceSyncStatus.failed),
        serverError: Value(serverError),
        retryCount: Value(incrementRetry ? row.retryCount + 1 : row.retryCount),
      ),
    );
  }

  Future<void> deleteAttendanceQueueEntry(String clientReceiptId) {
    return (delete(
      offlineAttendanceQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).go();
  }

  // ── System report / excuse outboxes ──

  Future<void> enqueueSystemReport({
    required String clientReceiptId,
    required String userId,
    required ReportCategory category,
    required ReportSeverity severity,
    required String title,
    required String description,
    String? screenshotData,
    String? deviceInfo,
    String? appVersion,
    String? route,
    String? networkType,
    DateTime? createdAt,
  }) {
    return into(systemReportQueue).insert(
      SystemReportQueueCompanion.insert(
        clientReceiptId: clientReceiptId,
        userId: userId,
        category: category.wire,
        severity: severity.wire,
        title: title,
        description: description,
        screenshotData: Value(screenshotData),
        deviceInfo: Value(deviceInfo),
        appVersion: Value(appVersion),
        route: Value(route),
        networkType: Value(networkType),
        syncStatus: OutboxStatus.pending,
        createdAt: createdAt ?? DateTime.now().toUtc(),
      ),
      mode: InsertMode.insertOrIgnore,
    );
  }

  Future<void> markSystemReportSubmitted(String clientReceiptId) {
    return (update(
      systemReportQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      const SystemReportQueueCompanion(
        syncStatus: Value(OutboxStatus.submitted),
      ),
    );
  }

  Future<void> markSystemReportFailed(
    String clientReceiptId, {
    required String serverError,
  }) async {
    final row =
        await (select(systemReportQueue)
              ..where((row) => row.clientReceiptId.equals(clientReceiptId)))
            .getSingleOrNull();
    if (row == null) return;
    await (update(
      systemReportQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      SystemReportQueueCompanion(
        syncStatus: const Value(OutboxStatus.failed),
        serverError: Value(serverError),
        retryCount: Value(row.retryCount + 1),
      ),
    );
  }

  Future<void> enqueueExcuse({
    required String clientReceiptId,
    required String userId,
    required String recordId,
    required ExcuseReason reason,
    required String description,
    String? evidenceData,
    DateTime? createdAt,
  }) {
    return into(excuseQueue).insert(
      ExcuseQueueCompanion.insert(
        clientReceiptId: clientReceiptId,
        userId: userId,
        recordId: recordId,
        reason: reason.wire,
        description: description,
        evidenceData: Value(evidenceData),
        syncStatus: OutboxStatus.pending,
        createdAt: createdAt ?? DateTime.now().toUtc(),
      ),
      mode: InsertMode.insertOrIgnore,
    );
  }

  Future<void> markExcuseSubmitted(String clientReceiptId) {
    return (update(
      excuseQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      const ExcuseQueueCompanion(syncStatus: Value(OutboxStatus.submitted)),
    );
  }

  Future<void> markExcuseFailed(
    String clientReceiptId, {
    required String serverError,
  }) async {
    final row =
        await (select(excuseQueue)
              ..where((row) => row.clientReceiptId.equals(clientReceiptId)))
            .getSingleOrNull();
    if (row == null) return;
    await (update(
      excuseQueue,
    )..where((row) => row.clientReceiptId.equals(clientReceiptId))).write(
      ExcuseQueueCompanion(
        syncStatus: const Value(OutboxStatus.failed),
        serverError: Value(serverError),
        retryCount: Value(row.retryCount + 1),
      ),
    );
  }

  // ── Section roles / permissions cache (small, additive helpers) ──

  Future<void> writeRolesSnapshot(
    String userId,
    List<SectionRole> roles,
  ) async {
    await putScheduleCache(
      userId,
      'section-roles:all',
      roles.map((role) => role.toJson()).toList(growable: false),
    );
  }

  Future<List<SectionRole>> readRolesSnapshot(String userId) async {
    final rows = await readScheduleCache(userId, 'section-roles:all');
    if (rows == null) return const <SectionRole>[];
    return rows
        .whereType<Map>()
        .map((row) => SectionRole.fromJson(row.cast<String, dynamic>()))
        .toList(growable: false);
  }
}

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final database = AppDatabase.open();
  ref.onDispose(database.close);
  return database;
});

Map<String, dynamic> _decodePayload(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is Map<String, dynamic>) return decoded;
  if (decoded is Map) return decoded.cast<String, dynamic>();
  throw FormatException('Cached payload is not a JSON object');
}

DateTime? _parseNullableDate(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toUtc();
}
