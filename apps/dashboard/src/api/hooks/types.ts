export interface PaginationParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export function buildPaginationQuery(params: PaginationParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined && params.offset > 0) qs.set('offset', String(params.offset));
  if (params.search) qs.set('search', params.search);
  return qs;
}
