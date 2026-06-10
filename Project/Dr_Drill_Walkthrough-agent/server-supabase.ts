import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export interface SupabaseConfig {
  enabled: boolean;
  primary_url: string;
  primary_key: string;
  backup_url: string;
  backup_key: string;
  is_initialized: boolean;
}

const CONFIG_PATH = path.join(process.cwd(), 'supabase_config.json');

export function cleanSupabaseUrl(url: string | null | undefined): string {
  if (!url) return '';
  let cleaned = url.trim();
  cleaned = cleaned.replace(/\/+$/, '');
  if (cleaned.endsWith('/rest/v1')) {
    cleaned = cleaned.slice(0, -'/rest/v1'.length);
  }
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function loadSupabaseConfig(): SupabaseConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return {
        enabled: data.enabled ?? false,
        primary_url: cleanSupabaseUrl(data.primary_url ?? ''),
        primary_key: data.primary_key ?? '',
        backup_url: cleanSupabaseUrl(data.backup_url ?? ''),
        backup_key: data.backup_key ?? '',
        is_initialized: data.is_initialized ?? false,
      };
    }
  } catch (err) {
    console.warn('[SUPABASE CONFIG ERROR] Failed to load config:', err);
  }
  return {
    enabled: false,
    primary_url: '',
    primary_key: '',
    backup_url: '',
    backup_key: '',
    is_initialized: false,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('[SUPABASE CONFIG SAVE ERROR] Failed to save config:', err);
  }
}

// Lazy loaded clients
let primaryClient: any = null;
let backupClient: any = null;

export function resetSupabaseClients() {
  primaryClient = null;
  backupClient = null;
  console.log('[SUPABASE CLIENT MANAGER] Cached clients cleared.');
}

export function getSupabaseClient(activeDatabase: 'primary' | 'backup' = 'primary') {
  const config = loadSupabaseConfig();
  if (!config.enabled) return null;

  if (activeDatabase === 'backup') {
    if (config.backup_url && config.backup_key) {
      if (!backupClient) {
        const cleanedUrl = cleanSupabaseUrl(config.backup_url);
        backupClient = createClient(cleanedUrl, config.backup_key);
      }
      return backupClient;
    }
  }

  // Fallback to Primary
  if (config.primary_url && config.primary_key) {
    if (!primaryClient) {
      const cleanedUrl = cleanSupabaseUrl(config.primary_url);
      primaryClient = createClient(cleanedUrl, config.primary_key);
    }
    return primaryClient;
  }

  return null;
}

export const SUPABASE_SQL_SCHEMA = `-- Supabase PostgreSQL Schema for SRE Failover Drills Agent

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Runbooks Table
CREATE TABLE IF NOT EXISTS runbooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  steps TEXT NOT NULL, -- JSON formatted array
  "rawMarkdown" TEXT,
  "createdAt" TEXT NOT NULL
);
ALTER TABLE runbooks DISABLE ROW LEVEL SECURITY;

-- 3. Drills Table
CREATE TABLE IF NOT EXISTS drills (
  id TEXT PRIMARY KEY,
  "runbookId" TEXT NOT NULL,
  "runbookTitle" TEXT NOT NULL,
  status TEXT NOT NULL,
  "agentState" TEXT NOT NULL,
  "startedAt" TEXT NOT NULL,
  "completedAt" TEXT,
  "currentStepId" TEXT,
  steps TEXT NOT NULL, -- JSON formatted array
  logs TEXT NOT NULL, -- JSON formatted array
  "rtoComplianceRatio" INTEGER NOT NULL
);
ALTER TABLE drills DISABLE ROW LEVEL SECURITY;

-- 4. Compliance Reports Table
CREATE TABLE IF NOT EXISTS compliance_reports (
  "drillId" TEXT PRIMARY KEY,
  "drillTitle" TEXT NOT NULL,
  "totalSteps" INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  "rtoMet" INTEGER NOT NULL,
  "rtoViolations" INTEGER NOT NULL,
  "totalDuration" INTEGER NOT NULL,
  "rtoCompliancePercent" INTEGER NOT NULL,
  "isCompliant" BOOLEAN NOT NULL DEFAULT TRUE,
  "executiveSummary" TEXT,
  "technicalSummary" TEXT,
  "auditorChecklist" TEXT NOT NULL, -- JSON formatted array
  "createdAt" TEXT NOT NULL
);
ALTER TABLE compliance_reports DISABLE ROW LEVEL SECURITY;

-- 5. Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_trail (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "userRole" TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  "drillId" TEXT,
  "ipAddress" TEXT NOT NULL
);
ALTER TABLE audit_trail DISABLE ROW LEVEL SECURITY;

-- 6. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  "fileName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadDate" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  path TEXT NOT NULL
);
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
`;

