import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_base.dart';
import '../../../core/models/user.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/dio_client.dart';

/// Feature-local PATCH helper.
///
/// The shared `UpdateUserInput.toJson()` serializes every nullable field;
/// this console must send only the fields the operator actually changed (and
/// an explicit `null` only when clearing a capability override).
class AdminUsersApi extends ApiBase {
  AdminUsersApi(super.dio);

  Future<User> patchUser(String id, Map<String, dynamic> body) async {
    final data = await patchJson('/users/$id', body: body, dropNulls: false);
    return User.fromJson(asMap(data));
  }
}

final adminUsersApiProvider = Provider<AdminUsersApi>(
  (ref) => AdminUsersApi(ref.watch(dioProvider)),
);

/// Typed error copy for the users console, including the designation guard.
String adminUsersErrorMessage(Object error) {
  if (error is ApiRequestError) {
    if (error.code == 'designations_admin_only') {
      return 'Only super admins can change administrative designations.';
    }
    return error.message;
  }
  return '$error';
}
