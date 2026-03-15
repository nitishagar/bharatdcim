import type { Context } from 'hono';
import type { ZodError } from 'zod';

type ValidationResult =
  | { success: true; data: unknown }
  | { success: false; error: ZodError; data: unknown };

/**
 * Shared hook for @hono/zod-validator that returns structured 400 errors
 * matching the existing { error: { code, message } } format with added field-level issues.
 */
export function validationHook(result: ValidationResult, c: Context) {
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      field: i.path.join('.') || '_root',
      message: i.message,
      code: i.code,
    }));
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${issues.map((i) => i.field).join(', ')}`,
          issues,
        },
      },
      400,
    );
  }
}
