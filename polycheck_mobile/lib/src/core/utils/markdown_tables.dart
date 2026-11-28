/// Wide tables are unreadable in a phone-sized chat, so any the assistant sends
/// are shown as a list, one entry per row. Mirrors
/// `shared/src/utils/markdown-tables.ts`.
library;

final RegExp _fence = RegExp(r'^\s*(```|~~~)');
final RegExp _separator = RegExp(r'(?<!\\)\|');
final RegExp _closingPipe = RegExp(r'(?<!\\)\|$');
final RegExp _dividerCell = RegExp(r'^:?-+:?$');
final RegExp _boldMarker = RegExp(r'\*\*|__');
const Set<String> _empty = <String>{'', '-', '–', '—'};

String flattenMarkdownTables(String markdown) {
  final lines = markdown.split('\n');
  final out = <String>[];
  var fenced = false;
  for (var index = 0; index < lines.length; index += 1) {
    final line = lines[index];
    if (_fence.hasMatch(line)) fenced = !fenced;
    final next = index + 1 < lines.length ? lines[index + 1] : null;
    if (fenced || !_isRow(line) || !_isDivider(next)) {
      out.add(line);
      continue;
    }
    final headers = _cells(line);
    final rows = <List<String>>[];
    var cursor = index + 2;
    while (cursor < lines.length && _isRow(lines[cursor])) {
      rows.add(_cells(lines[cursor]));
      cursor += 1;
    }
    if (out.isNotEmpty && out.last.trim().isNotEmpty) out.add('');
    if (rows.isEmpty) {
      out.add(headers.where((header) => header.isNotEmpty).join(' · '));
    }
    for (final row in rows) {
      out.add(_entry(headers, row));
    }
    if (cursor < lines.length && lines[cursor].trim().isNotEmpty) out.add('');
    index = cursor - 1;
  }
  return out.join('\n');
}

String _entry(List<String> headers, List<String> row) {
  final first = _plain(row.isEmpty ? '' : row.first);
  final title = first.isEmpty ? '(blank)' : first;
  final names = <String>[];
  final values = <String>[];
  for (var column = 1; column < headers.length; column += 1) {
    final value = column < row.length ? row[column] : '';
    if (_empty.contains(value)) continue;
    names.add(_plain(headers[column]));
    values.add(value);
  }
  if (values.isEmpty) return '- **$title**';
  // A two-column table is a list of names and values.
  if (headers.length == 2) return '- **$title**: ${values.first}';
  final facts = <String>[
    for (var i = 0; i < values.length; i += 1)
      names[i].isEmpty ? values[i] : '${names[i]}: ${values[i]}',
  ].join(' · ');
  // Two trailing spaces start a new line inside the same list item.
  return '- **$title**  \n  $facts';
}

String _plain(String value) => value.replaceAll(_boldMarker, '');

bool _isRow(String? line) => line != null && _separator.hasMatch(line);

bool _isDivider(String? line) =>
    _isRow(line) && _cells(line!).every(_dividerCell.hasMatch);

List<String> _cells(String line) {
  var text = line.trim();
  if (text.startsWith('|')) text = text.substring(1);
  text = text.replaceFirst(_closingPipe, '');
  return [
    for (final cell in text.split(_separator))
      cell.replaceAll(r'\|', '|').trim(),
  ];
}
