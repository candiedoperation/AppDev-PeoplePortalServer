/**
  People Portal Server
  Copyright (C) 2026  Atheesh Thirumalairajan

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import crypto from 'crypto';
import { CustomValidationError } from './errors';

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

  const ownersStr = formatList(owners, "or") || "an administrator";
  const bindlesStr = formatList(missingBindles, "and");

  return `You do not have permission to access this resource. Please ask ${ownersStr} to grant you the ${bindlesStr} bindle${missingBindles.length === 1 ? "" : "s"}.`;
}

/**
 * Validates a team name ensuring it contains only letters, numbers, spaces, and apostrophes.
 * Also formats the name to Title Case (capitalizing the first letter of each word).
 * @param name Team Name
 * @returns Formatted Team Name
 * @throws Error if invalid
 */
export function validateTeamName(name: string): string {
  if (name.length < 3 || name.length > 25) {
    throw new CustomValidationError(
      400,
      "Invalid Team Name. Must be between 3 and 25 characters."
    );
  }

  // Allow letters, numbers, spaces, and apostrophes
  const regex = /^[a-zA-Z0-9' ]+$/;
  if (!regex.test(name)) {
    throw new CustomValidationError(
      400,
      "Invalid Team Name. Use only letters, numbers, spaces, and apostrophes."
    );
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) {
    throw new CustomValidationError(
      400,
      "Invalid Team Name. Must contain at least one letter."
    );
  }

  // Title Case Formatting
  return name.split(' ').map(word => {
    if (word.length === 0) return "";
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}
