import {
  classifyAttendanceSyncError,
  createSimulatedNetworkOutage,
  getRecentCampusDateRange,
  haversineDistance,
  isOutageArmed,
  isWithinGeofence,
  signQRToken,
  verifyQRToken,
  hashMeetingPin,
  type User,
  type Subject,
  type Section,
  type Session,
  type AttendanceRecord,
  type AttendanceSummary,
  type AttendanceStatus,
  type EditableAttendanceStatus,
  type ResolvableAttendanceStatus,
  type Student,
  type Teacher,
  type Enrollment,
  type StudentDisputeReason,
  type SectionRole,
  type SectionRoleType,
  type SessionPermission,
  type ProofOfClass,
  type CalendarEvent,
  type CreateSubjectInput,
  type CreateSectionInput,
  type CreateSessionInput,
  type SubmitAttendanceResult,
  type EnrollStudentInput,
  type BulkSessionInput,
  type CreateTeacherInput,
  type CreateStudentInput,
  type ResetUserPasswordResult,
  type ScanEvidenceInput,
  type AttendanceReport,
  type AttendanceReportFilters,
  type DashboardOverview,
  type ApiClient,
  type PrivacyNotice,
  type AuditLogFilters,
  type AuditLogPage,
  type StudentImportRequest,
  type StudentImportResult,
  type ImportJobStatus,
  type EnrollImportRequest,
  type EnrollImportResult,
  type EnrollImportRow,
  type AdminOverview,
  type AdminUserFilters,
  type AdminUserPage,
  type AssignableRole,
  type CreateAdminInput,
  type ServerStatusSnapshot,
  type UpdateUserInput,
  type AiCapabilities,
  type AiChatSendInput,
  type AiChatSendResult,
  type AiChatThread,
  type AiThreadSummary,
  type AttendanceStanding,
  type AppNotification,
  type NotificationReadInput,
  type PushTokenInput,
  type StudentAtRisk,
  type AtRiskReferral,
  type ReferralStatus,
  type ExcuseDecision,
  type ExcuseReason,
  type CreateTeacherResult,
  type CreateStudentResult,
  type TeacherResetStudentPasswordResult,
  type EmergencyDeviceReleaseInput,
  type EmergencyDeviceReleaseResult,
  type UnregisterDeviceResult,
  type UpdateContactsInput,
  type SystemReport,
  type SystemReportFilters,
  type SystemReportPage,
  type SystemReportStats,
  type CreateSystemReportInput,
  type UpdateSystemReportStatusInput,
  type GenerateCheckpointQrInput,
  type TeacherActivationLocation,
  type MaintenanceStatus,
  type ScanAttemptView,
  type RecordTimeline,
  type LedgerVerifyResult,
  type PrivacyCenterSnapshot,
} from "@polycheck/shared";
import {
  getOrCreateTeacherSigningKey,
  isSigningKeyProvisioned,
  markSigningKeyProvisioned,
} from "./signing-key";
import { API_BASE } from "./api-config";
import { getOrCreateWebInstallationId } from "./device-id";
import {
  cacheAttendanceRecords,
  cacheRoster,
  cacheSections,
  cacheSessions,
  cacheSubjects,
  drainOfflineQueue,
  enqueueOfflineOperation,
  getCachedAttendanceForSession,
  getCachedAttendanceRecords,
  getCachedRoster,
  getCachedSection,
  getCachedSections,
  getCachedSession,
  getCachedSessions,
  getCachedSubjects,
  getEnrolledSectionIds,
  getPendingSyncCount,
  getServerClockOffset,
  initializeOfflineStore,
  persistOfflineStorage,
  removeCachedAttendanceAttempt,
  removeCachedRecord,
  replaceCachedAttendanceForStudent,
  setEnrolledSectionIds,
  setOfflineOwner,
  setServerClockOffset,
  wipeOfflineStore,
} from "./offline/store";
import type { OfflineOperationKind } from "./offline/db";
import { clearApiCache } from "./pwa/register-sw";

const STORAGE_KEY = "polycheck-user";
const REQUEST_TIMEOUT_MS = 15_000;
const EXPORT_TIMEOUT_MS = 30_000;

/**
 * Mirrors the backend web scan policy (`MAX_WEB_LOCATION_ACCURACY_METERS`).
 * The older 50 m client cap silently rejected every indoor scan the server
 * would have accepted.
 */
const WEB_MAX_LOCATION_ACCURACY_METERS = 500;

/** Shown before a user-initiated logout would discard unsynced check-ins. */
export function formatPendingQueueLogoutWarning(pendingCount: number): string {
  return pendingCount === 1
    ? "1 check-in has not been synced to the server. Sign out and discard it?"
    : `${pendingCount} check-ins have not been synced to the server. Sign out and discard them?`;
}

export interface LogoutOptions {
  armDeviceCooldown?: boolean;
  /**
   * Set only after the user explicitly confirmed discarding unsynced evidence.
   * Ignored for programmatic termination (`armDeviceCooldown: false`), which
   * always keeps the queue so the next login can drain it.
   */
  discardOfflineQueue?: boolean;
}

export interface LogoutOutcome {
  /** False only when a caller-supplied confirm declined the logout. */
  loggedOut: boolean;
  pendingSyncCount: number;
  /** True when unsynced queue rows and their keys survived the logout. */
  queuePreserved: boolean;
}

export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly remainingMinutes?: number,
    readonly distanceMeters?: number,
    readonly allowedDistanceMeters?: number,
    readonly canRequestOverride?: boolean,
    readonly estimatedEnd?: string,
    readonly remainingSeconds?: number,
    readonly activeDeviceKind?: "mobile" | "web" | null,
    readonly activeSessionLastActiveAt?: string,
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

export function isAuthRejection(error: unknown): error is ApiHttpError {
  return (
    error instanceof ApiHttpError &&
    (error.status === 401 || error.status === 403)
  );
}

function loadUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function saveUser(user: User | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage may be blocked; in-memory auth state is still authoritative. */
  }
  try {
    // Auth consumers must be notified even when privacy settings or a storage
    // quota error prevented persistence. In particular, a 401 must immediately
    // unmount protected content based on the in-memory currentUser value.
    window.dispatchEvent(new Event("polycheck-auth-changed"));
  } catch {
    /* A non-browser test shim may not implement dispatchEvent. */
  }
}

let currentUser: User | null = loadUser();

// `auth:session-replaced` is broadcast to the whole user room, including the
// browser that just performed the replacement login — and the WebSocket event
// can beat the login's own HTTP response on the wire (so a probe fired too
// early would still carry the pre-login cookie). Only an in-flight login
// mutes the monitor's destructive path; once the login response completed the
// fresh cookie is applied and a probe is authoritative.
let loginStartedAt = 0;

function noteLoginStarted() {
  loginStartedAt = Date.now();
}

function clearLoginInFlight() {
  loginStartedAt = 0;
}

export function isOwnLoginInFlight(now = Date.now()): boolean {
  return loginStartedAt > 0 && now - loginStartedAt < 30_000;
}

function recentDateRange(days = 30) {
  return getRecentCampusDateRange(days);
}

