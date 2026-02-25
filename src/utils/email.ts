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

import validator from 'validator';
import { CustomValidationError } from './errors';

/**
 * Normalizes an email address to a consistent format.
 * - Validates email format first
 * - Converts to lowercase
 * - Removes unnecessary characters
 * - Does NOT remove dots from Gmail addresses (to preserve original email)
 * 
 * @param email - The email address to normalize
 * @returns The normalized email address
 * @throws CustomValidationError if email is invalid or normalization fails
 */
export function normalizeEmail(email: string): string {
    if (!email) {
        throw new CustomValidationError(400, 'Email is required');
    }

    // Validate email format first
    if (!validator.isEmail(email)) {
        throw new CustomValidationError(400, 'Invalid email format');
    }

    const normalized = validator.normalizeEmail(email, {
        all_lowercase: true,
        gmail_remove_dots: false
    });

    if (!normalized) {
        throw new CustomValidationError(400, 'Email normalization failed');
    }

    return normalized;
}
