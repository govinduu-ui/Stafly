import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
let pool = null;
let pgliteInstance = null;
let isPglite = false;

// Initialize Database Connection
export async function getDb() {
  if (pool || pgliteInstance) {
    return { pool, pgliteInstance, isPglite };
  }

  // 1. Try connecting to standard PostgreSQL
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/staffly_db';
  try {
    const testPool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 2000,
    });
    
    // Quick query test
    await testPool.query('SELECT 1');
    console.log('Successfully connected to PostgreSQL database at:', dbUrl);
    pool = testPool;
    isPglite = false;
    return { pool, pgliteInstance: null, isPglite: false };
  } catch (err) {
    console.log('Standard PostgreSQL daemon not reachable, using WASM Embedded PostgreSQL (PGlite)...');
    
    // 2. Fallback to PGlite (Real WASM PostgreSQL engine)
    const dataDir = path.resolve(process.cwd(), './server/db/pglite_data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    console.log('Embedded PostgreSQL (PGlite) ready at:', dataDir);
    isPglite = true;
    return { pool: null, pgliteInstance, isPglite: true };
  }
}

// Universal Query Helper
export async function query(text, params = []) {
  const { pool: activePool, pgliteInstance: activePglite, isPglite: activeIsPglite } = await getDb();
  
  if (!activeIsPglite && activePool) {
    const result = await activePool.query(text, params);
    return result;
  } else if (activePglite) {
    const res = await activePglite.query(text, params);
    return {
      rows: res.rows || [],
      rowCount: res.affectedRows !== undefined ? res.affectedRows : (res.rows ? res.rows.length : 0),
    };
  }
  throw new Error('Database connection not initialized.');
}
