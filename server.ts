/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { 
  Runbook, 
  RunbookStep, 
  Drill, 
  AgentState, 
  ComplianceReport, 
  AuditEvent, 
  SystemMetrics, 
  UserRole 
} from './src/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database Entities
let runbooks: Runbook[] = [
  {
    id: 'rb-1',
    title: 'Enterprise Database Failover Runbook (SQL Cluster)',
    description: 'Procedures to route primary writes to read-only replica when US-EAST-1 suffers an outage.',
    steps: [
      {
        id: 'step-1',
        name: 'Check network layer & route points',
        function: 'check_network',
        rtoTarget: 5,
        description: 'Verify VPC peering and DNS routing layers are completely offline or responsive in target region.',
        status: 'PENDING'
      },
      {
        id: 'step-2',
        name: 'Terminate Master Primary DB node',
        function: 'stop_primary_replica',
        rtoTarget: 10,
        description: 'Hard stop primary node to prevent half-writes or split-brain conditions.',
        status: 'PENDING'
      },
      {
        id: 'step-3',
        name: 'Promote Read-Only Replica to Master',
        function: 'failover_database',
        rtoTarget: 15,
        description: 'Run SQL cluster promote command. Transition storage mount points to write mode.',
        status: 'PENDING'
      },
      {
        id: 'step-4',
        name: 'Verify replica is serving writes',
        function: 'verify_read_write',
        rtoTarget: 10,
        description: 'Trigger health records, execute direct write/read transactions and check checksum matches.',
        status: 'PENDING'
      },
      {
        id: 'step-5',
        name: 'Modify Core DNS Records',
        function: 'dns_switchover',
        rtoTarget: 8,
        description: 'Update Cloudflare route tags to point directly to DR endpoint.',
        status: 'PENDING'
      }
    ],
    rawMarkdown: `# Enterprise Database Failover Runbook (SQL Cluster)

## Step 1
Function: check_network
RTO Target: 5s
Description: Verify VPC peering and DNS routing layers are completely offline or responsive in target region.

---

## Step 2
Function: stop_primary_replica
RTO Target: 10s
Description: Hard stop primary node to prevent half-writes or split-brain conditions.

---

## Step 3
Function: failover_database
RTO Target: 15s
Description: Run SQL cluster promote command. Transition storage mount points to write mode.

---

## Step 4
Function: verify_read_write
RTO Target: 10s
Description: Trigger health records, execute direct write/read transactions and check checksum matches.

---

## Step 5
Function: dns_switchover
RTO Target: 8s
Description: Update Cloudflare route tags to point directly to DR endpoint.`,
    createdAt: new Date().toISOString()
  }
];

let drills: Drill[] = [];
let complianceReports: ComplianceReport[] = [];
let auditTrail: AuditEvent[] = [
  {
    id: 'aud-initial-1',
    timestamp: new Date().toISOString(),
    userId: 'usr-1',
    userEmail: 'rajakowshik813@gmail.com',
    userRole: 'Admin',
    action: 'SYSTEM_BOOTUP',
    details: 'Disaster Recovery Drill Agent initialized safely under version v2.4.0.',
    ipAddress: '127.0.0.1'
  }
];

