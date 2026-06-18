# PUP Attendance System — Full System Plan

**Polytechnic University of the Philippines**
System name: **Polycheck**
Document type: System Planning Document — Non-Technical Reference

---

## Overview

Polycheck is a unified web and mobile attendance management system designed to replace the current written class monitoring forms used at PUP. The system digitizes attendance through QR code scanning, geolocation verification, and biometric confirmation, making proxy attendance and identity fraud effectively impossible. It is built as an offline-first system, meaning it works fully without internet and syncs all data to the cloud automatically whenever a connection becomes available. It serves three distinct user roles — Super Admin, Admin (Teacher/Instructor), and Student — each with a scoped set of responsibilities and access.

---

## The Problem Being Solved

The current process relies on paper-based class monitoring forms. Students sign or are marked present manually, which creates several vulnerabilities: a student can be marked present by a classmate, forms can be lost or altered, and there is no real-time visibility for department heads. Collating attendance data for reporting requires manual counting and is error-prone. Polycheck eliminates all of these issues by moving the entire process into a verified, logged, and auditable digital system.

---

## User Roles

### Super Admin
Super Admins are department heads and authorized PUP officials such as program chairs and administrators. They have the highest level of access in the system and can see data across all teachers and subjects within their department or the entire institution depending on their scope. They do not manage day-to-day attendance but oversee the system, generate reports, manage teacher accounts, and configure institution-level settings.

### Admin (Teacher / Instructor)
Admins are teachers and instructors. Each teacher manages only their own subjects and classes. They create subjects, configure class schedules, generate QR codes for each session, set the geofence for their classroom, and define the time window during which students may check in. They can view attendance records for their classes and flag anomalies.

### Student
Students use the mobile app as their primary interface. They have a digital student ID within the app, can view their class schedules, and check in to classes by scanning the teacher's QR code. Their attendance history is visible to them, and they receive feedback when a check-in is denied and why.

---

## Core Features

### QR Code Attendance
Each class session requires the teacher to generate a fresh QR code directly in the system. The QR code is not a static image — it is a cryptographically signed token that is unique to that session and expires after a teacher-configured time window (typically two to five minutes). Tokens are signed locally on the teacher's device using a private key that was provisioned to the device during the initial connected setup phase. The server retains the corresponding public key and uses it to verify token signatures when records sync. This asymmetric key model means token signing is fully trustworthy without requiring a server connection at the moment of generation. The session data is queued for sync to Supabase whenever connectivity is available. Once the time window closes, the token is considered expired and any scan attempt is rejected. When records sync, the server re-validates all token signatures and timestamps.

### Geolocation Attendance Gating
When a teacher creates a session, they configure a geofence — a circular area defined by GPS coordinates and a radius (typically 30 to 50 meters centered on the classroom). This geofence is stored locally on the teacher's device and pre-synced to enrolled students' devices so it is available without internet. When a student submits a QR scan, the app performs the Haversine distance calculation locally on the device using the cached geofence data. If the student's current GPS coordinates fall outside the defined radius, the check-in is rejected immediately and the student is informed they are outside the allowed area. The GPS coordinates, outcome, and timestamp are all recorded locally and included in the sync payload when connectivity returns. Upon sync, the server re-validates all submitted coordinates against the stored geofence as a secondary check to catch any local tampering.

### Digital Student ID
Every student account has a digital ID card embedded in the mobile app. It displays the student's full name, student number, program, year level, and a profile photo. The ID is tied to the verified account and cannot be transferred or screenshotted for use by another person since its QR scanner and biometric gate are bound to the device it is installed on. The digital ID also serves as a quick reference for teachers doing manual verification if needed.

### Subject and Schedule Management
Teachers create subjects within the system, defining the subject name, section, room, schedule (days and time), and semester. Students are enrolled into subjects either by the teacher manually or through a system-generated enrollment code.

