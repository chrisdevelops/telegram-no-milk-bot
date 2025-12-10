// src/lib/config.ts

/**
 * History tracking configuration
 */
export interface HistoryConfig {
  enabled: boolean;
  maxEntries: number;
  userFormat: 'username' | 'userid' | 'both';
}

/**
 * Get history tracking configuration from environment variables
 * @returns History configuration with validated defaults
 */
export function getHistoryConfig(): HistoryConfig {
  // Default: enabled unless explicitly set to 'false'
  const enabled = process.env.HISTORY_ENABLED !== 'false';

  // Default: 100, minimum: 0 (infinite)
  const maxEntries = (() => {
    const val = parseInt(process.env.HISTORY_MAX_ENTRIES ?? '100', 10);
    return isNaN(val) || val < 0 ? 100 : val;
  })();

  // Default: 'both'
  const userFormat = (() => {
    const val = process.env.HISTORY_USER_FORMAT?.toLowerCase();
    if (val === 'username' || val === 'userid' || val === 'both') {
      return val;
    }
    return 'both';
  })();

  return { enabled, maxEntries, userFormat };
}
