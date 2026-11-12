import '../../../core/models/user.dart';
import '../../../core/router/routes/app_routes.dart';
import '../../../core/utils/designations.dart';
import 'admin_settings.dart';

/// One navigable administrator surface.
///
/// Visibility follows `shared/src/utils/designations.ts` (K13):
/// super admins implicitly hold every suite, IT coordinators get server
/// status / issue triage / settings-System, registrars get the
/// department-pinned account console, and department heads get no admin
/// surface at all (their oversight screens live inside the faculty section).
enum AdminSection {
  dashboard('/admin/dashboard', 'Dashboard'),
  users('/admin/users', 'User management'),
  settings('/admin/settings', 'Institution settings'),
  auditLogs('/admin/audit-logs', 'Audit log'),
  serverStatus('/admin/server-status', 'Server status'),
  systemReports('/admin/system-reports', 'System reports'),
  search('/admin/search', 'Global search');

  const AdminSection(this.route, this.label);

  final String route;
  final String label;
}

/// Resolved capability set for one account.
class AdminAccess {
  const AdminAccess({
    this.sections = const <AdminSection>{},
    this.settingsTabs = const <SettingsTab>{},
    this.canManageDesignations = false,
    this.canEditInstitutionSettings = false,
    this.canWriteMaintenance = false,
    this.isDepartmentPinned = false,
    this.departmentPin,
  });

  final Set<AdminSection> sections;
  final Set<SettingsTab> settingsTabs;

  /// Only super admins may write the three designation flags.
  final bool canManageDesignations;

  /// Institution-scope super admin only (backend `isInstitutionSuperAdmin`).
  final bool canEditInstitutionSettings;

  /// Super admin or an IT-coordinator teacher (maintenance trio keys only).
  final bool canWriteMaintenance;

  /// Registrar (and department-scope super admin) account administration is
  /// pinned to the actor's own department server-side.
  final bool isDepartmentPinned;
  final String? departmentPin;

  bool get isEmpty => sections.isEmpty;

  bool canOpen(AdminSection section) => sections.contains(section);

  bool canOpenSettingsTab(SettingsTab tab) => settingsTabs.contains(tab);

  bool canWriteSettingsTab(SettingsTab tab) {
    if (tab == SettingsTab.privacy) return false;
    if (canEditInstitutionSettings) return true;
    return tab == SettingsTab.system && canWriteMaintenance;
  }

  /// True when the console must render the read-only banner.
  bool get settingsReadOnly =>
      !canEditInstitutionSettings && !canWriteMaintenance;
}

const AdminAccess noAdminAccess = AdminAccess();

String? _trimmedDepartment(PolyUser? user) {
  final department = user?.department?.trim();
  return department == null || department.isEmpty ? null : department;
}

String? _scopeOf(PolyUser? user) => user is User ? user.scope : null;

bool _isInstitutionSuperAdmin(PolyUser? user) =>
    user != null &&
    user.role == UserRole.superAdmin &&
    _scopeOf(user) == 'institution';

/// Builds the complete admin capability matrix for [user].
AdminAccess adminAccessFor(PolyUser? user) {
  if (user == null) return noAdminAccess;

  if (user.role == UserRole.superAdmin) {
    final institution = _isInstitutionSuperAdmin(user);
    final departmentPin = institution ? null : _trimmedDepartment(user);
    return AdminAccess(
      sections: AdminSection.values.toSet(),
      settingsTabs: SettingsTab.values.toSet(),
      canManageDesignations: true,
      canEditInstitutionSettings: institution,
      canWriteMaintenance: institution,
      isDepartmentPinned: !institution && departmentPin != null,
      departmentPin: departmentPin,
    );
  }

  if (user.role != UserRole.teacher) return noAdminAccess;

  final sections = <AdminSection>{};
  final tabs = <SettingsTab>{};
  final itCoordinator = canAccessItOperations(user);
  final registrar = canAccessUserAdmin(user);

  if (itCoordinator) {
    sections.addAll(<AdminSection>{
      AdminSection.serverStatus,
      AdminSection.systemReports,
      AdminSection.settings,
    });
    tabs.addAll(<SettingsTab>{SettingsTab.system, SettingsTab.privacy});
  }
  if (registrar) {
    sections.add(AdminSection.users);
  }

  return AdminAccess(
    sections: sections,
    settingsTabs: tabs,
    canWriteMaintenance: itCoordinator,
    isDepartmentPinned: registrar && _trimmedDepartment(user) != null,
    departmentPin: registrar ? _trimmedDepartment(user) : null,
  );
}

bool canAccessAdminSection(PolyUser? user, AdminSection section) =>
    adminAccessFor(user).canOpen(section);

/// Landing surface after login/deep-link fallback.
///
/// Super admins land on the dashboard, IT coordinators on server status, and
/// registrars on the account console. Accounts with no admin suite keep the
/// normal role home.
String adminLandingRoute(PolyUser? user) {
  final access = adminAccessFor(user);
  if (access.canOpen(AdminSection.dashboard)) {
    return AdminSection.dashboard.route;
  }
  for (final section in <AdminSection>[
    AdminSection.serverStatus,
    AdminSection.systemReports,
    AdminSection.settings,
    AdminSection.users,
  ]) {
    if (access.canOpen(section)) return section.route;
  }
  if (user?.role == UserRole.teacher) return AppRoutes.facultyHome;
  if (user?.role == UserRole.student) return AppRoutes.studentHome;
  return AppRoutes.portal;
}

/// Settings tabs visible to [user] in declaration order.
List<SettingsTab> adminSettingsTabsFor(PolyUser? user) {
  final access = adminAccessFor(user);
  return <SettingsTab>[
    for (final tab in SettingsTab.values)
      if (access.canOpenSettingsTab(tab)) tab,
  ];
}

/// Sections reachable through the console menu, in declaration order.
List<AdminSection> adminSectionsFor(PolyUser? user) {
  final access = adminAccessFor(user);
  return <AdminSection>[
    for (final section in AdminSection.values)
      if (access.canOpen(section)) section,
  ];
}
