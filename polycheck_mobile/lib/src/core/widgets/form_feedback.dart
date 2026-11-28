import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/brand_theme.dart';
import 'campus_text_field.dart';

/// What stopped a form, shown directly above its submit button so the reason
/// is on screen when the button is pressed. Brings itself into view when it
/// appears or changes.
class FormProblems extends StatefulWidget {
  const FormProblems({
    super.key,
    required this.problems,
    this.title = 'Fix this first',
  });

  final List<String> problems;
  final String title;

  @override
  State<FormProblems> createState() => _FormProblemsState();
}

class _FormProblemsState extends State<FormProblems> {
  @override
  void initState() {
    super.initState();
    _reveal();
  }

  @override
  void didUpdateWidget(FormProblems oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.problems.join('\n') != oldWidget.problems.join('\n')) _reveal();
  }

  void _reveal() {
    if (widget.problems.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || Scrollable.maybeOf(context) == null) return;
      Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 250),
        alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.problems.isEmpty) return const SizedBox.shrink();
    final tokens = BrandTheme.of(context);
    final error = Theme.of(context).colorScheme.error;
    final text = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: tokens.onSurface, height: 1.4);
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: error.withValues(alpha: 0.08),
          border: Border(left: BorderSide(color: error, width: 4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.error_outline, size: 16, color: error),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    widget.title,
                    style: text?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            for (final problem in widget.problems) ...[
              const SizedBox(height: 4),
              Text(problem, style: text),
            ],
          ],
        ),
      ),
    );
  }
}

/// Only digits and a colon, at most five characters: the shape of `HH:mm`.
final List<TextInputFormatter> timeInputFormatters = <TextInputFormatter>[
  FilteringTextInputFormatter.allow(RegExp(r'[0-9:]')),
  LengthLimitingTextInputFormatter(5),
];

/// Whole numbers up to [digits] long, so `16564` cannot be typed in minutes.
List<TextInputFormatter> wholeNumberFormatters(int digits) =>
    <TextInputFormatter>[
      FilteringTextInputFormatter.digitsOnly,
      LengthLimitingTextInputFormatter(digits),
    ];

/// What is wrong with a whole-number field, or null.
String? rangeIssue(String text, int min, int max) {
  final value = int.tryParse(text.trim());
  if (value == null || value < min || value > max) {
    return 'Enter $min to $max.';
  }
  return null;
}

/// An `HH:mm` field that can be typed or picked from a clock.
class CampusTimeField extends StatelessWidget {
  const CampusTimeField({
    super.key,
    required this.controller,
    required this.label,
    this.errorText,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  Future<void> _pick(BuildContext context) async {
    final parts = controller.text.split(':');
    final hour = int.tryParse(parts.first) ?? 9;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: hour.clamp(0, 23),
        minute: minute.clamp(0, 59),
      ),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: false),
        child: child!,
      ),
    );
    if (picked == null) return;
    final value =
        '${picked.hour.toString().padLeft(2, '0')}:'
        '${picked.minute.toString().padLeft(2, '0')}';
    controller.text = value;
    onChanged?.call(value);
  }

  @override
  Widget build(BuildContext context) {
    return CampusTextField(
      controller: controller,
      label: label,
      hint: 'HH:mm',
      errorText: errorText,
      keyboardType: TextInputType.datetime,
      inputFormatters: timeInputFormatters,
      onChanged: onChanged,
      suffix: IconButton(
        tooltip: 'Pick $label',
        onPressed: () => _pick(context),
        icon: const Icon(Icons.schedule, size: 18),
      ),
    );
  }
}