function queryPath(
  path: string,
  values: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function authHeaders(): Promise<Record<string, string>> {
  return { "Content-Type": "application/json" };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  // F7 outage simulator killswitch — every request path begins here.
  if (isOutageArmed()) throw createSimulatedNetworkOutage();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal;
  const forwardAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    if (res.status === 401) {
      currentUser = null;
      saveUser(null);
    }
    const message = Array.isArray(err.message)
      ? err.message.join(". ")
      : err.message;
    const code = typeof err.code === "string" ? err.code : undefined;
    const remainingMinutes =
      typeof err.remainingMinutes === "number"
        ? err.remainingMinutes
        : undefined;
    const distanceMeters =
      typeof err.distanceMeters === "number" ? err.distanceMeters : undefined;
    const allowedDistanceMeters =
      typeof err.allowedDistanceMeters === "number"
        ? err.allowedDistanceMeters
        : undefined;
    const canRequestOverride =
      typeof err.canRequestOverride === "boolean"
        ? err.canRequestOverride
        : undefined;
    const estimatedEnd =
      typeof err.estimatedEnd === "string" ? err.estimatedEnd : undefined;
    const remainingSeconds =
      typeof err.remainingSeconds === "number"
        ? err.remainingSeconds
        : undefined;
    const activeDeviceKind =
      err.activeDeviceKind === "mobile" || err.activeDeviceKind === "web"
        ? err.activeDeviceKind
        : err.activeDeviceKind === null
          ? null
          : undefined;
    const activeSessionLastActiveAt =
      typeof err.activeSessionLastActiveAt === "string"
        ? err.activeSessionLastActiveAt
        : undefined;
    // Maintenance is a cross-cutting state, not a page-local error: publish it
    // before throwing so the global overlay can render even when the caller
    // catches and ignores the failure.
    if (
      res.status === 503 &&
      code === "system_maintenance" &&
      typeof window !== "undefined"
    ) {
      try {
        window.dispatchEvent(
          new CustomEvent("polycheck-maintenance", {
            detail: { message: message || "", estimatedEnd },
          }),
        );
      } catch {
        /* dispatchEvent may be unavailable in non-browser test shims */
      }
    }
    throw new ApiHttpError(
      message || "Request failed",
      res.status,
      code,
      remainingMinutes,
      distanceMeters,
      allowedDistanceMeters,
      canRequestOverride,
      estimatedEnd,
      remainingSeconds,
      activeDeviceKind,
      activeSessionLastActiveAt,
    );
  }
  return res.json();
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    headers: await authHeaders(),
    credentials: "include",
    signal,
  });
  return handleResponse<T>(res);
}

async function post<T>(
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(await authHeaders()),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

async function patch<T>(
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      ...(await authHeaders()),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: await authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

async function del<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: await authHeaders(),
  });
  return handleResponse<T>(res);
}

export function isNetworkFailure(error: unknown): boolean {
  // Typed API errors are authoritative server answers; anything else (abort,
  // DNS, CORS, offline) is a connectivity failure that may fall back to cache.
  if (error instanceof ApiHttpError) return error.status >= 500;
  return true;
}

async function trustedNow(): Promise<number> {
  const offset = await getServerClockOffset().catch(() => null);
  return Date.now() + (offset ?? 0);
}

/**
 * The public key persists server-side and provisioning is rate limited, so
 * upload it only once per browser/account. A key that already matches the
 * cached session is known to the server, enabling fully offline QR use.
 */
async function ensureTeacherSigningKeyProvisioned(
  user: User,
  session: Session,
  key: { publicKey: string },
  force = false,
): Promise<void> {
  if (!force) {
    if (session.teacherPublicKey && session.teacherPublicKey === key.publicKey) {
      await markSigningKeyProvisioned(user.id);
      return;
    }
    if (await isSigningKeyProvisioned(user.id)) return;
  }
  try {
    await post("/auth/provision-key", { publicKey: key.publicKey });
    await markSigningKeyProvisioned(user.id);
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    // Typed 4xx on purpose: callers' offline-activation catch treats
    // network-shaped failures as "activate locally", but an unprovisioned
    // signing key would make every queued scan fail server-side verification.
    // This precondition must fail closed.
    throw new ApiHttpError(
      "Connect to the internet once to register this device before generating offline QR codes.",
      400,
    );
  }
}

const RECEIPT_POLL_ATTEMPTS = 4;
const RECEIPT_POLL_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Authenticated assistant file download (AI1). Uses the same cookie session and
 * timeout as the CSV export path and surfaces the server's message on failure.
 */
export async function downloadAssistantFile(
  downloadPath: string,
): Promise<Blob> {
  const res = await fetchWithTimeout(
    `${API_BASE}${downloadPath}`,
    { headers: await authHeaders(), credentials: "include" },
    EXPORT_TIMEOUT_MS,
  );
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      Array.isArray(error.message)
        ? error.message.join(". ")
        : error.message || "Download failed",
    );
  }
  return res.blob();
}

/**
 * Signs the browser out and reports what happened to the offline queue. Queued
 * evidence is never destroyed silently: rows survive unless the user explicitly
 * confirmed discarding them, and programmatic termination (a replaced/revoked
 * session) always preserves them so the next login can drain.
 */
async function performLogout(options: LogoutOptions): Promise<{
  pendingSyncCount: number;
  queuePreserved: boolean;
}> {
  const armDeviceCooldown = options.armDeviceCooldown !== false;
  // An unknown queue state counts as "may hold evidence": fail closed.
  let pendingSyncCount = 0;
  let queueStateKnown = true;
  try {
    pendingSyncCount = await getPendingSyncCount();
  } catch (error) {
    queueStateKnown = false;
    console.warn(
      "[offline] Pending check-ins could not be read; preserving the offline queue on logout.",
      error,
    );
  }
  const queuePreserved =
    !armDeviceCooldown ||
    !queueStateKnown ||
    (pendingSyncCount > 0 && options.discardOfflineQueue !== true);

  currentUser = null;
  saveUser(null);
  if (queuePreserved) {
    // Release the in-memory owner so this signed-out tab cannot read the
    // encrypted caches; the rows and their keys stay for the next login.
    setOfflineOwner(null);
  } else {
    await wipeOfflineStore().catch((error: unknown) => {
      console.warn("[offline] Offline storage wipe failed during logout.", error);
    });
  }
  // The Cache API ignores the session cookie, so a cached API body would be
  // served to the next account on this browser.
  await clearApiCache();
  try {
    await fetchWithTimeout(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        armDeviceCooldown
          ? {
              deviceId: getOrCreateWebInstallationId(),
              armDeviceCooldown: true,
            }
          : { armDeviceCooldown: false },
      ),
    });
  } catch {
    /* Local logout still succeeds when the server is unavailable. */
  }
  return { pendingSyncCount, queuePreserved };
}

