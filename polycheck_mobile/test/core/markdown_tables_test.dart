import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/markdown_tables.dart';

/// The same cases as `shared/src/utils/markdown-tables.test.ts`.
void main() {
  test(
    'turns each row of a wide table into one entry, without empty cells',
    () {
      final input = [
        'Here is your summary:',
        '| Subject | Section | Present | Rate |',
        '|---|:--:|---:|---|',
        '| **IT Elective** | 4-1 | 0 | — |',
        '| Programming | 2-2 | 5 | 83% |',
        'Ask me about one subject.',
      ].join('\n');

      expect(
        flattenMarkdownTables(input),
        [
          'Here is your summary:',
          '',
          '- **IT Elective**  \n  Section: 4-1 · Present: 0',
          '- **Programming**  \n  Section: 2-2 · Present: 5 · Rate: 83%',
          '',
          'Ask me about one subject.',
        ].join('\n'),
      );
    },
  );

  test('writes a two-column table as names and values', () {
    expect(
      flattenMarkdownTables(
        '| Item | Count |\n|---|---|\n| Present | 2 |\n| Late | 1 |',
      ),
      '- **Present**: 2\n- **Late**: 1',
    );
  });

  test('converts a table without outer pipes and keeps escaped pipes', () {
    expect(
      flattenMarkdownTables('Subject | Rate\n--- | ---\nProgramming | 83%'),
      '- **Programming**: 83%',
    );
    expect(
      flattenMarkdownTables('| A | B |\n|---|---|\n| x \\| y | z |'),
      '- **x | y**: z',
    );
  });

  test('leaves other text alone', () {
    for (final input in [
      'Just a sentence with a | pipe in it.',
      '- one\n- two',
      '| not a table |\nbecause there is no divider',
      'A sentence with a | pipe\n---\nabove a rule',
      '```\n| a | b |\n|---|---|\n| 1 | 2 |\n```',
    ]) {
      expect(flattenMarkdownTables(input), input);
    }
  });

  test('copes with a table that is still streaming in', () {
    expect(
      flattenMarkdownTables('| Subject | Rate |\n|---|---|'),
      'Subject · Rate',
    );
  });
}
