import { ForbiddenError, UnauthorizedError, StoreNotFoundError } from "./errors";
import { forbidden, unauthorized, notFound } from "@/lib/api-error-response";

type RouteHandler = (...args: any[]) => Promise<Response>;

export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ForbiddenError) return forbidden(error.message);
      if (error instanceof UnauthorizedError) return unauthorized(error.message);
      if (error instanceof StoreNotFoundError) return notFound(error.message);
      throw error;
    }
  };
}
