/// Polycheck core barrel for the Flutter foundation.
///
/// Feature waves import this single library:
/// `import 'package:polycheck_mobile/src/core/polycheck_core.dart';`
library;

export 'api/api.dart';
export 'api/api_providers.dart';
export 'app_info.dart';
export 'database/app_database.dart';
export 'models/models.dart';
export 'network/api_config.dart';
export 'network/api_error.dart';
export 'network/api_events.dart';
export 'network/dio_client.dart';
export 'network/secure_token_store.dart';
export 'providers/device_now.dart';
export 'providers/maintenance_provider.dart';
export 'providers/offline_banner.dart';
export 'providers/session_provider.dart';
export 'providers/student_officer_provider.dart';
export 'providers/trusted_clock.dart';
export 'router/app_router.dart';
export 'router/router_decision.dart';
export 'router/router_notifier.dart';
export 'router/routes/app_routes.dart';
export 'rules/qr_fallback_policy.dart';
export 'sync/attendance_pin_vault.dart';
export 'sync/sync_engine.dart';
export 'sync/sync_lifecycle_binder.dart';
export 'theme/pup_theme.dart';
export 'theme/pup_tokens.dart';
export 'utils/calendar_utils.dart';
export 'utils/cooldown.dart';
export 'utils/designations.dart';
export 'utils/haversine.dart';
export 'utils/id_hologram.dart';
export 'utils/image_compression.dart';
export 'utils/maintenance_time.dart';
export 'utils/outage_simulator.dart';
export 'utils/password_policy.dart';
export 'utils/pin_hash.dart';
export 'utils/pup_courses.dart';
export 'utils/section_label.dart';
export 'utils/session_slots.dart';
export 'utils/token_crypto.dart';
export 'widgets/campus_badge.dart';
export 'widgets/campus_bottom_nav.dart';
export 'widgets/campus_bottom_sheet.dart';
export 'widgets/campus_button.dart';
export 'widgets/campus_card.dart';
export 'widgets/campus_dialog.dart';
export 'widgets/campus_empty_state.dart';
export 'widgets/campus_header.dart';
export 'widgets/campus_loading.dart';
export 'widgets/campus_month_cell.dart';
export 'widgets/campus_text_field.dart';
export 'widgets/campus_toast.dart';
export 'widgets/section_heading_label.dart';
export 'widgets/status_colors.dart';

// Feature shells that ride the core navigator (additive; feature waves keep
// importing this single barrel).
export '../features/admin/presentation/widgets/admin_shell.dart';
