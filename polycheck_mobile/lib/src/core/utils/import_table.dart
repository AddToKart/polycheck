import 'campus_courses.dart';

/// Mirrors `shared/src/utils/import/prepare.ts`.
///
/// School lists often put the student number and the name in one cell, split
/// the name into Last, First and Middle columns, or name the class only by a
/// section code such as `BSIT-SM 4-1`. New columns are added at the end so the
/// columns the import understands exist before they are matched.
class PreparedImportTable {
  const PreparedImportTable({required this.headers, required this.rows});

  final List<String> headers;
  final List<List<String>> rows;
}

String _canonical(String value) =>
    value.toLowerCase().replaceAll(RegExp('[^a-z0-9ñ]+'), '');

const _lastName = {'lastname', 'surname', 'familyname'};
const _firstName = {'firstname', 'givenname'};
const _middleName = {'middlename', 'middleinitial', 'mi'};
const _suffix = {'suffix', 'nameextension', 'extensionname'};
const _wholeName = {
  'name',
  'fullname',
  'studentname',
  'completename',
  'nameofstudent',
};

final RegExp _numberOnly = RegExp(r'^\s*\d{4}-\d{5}-[A-Za-z]{2}-\d\s*$');
final RegExp _numberThenName = RegExp(
  r'^\s*(\d{4}-\d{5}-[A-Za-z]{2}-\d)(?!\d)\s*[-–,:]?\s*(\p{L}.*)$',
  unicode: true,
);

/// `BSIT-SM 4-1` or `BSIT 4-1`: program, campus code, year level, section.
final RegExp _sectionCode = RegExp(
  r'^\s*([A-Za-z]{3,10})(?:\s*-\s*[A-Za-z]{2,4})?\s+([1-8])\s*-\s*\d{1,2}[A-Za-z]?\s*$',
);

({String program, String year})? _sectionProgram(String value) {
  final match = _sectionCode.firstMatch(value);
  if (match == null) return null;
  final course = normalizeCourse(match.group(1));
  if (!course.matched) return null;
  return (program: course.code!, year: match.group(2)!);
}

PreparedImportTable prepareImportTable(
  List<String> sourceHeaders,
  List<List<String>> sourceRows,
) {
  final headers = [
    for (final header in sourceHeaders)
      header.replaceAll(RegExp(r'^\s*"+|"+\s*$'), ''),
  ];
  final rows = [
    for (final row in sourceRows)
      <String>[
        for (var column = 0; column < headers.length; column++)
          column < row.length ? row[column] : '',
      ],
  ];

  int find(Set<String> names) =>
      headers.indexWhere((header) => names.contains(_canonical(header)));

  /// The first column whose filled-in cells mostly satisfy [matches].
  int columnWhere(bool Function(String) matches) {
    for (var column = 0; column < headers.length; column++) {
      final values = rows
          .map((row) => row[column].trim())
          .where((value) => value.isNotEmpty)
          .toList(growable: false);
      if (values.isNotEmpty &&
          values.where(matches).length / values.length >= 0.8) {
        return column;
      }
    }
    return -1;
  }

  void add(String header, String Function(List<String>) value) {
    for (final row in rows) {
      row.add(value(row));
    }
    headers.add(header);
  }

  if (columnWhere(_numberOnly.hasMatch) < 0) {
    final combined = columnWhere(_numberThenName.hasMatch);
    if (combined >= 0) {
      add(
        'Student Number',
        (row) => _numberThenName.firstMatch(row[combined])?.group(1) ?? '',
      );
      for (final row in rows) {
        final name = _numberThenName.firstMatch(row[combined])?.group(2);
        if (name != null) row[combined] = name.trim();
      }
    }
  }

  final last = find(_lastName);
  final first = find(_firstName);
  if (last >= 0 && first >= 0 && find(_wholeName) < 0) {
    final middle = find(_middleName);
    final suffix = find(_suffix);
    add('Full Name', (row) {
      String part(int column) => column >= 0 ? row[column].trim() : '';
      final given = [
        part(first),
        part(middle),
        part(suffix),
      ].where((value) => value.isNotEmpty).join(' ');
      return [part(last), given].where((value) => value.isNotEmpty).join(', ');
    });
  }

  final hasProgram =
      headers.any(
        (header) => RegExp(
          'program|course|degree|curriculum',
        ).hasMatch(_canonical(header)),
      ) ||
      columnWhere((value) => normalizeCourse(value).matched) >= 0;
  final section = columnWhere((value) => _sectionProgram(value) != null);
  if (section >= 0) {
    final hasYear = headers.any(
      (header) => RegExp('^(year|yr)').hasMatch(_canonical(header)),
    );
    if (!hasProgram) {
      add('Program', (row) => _sectionProgram(row[section])?.program ?? '');
    }
    if (!hasYear) {
      add('Year Level', (row) => _sectionProgram(row[section])?.year ?? '');
    }
  }

  return PreparedImportTable(headers: headers, rows: rows);
}
