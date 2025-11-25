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
// Replit docs recommend max: 10 for production apps with 1000+ users when using Neon pooler
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Recommended by Replit for Autoscale deployments
  connectionTimeoutMillis: 10000, // 10 seconds - allow time for slow networks
  idleTimeoutMillis: 30000, // 30 seconds - close unused connections
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
