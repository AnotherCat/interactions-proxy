export class InvalidRequest extends Error {}

// errors below are returned to the user as a response
export class MissingPermissions extends Error {}
export class ReturnedError extends Error {}
export class InternalRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
