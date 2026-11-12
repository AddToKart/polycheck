import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/polycheck_core.dart';
import 'widgets/faculty_shell.dart';

/// Create a parent subject (name / code / description).
class SubjectCreateScreen extends ConsumerStatefulWidget {
  const SubjectCreateScreen({super.key});

  @override
  ConsumerState<SubjectCreateScreen> createState() =>
      _SubjectCreateScreenState();
}

class _SubjectCreateScreenState extends ConsumerState<SubjectCreateScreen> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _code = TextEditingController();
  final TextEditingController _description = TextEditingController();
  bool _submitting = false;
  String? _nameError;
  String? _codeError;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final name = _name.text.trim();
    final code = _code.text.trim();
    setState(() {
      _nameError = name.isEmpty ? 'Enter the subject name.' : null;
      _codeError = code.isEmpty ? 'Enter the subject code.' : null;
      _error = null;
    });
    if (_nameError != null || _codeError != null) return;
    setState(() => _submitting = true);
    try {
      final subject = await ref
          .read(subjectsApiProvider)
          .createSubject(
            CreateSubjectInput(
              name: name,
              code: code,
              description: _description.text.trim().isEmpty
                  ? null
                  : _description.text.trim(),
            ),
          );
      if (!mounted) return;
      CampusToast.showIn(
        context,
        '${subject.name} created. Add a section next.',
        tone: CampusToastTone.success,
      );
      context.pushReplacement('/faculty/subjects/${subject.id}');
    } on ApiRequestError catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Unable to create the subject: $error');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return FacultyScaffold(
      title: 'New subject',
      subtitle: 'Parent course — sections are added afterwards',
      showDefaultActions: false,
      body: FacultyPageBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              CampusCard(
                borderColor: tokens.gold,
                child: Text(
                  _error!,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.onSurface),
                ),
              ),
              const SizedBox(height: 12),
            ],
            CampusTextField(
              controller: _name,
              label: 'Subject name',
              hint: 'Software Engineering',
              errorText: _nameError,
              textCapitalization: TextCapitalization.words,
              onChanged: (_) {
                if (_nameError != null) setState(() => _nameError = null);
              },
            ),
            const SizedBox(height: 14),
            CampusTextField(
              controller: _code,
              label: 'Subject code',
              hint: 'COMP 20043',
              errorText: _codeError,
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) {
                if (_codeError != null) setState(() => _codeError = null);
              },
            ),
            const SizedBox(height: 14),
            CampusTextField(
              controller: _description,
              label: 'Description (optional)',
              hint: 'One or two lines for the section roster.',
              maxLines: 3,
              minLines: 2,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 20),
            CampusButton(
              label: 'Create subject',
              icon: Icons.add,
              loading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
            const SizedBox(height: 10),
            Text(
              'After creating the subject, add a section with its schedule, '
              'room, course and semester.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: tokens.muted),
            ),
          ],
        ),
      ),
    );
  }
}
