import 'dart:convert';
import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import '../../../core/utils/image_compression.dart';
import '../../../core/utils/proof_window.dart';

class StudentImageEvidence {
  const StudentImageEvidence({required this.bytes, required this.dataUrl});

  final Uint8List bytes;
  final String dataUrl;
}

class StudentImageException implements Exception {
  const StudentImageException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Picks an image, compresses it, and returns a 5 MB-safe data URL.
///
/// Returns null when the user cancels the picker.
Future<StudentImageEvidence?> pickStudentImage({
  required ImageSource source,
}) async {
  final picked = await ImagePicker().pickImage(
    source: source,
    imageQuality: 85,
  );
  if (picked == null) return null;

  Uint8List bytes;
  String mime = picked.mimeType ?? 'image/jpeg';
  final raw = await picked.readAsBytes();
  try {
    bytes = await compressImageBytes(
      raw,
      quality: 60,
      minWidth: 1280,
      minHeight: 720,
    );
    mime = 'image/jpeg';
  } on Object {
    bytes = raw;
  }
  if (bytes.lengthInBytes > 5 * 1000 * 1000) {
    throw const StudentImageException(
      'Evidence photos must be 5 MB or smaller.',
    );
  }
  return StudentImageEvidence(
    bytes: bytes,
    dataUrl: 'data:$mime;base64,${base64Encode(bytes)}',
  );
}

/// Largest result compression aims for before trying harder.
const int _proofTargetBytes = 450000;

/// Compresses one class photo. The original is never uploaded: if it cannot be
/// compressed it is refused, so hidden camera data never leaves the phone.
Future<StudentImageEvidence> prepareProofPhoto(Uint8List raw) async {
  Uint8List bytes;
  try {
    bytes = await compressImageBytes(
      raw,
      quality: 65,
      minWidth: 1280,
      minHeight: 720,
    );
    if (bytes.lengthInBytes > _proofTargetBytes) {
      bytes = await compressImageBytes(
        raw,
        quality: 50,
        minWidth: 960,
        minHeight: 540,
      );
    }
  } on Object {
    throw const StudentImageException(
      'This photo could not be prepared. Use a JPG or PNG photo.',
    );
  }
  if (bytes.lengthInBytes > proofPhotoMaxBytes) {
    throw const StudentImageException(
      'The photo could not be made small enough. Try another one.',
    );
  }
  return StudentImageEvidence(
    bytes: bytes,
    dataUrl: 'data:image/jpeg;base64,${base64Encode(bytes)}',
  );
}

/// Takes one photo, or picks up to [limit] from the gallery. Returns an empty
/// list when the person cancels.
Future<List<StudentImageEvidence>> pickProofPhotos(
  ImageSource source,
  int limit,
) async {
  final picker = ImagePicker();
  final List<XFile> files;
  if (source == ImageSource.gallery && limit > 1) {
    files = await picker.pickMultiImage(
      limit: limit,
      maxWidth: 2400,
      maxHeight: 2400,
    );
  } else {
    final one = await picker.pickImage(
      source: source,
      maxWidth: 2400,
      maxHeight: 2400,
    );
    files = <XFile>[?one];
  }
  return <StudentImageEvidence>[
    for (final file in files.take(limit))
      await prepareProofPhoto(await file.readAsBytes()),
  ];
}
