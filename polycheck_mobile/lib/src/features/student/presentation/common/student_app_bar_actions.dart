import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../student_paths.dart';

/// Notification, assistant, and profile entry points shared by the student
/// tab screens. The surfaces are owned by the surface wave; this only routes.
class StudentAppBarActions {
  const StudentAppBarActions._();

  static List<Widget> build(BuildContext context) {
    return <Widget>[
      IconButton(
        tooltip: 'Notifications',
        onPressed: () => context.push(StudentPaths.notifications),
        icon: const Icon(Icons.notifications_none_outlined),
      ),
      IconButton(
        tooltip: 'Assistant',
        onPressed: () => context.push(StudentPaths.assistant),
        icon: const Icon(Icons.auto_awesome_outlined),
      ),
      IconButton(
        tooltip: 'Profile',
        onPressed: () => context.push(StudentPaths.profile),
        icon: const Icon(Icons.person_outline),
      ),
    ];
  }
}
