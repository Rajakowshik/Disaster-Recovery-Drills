/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User roles for RBAC
export type UserRole = 'Admin' | 'Operator' | 'Auditor' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Action permission matrix
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Admin: ['upload_runbook', 'start_drill', 'stop_drill', 'execute_tools', 'view_reports', 'view_audit_trail', 'configure_settings'],
  Operator: ['start_drill', 'execute_tools', 'view_reports', 'view_audit_trail'],
  Auditor: ['view_reports', 'view_audit_trail'],
  Viewer: ['view_reports']
};

export interface RunbookStep {
  id: string;
  name: string;
  function: string;
  rtoTarget: number; // in seconds
  description: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'SKIPPED';
  duration?: number; // in seconds
  startedAt?: string;
  completedAt?: string;
  logs?: string[];
  output?: string;
  error?: string;
}

export interface Runbook {
  id: string;
  title: string;
  description: string;
  steps: RunbookStep[];
  rawMarkdown: string;
  createdAt: string;
}

export type AgentState = 'IDLE' | 'RUNBOOK_LOADED' | 'PLANNING' | 'EXECUTING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';

export interface Drill {
  id: string;
  runbookId: string;
  runbookTitle: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'CANCELLED';
  agentState: AgentState;
  startedAt: string;
  completedAt?: string;
  currentStepId?: string;
  steps: RunbookStep[];
  logs: string[];
  rtoComplianceRatio: number; // Percentage met
}

export interface ComplianceReport {
  drillId: string;
  drillTitle: string;
  totalSteps: number;
  passed: number;
  failed: number;
  skipped: number;
  rtoMet: number;
  rtoViolations: number;
  totalDuration: number; // in seconds
  rtoCompliancePercent: number; // e.g. 85.5%
  isCompliant: boolean;
  executiveSummary: string;
  technicalSummary: string;
  auditorChecklist: {
    rule: string;
    passed: boolean;
    evidence: string;
  }[];
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  details: string;
  drillId?: string;
  ipAddress: string;
}

export interface SystemMetrics {
  agentExecutionTimeAvg: number;
  drillSuccessRate: number;
  apiLatencyAvg: number;
  rtoComplianceAvg: number;
  activeDrillsCount: number;
  rateLimitHits: number;
  cacheHitRatio: number;
  cpuUsage: number;
  memoryUsage: number;
}
