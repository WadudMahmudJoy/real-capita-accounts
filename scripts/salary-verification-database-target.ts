const REQUIRED_DATABASE = "real_capita_accounts_salary_dev";

export function assertSalaryVerificationDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) throw new Error("Database URL is missing.");

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Database URL is malformed.");
  }

  let detectedDatabase: string;
  try {
    detectedDatabase = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("Database URL is malformed.");
  }

  if (detectedDatabase !== REQUIRED_DATABASE) {
    throw new Error(
      `Detected database "${detectedDatabase}"; required safe target is "${REQUIRED_DATABASE}".`,
    );
  }

  return detectedDatabase;
}
