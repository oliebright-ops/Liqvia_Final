const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return;

  console.error(`[env] Missing required production variables: ${missing.join(', ')}`);
  process.exit(1);
}
