export class InvalidRequest extends Error {}

// errors below are returned to the user as a response
export class MissingPermissions extends Error {}
export class ReturnedError extends Error {}
export class InternalRequestError extends Error {
  response: Response
  constructor(message: string, response: Response) {
    super(message)
    this.response = response
  }
}
