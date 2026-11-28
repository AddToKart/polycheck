import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api/api_providers.dart';
import '../network/api_error.dart';
import '../theme/brand_theme.dart';
import '../utils/calendar_utils.dart';
import 'campus_bottom_sheet.dart';
import 'campus_button.dart';
import 'campus_toast.dart';
import 'form_feedback.dart';

/// Saves class photos, with their time stamps, as one PDF and opens the share
/// sheet, which can save it to the phone or send it on.
class PhotoReportButton extends ConsumerStatefulWidget {
  const PhotoReportButton({
    super.key,
    this.sessionId,
    this.sectionId,
    this.label = 'Save photos as PDF',
    this.chooseDates = false,
  });

  final String? sessionId;
  final String? sectionId;
  final String label;

  /// Asks for every photo or a date range first, for a whole semester.
  final bool chooseDates;

  @override
  ConsumerState<PhotoReportButton> createState() => _PhotoReportButtonState();
}

class _PhotoReportButtonState extends ConsumerState<PhotoReportButton> {
  bool _busy = false;
  String? _error;

  Future<void> _start() async {
    if (_busy) return;
    DateTimeRange? range;
    if (widget.chooseDates) {
      final choice = await showCampusBottomSheet<String>(
        context,
        title: 'Class photos as PDF',
        child: Builder(
          builder: (sheetContext) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Photos are grouped by class meeting, each with its date and '
                'time stamp.',
                style: Theme.of(sheetContext).textTheme.bodySmall?.copyWith(
                  color: BrandTheme.of(sheetContext).muted,
                ),
              ),
              const SizedBox(height: 12),
              CampusButton(
                label: 'All photos',
                onPressed: () => Navigator.of(sheetContext).pop('all'),
              ),
              const SizedBox(height: 8),
              CampusButton(
                label: 'Choose dates',
                variant: CampusButtonVariant.outline,
                onPressed: () => Navigator.of(sheetContext).pop('range'),
              ),
            ],
          ),
        ),
      );
      if (choice == null || !mounted) return;
      if (choice == 'range') {
        range = await showDateRangePicker(
          context: context,
          firstDate: DateTime(2024),
          lastDate: DateTime(2035),
          helpText: 'Class dates to include',
        );
        if (range == null || !mounted) return;
      }
    }
    await _download(range);
  }

  Future<void> _download(DateTimeRange? range) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final download = await ref
          .read(docsApiProvider)
          .proofPhotos(
            sessionId: widget.sessionId,
            sectionId: widget.sectionId,
            from: range == null ? null : formatDate(range.start),
            to: range == null ? null : formatDate(range.end),
          );
      final directory = await getTemporaryDirectory();
      final name = download.filename;
      final file = File('${directory.path}${Platform.pathSeparator}$name');
      await file.writeAsBytes(download.bytes, flush: true);
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'application/pdf', name: name)],
          subject: name,
        ),
      );
    } on ApiRequestError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) {
        CampusToast.showIn(
          context,
          'The PDF could not be saved: $error',
          tone: CampusToastTone.error,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampusButton(
          label: widget.label,
          icon: Icons.picture_as_pdf_outlined,
          variant: CampusButtonVariant.outline,
          loading: _busy,
          onPressed: _busy ? null : _start,
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: FormProblems(title: 'No PDF made', problems: [_error!]),
          ),
      ],
    );
  }
}
