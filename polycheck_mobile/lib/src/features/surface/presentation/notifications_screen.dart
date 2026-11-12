import 'package:flutter/material.dart';

import '../../../core/widgets/campus_header.dart';
import 'notifications_panel.dart';

/// Standalone notifications page (`/notifications` alias).
///
/// The canonical in-app destination is `/profile?tab=notifications` because
/// the guard-owned shared path set currently admits only `/profile`; this
/// screen exists so widening the shared path set (or a direct deep link)
/// immediately serves the full center.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CampusHeader(title: 'Notifications'),
      body: const SafeArea(top: false, child: NotificationsPanel()),
    );
  }
}