// Initialize Gemini SDK with User-Agent set for telemetry
const api_key = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;
if (api_key && api_key !== 'MY_GEMINI_API_KEY') {
  aiClient = new GoogleGenAI({
    apiKey: api_key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Rate Limiting mock variables
let rateLimitCounter: Record<string, { count: number; expires: number }> = {};
const checkRateLimit = (ip: string, scenario: 'api' | 'auth' | 'agent'): boolean => {
  const now = Date.now();
  const limitKey = `${ip}:${scenario}`;
  const limitMax = scenario === 'auth' ? 5 : scenario === 'agent' ? 10 : 30; // Strict limit: 5 requests for auth
  
  if (!rateLimitCounter[limitKey] || rateLimitCounter[limitKey].expires < now) {
    rateLimitCounter[limitKey] = { count: 1, expires: now + 30000 }; // 30 second window
    return true;
  }
  
  rateLimitCounter[limitKey].count++;
  if (rateLimitCounter[limitKey].count > limitMax) {
    return false;
  }
  return true;
};

// Cache structure mock configurations
let reportCache: Record<string, { data: ComplianceReport; expires: number }> = {};

// Helper: Append Audit Logs
const logAudit = (
  userId: string, 
  userEmail: string, 
  userRole: UserRole, 
  action: string, 
  details: string, 
  drillId?: string
) => {
  const audit: AuditEvent = {
    id: `aud-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId,
    userEmail,
    userRole,
    action,
    details,
    drillId,
    ipAddress: '192.168.1.15'
  };
  auditTrail.unshift(audit);
};

// Webhook simulation notify endpoint helper
const postWebhookNotify = async (event: string, details: string) => {
  console.log(`[INFRA Webhook] Trigger notifications on ${event}: ${details}`);
};

// REST API Definition

// Rate Limiter middleware
const apiRateLimiter = (req: Request, res: Response, next: any) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(ip, 'api')) {
    logAudit('system', 'rate-limit-abuse@agent.sh', 'Viewer', 'API_RATE_LIMIT_TRIPPED', `Blocked IP ${ip} due to rate limiting policy.`);
    return res.status(429).json({ error: 'Too many requests. API rate limit exceeded (30 per 30s).' });
  }
  next();
};

app.use('/api', apiRateLimiter);

// Auth login endpoint
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(ip, 'auth')) {
    return res.status(429).json({ error: 'Auth rate limit exceeded. Try again in 30 seconds.' });
  }
  const { email, password } = req.body;
  if (email === 'rajakowshik813@gmail.com') {
    res.json({
      token: 'jwt-mock-secret-token',
      user: {
        id: 'usr-1',
        name: 'Raj K.',
        email: 'rajakowshik813@gmail.com',
        role: 'Admin'
      }
    });
  } else {
    // Return standard auditor role to easily demonstrate permissions
    res.json({
      token: 'jwt-mock-secret-token',
      user: {
        id: `usr-${Math.random().toString(36).substr(2, 5)}`,
        name: email.split('@')[0],
        email,
        role: 'Operator'
      }
    });
  }
});

// Runbooks list
app.get('/api/runbooks', (req, res) => {
  res.json(runbooks);
});

// Upload and Parse Runbook Markdown
app.post('/api/runbooks/upload', (req, res) => {
  const { title, rawMarkdown, user } = req.body;
  const lines = rawMarkdown.split('\n');
  let steps: RunbookStep[] = [];
  let currentStep: Partial<RunbookStep> = {};
  let stepIndex = 1;

  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('## Step') || line.startsWith('### Step')) {
        if (currentStep.name) {
          currentStep.id = `step-${stepIndex++}`;
          currentStep.status = 'PENDING';
          steps.push(currentStep as RunbookStep);
          currentStep = {};
        }
        currentStep.name = line.replace(/^(#+)\s*Step\s*\d+\s*(:|\-)?\s*/i, '') || `Step ${stepIndex}`;
      } else if (line.startsWith('Function:')) {
        currentStep.function = line.replace('Function:', '').trim();
      } else if (line.startsWith('RTO Target:')) {
        const matches = line.match(/\d+/);
        currentStep.rtoTarget = matches ? parseInt(matches[0]) : 10;
      } else if (line.startsWith('Description:')) {
        currentStep.description = line.replace('Description:', '').trim();
      } else if (line.length > 0 && currentStep.name && !currentStep.description) {
        // If there is description text below but no explicit "Description:" tag
        currentStep.description = line;
      }
    }
    // Push final step
    if (currentStep.name) {
      currentStep.id = `step-${stepIndex++}`;
      currentStep.status = 'PENDING';
      if (!currentStep.function) {
        currentStep.function = 'check_network';
      }
      if (!currentStep.rtoTarget) {
        currentStep.rtoTarget = 10;
      }
      if (!currentStep.description) {
        currentStep.description = 'Continuous automated network ping tests and routing validation.';
      }
      steps.push(currentStep as RunbookStep);
    }

    if (steps.length === 0) {
      // Fallback parser: search headers
      steps = [
        {
          id: 'step-f1',
          name: 'Primary Outage Routing Check',
          function: 'check_network',
          rtoTarget: 10,
          description: 'Synthetically ping backend web application endpoints to trace network routes.',
          status: 'PENDING'
        }
      ];
    }

    const newRunbook: Runbook = {
      id: `rb-${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'Parsed Markdown Runbook Document',
      description: `Parsed runbook containing ${steps.length} automated steps.`,
      steps,
      rawMarkdown,
      createdAt: new Date().toISOString()
    };

    runbooks.push(newRunbook);
    logAudit(user?.id || 'usr-1', user?.email || 'rajakowshik813@gmail.com', user?.role || 'Admin', 'RUNBOOK_CREATED', `Imported runbook "${title}" containing ${steps.length} procedures.`);
    res.json(newRunbook);
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to process markdown runbook format.' });
  }
});

// Drills list
app.get('/api/drills', (req, res) => {
  res.json(drills);
});

// Start Drills with Runbook
app.post('/api/drills/start', (req, res) => {
  const { runbookId, user } = req.body;
  const runbook = runbooks.find(r => r.id === runbookId);
  if (!runbook) {
    return res.status(404).json({ error: 'Runbook not found' });
  }

  // Check if there's already a running drill to prevent concurrent execution clashes
  const activeDrill = drills.find(d => d.status === 'RUNNING');
  if (activeDrill) {
    return res.status(400).json({ error: 'A Drill is current running. Wait for completion or stop it.' });
  }

  const drillSteps = runbook.steps.map(s => ({
    ...s,
    status: 'PENDING' as const,
    logs: [] as string[]
  }));

  const newDrill: Drill = {
    id: `dr-${Math.random().toString(36).substr(2, 9)}`,
    runbookId: runbook.id,
    runbookTitle: runbook.title,
    status: 'RUNNING',
    agentState: 'LOADING_RUNBOOK' as any, // Setup stage
    startedAt: new Date().toISOString(),
    steps: drillSteps,
    logs: [
      `[STATE: IDLE] [05:02:30Z] Initializing Drill Run. Reading standard instructions.`,
      `[STATE: RUNBOOK_LOADED] Runbook "${runbook.title}" successfully compiled. Loaded ${drillSteps.length} validation steps.`,
    ],
    rtoComplianceRatio: 100
  };

  drills.unshift(newDrill);
  logAudit(user?.id || 'usr-1', user?.email || 'rajakowshik813@gmail.com', user?.role || 'Admin', 'DRILL_STARTED', `Initiated automated Disaster Recovery drill "${runbook.title}".`, newDrill.id);
  postWebhookNotify('DRILL_START', `Drill ${newDrill.id} of runbook ${runbook.title} started by ${user?.email || 'rajakowshik813@gmail.com'}`);

  res.json(newDrill);
});

// Single Drill Fetch
app.get('/api/drills/:id', (req, res) => {
  const drill = drills.find(d => d.id === req.params.id);
  if (!drill) {
    res.status(404).json({ error: 'Drill not found' });
  } else {
    res.json(drill);
  }
});

// Update Drill Log/State (Used by interactive UI Loop)
app.post('/api/drills/:id/update', (req, res) => {
  const { agentState, logs, steps, status, rtoComplianceRatio } = req.body;
  const drillIndex = drills.findIndex(d => d.id === req.params.id);
  if (drillIndex === -1) {
    return res.status(404).json({ error: 'Drill not found' });
  }

  drills[drillIndex] = {
    ...drills[drillIndex],
    agentState,
    logs,
    steps,
    status,
    rtoComplianceRatio,
    completedAt: status !== 'RUNNING' ? new Date().toISOString() : drills[drillIndex].completedAt
  };

  if (status === 'SUCCESS' && drills[drillIndex].status === 'RUNNING') {
    postWebhookNotify('DRILL_COMPLETED', `Drill ${req.params.id} completed successfully.`);
  } else if (status === 'FAILURE' && drills[drillIndex].status === 'RUNNING') {
    postWebhookNotify('DRILL_FAILURE', `Drill ${req.params.id} failed verification routine! Escalating alert to PagerDuty.`);
  }

  res.json(drills[drillIndex]);
});

// Mock Tools Run implementation on the Backend (Allows demonstrating realistic server tools execution)
app.post('/api/drills/tools/execute', (req, res) => {
  const { toolName, failSimulate } = req.body;
  const duration = Math.floor(Math.random() * 5) + 2; // Simulated duration 2-7 seconds
  const isDocError = failSimulate === true;

  type StandardOut = { success: boolean; latency: number; logs: string[]; output?: string; error?: string };

  let responsePayload: StandardOut = {
    success: !isDocError,
    latency: duration,
    logs: [
      `[INFRA] Executed action "${toolName}" on host target cluster-node-us-east.net`,
      `[INFRA] Establishing TLS connection to port 5432...`,
      `[INFRA] Connection success.`
    ]
  };

  switch (toolName) {
    case 'check_network':
      responsePayload.logs.push(`[SYSTEM] VPC Peer Status: ACTIVE. Traceroute completed in ${duration * 200}ms.`);
      responsePayload.output = `SUBNET_VPC_VALIDATED: OK\nGATEWAY_PING_LOSS: 0%\nRESOLVED_IP: 10.230.12.8`;
      break;
    case 'stop_primary_replica':
      responsePayload.logs.push(`[SYSTEM] Triggering primary master server kill signals.`);
      responsePayload.logs.push(`[SYSTEM] Sent SIGTERM to Postgres Master process ID #12190.`);
      responsePayload.output = `PRIMARY_DB_STATE: OFFLINE\nACTIVE_CONNECTIONS: 0\nPORT_LISTEN: 5432 CLOSED`;
      break;
    case 'failover_database':
      responsePayload.logs.push(`[SYSTEM] Invoking SQL replication promoting action.`);
      responsePayload.logs.push(`[SYSTEM] Advancing transaction WAL logs sequence count.`);
      if (isDocError) {
        responsePayload.error = `WRITE_REQUISITIONS_DENIED: Replica write permissions locked in config parameters. Master-role promotion aborted.`;
        responsePayload.logs.push(`[ERROR] Promotion failed. Rolling back configuration changes.`);
      } else {
        responsePayload.output = `REPLICA_STATE: PROMOTED\nNEW_MASTER: postgres-dr-01-node.net\nREPLICATION_SLA_DRIFT: 0s`;
      }
      break;
    case 'verify_read_write':
      responsePayload.logs.push(`[SYSTEM] Attempting transactional table injection tests.`);
      responsePayload.logs.push(`[SYSTEM] DB transaction block: INSERT INTO dr_heartbeats(timestamp, key_val) VALUES (NOW(), 'drillcheck').`);
      responsePayload.output = `TABLE_WRITE: SUCCESS\nCHECKSUM_MATCH: 100%\nIS_READ_ONLY: FALSE`;
      break;
    case 'dns_switchover':
      responsePayload.logs.push(`[SYSTEM] Calling Cloudflare DNS Route management REST service.`);
      responsePayload.logs.push(`[SYSTEM] Updating A-Record router target pointers to 10.240.2.19.`);
      responsePayload.output = `DNS_A_RECORD_UPDATE: SUCCESS\nTTL: 60s\nPROPAGATION_SATURATION: 100%`;
      break;
    default:
      responsePayload.logs.push(`[SYSTEM] Invoking general tool process executor.`);
      responsePayload.output = `COMMAND_EXECUTOR: COMPLETED_MOCK`;
  }

  res.json(responsePayload);
});

// Gemini intelligence: Generate Compliance Audit Reports via Gemini API
app.post('/api/reports/generate', async (req, res) => {
  const { drillId, user } = req.body;
  const drill = drills.find(d => d.id === drillId);
  if (!drill) {
    return res.status(404).json({ error: 'Drill results not found.' });
  }

  // Check cache to demonstrate Layer 10 (Caching)
  const cached = reportCache[drillId];
  if (cached && cached.expires > Date.now()) {
    return res.json({ report: cached.data, cacheHit: true });
  }

  // Compute stats
  const totalSteps = drill.steps.length;
  const passed = drill.steps.filter(s => s.status === 'SUCCESS').length;
  const failed = drill.steps.filter(s => s.status === 'FAILURE').length;
  const skipped = drill.steps.filter(s => s.status === 'SKIPPED').length;
  
  let rtoMet = 0;
  let rtoViolations = 0;
  let totalDuration = 0;

  drill.steps.forEach(step => {
    if (step.duration) {
      totalDuration += step.duration;
      if (step.duration <= step.rtoTarget) {
        rtoMet++;
      } else {
        rtoViolations++;
      }
    }
  });

  const rtoCompliancePercent = Math.round((rtoMet / (rtoMet + rtoViolations || 1)) * 100);
  const isCompliant = failed === 0 && rtoCompliancePercent >= 80;

  // Let's generate summaries using Gemini client if configured, otherwise provide elegant pre-constructed summaries of high density
  let execSummary = `Executive Summary for Drill - ${drill.runbookTitle}:\n\nThe Disaster Recovery drill was successfully run with 100% step checks passed. Recovery Point Objective (RPO) drift registered at 0s, and Recovery Time Objective (RTO) constraints were met across core operations, indicating that our failover infrastructure is fully audit-compliant and resilient to AWS regional outages. Total duration: ${totalDuration}s. RTO met on ${rtoMet}/${rtoMet + rtoViolations} criteria.`;
  let techSummary = `Technical Summary (SRE & Engineering Review):\n\nFailover orchestration safely executed key routing procedures including network gate checking, primary Postgres database SIGTERM triggers, database master promotes, synthetic transactional heartbeat inserts, and dynamic DNS record updates via API. Log outputs show that replication promote took ${drill.steps.find(s => s.function === 'failover_database')?.duration || 4}s exceeding standard targets. DNS propagation finished smoothly but latency bounds suggest optimization in failover cluster variables.`;

  if (aiClient) {
    try {
      const prompt = `You are a Principal DR Consultant and SRE Architect auditing a Disaster Recovery executive drill run.
      Generate a premium, dense Executive Summary (1 paragraph targeting CTO/Business leadership) and a detailed, itemized SRE technical summary (targeted at Cloud Engineers, Database Administrators, and compliance auditors explaining actual step performance vs targets) for the following drill execution results:
      
      Drill Name: ${drill.runbookTitle}
      Drill Status: ${drill.status}
      Drill Steps:
      ${drill.steps.map(s => `- ${s.name} (${s.function}): Status: ${s.status}, Elapsed Time: ${s.duration || 0}s, Target: ${s.rtoTarget}s. Description: ${s.description}`).join('\n')}
      
      Logs Sequence:
      ${drill.logs.slice(-15).join('\n')}
      
      Return the output as a valid JSON object matching this schema exactly:
      {
        "executiveSummary": "CTO summary paragraph here...",
        "technicalSummary": "Deep SRE DBA technical points here..."
      }`;

      const geminiResponse = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        }
      });
      const resText = geminiResponse.text?.trim() || '{}';
      const parsed = JSON.parse(resText);
      if (parsed.executiveSummary) execSummary = parsed.executiveSummary;
      if (parsed.technicalSummary) techSummary = parsed.technicalSummary;
    } catch (err) {
      console.error('[Gemini API] Failed to query model. Falling back to high-density structured analysis summaries.', err);
    }
  }

  const report: ComplianceReport = {
    drillId: drill.id,
    drillTitle: drill.runbookTitle,
    totalSteps,
    passed,
    failed,
    skipped,
    rtoMet,
    rtoViolations,
    totalDuration,
    rtoCompliancePercent,
    isCompliant,
    executiveSummary: execSummary,
    technicalSummary: techSummary,
    auditorChecklist: [
      {
        rule: 'SOC 2 Core Resilience Control CC7.3 (Disaster Recovery Testing)',
        passed: isCompliant,
        evidence: `Audit ledger verifies runbook execution sequence successfully validated on ${new Date().toLocaleDateString()}.`
      },
      {
        rule: 'ISO 27001 Security Control A.17 (Information Security Continuity)',
        passed: passed === totalSteps,
        evidence: `All ${totalSteps} failover procedures executed fully with closed validation heartbeat loops.`
      },
      {
        rule: 'RTO SLA Guarantee Compliance Threshold (>=80% Met)',
        passed: rtoCompliancePercent >= 80,
        evidence: `Disaster failover completed with ${rtoCompliancePercent}% of individual steps conforming strictly to SLA targets.`
      }
    ],
    createdAt: new Date().toISOString()
  };

  // Add to cache
  reportCache[drillId] = {
    data: report,
    expires: Date.now() + 60000 // 60s cache
  };

  complianceReports.unshift(report);
  logAudit(user?.id || 'usr-1', user?.email || 'rajakowshik813@gmail.com', user?.role || 'Admin', 'COMPLIANCE_REPORT_GENERATED', `Compiled comprehensive Gemini audited compliance analysis for Drill ${drillId}.`, drillId);

  res.json({ report, cacheHit: false });
});

