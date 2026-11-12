/// Application identity surfaced on the portal footer.
///
/// Keep in sync with `pubspec.yaml` (`version:`). Overridable at build time so
/// release pipelines can stamp the CI build number without editing Dart.
const String appVersion = String.fromEnvironment(
  'PUP_APP_VERSION',
  defaultValue: '1.0.0',
);

String get appVersionLabel => 'Version $appVersion';
