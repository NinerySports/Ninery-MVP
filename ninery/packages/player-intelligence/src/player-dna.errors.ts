export class PlayerDNANotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerDNANotFoundError";
  }
}

export class PlayerDNAValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerDNAValidationError";
  }
}

export class PlayerDNAAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerDNAAuthorizationError";
  }
}