const apiBase = {
  getPrivacyNotice(): Promise<PrivacyNotice> {
    return get("/auth/privacy-notice");
  },

  async acceptPrivacyConsent(version: string): Promise<User> {
    const user = await post<User>("/auth/privacy-consent", { version });
    currentUser = user;
    saveUser(user);
    return user;
  },

  async loginStudent(
    studentId: string,
    password?: string,
  ): Promise<User | null> {
    noteLoginStarted();
    try {
      const res = await fetchWithTimeout(`${API_BASE}/auth/login/student`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          password: password ?? "",
          deviceId: getOrCreateWebInstallationId(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Login failed" }));
        const msg = Array.isArray(err.message)
          ? err.message.join(". ")
          : err.message || "Login failed";
        const code = typeof err.code === "string" ? err.code : undefined;
        const estimatedEnd =
          typeof err.estimatedEnd === "string" ? err.estimatedEnd : undefined;
        const remainingMinutes =
          typeof err.remainingMinutes === "number"
            ? err.remainingMinutes
            : undefined;
        const remainingSeconds =
          typeof err.remainingSeconds === "number"
            ? err.remainingSeconds
            : undefined;
        const activeDeviceKind =
          err.activeDeviceKind === "mobile" || err.activeDeviceKind === "web"
            ? err.activeDeviceKind
            : err.activeDeviceKind === null
              ? null
              : undefined;
        const activeSessionLastActiveAt =
          typeof err.activeSessionLastActiveAt === "string"
            ? err.activeSessionLastActiveAt
            : undefined;
        throw new ApiHttpError(
          msg,
          res.status,
          code,
          remainingMinutes,
          undefined,
          undefined,
          undefined,
          estimatedEnd,
          remainingSeconds,
          activeDeviceKind,
          activeSessionLastActiveAt,
        );
      }
      const data = await res.json();
      currentUser = data.user as User;
      saveUser(currentUser);
      // Account switch: drop any API body a previous account left in the
      // service-worker cache before this session starts reading.
      void clearApiCache();
      void initializeOfflineStore(currentUser.id).catch(() => undefined);
      return currentUser;
    } finally {
      // Covers success, rejected credentials, and network failures alike: the
      // in-flight stamp only exists to shield the pre-cookie wire race while
      // the login response is still travelling.
      clearLoginInFlight();
    }
  },

  async loginFaculty(email: string, password?: string): Promise<User | null> {
    noteLoginStarted();
    try {
      const res = await fetchWithTimeout(`${API_BASE}/auth/login/faculty`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: password ?? "" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Login failed" }));
        const msg = Array.isArray(err.message)
          ? err.message.join(". ")
          : err.message || "Login failed";
        const code = typeof err.code === "string" ? err.code : undefined;
        const estimatedEnd =
          typeof err.estimatedEnd === "string" ? err.estimatedEnd : undefined;
        throw new ApiHttpError(
          msg,
          res.status,
          code,
          undefined,
          undefined,
          undefined,
          undefined,
          estimatedEnd,
        );
      }
      const data = await res.json();
      currentUser = data.user as User;
      saveUser(currentUser);
      // Account switch: drop any API body a previous account left in the
      // service-worker cache before this session starts reading.
      void clearApiCache();
      void initializeOfflineStore(currentUser.id).catch(() => undefined);
      return currentUser;
    } finally {
      clearLoginInFlight();
    }
  },

  /**
   * Signs the browser out. The shared client contract types this as
   * `Promise<void>`; callers that need the queue outcome use
   * `requestUserLogout()`, which asks before discarding unsynced evidence.
   */
  async logout(options: LogoutOptions = {}): Promise<void> {
    await performLogout(options);
  },

  /**
   * Unsynced check-in count for the blocking logout confirmation. Degrades to
   * 0 (with a log) when IndexedDB is unavailable; `logout()` still preserves
   * the queue in that case because it re-reads the store and fails closed.
   */
  async pendingOfflineSyncCount(): Promise<number> {
    try {
      return await getPendingSyncCount();
    } catch (error) {
      console.warn(
        "[offline] Pending check-ins could not be read; treating as none.",
        error,
      );
      return 0;
    }
  },

  getCurrentUser(): User | null {
    if (!currentUser) currentUser = loadUser();
    return currentUser;
  },

  hasCurrentUser(): boolean {
    return currentUser !== null;
  },

  async getTrustedTimestamp(): Promise<string> {
    return new Date(await trustedNow()).toISOString();
  },

  async refreshServerClockOffset(): Promise<void> {
    try {
      const startedAt = Date.now();
      const health = await get<{ timestamp: string }>("/health");
      const completedAt = Date.now();
      const serverTime = new Date(health.timestamp).getTime();
      if (Number.isFinite(serverTime)) {
        await setServerClockOffset(serverTime - (startedAt + completedAt) / 2);
      }
    } catch {
      // Offline: the last cached offset remains valid for seven days.
    }
  },

  async restoreSession(): Promise<User | null> {
    const cached = loadUser();
    if (
      typeof navigator !== "undefined" &&
      navigator.onLine === false &&
      cached
    ) {
      currentUser = cached;
      void initializeOfflineStore(cached.id).catch(() => undefined);
      return cached;
    }
    try {
      currentUser = await get<User>("/auth/me");
      saveUser(currentUser);
      // Account switch: drop any API body a previous account left in the
      // service-worker cache before this session starts reading.
      void clearApiCache();
      void initializeOfflineStore(currentUser.id).catch(() => undefined);
      return currentUser;
    } catch (error) {
      if (isAuthRejection(error)) {
        currentUser = null;
        saveUser(null);
        setOfflineOwner(null);
        return null;
      }
      throw error;
    }
  },

  async changePassword(
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<User> {
    const updated = await post<User>("/auth/change-password", {
      ...(currentPassword ? { currentPassword } : {}),
      newPassword,
    });
    currentUser = updated;
    saveUser(updated);
    return updated;
  },

  // ── Subjects ──
  async getSubjects(): Promise<Subject[]> {
    try {
      const subjects = await get<Subject[]>("/subjects");
      await cacheSubjects(subjects).catch(() => undefined);
      return subjects;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return getCachedSubjects();
    }
  },
  getSubject(id: string): Promise<Subject> {
    return get(`/subjects/${id}`);
  },
  createSubject(data: CreateSubjectInput): Promise<Subject> {
    return post("/subjects", data);
  },

  // ── Sections ──
  async getSections(subjectId?: string): Promise<Section[]> {
    try {
      const sections = await get<Section[]>(
        `/sections${subjectId ? `?subjectId=${subjectId}` : ""}`,
      );
      await cacheSections(sections).catch(() => undefined);
      return sections;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedSections();
      return subjectId
        ? cached.filter((section) => section.subjectId === subjectId)
        : cached;
    }
  },
  async getSection(id: string): Promise<Section> {
    try {
      const section = await get<Section>(`/sections/${id}`);
      await cacheSections([section]).catch(() => undefined);
      return section;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedSection(id);
      if (!cached)
        throw new Error("Section is not available offline. Sync before class.");
      return cached;
    }
  },
  createSection(data: CreateSectionInput): Promise<Section> {
    return post("/sections", data);
  },
  async getSectionStudents(
    sectionId: string,
  ): Promise<
    (Student & {
      attendance: {
        present: number;
        late: number;
        absent: number;
        disputed: number;
      };
    })[]
  > {
    try {
      const students = await get<
        (Student & {
          attendance: {
            present: number;
            late: number;
            absent: number;
            disputed: number;
          };
        })[]
      >(`/sections/${sectionId}/students`);
      await cacheRoster(sectionId, students).catch(() => undefined);
      return students;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedRoster(sectionId);
      return cached.map((student) => ({
        ...student,
        attendance: { present: 0, late: 0, absent: 0, disputed: 0 },
      }));
    }
  },
  async getStudentsForSection(sectionId: string): Promise<Student[]> {
    try {
      const students = await get<Student[]>(`/sections/${sectionId}/students`);
      await cacheRoster(sectionId, students).catch(() => undefined);
      return students;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return getCachedRoster(sectionId);
    }
  },
  async getStudentSections(studentId: string): Promise<Section[]> {
    // `/sections` is role-scoped server-side; the argument stays for the
    // shared ApiClient contract.
    void studentId;
    try {
      const sections = await get<Section[]>("/sections");
      await cacheSections(sections).catch(() => undefined);
      await setEnrolledSectionIds(sections.map((section) => section.id)).catch(
        () => undefined,
      );
      return sections;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const sectionIds = await getEnrolledSectionIds();
      const cached = await getCachedSections();
      return cached.filter((section) => sectionIds.includes(section.id));
    }
  },
  resetEnrollmentCode(sectionId: string): Promise<{ enrollmentCode: string }> {
    return post(`/sections/${sectionId}/enrollment-code/reset`);
  },
  disableEnrollmentCode(sectionId: string): Promise<void> {
    return post(`/sections/${sectionId}/enrollment-code/disable`);
  },
  removeStudentFromSection(
    sectionId: string,
    studentId: string,
  ): Promise<boolean> {
    return del(`/sections/${sectionId}/students/${studentId}`);
  },
  getEnrollments(sectionId?: string): Promise<Enrollment[]> {
    return sectionId
      ? get(`/sections/${sectionId}/enrollments`)
      : get("/enrollments");
  },
  enrollByCode(enrollmentCode: string): Promise<Enrollment> {
    return post("/sections/enroll-by-code", { enrollmentCode });
  },

  // ── Sessions ──
  async getSessions(sectionId?: string): Promise<Session[]> {
    try {
      const sessions = await get<Session[]>(
        `/sessions${sectionId ? `?sectionId=${sectionId}` : ""}`,
      );
      await cacheSessions(sessions).catch(() => undefined);
      return sessions;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return getCachedSessions(sectionId);
    }
  },
  async getSession(id: string): Promise<Session> {
    try {
      const session = await get<Session>(`/sessions/${id}`);
      await cacheSessions([session]).catch(() => undefined);
      return session;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedSession(id);
      if (!cached)
        throw new Error("Session is not available offline. Sync before class.");
      return cached;
    }
  },
  createSession(data: CreateSessionInput): Promise<Session> {
    const { teacherId, ...body } = data;
    void teacherId;
    return post("/sessions", body);
  },
  async generateQrCode(
    sessionId: string,
    validityMinutes: number,
    gracePeriodMinutes?: number,
    teacherLocation?: TeacherActivationLocation,
  ): Promise<Session> {
    if (
      validityMinutes < 1 ||
      validityMinutes > 15 ||
      (gracePeriodMinutes ?? 0) > 60
    ) {
      throw new Error(
        "QR validity must be 1-15 minutes and grace must be 0-60 minutes",
      );
    }
    const user = this.getCurrentUser();
    if (!user || user.role !== "teacher")
      throw new Error("A teacher account is required to sign QR tokens");
    const [session, key] = await Promise.all([
      this.getSession(sessionId),
      getOrCreateTeacherSigningKey(user.id),
    ]);
    const effectiveGrace =
      gracePeriodMinutes ?? Math.min(session.gracePeriodMinutes, 60);
    if (effectiveGrace < 0 || effectiveGrace > 60)
      throw new Error("QR grace must be 0-60 minutes");
    const issuedAt = await trustedNow();
    const token = signQRToken(
      {
        version: 1,
        sessionId: session.id,
        sectionId: session.sectionId,
        teacherId: user.id,
        teacherName: user.fullName,
        issuedAt,
        validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        mode: "in_person",
        pinRequired: false,
      },
      key.secretKey,
    );
    try {
      await ensureTeacherSigningKeyProvisioned(user, session, key);
      const activated = await post<Session>(`/sessions/${sessionId}/activate`, {
        validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        token,
        // V4 anti-ghost-professor evidence; absent fix keeps today's behavior.
        ...(teacherLocation?.latitude !== undefined &&
        teacherLocation?.longitude !== undefined
          ? {
              latitude: teacherLocation.latitude,
              longitude: teacherLocation.longitude,
              ...(teacherLocation.override
                ? { overrideTeacherLocation: true }
                : {}),
            }
          : {}),
      });
      await cacheSessions([activated]).catch(() => undefined);
      return activated;
    } catch (error) {
      if (
        error instanceof ApiHttpError &&
        (error.message.includes("signature is invalid") ||
          error.message.includes("signing key"))
      ) {
        await ensureTeacherSigningKeyProvisioned(user, session, key, true);
        const retried = await post<Session>(`/sessions/${sessionId}/activate`, {
          validityMinutes,
          gracePeriodMinutes: effectiveGrace,
          token,
          ...(teacherLocation?.latitude !== undefined &&
          teacherLocation?.longitude !== undefined
            ? {
                latitude: teacherLocation.latitude,
                longitude: teacherLocation.longitude,
                ...(teacherLocation.override
                  ? { overrideTeacherLocation: true }
                  : {}),
              }
            : {}),
        });
        await cacheSessions([retried]).catch(() => undefined);
        return retried;
      }
      if (!isNetworkFailure(error)) throw error;
      const activated: Session = {
        ...session,
        isActive: true,
        qrToken: token,
        qrGeneratedAt: new Date(issuedAt).toISOString(),
        qrTokenExpiresAt: new Date(
          issuedAt + validityMinutes * 60_000,
        ).toISOString(),
        qrValidityMinutes: validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        teacherPublicKey: key.publicKey,
      };
      await enqueueOfflineOperation("session_activation", {
        sessionId,
        validityMinutes,
        gracePeriodMinutes: effectiveGrace,
        token,
      });
      await cacheSessions([activated]).catch(() => undefined);
      return activated;
    }
  },
  async generateCheckpointQrCode(
    input: GenerateCheckpointQrInput,
  ): Promise<Session> {
    const {
      sessionId,
      checkpoint,
      validitySeconds,
      graceMinutes,
      pin,
      regenerate,
    } = input;
    if (
      !Number.isInteger(validitySeconds) ||
      validitySeconds < 60 ||
      validitySeconds > 300
    ) {
      throw new Error("Checkpoint QR validity must be 60-300 seconds");
    }
    const effectiveGrace = checkpoint === "start" ? (graceMinutes ?? 10) : 0;
    if (checkpoint === "start" && (effectiveGrace < 0 || effectiveGrace > 60)) {
      throw new Error("Check-in grace must be 0-60 minutes");
    }
    const user = this.getCurrentUser();
    if (!user || user.role !== "teacher")
      throw new Error("A teacher account is required to sign QR tokens");
    const [session, key] = await Promise.all([
      this.getSession(sessionId),
      getOrCreateTeacherSigningKey(user.id),
    ]);
    if (session.mode !== "online") {
      throw new Error(
        "Start/end checkpoint QR codes are only available for online sessions",
      );
    }
    const pinRequired = typeof pin === "string" && pin.length > 0;
    const pinHash = pinRequired
      ? (await hashMeetingPin(pin)).serialized
      : undefined;
    const issuedAt = await trustedNow();
    const token = signQRToken(
      {
        version: 1,
        sessionId: session.id,
        sectionId: session.sectionId,
        teacherId: user.id,
        teacherName: user.fullName,
        issuedAt,
        validityMinutes: Math.ceil(validitySeconds / 60),
        gracePeriodMinutes: effectiveGrace,
        mode: "online",
        checkpoint,
        pinRequired,
        ...(pinHash ? { pinHash } : {}),
        validitySeconds,
      },
      key.secretKey,
    );
    const activatedAtIso = new Date(issuedAt).toISOString();
    const expiresAtIso = new Date(
      issuedAt + validitySeconds * 1000,
    ).toISOString();
    try {
      await ensureTeacherSigningKeyProvisioned(user, session, key);
      const activated = await post<Session>(`/sessions/${sessionId}/activate`, {
        checkpoint,
        validitySeconds,
        ...(checkpoint === "start"
          ? { gracePeriodMinutes: effectiveGrace }
          : {}),
        ...(regenerate ? { regenerate: true } : {}),
        token,
      });
      await cacheSessions([activated]).catch(() => undefined);
      return activated;
    } catch (error) {
      if (
        error instanceof ApiHttpError &&
        (error.message.includes("signature is invalid") ||
          error.message.includes("signing key"))
      ) {
        await ensureTeacherSigningKeyProvisioned(user, session, key, true);
        const retried = await post<Session>(`/sessions/${sessionId}/activate`, {
          checkpoint,
          validitySeconds,
          ...(checkpoint === "start"
            ? { gracePeriodMinutes: effectiveGrace }
            : {}),
          ...(regenerate ? { regenerate: true } : {}),
          token,
        });
        await cacheSessions([retried]).catch(() => undefined);
        return retried;
      }
      if (!isNetworkFailure(error)) throw error;
      const activated: Session = {
        ...session,
        isActive: true,
        teacherPublicKey: key.publicKey,
        pinRequired: session.pinRequired || pinRequired,
        ...(checkpoint === "start"
          ? {
              startQrToken: token,
              startQrGeneratedAt: activatedAtIso,
              startTokenExpiresAt: expiresAtIso,
              startQrValiditySeconds: validitySeconds,
              startGraceMinutes: effectiveGrace,
            }
          : {
              endQrToken: token,
              endQrGeneratedAt: activatedAtIso,
              endTokenExpiresAt: expiresAtIso,
              endQrValiditySeconds: validitySeconds,
              endGraceMinutes: 0,
            }),
      };
      await enqueueOfflineOperation("session_activation", {
        sessionId,
        checkpoint,
        validitySeconds,
        gracePeriodMinutes: effectiveGrace,
        regenerate: regenerate ?? false,
        token,
      });
      await cacheSessions([activated]).catch(() => undefined);
      return activated;
    }
  },
  async endSession(sessionId: string): Promise<Session> {
    try {
      const ended = await post<Session>(`/sessions/${sessionId}/end`);
      await cacheSessions([ended]).catch(() => undefined);
      return ended;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const session = await getCachedSession(sessionId);
      if (!session) throw new Error("Session is not available offline");
      const ended = {
        ...session,
        isActive: false,
        endedAt: new Date(await trustedNow()).toISOString(),
      };
      await enqueueOfflineOperation("session_end", { sessionId });
      await cacheSessions([ended]).catch(() => undefined);
      return ended;
    }
  },
  getSectionSessions(sectionId: string): Promise<Session[]> {
    return this.getSessions(sectionId);
  },

  // ── Attendance ──
  async getAttendanceRecords(
    sessionId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AttendanceRecord[]> {
    const scope = sessionId
      ? { sessionId, limit: 1000 }
      : startDate && endDate
        ? { startDate, endDate, limit: 1000 }
        : { ...recentDateRange(31), limit: 1000 };
    try {
      const records = await get<AttendanceRecord[]>(
        queryPath("/attendance", scope),
      );
      await cacheAttendanceRecords(records).catch(() => undefined);
      return records;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      if (sessionId) return getCachedAttendanceForSession(sessionId);
      const cached = await getCachedAttendanceRecords();
      return cached.sort(
        (left, right) =>
          new Date(right.timestamp).getTime() -
          new Date(left.timestamp).getTime(),
      );
    }
  },
  getAttendanceSummaries(teacherId?: string): Promise<AttendanceSummary[]> {
    return get(
      queryPath("/attendance/summaries", { ...recentDateRange(), teacherId }),
    );
  },
  getAttendanceReport(
    filters: AttendanceReportFilters = {},
  ): Promise<AttendanceReport> {
    return get(
      queryPath("/attendance/report", { ...recentDateRange(), ...filters }),
    );
  },
  getDashboardOverview(
    filters: Pick<AttendanceReportFilters, "startDate" | "endDate"> = {},
  ): Promise<DashboardOverview> {
    return get(queryPath("/dashboard/overview", filters));
  },
  getAdminOverview(): Promise<AdminOverview> {
    return get("/dashboard/admin-overview");
  },
  getServerStatus(): Promise<ServerStatusSnapshot> {
    return get("/dashboard/server-status");
  },
  async getAttendanceForStudent(
    studentId: string,
  ): Promise<AttendanceRecord[]> {
    try {
      const records = await get<AttendanceRecord[]>(
        `/attendance/student/${studentId}`,
      );
      await replaceCachedAttendanceForStudent(studentId, records).catch(
        () => undefined,
      );
      return records;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return getCachedAttendanceRecords(studentId);
    }
  },
  async getStudentAttendanceForSection(
    studentId: string,
    sectionId: string,
  ): Promise<AttendanceRecord[]> {
    try {
      const records = await get<AttendanceRecord[]>(
        `/attendance/student/${studentId}?sectionId=${sectionId}`,
      );
      await replaceCachedAttendanceForStudent(studentId, records).catch(
        () => undefined,
      );
      return records;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedAttendanceRecords(studentId);
      return cached.filter((record) => record.sectionId === sectionId);
    }
  },
  async addAttendanceRecord(
    record: Omit<AttendanceRecord, "status"> & {
      status: EditableAttendanceStatus;
    },
  ): Promise<AttendanceRecord> {
    const payload = {
      sessionId: record.sessionId,
      sectionId: record.sectionId,
      studentId: record.studentId,
      status: record.status,
    };
    try {
      const created = await post<AttendanceRecord>("/attendance", payload);
      await cacheAttendanceRecords([created]).catch(() => undefined);
      return created;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const optimistic: AttendanceRecord = {
        ...record,
        id: crypto.randomUUID(),
        isSynced: false,
        manuallySet: true,
      };
      await enqueueOfflineOperation("attendance_manual", {
        record: optimistic,
      });
      await cacheAttendanceRecords([optimistic]).catch(() => undefined);
      return optimistic;
    }
  },
  async updateAttendanceStatus(
    recordId: string,
    status: EditableAttendanceStatus,
  ): Promise<AttendanceRecord> {
    try {
      const updated = await patch<AttendanceRecord>(
        `/attendance/${recordId}/status`,
        { status },
      );
      await cacheAttendanceRecords([updated]).catch(() => undefined);
      return updated;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const cached = await getCachedAttendanceRecords();
      const existing = cached.find((record) => record.id === recordId);
      const optimistic: AttendanceRecord = {
        ...(existing ?? {
          id: recordId,
          sessionId: "",
          sectionId: "",
          studentId: "",
          studentName: "",
          timestamp: new Date().toISOString(),
          status,
          coordinates: { latitude: 0, longitude: 0 },
          deviceId: "offline-web",
        }),
        status,
        isSynced: false,
        manuallySet: true,
      };
      await enqueueOfflineOperation("attendance_status", {
        recordId,
        status,
        sessionId: optimistic.sessionId,
      });
      await cacheAttendanceRecords([optimistic]).catch(() => undefined);
      return optimistic;
    }
  },
  async submitScan(
    sessionId: string,
    studentId: string,
    studentName: string,
    lat: number | null,
    lon: number | null,
    deviceId: string,
    qrToken: string,
    scannedAt?: string,
    evidence?: ScanEvidenceInput,
    pin?: string,
  ): Promise<AttendanceRecord | { error: string }> {
    const payload = {
      sessionId,
      ...(lat !== null ? { lat } : {}),
      ...(lon !== null ? { lon } : {}),
      deviceId,
      qrToken,
      scannedAt: scannedAt ?? new Date().toISOString(),
      ...evidence,
      ...(pin ? { pin } : {}),
    };
    try {
      const result = await post<AttendanceRecord | { error: string }>(
        "/attendance/scan",
        payload,
      );
      if (!("error" in result))
        await cacheAttendanceRecords([result]).catch(() => undefined);
      return result;
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      if (!qrToken) return { error: "QR token is required" };
      const cachedSession = await getCachedSession(sessionId);
      // The cached `/health` offset is part of the offline contract: token
      // bounds are server-clock values and the raw device clock can be minutes
      // off, so a missing session/key/offset fails closed with the not-synced
      // message instead of reporting a misleading signature error.
      const clockOffset = await getServerClockOffset();
      if (
        !cachedSession ||
        !cachedSession.teacherPublicKey ||
        clockOffset === null
      ) {
        return {
          error:
            "Session security time and class data are not available offline. Sync before class.",
        };
      }
      const tokenPayload = verifyQRToken(qrToken, cachedSession.teacherPublicKey);
      if (!tokenPayload) return { error: "QR token signature is invalid" };
      const online = tokenPayload.mode === "online";
      const checkpoint = tokenPayload.checkpoint;
      const capturedAt = new Date(payload.scannedAt).getTime();
      // Server-clock view of the scan (null offsets already failed closed).
      const trustedCapturedAt = capturedAt + clockOffset;
      const validityMs =
        tokenPayload.validitySeconds !== undefined
          ? tokenPayload.validitySeconds * 1000
          : tokenPayload.validityMinutes * 60_000;
      const validityEnd = tokenPayload.issuedAt + validityMs;
      const graceEnd =
        validityEnd +
        (checkpoint === "end" ? 0 : tokenPayload.gracePeriodMinutes * 60_000);
      if (!online && evidence?.mocked === true)
        return { error: "Mocked locations are not accepted" };
      if (!online) {
        if (lat === null || lon === null || !cachedSession.geofence) {
          return { error: "Location is required for in-person attendance." };
        }
        const distance = haversineDistance(
          lat,
          lon,
          cachedSession.geofence.latitude,
          cachedSession.geofence.longitude,
        );
        if (distance > cachedSession.geofence.radiusMeters) {
          return {
            error: `You are outside the session geofence (${Math.round(distance)} m away, allowed ${cachedSession.geofence.radiusMeters} m).`,
          };
        }
        if (
          (evidence?.accuracyMeters ?? 0) > WEB_MAX_LOCATION_ACCURACY_METERS
        )
          return {
            error: "Location accuracy is too poor to verify attendance",
          };
        if (
          evidence?.locationCapturedAt &&
          Math.abs(
            capturedAt - new Date(evidence.locationCapturedAt).getTime(),
          ) >
            2 * 60_000
        ) {
          return {
            error:
              "Location fix is stale. Acquire a fresh location and try again.",
          };
        }
      }
      if (
        !Number.isFinite(capturedAt) ||
        trustedCapturedAt < tokenPayload.issuedAt - 30_000 ||
        trustedCapturedAt > graceEnd
      ) {
        return { error: "The QR attendance window has expired" };
      }
      const existing = await getCachedAttendanceForSession(sessionId);
      const alreadySaved = online
        ? existing.some(
            (record) =>
              record.studentId === studentId &&
              (checkpoint === "end"
                ? Boolean(record.checkOutTime)
                : Boolean(record.checkInTime)),
          )
        : existing.some((record) => record.studentId === studentId);
      if (alreadySaved) {
        return {
          error:
            "Attendance for this session was already saved on this device.",
        };
      }
      await enqueueOfflineOperation("attendance_scan", payload);
      // Matches the server: `capturedAt <= validityEnd ? present : late`, using
      // the offset-corrected capture time rather than the raw device clock.
      const legStatus: AttendanceStatus =
        trustedCapturedAt <= validityEnd ? "present" : "late";
      const record: AttendanceRecord = {
        id: online
          ? `offline:${sessionId}:${studentId}:${checkpoint ?? "start"}`
          : `offline:${sessionId}:${studentId}`,
        sessionId,
        sectionId: tokenPayload.sectionId,
        studentId,
        studentName,
        timestamp: payload.scannedAt,
        // Online rows stay pending between checkpoints until the session closes.
        status: online ? "pending" : legStatus,
        coordinates: online
          ? { latitude: null, longitude: null }
          : { latitude: lat, longitude: lon },
        deviceId,
        tokenSnapshot: qrToken,
        isSynced: false,
        ...(online
          ? checkpoint === "end"
            ? {
                checkOutTime: payload.scannedAt,
                checkOutStatus: "present" as const,
              }
            : { checkInTime: payload.scannedAt, checkInStatus: legStatus }
          : {}),
      };
      await cacheAttendanceRecords([record]).catch(() => undefined);
      return record;
    }
  },
  async checkAttendance(
    sessionId: string,
    studentId: string,
    lat: number | null,
    lon: number | null,
    qrToken?: string,
    scannedAt?: string,
    pin?: string,
  ): Promise<SubmitAttendanceResult> {
    void studentId;
    const payload = {
      sessionId,
      ...(lat !== null ? { lat } : {}),
      ...(lon !== null ? { lon } : {}),
      qrToken,
      scannedAt,
      ...(pin ? { pin } : {}),
    };
    try {
      return await post("/attendance/check", payload);
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      const session = await getCachedSession(sessionId);
      const clockOffset = await getServerClockOffset();
      if (
        !session ||
        !qrToken ||
        !session.teacherPublicKey ||
        clockOffset === null
      ) {
        return {
          success: false,
          status: "absent",
          reason: "not_synced",
          message:
            "Session security time and class data are not available offline. Sync before class.",
        };
      }
      const tokenPayload = verifyQRToken(qrToken, session.teacherPublicKey);
      if (
        !tokenPayload ||
        tokenPayload.sessionId !== session.id ||
        tokenPayload.sectionId !== session.sectionId ||
        tokenPayload.teacherId !== session.teacherId
      ) {
        return {
          success: false,
          status: "disputed",
          reason: "invalid_signature",
          message: "QR token signature is invalid",
        };
      }
      const online = tokenPayload.mode === "online";
      if (
        !online &&
        (lat === null ||
          lon === null ||
          !session.geofence ||
          !isWithinGeofence(
            lat,
            lon,
            session.geofence.latitude,
            session.geofence.longitude,
            session.geofence.radiusMeters,
          ))
      ) {
        return {
          success: false,
          status: "absent",
          reason: "outside_geofence",
          message: "You are outside the session geofence",
        };
      }
      // The device clock is only a capture source; window/endedAt/status
      // decisions all run on the `/health`-corrected time (a null offset
      // already failed closed as `not_synced` above).
      const capturedAt =
        new Date(scannedAt ?? Date.now()).getTime() + clockOffset;
      if (session.endedAt && capturedAt > new Date(session.endedAt).getTime())
        return {
          success: false,
          status: "absent",
          reason: "session_inactive",
          message: "Session was not active at scan time",
        };
      const validityMs =
        tokenPayload.validitySeconds !== undefined
          ? tokenPayload.validitySeconds * 1000
          : tokenPayload.validityMinutes * 60_000;
      const validityEnd = tokenPayload.issuedAt + validityMs;
      const graceEnd =
        validityEnd +
        (tokenPayload.checkpoint === "end"
          ? 0
          : tokenPayload.gracePeriodMinutes * 60_000);
      if (
        !Number.isFinite(capturedAt) ||
        capturedAt < tokenPayload.issuedAt - 30_000 ||
        capturedAt > graceEnd
      ) {
        return {
          success: false,
          status: "absent",
          reason: "qr_expired",
          message: "The QR attendance window has expired",
        };
      }
      await enqueueOfflineOperation("scan_attempt", payload);
      const status = capturedAt <= validityEnd ? "present" : "late";
      return {
        success: true,
        status,
        message:
          online && tokenPayload.checkpoint === "end"
            ? "Check-out saved offline and queued for sync."
            : status === "present"
              ? "Check-in saved offline and queued for sync."
              : "Late check-in saved offline and queued for sync.",
      };
    }
  },

  // ── Disputes ──
  getDisputedRecords(
    sessionId?: string,
    filters?: { search?: string; status?: "pending" | "resolved" | "all" },
  ): Promise<AttendanceRecord[]> {
    let path = "/disputes";
    const params = new URLSearchParams();
    if (sessionId) params.set("sessionId", sessionId);
    if (filters?.status && filters.status !== "all")
      params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    const qs = params.toString();
    if (qs) path += `?${qs}`;
    return get(path);
  },
  resolveDispute(
    recordId: string,
    resolution: "accept" | "reject" | "override",
    newStatus?: ResolvableAttendanceStatus,
  ): Promise<AttendanceRecord> {
    return post(`/disputes/${recordId}/resolve`, { resolution, newStatus });
  },
  submitDispute(data: {
    recordId: string;
    reason: StudentDisputeReason;
    description: string;
  }): Promise<AttendanceRecord> {
    return post("/disputes", data);
  },

  // ── Forensics (F8/F9) ──
  async getScanAttempts(sessionId?: string): Promise<ScanAttemptView[]> {
    const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return get(`/attendance/attempts${qs}`);
  },
  getRecordTimeline(recordId: string): Promise<RecordTimeline> {
    return get(`/attendance/records/${encodeURIComponent(recordId)}/timeline`);
  },
  async verifyLedger(): Promise<LedgerVerifyResult> {
    return post("/audit-logs/ledger/verify");
  },

  // ── Excuses (Wave 4) ──
  requestExcuse(
    recordId: string,
    input: { reason: ExcuseReason; description: string; evidenceData?: string },
  ): Promise<AttendanceRecord> {
    return post(
      `/attendance/records/${encodeURIComponent(recordId)}/excuse`,
      input,
    );
  },
  listExcuses(
    filters: {
      status?: "requested" | "approved" | "rejected";
      sectionId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ): Promise<AttendanceRecord[]> {
    return get(queryPath("/attendance/excuses", { ...filters }));
  },
  decideExcuse(
    recordId: string,
    decision: ExcuseDecision,
    note?: string,
  ): Promise<AttendanceRecord> {
    return post(
      `/attendance/records/${encodeURIComponent(recordId)}/excuse/decision`,
      { decision, note },
    );
  },
  getAtRiskStudents(
    filters: { sectionId?: string; limit?: number } = {},
  ): Promise<StudentAtRisk[]> {
    return get(queryPath("/attendance/at-risk", { ...filters }));
  },
  generateAtRiskReferral(input: {
    studentId: string;
    sectionId: string;
    note?: string;
  }): Promise<AtRiskReferral> {
    return post("/attendance/at-risk/referrals", input);
  },
  getAtRiskReferrals(
    filters: { status?: ReferralStatus; sectionId?: string } = {},
  ): Promise<AtRiskReferral[]> {
    return get(queryPath("/attendance/at-risk/referrals", { ...filters }));
  },
  updateAtRiskReferral(
    id: string,
    input: { status: ReferralStatus; note?: string },
  ): Promise<AtRiskReferral> {
    return patch(`/attendance/at-risk/referrals/${encodeURIComponent(id)}`, input);
  },

  // ── Notifications (Wave 4) ──
  getNotifications(
    filters: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<AppNotification[]> {
    return get(
      queryPath("/notifications", {
        unreadOnly: filters.unreadOnly ? "true" : undefined,
        limit: filters.limit,
      }),
    );
  },
  getUnreadNotificationCount(): Promise<number> {
    return get("/notifications/unread-count");
  },
  markNotificationsRead(
    input: NotificationReadInput = { all: true },
  ): Promise<number> {
    return post("/notifications/read", input);
  },
  registerPushToken(input: PushTokenInput): Promise<boolean> {
    return post("/notifications/push-token", input);
  },

  // ── Users ──
  getStudents(): Promise<Student[]> {
    return get("/users/students");
  },
  getStudent(id: string): Promise<Student> {
    return get(`/users/${id}`);
  },
  getTeachers(): Promise<Teacher[]> {
    return get("/users/teachers");
  },
  getUsers(
    filters: AdminUserFilters = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<AdminUserPage> {
    return get(
      queryPath("/users", {
        role: filters.role,
        q: filters.q,
        department: filters.department,
        status: filters.status,
        limit:
          filters.limit === undefined
            ? undefined
            : Math.min(Math.max(1, Math.trunc(filters.limit)), 100),
        offset: filters.offset,
      }),
      options.signal,
    );
  },
  updateUser(id: string, input: UpdateUserInput): Promise<User> {
    return patch(`/users/${id}`, input);
  },
  changeUserRole(id: string, role: AssignableRole): Promise<User> {
    return patch(`/users/${id}/role`, { role });
  },
  createAdmin(input: CreateAdminInput): Promise<User> {
    return post("/users/admins", input);
  },
  createTeacher(data: CreateTeacherInput): Promise<CreateTeacherResult> {
    return post("/users/teachers", data);
  },
  createStudent(data: CreateStudentInput): Promise<CreateStudentResult> {
    return post("/users/students", data);
  },
  resetUserPassword(
    id: string,
    password?: string,
  ): Promise<ResetUserPasswordResult> {
    return patch(
      `/users/${id}/password`,
      password === undefined ? {} : { password },
    );
  },
  setUserStatus(id: string, isActive: boolean): Promise<User> {
    return patch(`/users/${id}/status`, { isActive });
  },
  teacherResetStudentPassword(
    studentId: string,
    sectionId: string,
  ): Promise<TeacherResetStudentPasswordResult> {
    return post(`/users/students/${studentId}/teacher-reset-password`, {
      sectionId,
    });
  },
  emergencyReleaseDevice(
    studentId: string,
    input: EmergencyDeviceReleaseInput,
  ): Promise<EmergencyDeviceReleaseResult> {
    return post(`/users/students/${studentId}/device-release`, input);
  },
  unregisterDevice(deviceId: string): Promise<UnregisterDeviceResult> {
    return post("/users/me/device/unregister", { deviceId });
  },
  async updateContacts(input: UpdateContactsInput): Promise<User> {
    const updated = await patch<User>("/users/me/contacts", input);
    saveUser(updated);
    return updated;
  },

  // ── System issue & feedback reporting (SR) ──
  createSystemReport(input: CreateSystemReportInput): Promise<SystemReport> {
    return post("/reports", input);
  },
  getMySystemReports(): Promise<SystemReport[]> {
    return get("/reports/my");
  },
  getSystemReports(
    filters: SystemReportFilters = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<SystemReportPage> {
    return get(
      queryPath("/reports", {
        category: filters.category,
        severity: filters.severity,
        status: filters.status,
        role: filters.role,
        search: filters.search,
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: filters.limit,
        offset: filters.offset,
      }),
      options.signal,
    );
  },
  getSystemReportStats(): Promise<SystemReportStats> {
    return get("/reports/stats");
  },
  getSystemReport(id: string): Promise<SystemReport> {
    return get(`/reports/${id}`);
  },
  updateSystemReportStatus(
    id: string,
    input: UpdateSystemReportStatusInput,
  ): Promise<SystemReport> {
    return patch(`/reports/${id}/status`, input);
  },

  importStudents(data: StudentImportRequest): Promise<StudentImportResult> {
    return post("/users/students/import", data, data.idempotencyKey);
  },
  getStudentImportJob(jobId: string): Promise<ImportJobStatus> {
    return get(`/users/students/import/jobs/${jobId}`);
  },
  previewEnrollImport(
    sectionId: string,
    rows: EnrollImportRow[],
  ): Promise<EnrollImportResult> {
    return post(`/sections/${sectionId}/enrollments/import`, {
      mode: "validate",
      rows,
    });
  },
  importSectionEnrollments(
    sectionId: string,
    data: EnrollImportRequest,
  ): Promise<EnrollImportResult> {
    return post(
      `/sections/${sectionId}/enrollments/import`,
      data,
      data.idempotencyKey,
    );
  },
  getSettings(): Promise<{ key: string; value: string; updatedAt: string }[]> {
    return get("/settings");
  },
  setSetting(
    key: string,
    value: string,
  ): Promise<{ key: string; value: string; updatedAt: string }> {
    return put(`/settings/${encodeURIComponent(key)}`, { value });
  },
  async getMaintenanceStatus(): Promise<MaintenanceStatus> {
    try {
      return await get("/maintenance/status");
    } catch {
      // The public probe must never take a page down; treat any failure as
      // "state unknown, assume not in maintenance" and let real 503s drive
      // the overlay when they occur.
      return { enabled: false };
    }
  },
  getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
    return get(queryPath("/audit-logs", { ...filters }));
  },
  getMyAttendance(studentId: string): Promise<AttendanceRecord[]> {
    return this.getAttendanceForStudent(studentId);
  },
  async getMySubjects(studentId: string): Promise<Subject[]> {
    void studentId;
    return this.getSubjects();
  },

  // ── Section Roles ──
  assignSectionRole(
    sectionId: string,
    studentId: string,
    role: SectionRoleType,
  ): Promise<SectionRole> {
    return post("/section-roles", { sectionId, studentId, role });
  },
  removeSectionRole(
    sectionId: string,
    studentId: string,
    role: SectionRoleType,
  ): Promise<boolean> {
    return del(`/section-roles/${sectionId}/${studentId}/${role}`);
  },
  getSectionRoles(sectionId: string): Promise<SectionRole[]> {
    return get(`/section-roles/${sectionId}`);
  },
  getStudentRoles(studentId: string): Promise<SectionRole[]> {
    return get(`/section-roles/student/${studentId}`);
  },

  // ── Session Permissions ──
  grantSessionPermission(
    sectionId: string,
    studentId: string,
  ): Promise<SessionPermission> {
    return post("/session-permissions", { sectionId, studentId });
  },
  revokeSessionPermission(
    sectionId: string,
    studentId: string,
  ): Promise<boolean> {
    return del(`/session-permissions/${sectionId}/${studentId}`);
  },
  checkSessionPermission(
    sectionId: string,
    studentId: string,
  ): Promise<boolean> {
    return get(`/session-permissions/check/${sectionId}/${studentId}`);
  },
  getActiveSessionPermissions(sectionId: string): Promise<SessionPermission[]> {
    return get(`/session-permissions/${sectionId}`);
  },

  // ── Proof of Class ──
  uploadProofOfClass(data: {
    sectionId: string;
    sessionId: string;
    photoData: string;
    description?: string;
    uploadedBy: string;
    uploadedByStudentName: string;
  }): Promise<ProofOfClass> {
    return post("/proofs", {
      sectionId: data.sectionId,
      sessionId: data.sessionId,
      photoData: data.photoData,
      description: data.description,
    });
  },
  getProofsOfClass(sessionId: string): Promise<ProofOfClass[]> {
    return get(`/proofs/${sessionId}`);
  },
  deleteProofOfClass(proofId: string): Promise<boolean> {
    return del(`/proofs/${proofId}`);
  },

  // ── Miscellaneous ──
  enrollStudent(data: EnrollStudentInput): Promise<boolean> {
    const { sectionId, ...body } = data;
    return post(`/sections/${sectionId}/enroll-student`, body);
  },
  getCalendarEvents(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<CalendarEvent[]> {
    return get(`/calendar/events?startDate=${startDate}&endDate=${endDate}`);
  },
  createBulkSessions(data: BulkSessionInput): Promise<Session[]> {
    const { teacherId, ...body } = data;
    void teacherId;
    return post("/sessions/bulk", body);
  },
  async syncOfflineQueue(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) return;
    await initializeOfflineStore(user.id);
    type ScanSyncResult =
      AttendanceRecord | { error: string; retryable?: boolean };
    type ScanSyncResponse =
      | { queued: false; results: ScanSyncResult[] }
      | { queued: true; receiptId: string };
    type ScanSyncStatus =
      | { state: "completed"; results: ScanSyncResult[] }
      | { state: "pending" | "failed" };

    const awaitCompletion = async (
      response: ScanSyncResponse,
    ): Promise<ScanSyncResult | null> => {
      if (!response.queued) return response.results[0] ?? null;
      for (let attempt = 0; attempt < RECEIPT_POLL_ATTEMPTS; attempt += 1) {
        const completion = await get<ScanSyncStatus>(
          `/sync/attendance/batches/${response.receiptId}`,
        );
        if (completion.state === "completed")
          return completion.results[0] ?? null;
        if (completion.state === "failed") {
          throw new ApiHttpError("Attendance sync job failed", 500);
        }
        await delay(RECEIPT_POLL_DELAY_MS * (attempt + 1));
      }
      return null;
    };

    await drainOfflineQueue(
      async (kind: OfflineOperationKind, payload, operationId) => {
        try {
          if (kind === "attendance_scan") {
            const response = await post<ScanSyncResponse>(
              "/sync/attendance/batches",
              {
                records: [payload],
              },
            );
            const result = await awaitCompletion(response);
            if (!result)
              return {
                outcome: "pending",
                error: "Awaiting server confirmation",
              };
            if ("error" in result) {
              const classified =
                result.retryable === false
                  ? { outcome: "terminal" as const, error: result.error }
                  : classifyAttendanceSyncError(result.error);
              if (classified.outcome === "terminal") {
                // Terminal evidence will never sync, so drop the optimistic
                // cached row: keeping it would make the "already saved on this
                // device" guard block every retry of that checkpoint (RN MP5).
                await removeCachedAttendanceAttempt(
                  String(payload.sessionId),
                  user.id,
                );
              }
              return classified;
            }
            await removeCachedAttendanceAttempt(
              String(payload.sessionId),
              user.id,
            );
            await cacheAttendanceRecords([{ ...result, isSynced: true }]);
            return { outcome: "synced" };
          }
          if (kind === "scan_attempt") {
            const result = await post<SubmitAttendanceResult>(
              "/attendance/check",
              payload,
              operationId,
            );
            if (!result.success) {
              return {
                outcome: "terminal",
                error: result.message || result.reason || "Check-in rejected",
              };
            }
            return;
          }
          if (kind === "session_activation") {
            const sessionId = String(payload.sessionId);
            const checkpoint =
              payload.checkpoint === "start" || payload.checkpoint === "end"
                ? payload.checkpoint
                : undefined;
            const activated = await post<Session>(
              `/sessions/${sessionId}/activate`,
              checkpoint
                ? {
                    checkpoint,
                    validitySeconds: payload.validitySeconds,
                    ...(checkpoint === "start"
                      ? { gracePeriodMinutes: payload.gracePeriodMinutes }
                      : {}),
                    ...(payload.regenerate ? { regenerate: true } : {}),
                    token: payload.token,
                  }
                : {
                    validityMinutes: payload.validityMinutes,
                    gracePeriodMinutes: payload.gracePeriodMinutes,
                    token: payload.token,
                  },
              operationId,
            );
            await cacheSessions([activated]).catch(() => undefined);
            return;
          }
          if (kind === "session_end") {
            const ended = await post<Session>(
              `/sessions/${String(payload.sessionId)}/end`,
              undefined,
              operationId,
            );
            await cacheSessions([ended]).catch(() => undefined);
            return;
          }
          if (kind === "attendance_manual") {
            const record = payload.record as AttendanceRecord;
            const created = await post<AttendanceRecord>(
              "/attendance",
              {
                sessionId: record.sessionId,
                sectionId: record.sectionId,
                studentId: record.studentId,
                status: record.status,
              },
              operationId,
            );
            await removeCachedRecord(record.id);
            await cacheAttendanceRecords([{ ...created, isSynced: true }]);
            return;
          }
          if (kind === "attendance_status") {
            const updated = await patch<AttendanceRecord>(
              `/attendance/${String(payload.recordId)}/status`,
              { status: payload.status },
              operationId,
            );
            await cacheAttendanceRecords([{ ...updated, isSynced: true }]);
            return;
          }
          return {
            outcome: "terminal",
            error: "Unknown offline operation. Contact support.",
          };
        } catch (error) {
          if (
            error instanceof ApiHttpError &&
            error.status === 409 &&
            (kind === "session_activation" || kind === "session_end")
          ) {
            // Read from the server: cached local state cannot prove a commit.
            try {
              const session = await get<Session>(
                `/sessions/${String(payload.sessionId)}`,
              );
              const checkpoint =
                payload.checkpoint === "start" || payload.checkpoint === "end"
                  ? payload.checkpoint
                  : undefined;
              const committed =
                kind === "session_activation"
                  ? checkpoint === "end"
                    ? Boolean(
                        payload.token && session.endQrToken === payload.token,
                      )
                    : checkpoint === "start"
                      ? Boolean(
                          payload.token &&
                          session.startQrToken === payload.token,
                        )
                      : Boolean(
                          payload.token && session.qrToken === payload.token,
                        )
                  : Boolean(session.endedAt);
              if (committed) {
                await cacheSessions([session]).catch(() => undefined);
                return { outcome: "synced" };
              }
              const changed =
                kind === "session_activation"
                  ? checkpoint === "end"
                    ? Boolean(session.endQrToken || session.endedAt)
                    : checkpoint === "start"
                      ? Boolean(session.startQrToken || session.endedAt)
                      : Boolean(session.qrToken || session.endedAt)
                  : Boolean(session.endedAt);
              if (changed) {
                return {
                  outcome: "terminal",
                  error:
                    "Session changed on the server. Review it with your instructor.",
                };
              }
              return {
                outcome: "retryable",
                error: "Session operation is still in progress",
              };
            } catch (reconciliationError) {
              error = reconciliationError;
            }
          }
          const message =
            error instanceof Error ? error.message : "Sync failed";
          if (
            error instanceof ApiHttpError &&
            [400, 403, 404, 410, 422].includes(error.status)
          ) {
            return { outcome: "terminal", error: message };
          }
          return { outcome: "retryable", error: message };
        }
      },
    );
  },
  async preSyncOfflineData(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) return;
    await initializeOfflineStore(user.id);
    try {
      const startedAt = Date.now();
      const health = await get<{ timestamp: string }>("/health");
      const completedAt = Date.now();
      const serverTime = new Date(health.timestamp).getTime();
      if (Number.isFinite(serverTime)) {
        await setServerClockOffset(serverTime - (startedAt + completedAt) / 2);
      }
      await this.syncOfflineQueue();
      await Promise.all([
        this.getSubjects(),
        user.role === "student"
          ? this.getStudentSections(user.id)
          : this.getSections(),
        this.getSessions(),
        ...(user.role === "student" ? [this.getMyAttendance(user.id)] : []),
      ]);
      await persistOfflineStorage();
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
    }
  },
  async exportAttendanceCsv(
    filters: AttendanceReportFilters = {},
  ): Promise<string> {
    const path = queryPath("/reports/export", {
      ...recentDateRange(),
      ...filters,
    });
    const res = await fetchWithTimeout(
      `${API_BASE}${path}`,
      { headers: await authHeaders(), credentials: "include" },
      EXPORT_TIMEOUT_MS,
    );
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(
        Array.isArray(error.message)
          ? error.message.join(". ")
          : error.message || "Export failed",
      );
    }
    return res.text();
  },
  search(
    query: string,
  ): Promise<{
    students: Student[];
    sections: Section[];
    sessions: Session[];
  }> {
    return get(`/search?q=${encodeURIComponent(query)}`);
  },

  // ── AI assistant (AI0/AI2/AI3) ──
  getAiCapabilities(): Promise<AiCapabilities> {
    return get("/ai/capabilities");
  },
  sendAiChatMessage(data: AiChatSendInput): Promise<AiChatSendResult> {
    return post("/ai/chat", data);
  },
  getAiThread(threadId: string): Promise<AiChatThread> {
    return get(`/ai/threads/${encodeURIComponent(threadId)}`);
  },
  listAiThreads(): Promise<AiThreadSummary[]> {
    return get("/ai/threads");
  },
  deleteAiThread(threadId: string): Promise<boolean> {
    return del(`/ai/threads/${encodeURIComponent(threadId)}`);
  },

  // ── Standing evaluation (AI4) ──
  getMyStanding(): Promise<AttendanceStanding[]> {
    return get("/me/standing");
  },

  // ── RA 10173 privacy center (F6, IT-suite surface) ──
  getPrivacyCenter(): Promise<PrivacyCenterSnapshot> {
    return get("/settings/privacy-center");
  },
};

export const api = { ...apiBase, downloadAssistantFile };

/**
 * UI entry point for a user-initiated sign-out: consult the pending queue,
 * ask before destroying evidence, and only then discard it. `confirm` receives
 * the pending count so a page can render its own dialog instead of
 * `window.confirm`.
 */
export async function requestUserLogout(
  confirm: (pendingCount: number) => boolean = (pendingCount) =>
    typeof window === "undefined"
      ? true
      : window.confirm(formatPendingQueueLogoutWarning(pendingCount)),
): Promise<LogoutOutcome> {
  const pendingSyncCount = await apiBase.pendingOfflineSyncCount();
  if (pendingSyncCount > 0 && !confirm(pendingSyncCount)) {
    return { loggedOut: false, pendingSyncCount, queuePreserved: true };
  }
  const outcome = await performLogout({
    discardOfflineQueue: pendingSyncCount > 0,
  });
  return { loggedOut: true, ...outcome };
}

api satisfies ApiClient;
