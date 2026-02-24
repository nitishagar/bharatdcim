#!/usr/bin/env node
/**
 * Seed the Turso database with initial data.
 * Usage: npx tsx src/db/run-seed.ts
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.
 */
import { createDb } from './client.js';
import { seedDatabase } from './seed.js';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const db = createDb(url, authToken);

console.log('Seeding database...');
await seedDatabase(db);
console.log('Seed complete.');
