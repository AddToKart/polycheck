import 'dart:convert';
import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import '../../../core/utils/image_compression.dart';

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