Enrollment codes are generated per-subject, not per-session. A teacher generates one code when they create the subject at the start of the semester. The code is short and alphanumeric — six to eight characters — so students can type it manually if needed. The teacher sets an expiry on the code, typically the first two weeks of the semester, after which it stops accepting new enrollments. Existing enrollments made before expiry remain valid for the rest of the semester. The teacher can invalidate and regenerate the code at any time — useful if the code leaks to students outside the intended section. Once enrolled, the subject and all of its sessions appear in the student's schedule view automatically and their device begins syncing geofence and session data for that subject.

### Attendance Records and Reporting
Every check-in, whether successful or denied, is logged with a timestamp, GPS coordinates, device ID, and outcome. Teachers can view per-session and per-student attendance summaries for all their subjects. Super Admins can generate department-wide or institution-wide attendance reports, filter by subject, teacher, date range, or student, and export records. Attendance status is categorized as Present, Late (within session window but past a teacher-configured grace period), or Absent.

---

## Anti-Cheat System

This is the most critical part of the system design. The v1 anti-cheat stack is deliberately scoped to the layers that provide the most protection for the least implementation complexity. Device binding and biometric gate are documented as v2 features — they add meaningful protection but would significantly increase v1 scope.

The v1 anti-cheat stack consists of: server-signed token expiry, server-side geofence re-validation on sync, reject-on-duplicate conflict resolution, and single active session per account. Together these cover all common cheat vectors without overbuilding the first version.

### Cheat Scenario 1 — Sending the QR Code to an Absent Friend
A present student screenshots or forwards the QR code to a classmate who is not physically in the room.

**Solution:** The QR token expires within a short teacher-configured window (two to five minutes). Geolocation validation is performed locally on the student's device at the moment of scan using cached geofence data, and the result is re-validated by the server when records sync. Even if the absent student receives the QR code instantly, their device checks their GPS coordinates locally and rejects the scan if they are not within the classroom geofence. Both the token validity and the GPS check must pass together — failing either rejects the check-in.

### Cheat Scenario 2 — Logging into an Absent Student's Account
A present student logs into their absent classmate's account on their own phone and scans the QR code on their behalf, satisfying the geolocation check since they are physically present.

**Solution — Single Active Session per Account (v1):** Better Auth enforces that a user account can only have one active verified session at a time. If student B's credentials are used to log in from a new device, student B is immediately logged out of their existing session and receives a security alert. This makes credential sharing immediately visible and disruptive to the legitimate account holder.

**Solution — Device Binding and Biometric Gate (v2):** In v2, the app will permanently bind a student account to a specific device on first login using a device fingerprint. Every scan submission will include this fingerprint as part of the signed payload, and the server will reject any scan where the submitting device does not match the account's registered device. Additionally, a biometric authentication gate (Face ID or fingerprint) will be required before the QR scanner opens, confirming the physical person holding the phone is the registered account holder. These two layers make the account-sharing attack essentially impossible even if the single-session enforcement is somehow bypassed.

### Cheat Scenario 3 — GPS Spoofing
A technically advanced student uses a mock location app to fake their coordinates as being inside the classroom.

**Solution — Coordinate Plausibility Monitoring:** The system logs all submitted GPS coordinates. Coordinates that are suspiciously precise — matching the exact geofence center to many decimal places — or that are implausibly consistent across multiple sessions from the same device are flagged and surfaced to the teacher and Super Admin as anomalies. This is a passive audit layer rather than a hard block, since reliable spoofing detection at the app level is difficult, but the audit trail creates accountability and gives teachers grounds to escalate.

**Solution — Device Integrity Attestation (v2):** Android SafetyNet and Apple DeviceCheck attestation will be added in v2, verifying at the OS level that the device has not been rooted or tampered with before any local validation result is trusted.

### Cheat Scenario 4 — Screenshot Replay of QR Code
A student saves a QR code from a previous session and tries to use it in a future session.

**Solution:** Each QR token carries a server-signed `issuedAt` timestamp embedded in the token payload at generation time. The local expiry check uses this signed timestamp — not the device clock — so winding the device clock back does not extend the token's validity. The app reads the `issuedAt` from the token itself and compares it against the teacher-configured window duration. When records sync, the server performs the same calculation using its own clock and the signed `issuedAt`, making the device clock entirely irrelevant to the authoritative expiry decision. Tokens are also single-use per student account — the first sync to arrive for a given token and student pair is accepted, and any subsequent submission of the same pair is rejected and logged as a duplicate, which is itself flagged for teacher review.