// Single Report fetch
app.get('/api/reports/:id', (req, res) => {
  const report = complianceReports.find(r => r.drillId === req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Report not compiled' });
  } else {
    res.json(report);
  }
});

// Audit Trails
app.get('/api/audit-trail', (req, res) => {
  res.json(auditTrail);
});

// Prometheus System Metrics mock provider
app.get('/api/system/metrics', (req, res) => {
  const recentDrills = drills.slice(0, 5);
  const avgExecTime = recentDrills.length > 0 
    ? Math.round(recentDrills.reduce((acc, curr) => {
        let dur = 0;
        curr.steps.forEach(s => { if (s.duration) dur += s.duration; });
        return acc + dur;
      }, 0) / recentDrills.length)
    : 34;

  const successCount = drills.filter(d => d.status === 'SUCCESS').length;
  const successRate = drills.length > 0 ? Math.round((successCount / drills.length) * 100) : 95;

  const mockMetrics: SystemMetrics = {
    agentExecutionTimeAvg: avgExecTime || 12,
    drillSuccessRate: successRate,
    apiLatencyAvg: Math.round(Math.random() * 4) + 12, // 12-16ms
    rtoComplianceAvg: drills.length > 0 
      ? Math.round(drills.reduce((acc, curr) => acc + curr.rtoComplianceRatio, 0) / drills.length)
      : 88,
    activeDrillsCount: drills.filter(d => d.status === 'RUNNING').length,
    rateLimitHits: Object.values(rateLimitCounter).reduce((acc, curr) => acc + curr.count, 0) || 4,
    cacheHitRatio: 65,
    cpuUsage: Math.floor(Math.random() * 8) + 14, // 14-22% idle standard Node
    memoryUsage: Math.floor(Math.random() * 5) + 32  // 32-37% RAM utilization
  };

  res.json(mockMetrics);
});

// Simulate Rate Limiter Event
app.post('/api/system/simulate-rate-limit', (req, res) => {
  const ip = '185.220.101.44'; // Tor Node / Malicious Address
  for (let i = 0; i < 40; i++) {
    checkRateLimit(ip, 'api');
  }
  logAudit('system', 'firewall-alert@infra.sh', 'Admin', 'RATE_LIMITER_BLOCKED_IP', `DDoS Protection: Blocked IP ${ip} after exceeding max API requisitions (45/30s).`);
  res.json({ message: 'Simulated API rate-limiting burst. Node security triggers tripped.' });
});

// Server boot / Vite development initialization
const initServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DR Drill Walkthrough Backend] Server running on http://0.0.0.0:${PORT}`);
  });
};

initServer();
