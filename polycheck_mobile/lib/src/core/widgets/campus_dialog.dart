import 'package:flutter/material.dart';

import '../theme/pup_theme.dart';

const BorderRadius _zero = BorderRadius.zero;

/// Builds one dialog action with the **dialog's own** [BuildContext].
///
/// Contract: callbacks MUST use [dialogContext] for `Navigator.of(...).pop`.
/// A dialog is presented through the root navigator, while a caller inside a
/// `ShellRoute` (student/faculty shells) lives on a nested navigator. Popping
/// with the caller's context by mistake therefore removes the *page* instead
/// of the dialog - the screen goes blank and the awaited dialog future never
/// resolves (the reported sign-out crash: `logout()` never ran and the server
/// session survived).
typedef CampusDialogActionBuilder = Widget Function(BuildContext dialogContext);

/// Zero-radius dialog shell with a title, optional description, content, and
/// trailing action row.
class CampusDialog extends StatelessWidget {
  const CampusDialog({
    super.key,
    required this.title,
    this.description,
    this.child,
    this.actions = const <Widget>[],
    this.scrollable = true,
  });

  final String title;
  final String? description;
  final Widget? child;
  final List<Widget> actions;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final textTheme = Theme.of(context).textTheme;
    final body = <Widget>[
      if (description != null && description!.isNotEmpty) ...[
        Text(
          description!,
          style: textTheme.bodySmall?.copyWith(color: tokens.muted),
        ),
        const SizedBox(height: 14),
      ],
      ?child,
    ];

    return AlertDialog(
      shape: const RoundedRectangleBorder(borderRadius: _zero),
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      backgroundColor: tokens.surface,
      title: Text(title),
      content: body.isEmpty
          ? null
          : SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: body,
              ),
            ),
      actions: actions.isEmpty
          ? null
          : [
              for (final action in actions)
                Padding(
                  padding: const EdgeInsets.only(left: 8, bottom: 4),
                  child: action,
                ),
            ],
    );
  }
}

/// Presents a [CampusDialog]. Returns when the dialog is dismissed.
///
/// Preferred: pass [actionBuilders] so every action closes over the dialog's
/// own context (see [CampusDialogActionBuilder]). [actions] remains for
/// pre-built widgets outside this fix wave; a pre-built action that pops with
/// a caller context removes that caller's route when it is not on the root
/// navigator (nested shells).
Future<T?> showCampusDialog<T>(
  BuildContext context, {
  required String title,
  String? description,
  Widget? child,
  List<CampusDialogActionBuilder> actionBuilders =
      const <CampusDialogActionBuilder>[],
  List<Widget> actions = const <Widget>[],
  bool barrierDismissible = true,
}) {
  return showDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (dialogContext) => CampusDialog(
      title: title,
      description: description,
      actions: <Widget>[
        for (final build in actionBuilders) build(dialogContext),
        ...actions,
      ],
      child: child,
    ),
  );
}
