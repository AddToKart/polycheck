import 'package:flutter/material.dart';

import '../../../core/widgets/campus_header.dart';
import 'privacy_panel.dart';

/// Standalone privacy page (`/privacy` alias) for deep links and any shell
/// that wants the transparency center outside the profile tabs.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CampusHeader(title: 'Privacy (RA 10173)'),
      body: const SafeArea(top: false, child: PrivacyPanel()),
    );
  }
}
