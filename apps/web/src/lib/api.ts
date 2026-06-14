export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type AuthRole = {
  code: "ACCOUNTANT";
  name: "Accountant";
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  roles: AuthRole[];
};

export type AuthResponse = {
  status: "ok";
  message?: string;
  user: AuthUser;
};

// ---------------------------------------------------------------------------
// Accounting foundation resource types (Phase 2A)
// ---------------------------------------------------------------------------

export type NormalBalanceSide = "DEBIT" | "CREDIT";

export type AccountClassCode =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

export type Company = {
  id: string;
  singletonKey: string;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type FiscalYear = {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountClass = {
  id: string;
  code: AccountClassCode;
  name: string;
  normalBalance: NormalBalanceSide;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Typed request payloads (must match backend DTO whitelists exactly)
// ---------------------------------------------------------------------------

export type CompanyInput = {
  name: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
};

export type CreateFiscalYearInput = {
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type UpdateFiscalYearInput = {
  name?: string;
  startDate?: string;
  endDate?: string;
  isClosed?: boolean;
};

export type ProjectInput = {
  code: string;
  name: string;
  location?: string;
  notes?: string;
  isActive?: boolean;
};

// ---------------------------------------------------------------------------
// Fetch layer
// ---------------------------------------------------------------------------

/**
 * Error raised for any non-successful API interaction. `status` is `0` when the
 * API could not be reached at all (network/connection failure).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConnectionError() {
    return this.status === 0;
  }
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }

    if (body.message) {
      return body.message;
    }
  } catch {
    return "Request failed. Please try again.";
  }

  return "Request failed. Please try again.";
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Shared, cookie-authenticated fetch helper.
 *
 * - Always sends `credentials: "include"` so the HttpOnly session cookie flows.
 * - Never reads or writes auth tokens in localStorage.
 * - Throws a typed {@link ApiError} on connection failure or non-2xx response so
 *   callers can present clear auth/connection messages.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const hasBody = body !== undefined;

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: hasBody ? JSON.stringify(body) : undefined,
      credentials: "include",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      method,
      signal,
    });
  } catch (error) {
    // Re-throw aborts untouched so callers can ignore unmounted requests.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      `Unable to reach the API at ${API_BASE_URL}. Please confirm the API server is running.`,
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Resource helpers
// ---------------------------------------------------------------------------

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const body = await apiFetch<AuthResponse>("/auth/me", { signal });
  return body.user;
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>("/auth/logout", { method: "POST" });
}

export function getCompany(signal?: AbortSignal): Promise<Company> {
  return apiFetch<Company>("/company", { signal });
}

export function createCompany(input: CompanyInput): Promise<Company> {
  return apiFetch<Company>("/company", { body: input, method: "POST" });
}

export function updateCompany(
  id: string,
  input: Partial<CompanyInput>,
): Promise<Company> {
  return apiFetch<Company>(`/company/${id}`, { body: input, method: "PATCH" });
}

export function getFiscalYears(signal?: AbortSignal): Promise<FiscalYear[]> {
  return apiFetch<FiscalYear[]>("/fiscal-years", { signal });
}

export function createFiscalYear(
  input: CreateFiscalYearInput,
): Promise<FiscalYear> {
  return apiFetch<FiscalYear>("/fiscal-years", { body: input, method: "POST" });
}

export function updateFiscalYear(
  id: string,
  input: UpdateFiscalYearInput,
): Promise<FiscalYear> {
  return apiFetch<FiscalYear>(`/fiscal-years/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function activateFiscalYear(id: string): Promise<FiscalYear> {
  return apiFetch<FiscalYear>(`/fiscal-years/${id}/activate`, {
    method: "POST",
  });
}

export function getProjects(signal?: AbortSignal): Promise<Project[]> {
  return apiFetch<Project[]>("/projects", { signal });
}

export function createProject(input: ProjectInput): Promise<Project> {
  return apiFetch<Project>("/projects", { body: input, method: "POST" });
}

export function updateProject(
  id: string,
  input: Partial<ProjectInput>,
): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { body: input, method: "PATCH" });
}

export function getAccountClasses(signal?: AbortSignal): Promise<AccountClass[]> {
  return apiFetch<AccountClass[]>("/account-classes", { signal });
}

/**
 * Narrow an unknown caught value to a user-facing message. Aborts are re-thrown
 * by {@link apiFetch}; everything else lands here.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
