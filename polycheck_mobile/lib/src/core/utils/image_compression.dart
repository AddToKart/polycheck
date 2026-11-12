import 'dart:isolate';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// Thrown when an attached image cannot be decoded for compression.
class ImageCompressionException implements Exception {
  const ImageCompressionException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Downsizes and re-encodes a JPEG/PNG/WebP image to JPEG, mirroring the
/// semantics previously provided by `flutter_image_compress`
/// (`minWidth`/`minHeight` are lower bounds; images are only downscaled,
/// never upscaled). Runs in a background isolate so the UI stays responsive.
///
/// Pure Dart on purpose: the previous native plugin applied the Kotlin Gradle
/// Plugin, which Flutter will reject once built-in Kotlin is mandatory.
Future<Uint8List> compressImageBytes(
  Uint8List input, {
  int quality = 60,
  int? minWidth,
  int? minHeight,
}) {
  return Isolate.run(
    () => _compressSync(
      input,
      quality: quality,
      minWidth: minWidth,
      minHeight: minHeight,
    ),
  );
}

Uint8List _compressSync(
  Uint8List input, {
  required int quality,
  int? minWidth,
  int? minHeight,
}) {
  final decoded = img.decodeImage(input);
  if (decoded == null) {
    throw const ImageCompressionException(
      'The selected image could not be decoded.',
    );
  }

  var frame = decoded;
  final width = frame.width;
  final height = frame.height;
  final minW = minWidth ?? 0;
  final minH = minHeight ?? 0;
  if (minW > 0 || minH > 0) {
    final widthScale = minW > 0 ? minW / width : 0.0;
    final heightScale = minH > 0 ? minH / height : 0.0;
    final scale = widthScale > heightScale ? widthScale : heightScale;
    if (scale > 0 && scale < 1) {
      frame = img.copyResize(
        frame,
        width: (width * scale).round().clamp(1, width),
        height: (height * scale).round().clamp(1, height),
        interpolation: img.Interpolation.average,
      );
    }
  }

  final clampedQuality = quality.clamp(1, 100);
  final encoded = Uint8List.fromList(
    img.encodeJpg(frame, quality: clampedQuality),
  );
  if (encoded.isEmpty) {
    throw const ImageCompressionException(
      'The selected image could not be compressed.',
    );
  }
  return encoded;
}
