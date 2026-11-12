import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:polycheck_mobile/src/core/utils/image_compression.dart';

img.Image _solid(int width, int height) {
  final image = img.Image(width: width, height: height);
  img.fill(image, color: img.ColorRgb8(123, 17, 19));
  return image;
}

void main() {
  test('downscales large images preserving aspect ratio as JPEG', () async {
    final source = Uint8List.fromList(img.encodePng(_solid(4000, 3000)));
    final compressed = await compressImageBytes(
      source,
      quality: 60,
      minWidth: 1280,
      minHeight: 720,
    );

    final decoded = img.decodeImage(compressed);
    expect(decoded, isNotNull);
    expect(decoded!.width, 1280);
    expect(decoded.height, 960);
    expect(compressed.length, lessThan(source.length));
    expect(compressed.take(2).toList(), [0xFF, 0xD8]);
  });

  test('does not upscale images smaller than the minimum bounds', () async {
    final source = Uint8List.fromList(img.encodePng(_solid(640, 480)));
    final compressed = await compressImageBytes(
      source,
      quality: 60,
      minWidth: 1280,
      minHeight: 720,
    );

    final decoded = img.decodeImage(compressed);
    expect(decoded, isNotNull);
    expect(decoded!.width, 640);
    expect(decoded.height, 480);
  });

  test('honors only the provided minimum dimension', () async {
    final source = Uint8List.fromList(img.encodePng(_solid(3000, 1500)));
    final compressed = await compressImageBytes(
      source,
      quality: 55,
      minWidth: 1080,
    );

    final decoded = img.decodeImage(compressed);
    expect(decoded, isNotNull);
    expect(decoded!.width, 1080);
    expect(decoded.height, 540);
  });

  test('throws a typed error for undecodable bytes', () async {
    await expectLater(
      compressImageBytes(Uint8List.fromList([1, 2, 3, 4])),
      throwsA(isA<ImageCompressionException>()),
    );
  });
}
