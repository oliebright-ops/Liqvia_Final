/** Ensure managed Postgres providers (Render, etc.) use SSL in production. */
export function normalizeDatabaseUrl(url: string): string {
  if (url.includes('sslmode=')) return url;

  const needsSsl =
    process.env.NODE_ENV === 'production' ||
    /\.render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(url);

  if (!needsSsl) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}sslmode=require`;
}

export function applyDatabaseUrlDefaults(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;
  process.env.DATABASE_URL = normalizeDatabaseUrl(url);
}
