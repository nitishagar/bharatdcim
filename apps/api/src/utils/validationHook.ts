import type { Hook } from '@hono/zod-validator';

/**
 * Shared hook for @hono/zod-validator that returns structured 400 errors
 * matching the existing { error: { code, message } } format with added field-level issues.
 */
export const validationHook: Hook<any, any, any> = (result, c) => {
  if (!result.success) {
    const issues = (result.error.issues as Array<{ path: (string | number)[]; message: string; code: string }>).map((i) => ({
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
};
