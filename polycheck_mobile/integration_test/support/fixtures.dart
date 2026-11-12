import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/features/faculty/data/teacher_signing_key.dart';

import 'api_helpers.dart';
import 'env.dart';

/// One self-contained attendance scenario, owned entirely by the run that
/// created it.
///
/// Nothing here touches seeded demo data: every run mints its own teacher,
/// student, subject, section, session and signing key, all suffixed with a
/// unique run id. Two agents (or two CI shards) can therefore run the same spec
/// against the same backend at the same time without colliding on a fixture,
/// a device binding, or a signing key.
class AttendanceFixture {
  AttendanceFixture._({
    required this.api,
    required this.runId,
    required this.teacherEmail,
    required this.teacherPassword,
    required this.teacher,
    required this.studentId,
    required this.studentPassword,
    required this.student,
    required this.session,
    required this.qrToken,
    required this.signingKey,
    required this.subjectId,
    required this.sectionId,
    required this.sessionId,
  });

  final FixtureApi api;

  /// Unique per run; folded into every name, code and id this fixture creates.
  final String runId;

  final String teacherEmail;
  final String teacherPassword;
  final User teacher;

  /// `studentId` is the human student number (`2026-12345-MN-0`), which is also
  /// what the student login portal accepts as its username.
  final String studentId;
  final String studentPassword;
  final User student;

  /// The armed session, exactly as the server returned it after `activate` —
  /// including `teacherPublicKey`, which is the key the client verifies a queued
  /// scan against while offline.
  final Session session;

  /// The token the teacher signed locally and then armed the session with. The
  /// server holds the same string, so an offline replay of it verifies.
  final String qrToken;

  final TeacherSigningKey signingKey;

  final String subjectId;
  final String sectionId;
  final String sessionId;

  /// Builds and arms the whole scenario.
  ///
  /// Order matters and mirrors the product flows:
  /// 1. the super admin mints a disposable teacher + student,
  /// 2. the new teacher creates a subject, a section and an in-person session,
  /// 3. the teacher signs an in-person QR token with the app's own
  ///    `TeacherSigningKeyService` (a real Ed25519 signature over the real wire
  ///    format) and provisions the matching public key through
  ///    `POST /auth/provision-key`,
  /// 4. the session is activated with that exact token, so the server's
  ///    `session.qrToken === evidence.qrToken` gate passes on replay.
  static Future<AttendanceFixture> create({
    FixtureApi? api,
    TeacherSigningKeyService? signingKeys,
    int qrValidityMinutes = 15,
    int gracePeriodMinutes = 60,
  }) async {
    IntegrationEnv.assertAppClientTargetsHarness();
    final client = api ?? FixtureApi();
    final keys = signingKeys ?? TeacherSigningKeyService();

    final runId = _newRunId();
    final superAdmin = await client.loginFaculty(
      email: IntegrationEnv.superAdminEmail,
      password: IntegrationEnv.seedPassword,
    );

    final teacherEmail = 'e2e.teacher.$runId@pup.edu.ph';
    final teacherProfile = await client.createTeacher(
      token: superAdmin.token,
      fullName: 'E2E Teacher $runId',
      email: teacherEmail,
      password: IntegrationEnv.fixturePassword,
    );
    final teacherLogin = await client.loginFaculty(
      email: teacherEmail,
      password: IntegrationEnv.fixturePassword,
    );
    final teacher = User.fromJson(teacherProfile);
    expectFixture(
      teacher.id == teacherLogin.id,
      'fixture teacher login did not return the created teacher',
    );

    final subject = await client.createSubject(
      token: teacherLogin.token,
      name: 'E2E Subject $runId',
      code: 'E2E$runId',
    );
    final subjectId = subject['id']! as String;

    final section = await client.createSection(
      token: teacherLogin.token,
      subjectId: subjectId,
      section: 'E2E-$runId',
      room: 'Room $runId',
      semester: '2026-1st',
    );
    final sectionId = section['id']! as String;

    final studentProfile = await client.createStudent(
      token: superAdmin.token,
      fullName: 'E2E Student $runId',
      studentId: '2026-${_studentNumberFor(runId)}-MN-0',
      password: IntegrationEnv.fixturePassword,
    );
    final student = User.fromJson(studentProfile);
    expectFixture(
      student.studentId != null && student.studentId!.isNotEmpty,
      'fixture student was created without a student number',
    );

    await client.enrollStudent(
      token: teacherLogin.token,
      sectionId: sectionId,
      studentId: student.id,
      studentName: student.fullName,
    );

    final now = await client.serverNow();
    final createdSession = await client.createSession(
      token: teacherLogin.token,
      sectionId: sectionId,
      subjectName: 'E2E Subject $runId',
      date: now.toIso8601String().substring(0, 10),
      startTime: '08:00',
      endTime: '09:00',
      room: 'Room $runId',
      qrValidityMinutes: qrValidityMinutes,
      gracePeriodMinutes: gracePeriodMinutes,
    );
    final sessionId = createdSession['id']! as String;

    // The app's own keygen + wire format. This is the only thing the server
    // will accept as a valid signature, because it verifies against the public
    // key provisioned right below.
    final signingKey = await keys.getOrCreate(teacher.id);
    final sessionForPayload = Session.fromJson(createdSession);
    final payload = buildInPersonTokenPayload(
      session: sessionForPayload,
      teacher: teacher,
      issuedAtMs: now.millisecondsSinceEpoch,
      validityMinutes: qrValidityMinutes,
      gracePeriodMinutes: gracePeriodMinutes,
    );
    final qrToken = await keys.signPayload(payload, signingKey);

    await client.provisionTeacherKey(
      token: teacherLogin.token,
      publicKey: signingKey.publicKey,
    );

    final armed = await client.activateSession(
      token: teacherLogin.token,
      sessionId: sessionId,
      qrToken: qrToken,
      validityMinutes: qrValidityMinutes,
      gracePeriodMinutes: gracePeriodMinutes,
    );

    final session = Session.fromJson(armed);
    expectFixture(
      session.qrToken == qrToken,
      'the server armed a different token than the one signed locally',
    );
    expectFixture(
      session.teacherPublicKey == signingKey.publicKey,
      'the armed session does not carry the provisioned signing key',
    );

    return AttendanceFixture._(
      api: client,
      runId: runId,
      teacherEmail: teacherEmail,
      teacherPassword: IntegrationEnv.fixturePassword,
      teacher: teacher,
      studentId: student.studentId!,
      studentPassword: IntegrationEnv.fixturePassword,
      student: student,
      session: session,
      qrToken: qrToken,
      signingKey: signingKey,
      subjectId: subjectId,
      sectionId: sectionId,
      sessionId: sessionId,
    );
  }