---

## Tech Stack

### Web Dashboard
The web dashboard is built with Next.js and serves the Teacher (Admin) and Super Admin interfaces. Teachers use it to create subjects, configure sessions, generate QR codes, and review attendance. Super Admins use it for user management, reporting, and system configuration. The web dashboard shares the same design system, type definitions, and API client logic as the mobile app through a monorepo structure.

### Mobile App
The mobile app is built with React Native using the Expo framework. It is the primary interface for students and is also available to teachers who prefer to generate and display QR codes from their phone. Expo provides access to native device capabilities required by the system — GPS via expo-location, camera and QR scanning via expo-camera, and biometric authentication via expo-local-authentication. The app targets both iOS and Android.

### Backend API
The backend is built with NestJS running on Node.js. NestJS is chosen for its module-based architecture, which maps cleanly to the system's distinct functional areas: authentication and session management, QR token generation and validation, geolocation validation, attendance recording, subject and schedule management, and reporting. Each module is independently testable and maintainable. The API is RESTful with JWT-based authentication.

### Database
The system uses a two-layer database architecture to support offline-first operation. On each device, a local SQLite database (via expo-sqlite on mobile) stores all data the app needs to function without internet — enrolled subjects, session tokens, geofence configurations, student profile data, and a queue of attendance records pending sync. This local database is the source of truth during class. The cloud database is PostgreSQL hosted on Supabase, which is the permanent system of record. Supabase is chosen for its Row Level Security (RLS) feature, which enforces data access policies at the database level — a student can only read their own records, a teacher can only read records for their subjects, and a Super Admin can read all records within their scope. Supabase also provides realtime subscriptions, which update the teacher's dashboard live as synced records arrive.

### Authentication
Better Auth handles session management, JWT issuance, and user account lifecycle. User roles (super_admin, admin, student) are stored in the user profile and attached to every session token. NestJS guards read the role from the token on every protected route and enforce access accordingly. The single active session per account constraint described in the Anti-Cheat section is enforced here at the Better Auth configuration level — it is one mechanism, not two.

### Monorepo Structure
The project is organized as a Turborepo monorepo. Shared code — TypeScript types, API client functions, validation schemas, and utility functions — lives in shared packages consumed by both the Next.js web app and the Expo mobile app. This ensures the two frontends stay in sync on data contracts and reduces duplicated logic.

---

## Offline-First Architecture

PUP's campus has unreliable WiFi and inconsistent mobile data coverage in classrooms. Polycheck is designed so that every critical action during class — QR generation, attendance scanning, and geolocation validation — works completely without internet. An internet connection is only needed to sync data, not to operate the system.

### How It Works

Both the teacher app and the student app maintain a local SQLite database on the device. All data the app needs during class — subject schedules, geofence configurations, enrolled student lists, and student profile data — is pre-loaded onto the device the last time it had any connection. During class, all operations read from and write to this local database exclusively. No network call is made during the check-in flow.

During the initial connected setup phase, the server provisions a signing key pair to each teacher's device. The private key is stored in the device's secure enclave or keystore and never leaves the device. The server retains the corresponding public key. All QR tokens generated offline are signed with this private key, and the server verifies them using the stored public key when records sync. This is the same asymmetric signing model used by systems like SSH and hardware security keys — the server does not need to be present at signing time for the signature to be trustworthy.

When internet becomes available on any device — whether the teacher's mobile data turns on, a student walks into an area with WiFi, or anyone gets home — the app's background sync queue drains automatically. Pending attendance records, newly created sessions, and any profile updates are pushed to Supabase. The sync is opportunistic and silent; users do not need to do anything to trigger it.

### Session Configuration vs Session Activation

There is an important distinction between two separate actions in the teacher flow, and they have different connectivity requirements.

