import 'package:flutter/material.dart';

import '../theme/brand_theme.dart';
import 'campus_bottom_sheet.dart';
import 'campus_button.dart';

/// One choice in a filter or sort menu.
class ListOption {
  const ListOption(this.value, this.label);

  final String value;
  final String label;
}

/// A drop-down filter. An empty [value] means it is not applied.
class ListFilter {
  const ListFilter({
    required this.id,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
    this.allLabel = 'All',
  });

  final String id;
  final String label;
  final String value;
  final List<ListOption> options;
  final ValueChanged<String> onChanged;
  final String allLabel;

  bool get isActive => value.isNotEmpty;

  String get valueLabel {
    for (final option in options) {
      if (option.value == value) return option.label;
    }
    return value;
  }
}

/// A page of a list, with the page number kept inside the range.
class ListPage<T> {
  factory ListPage(List<T> items, int page, {int size = 10}) {
    final pages = items.isEmpty ? 1 : ((items.length + size - 1) ~/ size);
    final current = page.clamp(1, pages);
    final start = (current - 1) * size;
    final end = (start + size).clamp(0, items.length);
    return ListPage._(
      items.sublist(start, end),
      current,
      pages,
      items.length,
      items.isEmpty ? 0 : start + 1,
      end,
    );
  }

  const ListPage._(
    this.items,
    this.page,
    this.pages,
    this.total,
    this.first,
    this.last,
  );

  final List<T> items;
  final int page;
  final int pages;
  final int total;
  final int first;
  final int last;
}

/// The search box, filter sheet and sort order every list shares.
class ListControls extends StatefulWidget {
  const ListControls({
    super.key,
    required this.query,
    required this.onQueryChanged,
    this.searchHint = 'Search',
    this.filters,
    this.sort = '',
    this.sortOptions = const <ListOption>[],
    this.onSortChanged,
    this.onClear,
  });

  final String query;
  final ValueChanged<String> onQueryChanged;
  final String searchHint;

  /// Read again each time the sheet redraws, so one filter can narrow another.
  final List<ListFilter> Function()? filters;

  /// The first of [sortOptions] is the default and has an empty value.
  final String sort;
  final List<ListOption> sortOptions;
  final ValueChanged<String>? onSortChanged;

  /// Resets every filter, the sort order and the search.
  final VoidCallback? onClear;

  @override
  State<ListControls> createState() => _ListControlsState();
}

class _ListControlsState extends State<ListControls> {
  late final TextEditingController _search = TextEditingController(
    text: widget.query,
  );

  @override
  void didUpdateWidget(ListControls oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.query != _search.text) _search.text = widget.query;
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  bool get _hasSheet => widget.filters != null || widget.sortOptions.isNotEmpty;

  Future<void> _openSheet() async {
    await showCampusBottomSheet<void>(
      context,
      title: 'Filter and sort',
      maxHeight: MediaQuery.sizeOf(context).height * 0.7,
      child: StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          // The parent redraws with the new value; the sheet follows a frame later.
          void apply(VoidCallback change) {
            change();
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (sheetContext.mounted) setSheetState(() {});
            });
          }

          final filters = widget.filters?.call() ?? const <ListFilter>[];
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final filter in filters) ...[
                _Menu(
                  key: ValueKey('filter-${filter.id}-${filter.value}'),
                  label: filter.label,
                  value: filter.value,
                  options: [ListOption('', filter.allLabel), ...filter.options],
                  onChanged: (value) => apply(() => filter.onChanged(value)),
                ),
                const SizedBox(height: 12),
              ],
              if (widget.sortOptions.isNotEmpty) ...[
                _Menu(
                  key: ValueKey('sort-${widget.sort}'),
                  label: 'Sort by',
                  value: widget.sort,
                  options: widget.sortOptions,
                  onChanged: (value) =>
                      apply(() => widget.onSortChanged?.call(value)),
                ),
                const SizedBox(height: 12),
              ],
              CampusButton(
                label: 'Show results',
                onPressed: () => Navigator.of(sheetContext).pop(),
              ),
              if (widget.onClear != null) ...[
                const SizedBox(height: 8),
                CampusButton(
                  label: 'Clear all',
                  variant: CampusButtonVariant.outline,
                  onPressed: () => apply(widget.onClear!),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    final active = (widget.filters?.call() ?? const <ListFilter>[])
        .where((filter) => filter.isActive)
        .toList(growable: false);
    final sortLabel = widget.sort.isEmpty
        ? null
        : widget.sortOptions
              .where((option) => option.value == widget.sort)
              .map((option) => option.label)
              .firstOrNull;
    final count = active.length + (sortLabel == null ? 0 : 1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                key: const ValueKey<String>('list-search'),
                controller: _search,
                onChanged: widget.onQueryChanged,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: widget.searchHint,
                  isDense: true,
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: widget.query.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Clear search',
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () => widget.onQueryChanged(''),
                        ),
                ),
              ),
            ),
            if (_hasSheet) ...[
              const SizedBox(width: 8),
              Tooltip(
                message: 'Filter and sort',
                child: InkWell(
                  key: const ValueKey<String>('list-filter-button'),
                  onTap: _openSheet,
                  child: Container(
                    height: 44,
                    constraints: const BoxConstraints(minWidth: 48),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: count > 0 ? tokens.maroon : tokens.surface,
                      border: Border.all(
                        color: count > 0 ? tokens.maroon : tokens.borderSubtle,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.tune,
                          size: 20,
                          color: count > 0 ? Colors.white : tokens.onSurface,
                        ),
                        if (count > 0) ...[
                          const SizedBox(width: 6),
                          Text(
                            '$count',
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(color: Colors.white),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
        if (count > 0) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final filter in active)
                _Chip(
                  label: '${filter.label}: ${filter.valueLabel}',
                  onRemove: () => filter.onChanged(''),
                ),
              if (sortLabel != null)
                _Chip(
                  label: 'Sorted: $sortLabel',
                  onRemove: () => widget.onSortChanged?.call(''),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Menu extends StatelessWidget {
  const _Menu({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<ListOption> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final known = options.any((option) => option.value == value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: BrandTheme.of(context).muted,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          initialValue: known ? value : '',
          isExpanded: true,
          decoration: const InputDecoration(
            contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            isDense: true,
          ),
          items: [
            for (final option in options)
              DropdownMenuItem<String>(
                value: option.value,
                child: Text(option.label, overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: (next) => onChanged(next ?? ''),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.onRemove});

  final String label;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final tokens = BrandTheme.of(context);
    return Semantics(
      button: true,
      label: 'Remove $label',
      child: InkWell(
        onTap: onRemove,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: tokens.surface,
            border: Border.all(color: tokens.borderSubtle),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.close, size: 14, color: tokens.muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// "11–20 of 53" with previous and next. Hidden when everything fits.
class ListPager extends StatelessWidget {
  const ListPager({super.key, required this.page, required this.onChanged});

  final ListPage<Object?> page;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    if (page.pages <= 1) return const SizedBox.shrink();
    final tokens = BrandTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          IconButton.outlined(
            key: const ValueKey<String>('pager-previous'),
            tooltip: 'Previous page',
            onPressed: page.page > 1 ? () => onChanged(page.page - 1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  'Page ${page.page} of ${page.pages}',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: tokens.onSurface),
                ),
                Text(
                  '${page.first}–${page.last} of ${page.total}',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
              ],
            ),
          ),
          IconButton.outlined(
            key: const ValueKey<String>('pager-next'),
            tooltip: 'Next page',
            onPressed: page.page < page.pages
                ? () => onChanged(page.page + 1)
                : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}
