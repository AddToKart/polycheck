import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/session_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/network/secure_token_store.dart';
import 'package:polycheck_mobile/src/core/providers/maintenance_provider.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/providers/trusted_clock.dart';

class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this.token]);

  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String value) async => token = value;

  @override
  Future<void> clear() async => token = null;
}

class TestDeviceIdentity extends DeviceIdentity {
  @override
  Future<String> getOrCreate() async => 'mobile-test-device';
}

class FakeSessionApi extends SessionApi {
  FakeSessionApi({
    this.onLoginStudent,
    this.onLoginFaculty,
    this.onPrivacyNotice,
    this.onChangePassword,
    this.onMe,
    this.onAcceptPrivacy,
  }) : super(Dio());

  final Future<LoginResult> Function(
    String studentId,
    String password,
    String? deviceId,
  )?
  onLoginStudent;
  final Future<LoginResult> Function(
    String email,
    String password,
    String? deviceId,
  )?
  onLoginFaculty;
  final Future<PrivacyNotice> Function()? onPrivacyNotice;
  final Future<User> Function(String? currentPassword, String newPassword)?
  onChangePassword;
  final Future<User> Function()? onMe;
  final Future<User> Function(String version)? onAcceptPrivacy;

  @override
  Future<LoginResult> loginStudent({
    required String studentId,
    required String password,
    String? deviceId,
  }) {
    final handler = onLoginStudent;
    if (handler == null) {
      throw UnimplementedError('loginStudent not configured');
    }
    return handler(studentId, password, deviceId);
  }

  @override
  Future<LoginResult> loginFaculty({
    required String email,
    required String password,
    String? deviceId,
  }) {
    final handler = onLoginFaculty;
    if (handler == null) {
      throw UnimplementedError('loginFaculty not configured');
    }
    return handler(email, password, deviceId);
  }

  @override
  Future<PrivacyNotice> getPrivacyNotice() {
    final handler = onPrivacyNotice;
    if (handler == null) {
      throw UnimplementedError('getPrivacyNotice not configured');
    }
    return handler();
  }

  @override
  Future<User> changePassword({
    String? currentPassword,
    required String newPassword,
  }) {
    final handler = onChangePassword;
    if (handler == null) {
      throw UnimplementedError('changePassword not configured');
    }
    return handler(currentPassword, newPassword);
  }

  @override
  Future<User> me({Duration? timeout}) {
    final handler = onMe;
    if (handler == null) {
      throw UnimplementedError('me not configured');
    }
    return handler();
  }

  @override
  Future<User> acceptPrivacyConsent(String version) {
    final handler = onAcceptPrivacy;
    if (handler == null) {
      throw UnimplementedError('acceptPrivacyConsent not configured');
    }
    return handler(version);
  }
}

class FakeMaintenanceController extends MaintenanceController {
  FakeMaintenanceController(this.initial);

  final MaintenanceState initial;

  @override
  MaintenanceState build() => initial;

  @override
  Future<bool> probe({bool quiet = false}) async => initial.enabled;

  @override
  Future<void> probeQuietly() async {}

  @override
  void startPolling() {}

  @override
  void stopPolling() {}
}

class FakeTrustedClock extends TrustedClockNotifier {
  FakeTrustedClock(this.clock);

  final TrustedClock clock;

  @override
  TrustedClock build() => clock;
}

class FakeSessionController extends SessionController {
  FakeSessionController(this.user);

  final User? user;

  @override
  SessionState build() {
    final current = user;
    if (current == null) {
      return const SessionState(status: SessionStatus.signedOut);
    }
    return SessionState(status: SessionStatus.signedIn, user: current);
  }
}

AppDatabase createTestDatabase() {
  return AppDatabase.forTesting(NativeDatabase.memory());
}

const User testStudent = User(
  id: 'student-1',
  fullName: 'Maria Santos',
  role: UserRole.student,
  studentId: '2024-00123-MN-0',
  program: 'BSIT',
  yearLevel: 3,
);

const User testFaculty = User(
  id: 'teacher-1',
  fullName: 'Prof. Juan Dela Cruz',
  role: UserRole.teacher,
  email: 'juan.delacruz@pup.edu.ph',
  department: 'CCIS',
);

const User testAdmin = User(
  id: 'admin-1',
  fullName: 'Campus Director',
  role: UserRole.superAdmin,
);
