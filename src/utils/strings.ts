import crypto from 'crypto';

export function generateSecureRandomString(length: number) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export function sanitizeGroupName(str: string) {
  // Remove all non-alphanumeric and non-hyphen characters
  // \w matches [A-Za-z0-9_], so replace underscores by removing them after
  // [^-] will exclude anything that isn't a letter, a number, or a hyphen/underscore

  let sanitized = str.replace(/[^A-Za-z0-9-_]/g, '');
  return sanitized;
}

/**
 * Normalizes a full name into FirstLast format, removing middle names and hyphens while capitalizing segments.
 */
export function sanitizeUserFullName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';

  const firstNameRaw = parts[0] ?? '';
  const lastNameRaw = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';

  const normalizeSegment = (str: string): string => {
    if (!str) return '';
    return str.split('-').map(segment => {
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    }).join('');
  };

  return normalizeSegment(firstNameRaw) + normalizeSegment(lastNameRaw);
}

/**
 * Formats a bindle access error message listing team owners and missing bindles.
 */
export function formatBindleAccessError(owners: string[], missingBindles: string[]): string {
  const formatList = (items: string[], conjunction: string) => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    const last = items[items.length - 1];
    const rest = items.slice(0, -1).join(", ");
    return `${rest} ${conjunction} ${last}`;
  };

  const ownersStr = formatList(owners, "or");
  const bindlesStr = formatList(missingBindles, "and");

  return `You do not have permission to access this resource. Please ask ${ownersStr} to grant you the ${bindlesStr} bindle${missingBindles.length === 1 ? "" : "s"}.`;
}