/**
 * Maps standard queries over to Supabase REST Calls
 */
export async function supabaseGet(
  activeDatabase: 'primary' | 'backup',
  sql: string,
  params: any[] = []
): Promise<any> {
  const client = getSupabaseClient(activeDatabase);
  if (!client) return null;

  try {
    const sqlClean = sql.trim().replace(/\s+/g, ' ');

    if (sqlClean.includes('SELECT COUNT(*) as count FROM runbooks')) {
      const { count, error } = await client.from('runbooks').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return { count: count || 0 };
    }

    if (sqlClean.includes('SELECT COUNT(*) as count FROM users')) {
      const { count, error } = await client.from('users').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return { count: count || 0 };
    }

    if (sqlClean.includes('SELECT * FROM runbooks WHERE id = ?')) {
      const { data, error } = await client.from('runbooks').select('*').eq('id', params[0]).maybeSingle();
      if (error) throw error;
      return data;
    }

    if (sqlClean.includes('SELECT * FROM users WHERE email = ?')) {
      // Postgres column lookup might match exact match
      const { data, error } = await client.from('users').select('*').ilike('email', params[0]).maybeSingle();
      if (error) throw error;
      return data;
    }

    if (sqlClean.includes('SELECT * FROM users WHERE id = ?')) {
      const { data, error } = await client.from('users').select('*').eq('id', params[0]).maybeSingle();
      if (error) throw error;
      return data;
    }

    if (sqlClean.includes("SELECT id FROM drills WHERE status = 'RUNNING'")) {
      const { data, error } = await client.from('drills').select('id').eq('status', 'RUNNING').maybeSingle();
      if (error) throw error;
      return data;
    }

    if (sqlClean.includes('SELECT * FROM drills WHERE id = ?')) {
      const { data, error } = await client.from('drills').select('*').eq('id', params[0]).maybeSingle();
      if (error) throw error;
      return data;
    }

    if (sqlClean.includes('SELECT * FROM compliance_reports WHERE drillId = ?')) {
      const { data, error } = await client.from('compliance_reports').select('*').eq('drillId', params[0]).maybeSingle();
      if (error) throw error;
      // Postgres returns boolean type for column isCompliant, ensure safety
      if (data) {
        data.isCompliant = data.isCompliant ? 1 : 0;
      }
      return data;
    }
  } catch (err: any) {
    console.warn(`[SUPABASE GET WARNING] Detailed Error Log:\n` +
                  `- SQL Query: "${sql}"\n` +
                  `- Parameters: ${JSON.stringify(params)}\n` +
                  `- Error Message: ${err?.message || err}\n` +
                  `- Error Details: ${JSON.stringify(err)}`);
    throw err;
  }
  return null;
}

