/// True when every word typed appears in at least one field, in any order.
/// Mirrors `frontend/src/lib/list-search.ts`.
bool matchesQuery(String query, Iterable<String?> fields) {
  final words = query
      .trim()
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty);
  if (words.isEmpty) return true;
  final haystack = fields.whereType<String>().join(' ').toLowerCase();
  return words.every(haystack.contains);
}
