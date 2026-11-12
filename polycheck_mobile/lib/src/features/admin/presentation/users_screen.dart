import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/dashboard.dart';
import '../../../core/models/user.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/designations.dart';
import '../../../core/widgets/campus_badge.dart';
import '../../../core/widgets/campus_card.dart';
import '../../../core/widgets/campus_empty_state.dart';
import '../../../core/widgets/campus_text_field.dart';
import '../application/admin_users_api.dart';
import '../domain/admin_access.dart';
import '../domain/admin_users.dart';
import 'widgets/admin_common.dart';
import 'widgets/bulk_import_sheet.dart';
import 'widgets/create_account_sheet.dart';
import 'widgets/user_record_sheet.dart';

class AdminUsersScreen extends ConsumerStatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  ConsumerState<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends ConsumerState<AdminUsersScreen> {
  final _search = TextEditingController();
  final _department = TextEditingController();
  Timer? _debounce;
  UserRoleTab _tab = UserRoleTab.teacher;
  UserFilterState _filters = const UserFilterState();
  AdminUserPage? _page;
  bool _loading = true;
  String? _error;
  int _offset = 0;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _department.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    final user = ref.read(sessionProvider).user;
    final access = adminAccessFor(user);
    try {
      final page = await ref
          .read(usersApiProvider)
          .getUsers(
            buildUserFilters(
              _tab,
              _filters,
              offset: _offset,
              departmentPin: access.departmentPin,
            ),
          );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _page = page;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = adminUsersErrorMessage(error);
        _loading = false;
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() {
        _filters = _filters.copyWith(q: value);
        _offset = 0;
      });
      _load();
    });
  }

  void _onDepartmentChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      setState(() {
        _filters = _filters.copyWith(department: value);
        _offset = 0;
      });
      _load();
    });
  }

  void _selectTab(UserRoleTab tab) {
    if (tab == _tab) return;
    setState(() {
      _tab = tab;
      _offset = 0;
    });
    _load();
  }

  void _selectStatus(AdminUserStatusFilter? status) {
    setState(() {
      _filters = status == null
          ? _filters.copyWith(clearStatus: true)
          : _filters.copyWith(status: status);
      _offset = 0;
    });
    _load();
  }

  void _refresh() {
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider).user;
    final access = adminAccessFor(user);
    final registrar =
        user?.role == UserRole.teacher && canAccessUserAdmin(user);
    final institutionAdmin = user?.role == UserRole.superAdmin;
    final tabs = userRoleTabsFor(
      institutionAdmin: institutionAdmin,
      registrar: registrar,
    );
    final page = _page;

    return AdminScaffold(
      title: 'User management',
      subtitle: registrar
          ? 'Department-pinned account administration'
          : 'Accounts, roles, and credentials',
      section: AdminSection.users,
      actions: <Widget>[
        IconButton(
          tooltip: _tab == UserRoleTab.superAdmin
              ? 'Add super administrator'
              : 'Add ${_tab == UserRoleTab.teacher ? 'teacher' : 'student'}',
          onPressed: _openCreate,
          icon: const Icon(Icons.person_add_alt_outlined),
        ),
        IconButton(
          tooltip: 'Refresh accounts',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: RefreshIndicator(
        color: PupTheme.of(context).maroon,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            if (access.isDepartmentPinned) ...<Widget>[
              AdminInfoBanner(
                icon: Icons.pin_drop_outlined,
                message:
                    '${registrar ? 'Registrar scope' : 'Department scope'} — '
                    'this console only lists and manages accounts in '
                    '${access.departmentPin ?? 'your department'}. Role changes, '
                    'designations, and email edits are super-admin only.',
              ),
              const SizedBox(height: 12),
            ],
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                for (final tab in tabs)
                  AdminFilterChip(
                    label: tab.label,
                    selected: _tab == tab,
                    onSelected: () => _selectTab(tab),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            CampusTextField(
              controller: _search,
              label: 'Search accounts',
              hint: 'Name, email, or student ID',
              prefixIcon: Icons.search,
              onChanged: _onSearchChanged,
            ),
            if (!registrar) ...<Widget>[
              const SizedBox(height: 12),
              CampusTextField(
                controller: _department,
                label: 'Filter by department',
                hint: 'e.g. CCIS',
                onChanged: _onDepartmentChanged,
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                AdminFilterChip(
                  label: 'All statuses',
                  selected: _filters.status == null,
                  onSelected: () => _selectStatus(null),
                ),
                AdminFilterChip(
                  label: 'Active',
                  selected: _filters.status == AdminUserStatusFilter.active,
                  onSelected: () => _selectStatus(AdminUserStatusFilter.active),
                ),
                AdminFilterChip(
                  label: 'Inactive',
                  selected: _filters.status == AdminUserStatusFilter.inactive,
                  onSelected: () =>
                      _selectStatus(AdminUserStatusFilter.inactive),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    page == null ? 'Loading accounts…' : userRangeLabel(page),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: PupTheme.of(context).muted,
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: () =>
                      showBulkImportSheet(context, onImported: _refresh),
                  icon: const Icon(Icons.upload_file, size: 16),
                  label: const Text('Bulk import'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: AdminLoading(label: 'Loading accounts…'),
              )
            else if (_error != null)
              AdminErrorState(message: _error!, onRetry: _load)
            else if (page == null || page.data.isEmpty)
              const CampusEmptyState(
                icon: Icons.people_outline,
                title: 'No accounts found',
                message: 'Try a different search, role, or status filter.',
              )
            else ...<Widget>[
              for (final account in page.data)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _UserRow(
                    account: account,
                    onTap: () => showUserRecordSheet(
                      context,
                      account: account,
                      onChanged: _refresh,
                    ),
                  ),
                ),
              if (page.total > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: <Widget>[
                      OutlinedButton(
                        onPressed: _offset > 0 && !_loading
                            ? () {
                                setState(() {
                                  _offset = (_offset - userPageSize).clamp(
                                    0,
                                    page.total,
                                  );
                                });
                                _load();
                              }
                            : null,
                        child: const Text('Previous'),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Page ${userPageNumber(page)} of '
                        '${userPageCount(page)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const Spacer(),
                      OutlinedButton(
                        onPressed: page.hasMore && !_loading
                            ? () {
                                setState(() {
                                  _offset += userPageSize;
                                });
                                _load();
                              }
                            : null,
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  void _openCreate() {
    final user = ref.read(sessionProvider).user;
    final access = adminAccessFor(user);
    if (_tab == UserRoleTab.superAdmin) {
      showAddAdminSheet(
        context,
        onChanged: _refresh,
        defaultDepartment: user?.department,
      );
      return;
    }
    showCreateAccountSheet(
      context,
      role: _tab == UserRoleTab.teacher ? UserRole.teacher : UserRole.student,
      onChanged: _refresh,
      defaultDepartment: access.isDepartmentPinned
          ? access.departmentPin
          : user?.department,
    );
  }
}

class _UserRow extends StatelessWidget {
  const _UserRow({required this.account, required this.onTap});

  final User account;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return CampusCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          CircleAvatar(
            radius: 20,
            backgroundColor: account.isActive ? tokens.maroon : tokens.campus,
            child: Text(
              accountInitials(account.fullName),
              style: TextStyle(
                color: account.isActive ? Colors.white : tokens.muted,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        account.fullName,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    CampusBadge(
                      label: userRoleLabel(account.role),
                      background: tokens.campus,
                      foreground: tokens.onSurface,
                      border: tokens.borderSubtle,
                      dense: true,
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  account.studentId ?? account.email ?? 'No identifier',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                ),
                if ((account.department ?? '').isNotEmpty)
                  Text(
                    account.department!,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.muted),
                  ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 5,
                  runSpacing: 5,
                  children: <Widget>[
                    AdminStatusChip(
                      label: account.isActive ? 'Active' : 'Disabled',
                      active: account.isActive,
                    ),
                    if (account.mustChangePassword)
                      const AdminStatusChip(
                        label: 'Rotation pending',
                        active: false,
                        positive: false,
                      ),
                    for (final designation in activeDesignations(account))
                      AdminStatusChip(label: designation.label, active: true),
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 18),
        ],
      ),
    );
  }
}
