import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../utils/legal_links.dart';

/// "Privacy Policy · Terms & Conditions", each opening in the browser. Wraps on
/// narrow phones.
class LegalLinksRow extends ConsumerWidget {
  const LegalLinksRow({super.key, this.alignment = WrapAlignment.center});

  final WrapAlignment alignment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Wrap(
      alignment: alignment,
      spacing: 4,
      children: [
        TextButton(
          onPressed: () => openLegalLink(
            context,
            ref,
            title: 'Privacy Policy',
            url: LegalLinks.privacy,
          ),
          child: const Text('Privacy Policy'),
        ),
        TextButton(
          onPressed: () => openLegalLink(
            context,
            ref,
            title: 'Terms & Conditions',
            url: LegalLinks.terms,
          ),
          child: const Text('Terms & Conditions'),
        ),
      ],
    );
  }
}
