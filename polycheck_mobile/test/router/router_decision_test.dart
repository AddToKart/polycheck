import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/router/router_decision.dart';
import 'package:polycheck_mobile/src/core/router/routes/app_routes.dart';

import '../helpers/auth_harness.dart';

void main() {
  group('anonymous guard', () {
    test('protected deep link redirects to the portal with redirect param', () {
      final decision = decideRoute(
        location: '/faculty/sections/12?tab=roster',
        status: SessionStatus.signedOut,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );

      expect(
        decision.redirect,
        '/?redirect=%2Ffaculty%2Fsections%2F12%3Ftab%3Droster',
      );
    });

    test('auth routes stay available', () {
      for (final path in <String>[
        AppRoutes.portal,
        AppRoutes.studentLogin,
        AppRoutes.facultyLogin,
        AppRoutes.maintenance,
      ]) {
        final decision = decideRoute(
          location: path,
          status: SessionStatus.signedOut,
          user: null,
          maintenanceActive: false,
          hasExpiredSession: false,
          lastRole: null,
          officerPresident: false,
          officerQac: false,
        );
        expect(decision.allowed, isTrue, reason: path);
      }
    });

    test('restoring/authenticating never redirects', () {
      for (final status in <SessionStatus>[
        SessionStatus.unknown,
        SessionStatus.restoring,
        SessionStatus.authenticating,
      ]) {
        final decision = decideRoute(
          location: '/student/dashboard',
          status: status,
          user: null,
          maintenanceActive: true,
          hasExpiredSession: false,
          lastRole: null,
          officerPresident: false,
          officerQac: false,
        );
        expect(decision.allowed, isTrue, reason: status.name);
      }
    });
  });

  group('role routing', () {
    test('student lands on the student dashboard from the portal', () {
      final decision = decideRoute(
        location: AppRoutes.portal,
        status: SessionStatus.signedIn,
        user: testStudent,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, AppRoutes.studentHome);
    });

    test('student officer labels keep the student section', () {
      for (final role in <AppRole>[
        AppRole.student,
        AppRole.president,
        AppRole.qac,
      ]) {
        expect(roleHome(role), AppRoutes.studentHome, reason: role.name);
        expect(rolePrefix(role), AppRoutes.studentPrefix, reason: role.name);
      }
    });

    test('president wins over qac and both resolve from section roles', () {
      final role = resolveAppRole(
        testStudent,
        officerPresident: true,
        officerQac: true,
      );
      expect(role, AppRole.president);
    });

    test('wrong-section navigation redirects to the role home', () {
      final decision = decideRoute(
        location: '/faculty/sessions/abc',
        status: SessionStatus.signedIn,
        user: testStudent,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, AppRoutes.studentHome);
    });

    test('faculty and admin own their sections', () {
      final faculty = decideRoute(
        location: '/faculty/sections/1',
        status: SessionStatus.signedIn,
        user: testFaculty,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(faculty.allowed, isTrue);

      final admin = decideRoute(
        location: '/admin/users',
        status: SessionStatus.signedIn,
        user: testAdmin,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(admin.allowed, isTrue);

      final adminWrong = decideRoute(
        location: '/student/dashboard',
        status: SessionStatus.signedIn,
        user: testAdmin,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(adminWrong.redirect, AppRoutes.adminHome);
    });

    test('shared profile and assistant routes are allowed for every role', () {
      for (final user in <User>[testStudent, testFaculty, testAdmin]) {
        for (final path in <String>[AppRoutes.profile, AppRoutes.assistant]) {
          final decision = decideRoute(
            location: path,
            status: SessionStatus.signedIn,
            user: user,
            maintenanceActive: false,
            hasExpiredSession: false,
            lastRole: null,
            officerPresident: false,
            officerQac: false,
          );
          expect(decision.allowed, isTrue, reason: '${user.role.name} $path');
        }
      }
    });

    test('authenticated users are sent home from auth screens', () {
      final decision = decideRoute(
        location: AppRoutes.studentLogin,
        status: SessionStatus.signedIn,
        user: testFaculty,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, AppRoutes.facultyHome);
    });

    test('unknown signed-in identity falls back to the portal', () {
      final decision = decideRoute(
        location: '/student/dashboard',
        status: SessionStatus.signedIn,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, '/?redirect=%2Fstudent%2Fdashboard');
      expect(
        resolveAppRole(null, officerPresident: false, officerQac: false),
        isNull,
      );
      expect(roleHome(null), AppRoutes.portal);
    });
  });

  group('forced password rotation', () {
    const pendingStudent = User(
      id: 'student-1',
      fullName: 'Maria Santos',
      role: UserRole.student,
      mustChangePassword: true,
    );

    test('locks every protected route', () {
      final decision = decideRoute(
        location: '/student/dashboard',
        status: SessionStatus.signedIn,
        user: pendingStudent,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, AppRoutes.forcePasswordChange);
    });

    test('force-password-change and maintenance stay reachable', () {
      for (final path in <String>[
        AppRoutes.forcePasswordChange,
        AppRoutes.maintenance,
      ]) {
        final decision = decideRoute(
          location: path,
          status: SessionStatus.signedIn,
          user: pendingStudent,
          maintenanceActive: false,
          hasExpiredSession: false,
          lastRole: null,
          officerPresident: false,
          officerQac: false,
        );
        expect(decision.allowed, isTrue, reason: path);
      }
    });

    test('rotation gate precedes maintenance for non-exempt users', () {
      final decision = decideRoute(
        location: '/student/dashboard',
        status: SessionStatus.signedIn,
        user: pendingStudent,
        maintenanceActive: true,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, AppRoutes.forcePasswordChange);
    });
  });

  group('maintenance guard', () {
    test('non-exempt roles are redirected to the maintenance screen', () {
      for (final user in <User>[testStudent, testFaculty]) {
        final decision = decideRoute(
          location: '/student/dashboard',
          status: SessionStatus.signedIn,
          user: user,
          maintenanceActive: true,
          hasExpiredSession: false,
          lastRole: null,
          officerPresident: false,
          officerQac: false,
        );
        expect(decision.redirect, AppRoutes.maintenance);
      }
    });

    test('the maintenance route itself never loops', () {
      final decision = decideRoute(
        location: AppRoutes.maintenance,
        status: SessionStatus.signedIn,
        user: testFaculty,
        maintenanceActive: true,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.allowed, isTrue);
    });

    test('exempt super admins and IT coordinators keep navigating', () {
      const itCoordinator = User(
        id: 'teacher-it',
        fullName: 'IT Coordinator',
        role: UserRole.teacher,
        isItCoordinator: true,
      );
      for (final user in <User>[testAdmin, itCoordinator]) {
        final home = user.role == UserRole.superAdmin
            ? AppRoutes.adminHome
            : AppRoutes.facultyHome;
        final decision = decideRoute(
          location: home,
          status: SessionStatus.signedIn,
          user: user,
          maintenanceActive: true,
          hasExpiredSession: false,
          lastRole: null,
          officerPresident: false,
          officerQac: false,
        );
        expect(decision.allowed, isTrue, reason: user.role.name);
      }
    });

    test('a plain teacher is not exempt', () {
      final decision = decideRoute(
        location: '/faculty/dashboard',
        status: SessionStatus.signedIn,
        user: testFaculty,
        maintenanceActive: true,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.redirect, AppRoutes.maintenance);
    });
  });

  group('session expiry', () {
    test('protected 401 redirects to the role login with reason', () {
      final decision = decideRoute(
        location: '/faculty/sections/1',
        status: SessionStatus.signedOut,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: true,
        lastRole: AppRole.faculty,
        officerPresident: false,
        officerQac: false,
      );
      expect(
        decision.redirect,
        '/login/faculty?reason=expired&redirect=%2Ffaculty%2Fsections%2F1',
      );
    });

    test('student expiry uses the student login', () {
      final decision = decideRoute(
        location: '/student/dashboard',
        status: SessionStatus.signedOut,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: true,
        lastRole: AppRole.president,
        officerPresident: false,
        officerQac: false,
      );
      expect(
        decision.redirect,
        '/login/student?reason=expired&redirect=%2Fstudent%2Fdashboard',
      );
    });

    test('login pages gain the expired reason once, then stay stable', () {
      final first = decideRoute(
        location: AppRoutes.studentLogin,
        status: SessionStatus.signedOut,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: true,
        lastRole: AppRole.student,
        officerPresident: false,
        officerQac: false,
      );
      expect(first.redirect, '/login/student?reason=expired');

      final second = decideRoute(
        location: '/login/student?reason=expired',
        status: SessionStatus.signedOut,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: true,
        lastRole: AppRole.student,
        officerPresident: false,
        officerQac: false,
      );
      expect(second.allowed, isTrue);
    });

    test('portal remains available after expiry', () {
      final decision = decideRoute(
        location: AppRoutes.portal,
        status: SessionStatus.signedOut,
        user: null,
        maintenanceActive: false,
        hasExpiredSession: true,
        lastRole: AppRole.student,
        officerPresident: false,
        officerQac: false,
      );
      expect(decision.allowed, isTrue);
    });
  });

  group('K13 administrator suites', () {
    const itCoordinator = User(
      id: 'teacher-it',
      fullName: 'IT Coordinator',
      role: UserRole.teacher,
      isItCoordinator: true,
    );
    const registrar = User(
      id: 'teacher-reg',
      fullName: 'Registrar',
      role: UserRole.teacher,
      isUserRegistrar: true,
    );
    const departmentHead = User(
      id: 'teacher-head',
      fullName: 'Department Head',
      role: UserRole.teacher,
      isDepartmentHead: true,
    );
    const itRegistrar = User(
      id: 'teacher-it-reg',
      fullName: 'IT Registrar',
      role: UserRole.teacher,
      isItCoordinator: true,
      isUserRegistrar: true,
    );

    RouteDecision decide(User user, String path) {
      return decideRoute(
        location: path,
        status: SessionStatus.signedIn,
        user: user,
        maintenanceActive: false,
        hasExpiredSession: false,
        lastRole: null,
        officerPresident: false,
        officerQac: false,
      );
    }

    test('super admins can open every console route', () {
      for (final path in AppRoutes.adminPaths) {
        expect(decide(testAdmin, path).allowed, isTrue, reason: path);
      }
      expect(
        decide(testAdmin, AppRoutes.adminPrefix).redirect,
        AppRoutes.adminHome,
      );
      expect(
        decide(testAdmin, '/admin/not-a-real-screen').redirect,
        AppRoutes.adminHome,
      );
    });

    test('IT coordinators open only their three suites', () {
      for (final path in <String>[
        '/admin/server-status',
        '/admin/system-reports',
        '/admin/settings',
        '/admin/settings?tab=system',
      ]) {
        expect(decide(itCoordinator, path).allowed, isTrue, reason: path);
      }
      for (final path in <String>[
        '/admin/dashboard',
        '/admin/users',
        '/admin/audit-logs',
        '/admin/search',
        '/admin/not-a-real-screen',
      ]) {
        expect(
          decide(itCoordinator, path).redirect,
          '/admin/server-status',
          reason: path,
        );
      }
      expect(
        decide(itCoordinator, AppRoutes.adminPrefix).redirect,
        '/admin/server-status',
      );
    });

    test('registrars open only the account console', () {
      expect(decide(registrar, '/admin/users').allowed, isTrue);
      for (final path in <String>[
        '/admin/dashboard',
        '/admin/server-status',
        '/admin/system-reports',
        '/admin/settings',
        '/admin/audit-logs',
        '/admin/search',
      ]) {
        expect(decide(registrar, path).redirect, '/admin/users', reason: path);
      }
      expect(decide(registrar, AppRoutes.adminPrefix).redirect, '/admin/users');
    });

    test('dual IT + registrar designations keep the union and IT landing', () {
      for (final path in <String>[
        '/admin/server-status',
        '/admin/system-reports',
        '/admin/settings',
        '/admin/users',
      ]) {
        expect(decide(itRegistrar, path).allowed, isTrue, reason: path);
      }
      expect(
        decide(itRegistrar, '/admin/dashboard').redirect,
        '/admin/server-status',
      );
    });

    test(
      'department heads and plain teachers never enter the admin console',
      () {
        for (final user in <User>[departmentHead, testFaculty, testStudent]) {
          for (final path in AppRoutes.adminPaths) {
            final decision = decide(user, path);
            final home = user.role == UserRole.student
                ? AppRoutes.studentHome
                : AppRoutes.facultyHome;
            expect(decision.redirect, home, reason: '${user.id} $path');
          }
        }
        expect(decide(departmentHead, '/faculty/at-risk').allowed, isTrue);
      },
    );
  });

  group('shared authenticated surfaces', () {
    const paths = <String>[
      AppRoutes.profile,
      AppRoutes.assistant,
      AppRoutes.notifications,
      AppRoutes.privacy,
      AppRoutes.profileReports,
      '/profile?tab=reports',
      '/profile?tab=notifications',
    ];

    test('every authenticated role reaches notifications/privacy/reports', () {
      for (final user in <User>[
        testStudent,
        testFaculty,
        testAdmin,
        const User(
          id: 'teacher-it',
          fullName: 'IT Coordinator',
          role: UserRole.teacher,
          isItCoordinator: true,
        ),
      ]) {
        for (final path in paths) {
          final decision = decideRoute(
            location: path,
            status: SessionStatus.signedIn,
            user: user,
            maintenanceActive: false,
            hasExpiredSession: false,
            lastRole: null,
            officerPresident: false,
            officerQac: false,
          );
          expect(decision.allowed, isTrue, reason: '${user.id} $path');
        }
      }
    });

    test('unknown children of shared paths still redirect safely', () {
      for (final path in <String>[
        '/notifications/123',
        '/privacy/extra',
        '/profile/reports/2026',
      ]) {
        final decision = decideRoute(
          location: path,
          status: SessionStatus.signedIn,
          user: testStudent,
          maintenanceActive: false,
          hasExpiredSession: false,
          lastRole: null,
          officerPresident: false,
          officerQac: false,
        );
        expect(decision.redirect, AppRoutes.studentHome, reason: path);
      }
    });
  });

  group('post-login destinations', () {
    test('accepts a same-role deep link including its query', () {
      expect(
        resolvePostLoginDestination(
          redirect: '/faculty/sections/1?tab=roster',
          role: AppRole.faculty,
        ),
        '/faculty/sections/1?tab=roster',
      );
    });

    test('accepts shared routes for any authenticated role', () {
      expect(
        resolvePostLoginDestination(
          redirect: AppRoutes.profile,
          role: AppRole.student,
        ),
        AppRoutes.profile,
      );
      expect(
        resolvePostLoginDestination(
          redirect: AppRoutes.notifications,
          role: AppRole.student,
        ),
        AppRoutes.notifications,
      );
    });

    test('designees resume permitted admin deep links only', () {
      const itCoordinator = User(
        id: 'teacher-it',
        fullName: 'IT Coordinator',
        role: UserRole.teacher,
        isItCoordinator: true,
      );
      const registrar = User(
        id: 'teacher-reg',
        fullName: 'Registrar',
        role: UserRole.teacher,
        isUserRegistrar: true,
      );
      expect(
        resolvePostLoginDestination(
          redirect: '/admin/server-status',
          role: AppRole.faculty,
          user: itCoordinator,
        ),
        '/admin/server-status',
      );
      expect(
        resolvePostLoginDestination(
          redirect: '/admin/users',
          role: AppRole.faculty,
          user: registrar,
        ),
        '/admin/users',
      );
      expect(
        resolvePostLoginDestination(
          redirect: '/admin/users',
          role: AppRole.faculty,
          user: itCoordinator,
        ),
        '/admin/server-status',
      );
      expect(
        resolvePostLoginDestination(
          redirect: '/admin/users',
          role: AppRole.faculty,
          user: testFaculty,
        ),
        isNull,
      );
      expect(
        resolvePostLoginDestination(
          redirect: '/admin/users',
          role: AppRole.admin,
          user: testAdmin,
        ),
        '/admin/users',
      );
    });

    test('rejects cross-role, auth, and protocol-relative destinations', () {
      expect(
        resolvePostLoginDestination(
          redirect: '/faculty/dashboard',
          role: AppRole.student,
        ),
        isNull,
      );
      expect(
        resolvePostLoginDestination(
          redirect: AppRoutes.studentLogin,
          role: AppRole.student,
        ),
        isNull,
      );
      expect(
        resolvePostLoginDestination(
          redirect: '//evil.example/steal',
          role: AppRole.student,
        ),
        isNull,
      );
      expect(
        resolvePostLoginDestination(
          redirect: 'student/dashboard',
          role: AppRole.student,
        ),
        isNull,
      );
    });
  });
}