Session configuration is the act of creating a subject, defining its geofence, setting the classroom location, and establishing the schedule. This must be done while the teacher has internet connectivity — ideally before the semester begins or at minimum before the class day. This is the data that students need to pre-sync onto their devices. Without it cached locally, students cannot scan. Configuration is a one-time setup per subject per semester, not a per-class task.

Session activation is the act of opening an already-configured subject and generating the QR code for that specific class meeting. This works completely offline. The teacher taps to start the session, the app generates and signs the token locally using the pre-configured subject data, and the QR is displayed. Students already have the geofence cached from their pre-session sync. The only thing they receive in the classroom is the QR token itself, which they get by physically scanning the screen — no internet needed for any part of that exchange.

This separation means the system's offline capability is real and complete for the actual classroom experience, while still requiring a one-time connected setup that any teacher can do at home or on mobile data before the semester starts.

### Pre-Session Sync Expectation

Students are expected to open Polycheck while connected at least once before each class day — at home, on the commute, or anywhere with data. This sync pulls down geofence configurations and subject data for all enrolled subjects. If a student has not synced and has no cached data for the current class, they will not be able to scan. This is a known and acceptable constraint, equivalent to a student forgetting their physical ID.

### Sync Conflict Resolution

When records arrive at the server during sync, conflicts are resolved using a reject-on-duplicate strategy. The first sync to arrive for a given token and student account pair is accepted and recorded as the canonical attendance entry. Any subsequent submission of the same pair — from any device — is rejected and logged as a duplicate. Duplicate submissions are flagged for teacher review since a legitimate student should only ever produce one record per session. For non-conflicting records from different students in the same session, there is no conflict — each token-student pair is unique and all records are inserted normally regardless of the order they arrive.

### Clock Drift and Token Expiry

The device clock is deliberately excluded from the authoritative expiry decision to prevent students from winding their clock back to extend a token's validity. Each token carries an `issuedAt` timestamp baked into the token payload at the moment of generation and signed with the teacher's provisioned private key. The local expiry check reads this signed timestamp and compares it against the teacher-configured window duration — not against the device's current time. When records sync, the server performs the same calculation using its own clock and the `issuedAt` from the verified token. Because the `issuedAt` is part of the signed payload and cannot be altered without invalidating the signature — and the signature can be verified using the server's copy of the teacher's public key — the device clock has no influence over whether a token is considered valid or expired.

### Server-Side Re-Validation on Sync

Every synced attendance record undergoes a full re-validation pass when it arrives at the server. The server checks that the signed token timestamp falls within the session window, that the submitted GPS coordinates fall within the session's geofence, and that no duplicate submission exists for the same token and student pair. Any record that fails re-validation is marked as disputed and surfaced to the teacher for manual review rather than silently discarded.

### Offline Anti-Cheat Considerations

Local validation introduces a manipulation surface that server-side-only validation does not. A student with a rooted or modified phone could theoretically alter the local validation logic to produce a fraudulent record that passes local checks. This is mitigated in v1 by the server re-validation pass on sync, the coordinate plausibility monitoring, and the reject-on-duplicate conflict strategy. The post-v1 addition of Android SafetyNet and Apple DeviceCheck attestation will close this gap further by verifying at the OS level that the app has not been tampered with before any local result is trusted.

---

## Design System

### Brand Foundation
The design system is built exclusively on PUP's official brand identity. The palette is intentionally restricted to four colors — maroon, deep maroon, golden yellow, and white or black depending on the mode. No additional brand colors are introduced. This restraint gives the system a unified, instantly recognizable identity that feels unmistakably PUP across every screen and surface.

### Color Palette

**Primary — Maroon** `#7B1113`
The dominant brand color and the backbone of the entire UI. Used for primary buttons, navigation bars, headers, active states, and all primary UI surfaces. Every screen's identity is anchored in this color.

**Primary Dark — Deep Maroon** `#4A0A0B`
Used for hover and pressed states on maroon elements, sidebar backgrounds, deep surface layers, and as the primary background color in dark mode. This is the dark counterpart that keeps the maroon family cohesive without introducing a foreign color.

