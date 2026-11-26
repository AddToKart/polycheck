import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// The Privacy Policy and Terms live on the landing site, so there is exactly
/// one copy of each. The accepted notice's URL comes from the API; these are
/// the public links the app shows everywhere else.
abstract final class LegalLinks {
  static const String privacy = String.fromEnvironment(
    'PRIVACY_URL',
    defaultValue: 'https://polycheck.live/privacy',
  );
  static const String terms = String.fromEnvironment(
    'TERMS_URL',
    defaultValue: 'https://polycheck.live/terms',
  );
}

/// Opens a web address outside the app; resolves false when nothing could.
typedef ExternalLinkOpener = Future<bool> Function(Uri uri);

final externalLinkOpenerProvider = Provider<ExternalLinkOpener>(
  (ref) =>
      (uri) => launchUrl(uri, mode: LaunchMode.externalApplication),
);

/// Opens [url] in the phone's browser. If that is not possible (no browser, a
/// blocked intent, a non-web address) the person gets the address to copy, so
/// the document is never out of reach.
Future<void> openLegalLink(
  BuildContext context,
  WidgetRef ref, {
  required String title,
  required String url,
}) async {
  final uri = Uri.tryParse(url);
  if (uri != null && (uri.isScheme('https') || uri.isScheme('http'))) {
    try {
      if (await ref.read(externalLinkOpenerProvider)(uri)) return;
    } on Object {
      // Fall through to the copy dialog.
    }
  }
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: SelectableText(url),
      actions: [
        TextButton(
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: url));
            if (dialogContext.mounted) Navigator.of(dialogContext).pop();
          },
          child: const Text('Copy link'),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: const Text('Close'),
        ),
      ],
    ),
  );
}
