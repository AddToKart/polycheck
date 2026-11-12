import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/dio_client.dart';
import 'ai_api.dart';
import 'attendance_api.dart';
import 'audit_api.dart';
import 'dashboard_api.dart';
import 'disputes_api.dart';
import 'docs_api.dart';
import 'notifications_api.dart';
import 'proofs_api.dart';
import 'reports_api.dart';
import 'search_api.dart';
import 'sections_api.dart';
import 'session_api.dart';
import 'sessions_api.dart';
import 'settings_api.dart';
import 'subjects_api.dart';
import 'sync_api.dart';
import 'users_api.dart';

final sessionApiProvider = Provider<SessionApi>(
  (ref) => SessionApi(ref.watch(dioProvider)),
);

final subjectsApiProvider = Provider<SubjectsApi>(
  (ref) => SubjectsApi(ref.watch(dioProvider)),
);

final sectionsApiProvider = Provider<SectionsApi>(
  (ref) => SectionsApi(ref.watch(dioProvider)),
);

final sessionsApiProvider = Provider<SessionsApi>(
  (ref) => SessionsApi(ref.watch(dioProvider)),
);

final attendanceApiProvider = Provider<AttendanceApi>(
  (ref) => AttendanceApi(ref.watch(dioProvider)),
);

final disputesApiProvider = Provider<DisputesApi>(
  (ref) => DisputesApi(ref.watch(dioProvider)),
);

final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApi(ref.watch(dioProvider)),
);

final aiApiProvider = Provider<AiApi>(
  (ref) =>
      AiApi(ref.watch(dioProvider), tokenStore: ref.watch(tokenStoreProvider)),
);

final usersApiProvider = Provider<UsersApi>(
  (ref) => UsersApi(ref.watch(dioProvider)),
);

final settingsApiProvider = Provider<SettingsApi>(
  (ref) => SettingsApi(ref.watch(dioProvider)),
);

final reportsApiProvider = Provider<ReportsApi>(
  (ref) => ReportsApi(ref.watch(dioProvider)),
);

final docsApiProvider = Provider<DocsApi>(
  (ref) => DocsApi(ref.watch(dioProvider)),
);

final syncApiProvider = Provider<SyncApi>(
  (ref) => SyncApi(ref.watch(dioProvider)),
);

final searchApiProvider = Provider<SearchApi>(
  (ref) => SearchApi(ref.watch(dioProvider)),
);

final auditApiProvider = Provider<AuditApi>(
  (ref) => AuditApi(ref.watch(dioProvider)),
);

final dashboardApiProvider = Provider<DashboardApi>(
  (ref) => DashboardApi(ref.watch(dioProvider)),
);

final proofsApiProvider = Provider<ProofsApi>(
  (ref) => ProofsApi(ref.watch(dioProvider)),
);
