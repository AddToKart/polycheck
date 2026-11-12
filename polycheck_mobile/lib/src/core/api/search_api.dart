import 'api_base.dart';
import 'api_models.dart';

/// Global lookup (`GET /search`, 2-100 chars, role-scoped by the server).
class SearchApi extends ApiBase {
  SearchApi(super.dio);

  Future<SearchResults> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 2) {
      return const SearchResults();
    }
    final data = await getJson(
      '/search',
      query: <String, dynamic>{'q': trimmed},
    );
    return SearchResults.fromJson(asMap(data));
  }
}
