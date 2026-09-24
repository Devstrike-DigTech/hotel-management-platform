import { config } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Codes the API uses when a sensitive action needs a fresh second factor. */
export const STEP_UP_CODES = new Set(["STEP_UP_REQUIRED", "MFA_STEP_UP_REQUIRED", "STEP_UP_EXPIRED"]);
export const isStepUpError = (e: unknown) => isApiError(e) && STEP_UP_CODES.has(e.code);

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Do not open the step-up dialog on STEP_UP_REQUIRED; let the caller handle it. */
  noStepUp?: boolean;
  /** Do not broadcast a signed-out event on 401 (sign-in screens). */
  noExpire?: boolean;
}

/* ---- session-expiry signal (the shell listens and redirects) ---- */
type Listener = () => void;
const expired = new Set<Listener>();
export function onSessionExpired(l: Listener) {
  expired.add(l);
  return () => {
    expired.delete(l);
  };
}

/* ---- step-up broker: a sensitive call pauses until the dialog resolves ---- */
export interface StepUpRequest {
  reason: string;
  resolve: (ok: boolean) => void;
}
type StepUpHandler = (req: StepUpRequest) => void;
let stepUpHandler: StepUpHandler | null = null;
let pendingStepUp: Promise<boolean> | null = null;
export function registerStepUpHandler(h: StepUpHandler | null) {
  stepUpHandler = h;
}
/** Ask the person for their code now. Resolves true once verified. */
export function requestStepUp(reason = "This action needs your authenticator code."): Promise<boolean> {
  if (pendingStepUp) return pendingStepUp;
  if (!stepUpHandler) return Promise.resolve(false);
  const h = stepUpHandler;
  pendingStepUp = new Promise<boolean>((resolve) => h({ reason, resolve })).finally(() => {
    pendingStepUp = null;
  });
  return pendingStepUp;
}

function buildUrl(path: string, query?: Query) {
  const clean = path.replace(/^\//, "");
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return `${config.proxyBase}/${clean}${qs ? `?${qs}` : ""}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { code?: string; message?: string | string[]; details?: Record<string, unknown> } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  let msg = Array.isArray(body.message) ? body.message.join(". ") : body.message;
  const fields = (body.details as { fields?: Record<string, string[]> } | undefined)?.fields;
  if (body.code === "VALIDATION_ERROR" && fields && typeof fields === "object") {
    const parts = Object.values(fields)
      .map((v) => (Array.isArray(v) ? v[v.length - 1] : String(v)))
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    if (parts.length) msg = parts.slice(0, 2).join(". ");
  }
  if (res.status === 429 && !msg) msg = "Too many attempts. Wait a minute and try again.";
  const code =
    body.code ||
    (res.status === 401 ? "UNAUTHORIZED" : res.status === 403 ? "FORBIDDEN" : res.status === 404 ? "NOT_FOUND" : res.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST");
  return new ApiError(res.status, code, msg || res.statusText || "Something went wrong", body.details);
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const { method = "GET", body, query, signal } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json", "X-Console-Request": "1", ...(opts.headers ?? {}) };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "NETWORK", "The console couldn't reach its server. Check your connection and try again.");
  }
}

async function request(path: string, opts: RequestOptions = {}): Promise<Response> {
  let res = await send(path, opts);
  if (!res.ok) {
    let err = await parseError(res);
    if (STEP_UP_CODES.has(err.code) && !opts.noStepUp) {
      const ok = await requestStepUp(err.message);
      if (!ok) throw err;
      res = await send(path, opts);
      if (res.ok) return res;
      err = await parseError(res);
    }
    if (err.status === 401 && !opts.noExpire) expired.forEach((l) => l());
    throw err;
  }
  return res;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Like `api` but returns the raw Response (CSV and file downloads). */
export async function apiRaw(path: string, opts: RequestOptions = {}): Promise<Response> {
  return request(path, opts);
}

/** Save a streamed response to disk with the server's filename. */
export async function download(path: string, fallbackName: string, opts: RequestOptions = {}) {
  const res = await apiRaw(path, opts);
  const cd = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
