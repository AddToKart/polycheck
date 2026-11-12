import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import 'student_cache.dart';
import 'student_models.dart';

/// Drift-first student reads with an opportunistic network refresh.
///
/// Every provider returns the local cache immediately (the A2 `.watch()`
/// streams), then writes the authoritative response into the same cache so the
/// watch emits the fresh rows. A network failure never clears cached data.

final studentSectionsProvider = StreamProvider<List<Section>>((ref) {
  final user = ref.watch(sessionProvider).user;
  final database = ref.watch(appDatabaseProvider);
  if (user == null) return Stream<List<Section>>.value(const <Section>[]);
  final api = ref.watch(sectionsApiProvider);
  unawaited(_refreshSections(database, api, user.id));
  return database.watchSections(user.id);
});

Future<void> _refreshSections(
  AppDatabase database,
  SectionsApi api,
  String userId,
) async {
  try {
    final sections = await api.getStudentSections(userId);
    await database.replaceSections(userId, sections);
    await database.writeEnrolledSectionIds(userId, <String>[
      for (final section in sections) section.id,
    ]);
  } catch (_) {
    // Offline-first: cached sections remain the source of truth.
  }
}

final studentSubjectsProvider = FutureProvider<Map<String, Subject>>((
  ref,
) async {
  final user = ref.watch(sessionProvider).user;
  if (user == null) return const <String, Subject>{};
  final database = ref.watch(appDatabaseProvider);
  final api = ref.watch(subjectsApiProvider);
  try {
    final subjects = await api.getSubjects();
    await database.replaceSubjects(user.id, subjects);
    return <String, Subject>{
      for (final subject in subjects) subject.id: subject,
    };
  } catch (_) {
    return _readCachedSubjects(database, user.id);
  }
});

Future<Map<String, Subject>> _readCachedSubjects(
  AppDatabase database,
  String userId,
) async {
  final rows = await (database.select(
    database.cachedSubjects,
  )..where((row) => row.userId.equals(userId))).get();
  final subjects = <String, Subject>{};
  for (final row in rows) {
    try {
      final subject = Subject.fromJson(decodeCachedPayload(row.payloadJson));
      subjects[subject.id] = subject;
    } catch (_) {
      // Skip a corrupt cache row instead of hiding every subject.
    }
  }
  return subjects;
}

final myAttendanceProvider = StreamProvider<List<AttendanceRecord>>((ref) {
  final user = ref.watch(sessionProvider).user;
  final database = ref.watch(appDatabaseProvider);
  if (user == null) {
    return Stream<List<AttendanceRecord>>.value(const <AttendanceRecord>[]);
  }
  final api = ref.watch(attendanceApiProvider);
  unawaited(_refreshMyAttendance(database, api, user.id));
  return database.watchMyAttendance(user.id, user.id);
});

Future<void> _refreshMyAttendance(
  AppDatabase database,
  AttendanceApi api,
  String userId,
) async {
  try {
    final records = await api.getMyAttendance(userId);
    await database.replaceAttendanceForStudent(userId, userId, records);
  } catch (_) {
    // Cached confirmed records remain visible while offline.
  }
}

final todaySessionsProvider = FutureProvider<List<Session>>((ref) async {
  final user = ref.watch(sessionProvider).user;
  if (user == null) return const <Session>[];
  final database = ref.watch(appDatabaseProvider);
  final api = ref.watch(sessionsApiProvider);
  final today = formatCampusDate(DateTime.now());
  try {
    final sessions = await api.getSessions();
    await database.upsertSessions(user.id, sessions);
    return sessions
        .where((session) => session.date == today)
        .toList(growable: false);
  } catch (_) {
    return readCachedSessions(database, user.id, date: today);
  }
});

final pendingScanCountProvider = StreamProvider<int>((ref) {
  final user = ref.watch(sessionProvider).user;
  final database = ref.watch(appDatabaseProvider);
  if (user == null) return Stream<int>.value(0);
  return database.watchPendingQueueCount(user.id);
});

/// Supplementary standing fetch; failures simply render no banner.
final studentStandingProvider = FutureProvider<List<AttendanceStanding>>((
  ref,
) async {
  final user = ref.watch(sessionProvider).user;
  if (user == null || user.role != UserRole.student) {
    return const <AttendanceStanding>[];
  }
  try {
    return await ref.read(attendanceApiProvider).getMyStanding();
  } catch (_) {
    return const <AttendanceStanding>[];
  }
});

