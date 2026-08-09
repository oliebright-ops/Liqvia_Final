import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The build-failing AI provider boundary test.
 *
 * If someone adds a direct call to an external AI provider anywhere outside
 * `ai-gateway/providers/`, CI fails here. This is the check that cannot be silenced
 * with an inline comment, unlike the matching ESLint rules in `eslint.config.mjs`.
 *
 * It scans source text rather than the module graph deliberately: the current
 * integration uses `fetch` against a URL string, not an SDK import, and a
 * graph-based check would not see it.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const SCAN_ROOTS = ['backend/src', 'frontend/src', 'frontend/server', 'packages/shared/src'];

/** The only place allowed to contain provider endpoints or SDK imports. */
const ALLOWED_PREFIXES = [
  join('backend', 'src', 'ai-gateway', 'providers'),
  // This file names the forbidden strings in order to test for them.
  join('backend', 'src', 'ai-gateway', 'ai-boundary.spec.ts'),
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.next', 'coverage', '.turbo']);

/** Split so this file's own literals do not match the patterns it enforces. */
const PROVIDER_HOST_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'OpenAI REST endpoint', pattern: new RegExp(['api', 'openai', 'com'].join('\\.')) },
  { label: 'Anthropic REST endpoint', pattern: new RegExp(['api', 'anthropic', 'com'].join('\\.')) },
  {
    label: 'Google Generative AI endpoint',
    pattern: new RegExp(['generativelanguage', 'googleapis', 'com'].join('\\.')),
  },
  { label: 'Mistral REST endpoint', pattern: new RegExp(['api', 'mistral', 'ai'].join('\\.')) },
  { label: 'Cohere REST endpoint', pattern: new RegExp(['api', 'cohere', 'com'].join('\\.')) },
];

const PROVIDER_IMPORT_PATTERN =
  /\b(?:import|require)\s*(?:\(|[^;\n]*\bfrom\s*)['"](openai|@ai-sdk\/openai|langchain|@langchain\/[^'"]+|@anthropic-ai\/sdk|@google\/generative-ai|@mistralai\/mistralai|cohere-ai|ollama)['"]/;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

function isAllowed(relativePath: string): boolean {
  const normalised = relativePath.split('/').join(sep);
  return ALLOWED_PREFIXES.some((prefix) => normalised.startsWith(prefix));
}

describe('AI provider boundary', () => {
  const files = SCAN_ROOTS.flatMap((root) => collectSourceFiles(join(REPO_ROOT, root)));

  it('scans a non-trivial number of source files', () => {
    // Guards against the scan silently finding nothing after a directory move —
    // a boundary test that inspects zero files passes for the wrong reason.
    expect(files.length).toBeGreaterThan(50);
  });

  it('contains no external AI provider endpoint outside the gateway provider adapter', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      if (isAllowed(rel)) continue;
      const content = readFileSync(file, 'utf8');
      for (const { label, pattern } of PROVIDER_HOST_PATTERNS) {
        if (pattern.test(content)) offenders.push(`${rel} — ${label}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('contains no external AI provider SDK import outside the gateway provider adapter', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      if (isAllowed(rel)) continue;
      const content = readFileSync(file, 'utf8');
      if (PROVIDER_IMPORT_PATTERN.test(content)) offenders.push(`${rel} — provider SDK import`);
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the provider adapter small enough to review in one sitting', () => {
    // The adapter is the entire trust boundary. If it grows, privacy logic has
    // probably drifted into it, where it can be bypassed by a second caller.
    const adapter = readFileSync(
      join(REPO_ROOT, 'backend/src/ai-gateway/providers/openai.provider.ts'),
      'utf8',
    );
    expect(adapter.split('\n').length).toBeLessThan(160);
  });

  it('exposes the gateway service but not the provider from the module barrel', () => {
    const barrel = readFileSync(join(REPO_ROOT, 'backend/src/ai-gateway/index.ts'), 'utf8');
    expect(barrel).toContain('AiPrivacyGatewayService');
    expect(barrel).not.toContain('OpenAiProvider');
  });
});
