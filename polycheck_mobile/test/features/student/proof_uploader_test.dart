import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/proofs_api.dart';
import 'package:polycheck_mobile/src/core/models/section_role.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/utils/proof_window.dart';
import 'package:polycheck_mobile/src/features/student/data/student_images.dart';
import 'package:polycheck_mobile/src/features/student/presentation/officer/proof_uploader.dart';

// A 1x1 PNG, so previews really decode.
final _pixel = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhWMjWwAAAABJRU5ErkJggg==',
);

class _FakeProofsApi extends ProofsApi {
  _FakeProofsApi({this.failFrom}) : super(Dio());

  /// The upload number (1-based) from which the server starts refusing.
  final int? failFrom;
  final List<String> uploaded = <String>[];

  @override
  Future<ProofOfClass> uploadProofOfClass({
    required String sectionId,
    required String sessionId,
    required String photoData,
    String? description,
  }) async {
    if (failFrom != null && uploaded.length + 1 >= failFrom!) {
      throw const ApiRequestError(
        message: 'Photos can only be uploaded while the class is ongoing',
        status: 400,
      );
    }
    uploaded.add('$sessionId:$photoData');
    return ProofOfClass(
      id: 'p${uploaded.length}',
      sectionId: sectionId,
      sessionId: sessionId,
      uploadedBy: 'student-1',
    );
  }
}

void main() {
  group('isProofWindowOpen', () {
    bool openAt(String time, {bool active = false}) => isProofWindowOpen(
      date: '2026-11-27',
      startTime: '09:00',
      endTime: '10:30',
      isActive: active,
      now: DateTime.parse('2026-11-27T$time:00+08:00'),
    );

    test('covers the whole class and a short grace, not only the QR', () {
      expect(openAt('09:00'), isTrue);
      expect(openAt('10:45'), isTrue);
      expect(openAt('08:59'), isFalse);
      expect(openAt('10:46'), isFalse);
      expect(openAt('15:00', active: true), isTrue);
    });
  });

  Future<(_FakeProofsApi, List<int>)> pump(
    WidgetTester tester, {
    int alreadyUploaded = 0,
    int? failFrom,
  }) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final api = _FakeProofsApi(failFrom: failFrom);
    final limits = <int>[];
    var next = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          proofsApiProvider.overrideWithValue(api),
          proofPhotoPickerProvider.overrideWithValue((
            ImageSource source,
            int limit,
          ) async {
            limits.add(limit);
            // Offer more than asked, as a gallery that ignores the limit would.
            return List<StudentImageEvidence>.generate(
              limit + 2,
              (_) => StudentImageEvidence(
                bytes: _pixel,
                dataUrl: 'data:image/jpeg;base64,${++next}',
              ),
            );
          }),
        ],
        child: MaterialApp(
          theme: BrandTheme.light,
          home: Scaffold(
            body: SingleChildScrollView(
              child: ProofUploader(
                sectionId: 'sec-1',
                sessionId: 'sess-1',
                alreadyUploaded: alreadyUploaded,
                onUploaded: () {},
              ),
            ),
          ),
        ),
      ),
    );
    return (api, limits);
  }

  testWidgets('takes no more photos than the session still allows', (
    tester,
  ) async {
    final (api, limits) = await pump(tester, alreadyUploaded: 2);

    await tester.tap(find.text('Gallery'));
    await tester.pump();

    expect(limits, <int>[2]);
    await tester.tap(find.text('Upload 2 photos'));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(seconds: 6));
    expect(api.uploaded, <String>[
      'sess-1:data:image/jpeg;base64,1',
      'sess-1:data:image/jpeg;base64,2',
    ]);
  });

  testWidgets('keeps the photos that did not upload and says why', (
    tester,
  ) async {
    final (api, _) = await pump(tester, alreadyUploaded: 1, failFrom: 2);
    await tester.tap(find.text('Gallery'));
    await tester.pump();
    await tester.tap(find.text('Upload 3 photos'));
    await tester.pumpAndSettle();

    expect(api.uploaded, hasLength(1));
    expect(find.textContaining('1 uploaded. Photos can only'), findsOneWidget);
    expect(find.text('Upload 2 photos'), findsOneWidget);
    await tester.pump(const Duration(seconds: 6));
  });

  testWidgets('offers no camera once all four are used', (tester) async {
    await pump(tester, alreadyUploaded: 4);

    expect(
      find.text('You have added all 4 photos for this session.'),
      findsOneWidget,
    );
    expect(find.text('Take photo'), findsNothing);
  });
}