/// Hologram device chip (`DEVICE-BOUND •·•·4F2A`), masked server-side style.
final studentDeviceChipProvider = FutureProvider<String>((ref) async {
  try {
    final deviceId = await ref.read(deviceIdentityProvider).getOrCreate();
    return maskDeviceChip(deviceId);
  } catch (_) {
    return maskDeviceChip(null);
  }
});

/// Tri-state outcome of the officer session-permission check (Bug 6).
///
/// `denied` is an authoritative server answer ("no active permission");
/// `errored` means the check itself could not be completed (offline/server
/// failure) and must never render as a fake denial — the UI shows
/// "Couldn't verify permission — tap to retry" instead.
enum OfficerPermissionCheck { authorized, denied, errored }

/// [StudentSectionDetail] plus the tri-state permission outcome.
///
/// The detail model keeps its plain `hasActivePermission` bool (true iff
/// [permission] is [OfficerPermissionCheck.authorized]); the tri-state lives
/// here so the screens can branch authorized/denied/errored.
class StudentSectionDetailView {
  const StudentSectionDetailView({
    required this.detail,
    required this.permission,
    this.permissionExpiresAt,
  });

  final StudentSectionDetail detail;
  final OfficerPermissionCheck permission;

  /// Server-side expiry of the active session-permission row (when
  /// [permission] is authorized) — mirrors the instructor web console's
  /// "Active until" display.
  final DateTime? permissionExpiresAt;

  bool get hasActivePermission =>
      permission == OfficerPermissionCheck.authorized;

  bool get isOfficer => detail.isOfficer;

  bool get isPresident => detail.isPresident;

  bool get isQac => detail.isQac;

  String get subjectName => detail.subjectName;

  String get sectionLabel => detail.sectionLabel;
}

/// Section detail for the officer surfaces.
///
/// `autoDispose` (Bug 6): the permission check is time-sensitive — a cached
/// `false` from a previous mount used to block officers whose instructor had
/// since granted access. With autoDispose the provider is recreated on every
/// re-entry, and the screens additionally refresh it on init.
final studentSectionDetailProvider = FutureProvider.autoDispose
    .family<StudentSectionDetailView, String>((ref, sectionId) async {
      final user = ref.watch(sessionProvider).user;
      if (user == null) {
        throw const ApiRequestError(
          message: 'Sign in with a student account to view this class.',
          status: 401,
        );
      }
      final database = ref.watch(appDatabaseProvider);
      final sectionsApi = ref.read(sectionsApiProvider);
      final sessionsApi = ref.read(sessionsApiProvider);
      final subjectsApi = ref.read(subjectsApiProvider);

      Section section;
      try {
        section = await sectionsApi.getSection(sectionId);
        await database.upsertSections(user.id, <Section>[section]);
      } on Object {
        final cached = await readCachedSection(database, user.id, sectionId);
        if (cached == null) rethrow;
        section = cached;
      }
      Subject? subject;
      try {
        subject = await subjectsApi.getSubject(section.subjectId);
      } catch (_) {
        subject = null;
      }

      List<Session> sessions;
      try {
        sessions = await sessionsApi.getSectionSessions(sectionId);
        await database.replaceSessionsForSection(user.id, sectionId, sessions);
      } catch (_) {
        sessions = await readCachedSessions(
          database,
          user.id,
          sectionId: sectionId,
        );
      }

      List<SectionRole> roles;
      try {
        final allRoles = await sectionsApi.getStudentRoles(user.id);
        await database.writeRolesSnapshot(user.id, allRoles);
        roles = allRoles
            .where((role) => role.sectionId == sectionId)
            .toList(growable: false);
      } catch (_) {
        // Offline fallback: the last known roles snapshot stays authoritative
        // for officer badges.
        final cached = await database.readRolesSnapshot(user.id);
        roles = cached
            .where((role) => role.sectionId == sectionId)
            .toList(growable: false);
      }

      // Permission tri-state (Bug 6): only presidents carry the check; a
      // failed check is `errored`, never a fake `denied`.
      //
      // Authorization source = `GET /session-permissions/:sectionId` — the
      // exact endpoint the instructor web console reads its "Active until"
      // chip from. Boolean `check` is still issued and only used as a
      // diagnostic tie-breaker when the list contradicts it, so the student
      // surface can never disagree with what the instructor sees.
      var permission = OfficerPermissionCheck.denied;
      DateTime? permissionExpiresAt;
      if (roles.any((role) => role.role == SectionRoleType.president)) {
        try {
          final rows = await sectionsApi.getActiveSessionPermissions(sectionId);
          final mine = rows
              .where((row) => row.studentId == user.id && row.isActive)
              .toList(growable: false);
          DateTime? latest;
          for (final row in mine) {
            final expires = DateTime.tryParse(row.expiresAt)?.toUtc();
            if (expires == null) continue;
            if (expires.isAfter(DateTime.now().toUtc()) &&
                (latest == null || expires.isAfter(latest))) {
              latest = expires;
            }
          }
          if (latest != null) {
            permission = OfficerPermissionCheck.authorized;
            permissionExpiresAt = latest;
          } else {
            permission = OfficerPermissionCheck.denied;
          }
        } on Object {
          permission = OfficerPermissionCheck.errored;
        }
      }

      return StudentSectionDetailView(
        detail: StudentSectionDetail(
          section: section,
          subject: subject,
          sessions: sessions,
          roles: roles,
          hasActivePermission: permission == OfficerPermissionCheck.authorized,
        ),
        permission: permission,
        permissionExpiresAt: permissionExpiresAt,
      );
    });

