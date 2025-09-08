import crypto from 'crypto';

export function generateSecureRandomString(length: number) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export function sanitizeGroupName(str: string) {
  // Remove all non-alphanumeric and non-hyphen characters
  // \w matches [A-Za-z0-9_], so replace underscores by removing them after
  // [^-] will exclude anything that isn't a letter, a number, or a hyphen

  let sanitized = str.replace(/[^A-Za-z0-9-]/g, '');
  return sanitized;
}