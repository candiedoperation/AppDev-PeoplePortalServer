/**
  App Dev Club People Portal Server
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

export class ResourceAccessError extends Error {
    constructor(public status: number, public message: string) {
        super(message);
        this.name = "ResourceAccessError";
        Object.setPrototypeOf(this, ResourceAccessError.prototype);
    }
}

export class CustomValidationError extends Error {
    constructor(public status: number, public message: string) {
        super(message);
        this.name = "CustomValidationError";
        Object.setPrototypeOf(this, CustomValidationError.prototype);
    }
}
