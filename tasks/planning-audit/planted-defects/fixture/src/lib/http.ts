export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * Base class for errors that carry the HTTP status they should map to. Route handlers
 * throw these (or a subclass) and let the top-level request handler translate them into
 * a response.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "not found") {
    super(404, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "unauthorized") {
    super(401, message);
  }
}
