import type { ValidationError } from 'class-validator';

/**
 * One field's validation failure, flattened from a (possibly nested)
 * class-validator `ValidationError` tree into a single entry: the dotted
 * property path plus every constraint it failed, keyed by the
 * class-validator constraint name (e.g. `minLength`, `isEnum`) with the
 * original English message class-validator generated for it.
 *
 * The English messages are kept around only so the localizer can pull
 * numeric parameters (e.g. the `6` in "must be longer than or equal to 6
 * characters") out of them with a regex — the constraint key is what
 * actually drives which localized template gets used.
 */
export interface FlattenedValidationError {
  property: string;
  constraints: Record<string, string>;
}

/**
 * Marker payload thrown as the body of a `BadRequestException` by the
 * global `ValidationPipe`'s `exceptionFactory` (see `main.ts`). It
 * deliberately preserves the structured, per-field constraint data instead
 * of flattening straight to English strings, so `AllExceptionsFilter` can
 * localize it into the caller's language before it reaches the client.
 */
export interface ValidationExceptionPayload {
  message: string;
  isValidationException: true;
  validationErrors: FlattenedValidationError[];
}

/** Type guard used by `AllExceptionsFilter` to detect the payload above. */
export function isValidationExceptionPayload(
  value: unknown,
): value is ValidationExceptionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.isValidationException === true && Array.isArray(candidate.validationErrors)
  );
}

/**
 * Flattens class-validator's `ValidationError[]` (which nests `children`
 * for nested DTOs / array items) into a flat list of
 * `{ property, constraints }`, joining nested property paths with `.`
 * (e.g. a failing `city` inside an `address` DTO becomes `address.city`).
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FlattenedValidationError[] {
  const flattened: FlattenedValidationError[] = [];

  for (const error of errors) {
    const propertyPath = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      flattened.push({ property: propertyPath, constraints: error.constraints });
    }

    if (error.children && error.children.length > 0) {
      flattened.push(...flattenValidationErrors(error.children, propertyPath));
    }
  }

  return flattened;
}
