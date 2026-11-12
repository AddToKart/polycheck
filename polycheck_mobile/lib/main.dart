import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'src/core/api/api_providers.dart';
import 'src/core/database/app_database.dart';
import 'src/core/providers/maintenance_provider.dart';
import 'src/core/providers/offline_banner.dart';
import 'src/core/providers/session_provider.dart';
import 'src/core/providers/trusted_clock.dart';
import 'src/core/router/app_router.dart';
import 'src/core/sync/sync_lifecycle_binder.dart';
import 'src/core/theme/pup_theme.dart';
import 'src/core/theme/pup_tokens.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarBrightness: Brightness.dark,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
      systemNavigationBarContrastEnforced: false,
    ),
  );
  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  final database = AppDatabase.open();

  runApp(
    ProviderScope(
      overrides: [appDatabaseProvider.overrideWithValue(database)],
      child: const PolycheckApp(),
    ),
  );
}

/// Production root. Tests pass an explicit [router] and `bootstrap: false` so
/// no database, secure storage, or network work is scheduled.
class PolycheckApp extends ConsumerWidget {
  const PolycheckApp({super.key, this.router, this.bootstrap = true});

  final GoRouter? router;
  final bool bootstrap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appRouter = router ?? ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'Polycheck',
      debugShowCheckedModeBanner: false,
      theme: PupTheme.light,
      darkTheme: PupTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: appRouter,
      builder: bootstrap
          ? (context, child) => SyncLifecycleBinder(
              child: _BootLifecycle(child: child ?? const SizedBox.shrink()),
            )
          : null,
    );
  }
}

/// Non-blocking boot work: trusted-clock offset probe, periodic refresh,
/// maintenance probe, and an offline strip while the health endpoint is
/// unreachable.
class _BootLifecycle extends ConsumerStatefulWidget {
  const _BootLifecycle({required this.child});

  final Widget child;

  @override
  ConsumerState<_BootLifecycle> createState() => _BootLifecycleState();
}

class _BootLifecycleState extends ConsumerState<_BootLifecycle> {
  bool _offline = false;
  Timer? _retryTimer;

  @override
  void initState() {
    super.initState();
    ref.read(sessionProvider);
    ref.read(maintenanceProvider);
    ref.read(trustedClockProvider.notifier).startPeriodicRefresh();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_probe());
    });
  }

  @override
  void dispose() {
    _retryTimer?.cancel();
    super.dispose();
  }

  Future<void> _probe() async {
    try {
      await ref.read(sessionApiProvider).healthTimestamp();
      _setOffline(false);
    } catch (_) {
      _setOffline(true);
    }
  }

  void _setOffline(bool value) {
    if (!mounted) return;
    // Publish the strip state for full-bleed screens (the scanner pads its
    // header by the strip height); local state stays the render source.
    ref.read(offlineBannerProvider.notifier).setOffline(value);
    if (_offline == value) return;
    setState(() => _offline = value);
    if (value) {
      _retryTimer ??= Timer.periodic(const Duration(seconds: 15), (_) {
        unawaited(_probe());
      });
    } else {
      _retryTimer?.cancel();
      _retryTimer = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_offline)
          Positioned(
            top: MediaQuery.paddingOf(context).top,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Material(
                color: tokens.gold,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.cloud_off_outlined,
                        size: 14,
                        color: PupColors.pupDeepMaroon,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Offline - showing saved data. New records sync when '
                          'the server is reachable.',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: PupColors.pupDeepMaroon,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
