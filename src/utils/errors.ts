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
