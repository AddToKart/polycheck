import 'package:polycheck_mobile/src/core/network/api_config.dart';

/// Compile-time configuration for the integration harness.
///
/// Everything here comes from `--dart-define`; nothing reads the environment at
/// runtime, so the values are baked when `flutter test integration_test/...`
/// compiles the app for the device.
abstract final class IntegrationEnv {
  /// API root the harness and the app both talk to.
  ///
  /// `10.0.2.2` is the Android emulator's alias for the host loopback, so the
  /// default targets a backend running on the developer machine. On a physical
  /// device or a CI runner with `adb reverse tcp:4000 tcp:4000`, override it:
  ///
  /// ```
  /// --dart-define=PUP_API_BASE_URL=http://localhost:4000/api
  /// ```
  static const String baseUrl = String.fromEnvironment(
    'PUP_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api',
  );

  /// Seeded super admin — the only account allowed to mint disposable students
  /// (`POST /users/students` needs `teacher`/`super_admin` + `user_admin`).
  static const String superAdminEmail = 'mcreyes@pup.edu.ph';

  /// Password of every seeded account in the local Docker stack.
  static const String seedPassword = 'PolycheckLocal1!';

  /// Password given to every disposable fixture account.
  ///
  /// Passed explicitly on creation so the server never generates a temporary
  /// password (`mustChangePassword`) that would stall the login flow behind the
  /// forced-rotation router guard.
  static const String fixturePassword = 'PyE2e!Passw0rd';

  /// Department every fixture account belongs to (scoping guard input).
  static const String department = 'CCIS';

  /// The geofence every fixture session is created with. The harness feeds the
  /// scan pipeline a fix at this exact point, so the geofence math runs for
  /// real instead of being bypassed.
  static const double campusLatitude = 14.5995;
  static const double campusLongitude = 120.9842;

  /// Radius of the fixture session geofence (the server accepts 10-500 m).
  static const int campusRadiusMeters = 150;

  /// Accuracy reported by the harness GNSS fake — inside the 50 m mobile cap.
  static const double campusAccuracyMeters = 10;

  /// Fails fast when the app client and the fixture client would talk to
  /// different backends.
  ///
  /// `ApiConfig.baseUrl` is what the app's Dio is built with; if the operator
  /// forgot the define it falls back to the staging URL while the harness uses
  /// `10.0.2.2`, which would "pass" by never touching the local backend.
  static void assertAppClientTargetsHarness() {
    if (ApiConfig.baseUrl != baseUrl) {
      throw StateError(
        'The app client is pointed at "${ApiConfig.baseUrl}" but the harness '
        'is pointed at "$baseUrl". Pass '
        '--dart-define=PUP_API_BASE_URL=$baseUrl so both agree.',
      );
    }
  }
}