export async function supabaseAll(
  activeDatabase: 'primary' | 'backup',
  sql: string,
  params: any[] = []
): Promise<any[] | null> {
  const client = getSupabaseClient(activeDatabase);
  if (!client) return null;

  try {
    const sqlClean = sql.trim().replace(/\s+/g, ' ');

    if (sqlClean.includes('SELECT * FROM runbooks')) {
      const { data, error } = await client.from('runbooks').select('*').order('createdAt', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    if (sqlClean.includes('SELECT * FROM drills')) {
      const { data, error } = await client.from('drills').select('*').order('startedAt', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    if (sqlClean.includes('SELECT * FROM audit_trail')) {
      const { data, error } = await client.from('audit_trail').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    if (sqlClean.includes('SELECT * FROM users')) {
      const { data, error } = await client.from('users').select('*');
      if (error) throw error;
      return data || [];
    }

    if (sqlClean.includes('SELECT * FROM documents')) {
      const { data, error } = await client.from('documents').select('*').order('uploadDate', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  } catch (err: any) {
    console.warn(`[SUPABASE ALL WARNING] Detailed Error Log:\n` +
                  `- SQL Query: "${sql}"\n` +
                  `- Parameters: ${JSON.stringify(params)}\n` +
                  `- Error Message: ${err?.message || err}\n` +
                  `- Error Details: ${JSON.stringify(err)}`);
    throw err;
  }
  return null;
}

export async function supabaseRun(
  activeDatabase: 'primary' | 'backup',
  sql: string,
  params: any[] = []
): Promise<{ changes: number; lastID?: string } | null> {
  const client = getSupabaseClient(activeDatabase);
  if (!client) return null;

  try {
    const sqlClean = sql.trim().replace(/\s+/g, ' ');

    if (sqlClean.startsWith('INSERT INTO runbooks')) {
      const item = {
        id: params[0],
        title: params[1],
        description: params[2],
        steps: typeof params[3] === 'string' ? params[3] : JSON.stringify(params[3]),
        rawMarkdown: params[4],
        createdAt: params[5],
      };
      const { error } = await client.from('runbooks').insert(item);
      if (error) throw error;
      return { changes: 1, lastID: item.id };
    }

    if (sqlClean.startsWith('INSERT INTO drills')) {
      const item = {
        id: params[0],
        runbookId: params[1],
        runbookTitle: params[2],
        status: params[3],
        agentState: params[4],
        startedAt: params[5],
        steps: typeof params[6] === 'string' ? params[6] : JSON.stringify(params[6]),
        logs: typeof params[7] === 'string' ? params[7] : JSON.stringify(params[7]),
        rtoComplianceRatio: params[8],
      };
      const { error } = await client.from('drills').insert(item);
      if (error) throw error;
      return { changes: 1, lastID: item.id };
    }

    if (sqlClean.startsWith('UPDATE drills SET')) {
      const { error } = await client.from('drills').update({
        agentState: params[0],
        logs: typeof params[1] === 'string' ? params[1] : JSON.stringify(params[1]),
        steps: typeof params[2] === 'string' ? params[2] : JSON.stringify(params[2]),
        status: params[3],
        rtoComplianceRatio: params[4],
        completedAt: params[5],
      }).eq('id', params[6]);
      if (error) throw error;
      return { changes: 1 };
    }

    if (sqlClean.startsWith('INSERT OR REPLACE INTO compliance_reports')) {
      const item = {
        drillId: params[0],
        drillTitle: params[1],
        totalSteps: params[2],
        passed: params[3],
        failed: params[4],
        skipped: params[5],
        rtoMet: params[6],
        rtoViolations: params[7],
        totalDuration: params[8],
        rtoCompliancePercent: params[9],
        isCompliant: !!params[10],
        executiveSummary: params[11],
        technicalSummary: params[12],
        auditorChecklist: typeof params[13] === 'string' ? params[13] : JSON.stringify(params[13]),
        createdAt: params[14],
      };
      const { error } = await client.from('compliance_reports').upsert(item);
      if (error) throw error;
      return { changes: 1 };
    }

    if (sqlClean.startsWith('INSERT INTO audit_trail')) {
      const item = params.length === 9 ? {
        id: params[0],
        timestamp: params[1],
        userId: params[2],
        userEmail: params[3],
        userRole: params[4],
        action: params[5],
        details: params[6],
        drillId: params[7] || null,
        ipAddress: params[8],
      } : {
        id: params[0],
        timestamp: params[1],
        userId: params[2],
        userEmail: params[3],
        userRole: params[4],
        action: params[5],
        details: params[6],
        drillId: null,
        ipAddress: params[7],
      };
      const { error } = await client.from('audit_trail').insert(item);
      if (error) throw error;
      return { changes: 1, lastID: item.id };
    }

    if (sqlClean.startsWith('INSERT INTO users')) {
      const item = {
        id: params[0],
        username: params[1],
        email: params[2],
        passwordHash: params[3],
        role: params[4],
        createdAt: params[5],
      };
      const { error } = await client.from('users').insert(item);
      if (error) throw error;
      return { changes: 1, lastID: item.id };
    }

    if (sqlClean.startsWith('UPDATE users SET')) {
      const { error } = await client.from('users').update({
        role: params[0],
        username: params[1],
        email: params[2],
      }).eq('id', params[3]);
      if (error) throw error;
      return { changes: 1 };
    }

    if (sqlClean.startsWith('DELETE FROM users WHERE id = ?')) {
      const { error } = await client.from('users').delete().eq('id', params[0]);
      if (error) throw error;
      return { changes: 1 };
    }

    if (sqlClean.startsWith('INSERT INTO documents')) {
      const item = {
        id: params[0],
        fileName: params[1],
        uploadedBy: params[2],
        uploadDate: params[3],
        fileType: params[4],
        path: params[5],
      };
      const { error } = await client.from('documents').insert(item);
      if (error) throw error;
      return { changes: 1, lastID: item.id };
    }
  } catch (err: any) {
    console.warn(`[SUPABASE RUN WARNING] Detailed Error Log:\n` +
                  `- SQL Query: "${sql}"\n` +
                  `- Parameters: ${JSON.stringify(params)}\n` +
                  `- Error Message: ${err?.message || err}\n` +
                  `- Error Details: ${JSON.stringify(err)}`);
    throw err;
  }
  return null;
}