**Accent — Golden Yellow** `#F5A800`
The sole accent color, derived directly from the star in the PUP logo. Used for highlights, active navigation indicators, important badges, call-to-action emphasis, and any element that needs to stand out against a maroon or dark surface. It is never used as a background for large surfaces — only as an accent.

**Light Mode Base — White** `#FFFFFF`
The background color for all screens, cards, and surfaces in light mode. Pure white is used rather than off-white to create maximum contrast against maroon and to keep the UI clean and legible.

**Dark Mode Base — Black** `#0A0A0A`
The background color for all screens and surfaces in dark mode. Near-black rather than pure black to reduce eye strain while maintaining the deep, authoritative feel that complements the maroon and gold palette.

All semantic states — success, error, warning, informational — are expressed using maroon, deep maroon, golden yellow, and white or black tints rather than introducing external colors like green, red, or blue. For example, a denied check-in is communicated through a deep maroon badge with white text and a golden yellow icon rather than a red alert. A successful check-in uses a golden yellow badge with deep maroon text.

### Typography
The system uses a two-font pairing. A serif display font is used for headings and the app name to convey the academic and institutional character of PUP. A clean, readable sans-serif is used for all body text, labels, form fields, and data tables. Both fonts are loaded via Google Fonts and consistent across web and mobile.

### Component Design Language
All UI components — buttons, cards, form inputs, modals, badges, and navigation — follow a consistent visual language across both the web dashboard and the mobile app. The web uses shadcn/ui as the component base, configured with the PUP color tokens. The mobile uses react-native-reusables, which is a React Native port of shadcn/ui, configured with the same tokens through NativeWind. This means a badge on the web and a badge on mobile look and behave identically, just adapted to their rendering environment.

Buttons use maroon as the primary action color with white text, with golden yellow used as the accent border or icon emphasis. Status badges stay strictly within the palette — golden yellow with deep maroon text for Present, maroon with white text for Late, deep maroon with a golden yellow border for Absent, and a white badge with maroon text for Pending. Navigation uses a maroon background with white text and a golden yellow active indicator underline. Cards use a white background in light mode and a deep maroon surface in dark mode, with a maroon or golden yellow left-border accent for emphasis.

### Mobile-Specific Design Considerations
The mobile app uses NativeWind to apply Tailwind-compatible utility classes to React Native components, ensuring the same design tokens drive styling across both platforms. The QR scanner screen uses a full-screen camera view with a maroon overlay frame and a gold alignment guide to make the scan experience feel intentional and on-brand rather than generic. The digital student ID card is styled as a physical ID card with the PUP maroon header, the student's photo, and the PUP logo, giving it a sense of official authority.

### Dark Mode
Both the web dashboard and the mobile app support dark mode. In dark mode, black is the base background, deep maroon is used for surface layers and cards, golden yellow retains its role as the sole accent, and all text switches to white. Maroon is still used for interactive elements and navigation. The dark mode palette is a natural extension of the PUP brand — the official logo itself is a golden star on a dark maroon background, so the dark mode of this system is essentially the logo made into a UI.

---

## Data and Privacy

All attendance records are stored with full audit information — who checked in, from which device, at what GPS coordinates, at what time, and whether it was approved or denied. This data is accessible only to authorized roles as defined by Supabase RLS. Students see only their own records. Teachers see only records for their subjects. Super Admins see all records within their authorized scope.

GPS coordinates submitted during check-in are stored for audit and anomaly detection purposes. Students are informed of this at onboarding and must consent. Device fingerprints are stored securely and used only for session binding and anti-cheat validation.

---

## System Boundaries and Exclusions (v1)

The following are explicitly out of scope for v1 and documented as v2 features: device binding via device fingerprint, biometric gate before QR scanning, OS-level device integrity attestation (Android SafetyNet and Apple DeviceCheck). These are the next anti-cheat layers after the v1 stack is proven stable.

Also out of scope for v1: integration with PUP's existing student information system, automated class excuse or leave request workflows, and push notification infrastructure for schedule reminders. These are noted for future planning but will not be built in v1.

---

*Prepared based on project discussions — Cayla, June 2026*