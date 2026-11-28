/// Application identity surfaced on the portal footer.
///
/// The default must match `pubspec.yaml` (`version:`); `app_info_test.dart`
/// fails when it does not, so a build made without the override is still
/// labelled correctly.
const String appVersion = String.fromEnvironment(
  'APP_VERSION',
  defaultValue: '1.1.8',
);

String get appVersionLabel => 'Version $appVersion';