  /// Teacher-side token, for reading the authoritative server rows back.
  Future<FixtureSession> teacherSession() =>
      api.loginFaculty(email: teacherEmail, password: teacherPassword);

  /// Server-side attendance rows for this fixture's session.
  Future<List<Map<String, dynamic>>> serverAttendance() async {
    final teacherAuth = await teacherSession();
    return api.readAttendance(token: teacherAuth.token, sessionId: sessionId);
  }

  /// Teardown of what the API allows.
  ///
  /// Server-side rows cannot be deleted once the session exists: the backend
  /// rejects `DELETE /sections/:id` with "Cannot delete a section with existing
  /// session history" and `DELETE /subjects/:id` with "Delete or reassign the
  /// subject sections first" — by design, so a defense-day fixture never erases
  /// attendance evidence. Every row this fixture created is run-unique and
  /// inert, so leftovers can never collide with the next run. What *is*
  /// cleaned up is this device's secure-storage signing key.
  Future<void> dispose({TeacherSigningKeyService? signingKeys}) async {
    final keys = signingKeys ?? TeacherSigningKeyService();
    try {
      await keys.reset(teacher.id);
    } catch (error) {
      debugPrint(
        'AttendanceFixture[$runId]: signing key for ${teacher.id} not reset '
        '(${_describe(error)}).',
      );
    }
  }

  static String _describe(Object error) =>
      error is FixtureApiException ? error.toString() : '$error';

  static String _newRunId() {
    final stamp = DateTime.now().toUtc().millisecondsSinceEpoch;
    final noise = math.Random()
        .nextInt(0x1000)
        .toRadixString(16)
        .padLeft(3, '0');
    return '${stamp % 100000000}${noise.toUpperCase()}';
  }

  /// Deterministic 5-digit block derived from the run id, so the student number
  /// is unique per run and still matches `^\d{4}-\d{5}-[A-Z]{2}-\d$`.
  static String _studentNumberFor(String runId) {
    final digits = runId.replaceAll(RegExp(r'[^0-9]'), '');
    final value = int.parse(digits.substring(0, digits.length.clamp(0, 8)));
    return (10000 + (value % 89999)).toString().padLeft(5, '0');
  }
}

/// Assertion used while building a fixture.
///
/// `flutter_test`'s `expect` is imported by the specs; this keeps the fixture
/// module free of the test framework so it can also be reused by tooling.
void expectFixture(bool condition, String message) {
  if (!condition) throw StateError('Fixture precondition failed: $message');
}
