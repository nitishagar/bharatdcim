import { drizzle } from 'drizzle-orm/libsql/web';
import * as schema from './schema.js';

export function createDb(url: string, authToken: string) {
  return drizzle({ connection: { url, authToken }, schema });
}

export type Database = ReturnType<typeof createDb>;
