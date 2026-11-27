import 'package:flutter/material.dart';

import '../theme/brand_theme.dart';
import '../utils/campus_courses.dart';

/// The catalog code for a stored program, or the stored text when it matches
/// none of the campus programs.
String programDropdownValue(String stored) {
  final course = normalizeCourse(stored);
  return course.matched ? course.code! : course.raw;
}

/// A student's program (the campus calls it the course): one of the campus
/// programs. The choice is written into [controller] as the program code. An
/// older record whose program matches none of them keeps its value as an extra
/// choice, so opening a form never changes it silently.
class ProgramDropdown extends StatelessWidget {
  const ProgramDropdown({
    super.key,
    required this.controller,
    this.enabled = true,
  });

  final TextEditingController controller;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final selected = programDropdownValue(controller.text);
    final offCatalog =
        selected.isNotEmpty &&
        !campusCourses.any((course) => course.code == selected);
    final options = <(String, String)>[
      for (final course in campusCourses)
        (course.code, '${course.code} - ${course.name}'),
      if (offCatalog) (selected, '$selected (not in the program list)'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Program',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: tokens.onSurface,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: selected.isEmpty ? null : selected,
          isExpanded: true,
          hint: const Text('Select a program'),
          items: [
            for (final (value, label) in options)
              DropdownMenuItem<String>(
                value: value,
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          // The closed field shows one line; the open list can wrap to two.
          selectedItemBuilder: (context) => [
            for (final (_, label) in options)
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
          onChanged: enabled
              ? (value) {
                  if (value != null) controller.text = value;
                }
              : null,
        ),
      ],
    );
  }
}
