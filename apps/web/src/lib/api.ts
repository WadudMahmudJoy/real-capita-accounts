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
