import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-safe connection pool configuration
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Limit max connections to prevent exhausting Neon's connection limit
  // Replit Autoscale can spawn multiple instances, so keep this conservative
  max: 10, // Maximum 10 connections per instance
  // Connection timeout - fail fast instead of hanging
  connectionTimeoutMillis: 5000, // 5 seconds
  // Idle timeout - close unused connections to free resources
  idleTimeoutMillis: 30000, // 30 seconds
});

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
  // Don't throw - let the app continue running with remaining connections
});

// Log pool connection events in development
if (process.env.NODE_ENV === 'development') {
  pool.on('connect', () => {
    console.log('✓ Database connection acquired from pool');
  });
  pool.on('remove', () => {
    console.log('✓ Database connection removed from pool');
  });
}

export const db = drizzle({ client: pool, schema });
