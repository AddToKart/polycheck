import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import '../models/section_role.dart';
import '../models/user.dart';
import 'session_provider.dart';

/// Student officer flags derived from `GET /section-roles/student/:id`.
///
/// A student may hold either role in more than one section; the router treats
/// president as the stronger label when both exist. The endpoint is advisory
/// for navigation only - every officer action is re-authorized server-side.
@immutable
class StudentOfficerFlags {
  const StudentOfficerFlags({this.isPresident = false, this.isQac = false});

  static const StudentOfficerFlags none = StudentOfficerFlags();

  final bool isPresident;
  final bool isQac;

  bool get isOfficer => isPresident || isQac;

  static StudentOfficerFlags fromRoles(List<SectionRole> roles) {
    var president = false;
    var qac = false;
    for (final role in roles) {
      if (role.role == SectionRoleType.president) president = true;
      if (role.role == SectionRoleType.qac) qac = true;
    }
    return StudentOfficerFlags(isPresident: president, isQac: qac);
  }
}

/// Loads officer flags for the signed-in student. Failures degrade to a plain
/// student rather than blocking navigation.
final studentOfficerProvider = FutureProvider<StudentOfficerFlags>((ref) async {
  final identity = ref.watch(
    sessionProvider.select((state) => (state.user?.id, state.user?.role)),
  );
  final (userId, role) = identity;
  if (userId == null || role != UserRole.student) {
    return StudentOfficerFlags.none;
  }
  try {
    final roles = await ref.read(sectionsApiProvider).getStudentRoles(userId);
    return StudentOfficerFlags.fromRoles(roles);
  } catch (_) {
    return StudentOfficerFlags.none;
  }
});