/// Session detail for the officer proof-of-class surface.
///
/// `autoDispose` mirrors [studentSectionDetailProvider]: session state
/// (activation, tokens) changes server-side between visits, so every
/// re-entry re-fetches instead of replaying a cached snapshot.
final studentSessionDetailProvider = FutureProvider.autoDispose
    .family<StudentSessionDetail, StudentSessionKey>((ref, key) async {
      final user = ref.watch(sessionProvider).user;
      if (user == null) {
        throw const ApiRequestError(
          message: 'Sign in with a student account to view this session.',
          status: 401,
        );
      }
      final database = ref.watch(appDatabaseProvider);
      final sessionsApi = ref.read(sessionsApiProvider);
      final sectionsApi = ref.read(sectionsApiProvider);
      final subjectsApi = ref.read(subjectsApiProvider);
      final proofsApi = ref.read(proofsApiProvider);

      Session? session;
      try {
        session = await sessionsApi.getSession(key.sessionId);
        await database.upsertSessions(user.id, <Session>[session]);
      } catch (_) {
        session = await readCachedSession(database, user.id, key.sessionId);
      }
      if (session == null) {
        throw const ApiRequestError(
          message: 'This class session could not be found.',
          status: 404,
        );
      }

      Section? section;
      try {
        section = await sectionsApi.getSection(key.sectionId);
        await database.upsertSections(user.id, <Section>[section]);
      } catch (_) {
        section = await readCachedSection(database, user.id, key.sectionId);
      }
      if (section == null) {
        throw const ApiRequestError(
          message: 'This class could not be found.',
          status: 404,
        );
      }

      Subject? subject;
      try {
        subject = await subjectsApi.getSubject(section.subjectId);
      } catch (_) {
        subject = null;
      }

      List<ProofOfClass> proofs;
      try {
        proofs = await proofsApi.getProofsOfClass(key.sessionId);
      } catch (_) {
        proofs = const <ProofOfClass>[];
      }

      var isQac = false;
      try {
        final roles = await sectionsApi.getStudentRoles(user.id);
        await database.writeRolesSnapshot(user.id, roles);
        isQac = roles.any(
          (role) =>
              role.sectionId == key.sectionId &&
              role.role == SectionRoleType.qac,
        );
      } catch (_) {
        final roles = await database.readRolesSnapshot(user.id);
        isQac = roles.any(
          (role) =>
              role.sectionId == key.sectionId &&
              role.role == SectionRoleType.qac,
        );
      }

      return StudentSessionDetail(
        session: session,
        section: section,
        subject: subject,
        proofs: proofs,
        isQac: isQac,
      );
    });
