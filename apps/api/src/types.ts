export interface ApiError {
  error: {
    code: string;    // machine-readable: 'VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'
    message: string; // human-readable description
    details?: unknown; // optional structured details (e.g., Zod validation errors)
  };
}
