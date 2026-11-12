import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' show Rect;

import 'package:dio/dio.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/network/api_error.dart';

/// Authenticated byte download + platform share sheet used by assistant
/// attachments and the DPO summary.
class SurfaceDownloads {
  const SurfaceDownloads._();

  static Future<Uint8List> download(Dio dio, String path) async {
    try {
      final response = await dio.get<List<int>>(
        path,
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(response.data ?? const <int>[]);
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  /// Writes the bytes to a temporary file (the IO `XFile.fromData` ignores a
  /// display name) and opens the platform share sheet.
  static Future<void> shareBytes({
    required Uint8List bytes,
    required String filename,
    String? mimeType,
    String? title,
    Rect? sharePositionOrigin,
  }) async {
    final safeName = _safeName(filename);
    final directory = await getTemporaryDirectory();
    final folder = Directory(
      p.join(
        directory.path,
        'polycheck-shares',
        '${DateTime.now().microsecondsSinceEpoch}',
      ),
    );
    await folder.create(recursive: true);
    final file = File(p.join(folder.path, safeName));
    await file.writeAsBytes(bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path, mimeType: mimeType)],
        title: title,
        sharePositionOrigin: sharePositionOrigin,
      ),
    );
  }

  static String _safeName(String value) {
    final basename = p.basename(value.trim());
    final cleaned = basename.replaceAll(RegExp(r'[^\w.\- ()]'), '_');
    return cleaned.isEmpty ? 'polycheck-export.bin' : cleaned;
  }
}
