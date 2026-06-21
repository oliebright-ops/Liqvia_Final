const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET'] as const;
const INSECURE_JWT_SECRETS = new Set([
  'dev-only-change-in-production',
  'change-me-in-production-use-long-random-string',
]);

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`[env] Missing required production variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (jwtSecret.length < 32 || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    console.error('[env] JWT_SECRET must be a unique random string of at least 32 characters in production.');
    process.exit(1);
  }
}
