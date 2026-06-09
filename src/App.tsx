/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Shield, FileText, Activity, Layers, RefreshCw, LogIn, UserPlus,
  Compass, AlertTriangle, AlertCircle, LayoutDashboard, Database, HelpCircle
} from 'lucide-react';

import { 
  Runbook, 
  Drill, 
  ComplianceReport, 
  AuditEvent, 
  SystemMetrics, 
  User, 
  UserRole 
} from './types';

import RunbookEditor from './components/RunbookEditor';
import AgentMonitor from './components/AgentMonitor';
import ComplianceViewer from './components/ComplianceViewer';
import DevOpsConsole from './components/DevOpsConsole';
import AuditTrail from './components/AuditTrail';

// Pre-seeded standard mock credentials
const DEFAULT_USER: User = {
  id: 'usr-1',
  name: 'Raj K.',
  email: 'rajakowshik813@gmail.com',
  role: 'Admin'
};

export default function App() {
  // Navigation & User State
  const [activeTab, setActiveTab] = useState<'runbooks' | 'agent' | 'compliance' | 'devops' | 'audit' | 'docs'>('agent');
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
  const [showRbacModal, setShowRbacModal] = useState(false);

  // Database / Telemetry State
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [selectedRunbook, setSelectedRunbook] = useState<Runbook | null>(null);
  const [activeReport, setActiveReport] = useState<ComplianceReport | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  // Interactive UI load indicators
  const [globalLoading, setGlobalLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Initial Seed Load
  useEffect(() => {
    fetchInitialTelemetry();
    
    // Interval polling for active status
    const interval = setInterval(() => {
      syncActiveDrillState();
      fetchGeneralMetrics();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeDrill?.id]);

  const fetchInitialTelemetry = async () => {
    setGlobalLoading(true);
    setErrorMessage('');
    try {
      const rbRes = await fetch('/api/runbooks');
      const rbs = await rbRes.json();
      setRunbooks(rbs);
      if (rbs.length > 0) {
        setSelectedRunbook(rbs[0]);
      }

      await fetchDrillsAndAudits();
      await fetchGeneralMetrics();
    } catch (err) {
      setErrorMessage('Failed to connect to backend microservices.');
    } finally {
      setGlobalLoading(false);
    }
  };

  const fetchDrillsAndAudits = async () => {
    try {
      const drillRes = await fetch('/api/drills');
      const drs = await drillRes.json();
      setDrills(drs);
      
      const runningDrill = drs.find((d: Drill) => d.status === 'RUNNING');
      if (runningDrill) {
        setActiveDrill(runningDrill);
        // Switch SRE instantly to active tracking
        setActiveTab('agent');
      }

      const auditRes = await fetch('/api/audit-trail');
      const audits = await auditRes.json();
      setAuditTrail(audits);
    } catch (err) {
      console.error('Failed to update log state', err);
    }
  };

  const fetchGeneralMetrics = async () => {
    try {
      const metRes = await fetch('/api/system/metrics');
      const data = await metRes.json();
      setSystemMetrics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const syncActiveDrillState = async () => {
    if (!activeDrill) return;
    try {
      const res = await fetch(`/api/drills/${activeDrill.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDrill(data);
        if (data.status !== 'RUNNING') {
          // Drill finalized, reload checks
          fetchDrillsAndAudits();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Upload/Parse Runbook Markdown API call
  const handleUploadRunbook = async (title: string, markdown: string) => {
    const res = await fetch('/api/runbooks/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        rawMarkdown: markdown,
        user: currentUser
      })
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to parse');
    }

    const data = await res.json();
    setRunbooks((prev) => [data, ...prev]);
    setSelectedRunbook(data);
    fetchDrillsAndAudits();
  };

  // Trigger SRE Agent Drill Start payload
  const handleStartDrill = async () => {
    if (!selectedRunbook) return;
    setErrorMessage('');
    try {
      const res = await fetch('/api/drills/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runbookId: selectedRunbook.id,
          user: currentUser
        })
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMessage(err.error || 'Concurrent Drill limit exceeded.');
        return;
      }

      const drill = await res.json();
      setActiveDrill(drill);
      setActiveTab('agent');
      fetchDrillsAndAudits();
    } catch {
      setErrorMessage('Failed to trigger SRE automated deployment checklist.');
    }
  };

  // Sync state machine changes back to database (observe/reason stages update this)
  const handleDrillUpdate = async (updatedDrill: Drill) => {
    setActiveDrill(updatedDrill);
    try {
      await fetch(`/api/drills/${updatedDrill.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDrill)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopDrill = async () => {
    if (!activeDrill) return;
    const cancelledDrill: Drill = {
      ...activeDrill,
      status: 'CANCELLED',
      agentState: 'IDLE',
      logs: [...activeDrill.logs, `[STATE: IDLE] Executive Drill terminated manually by administrator.`].slice(-100)
    };
    await handleDrillUpdate(cancelledDrill);
    setActiveDrill(null);
    fetchDrillsAndAudits();
  };

  // Generate Gemini Audited Compliance Reports
  const handleGenerateReport = async (drillId: string) => {
    setReportLoading(true);
    setActiveTab('compliance');
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drillId, user: currentUser })
      });
      const data = await res.json();
      setActiveReport(data.report);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  // Execute Security Rate limit flood
  const handleSimulateRateLimit = async () => {
    try {
      await fetch('/api/system/simulate-rate-limit', { method: 'POST' });
      fetchDrillsAndAudits();
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic privilege boundary checking for RBAC demonstration
  const checkPermission = (action: string): boolean => {
    const permissions: Record<UserRole, string[]> = {
      Admin: ['upload_runbook', 'start_drill', 'stop_drill', 'execute_tools', 'view_reports', 'view_audit_trail', 'configure_settings'],
      Operator: ['start_drill', 'execute_tools', 'view_reports', 'view_audit_trail'],
      Auditor: ['view_reports', 'view_audit_trail'],
      Viewer: ['view_reports']
    };
    return permissions[currentUser.role].includes(action);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-200 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header Section */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#111827] border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Shield className="w-4 h-4 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-md font-semibold tracking-tight text-white flex items-center gap-2 font-display">
              DR Drill <span className="text-blue-400">Walkthrough Agent</span>
              <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-900/40 text-blue-300 border border-blue-800 rounded uppercase tracking-wider ml-1">Production V2.4.0</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium font-sans">Auto-testing Disaster Failover & Continuous SLA validations</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Active Agent Mode banner */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Active Agent Mode</span>
            <span className={`font-mono text-xs flex items-center gap-1.5 ${activeDrill && activeDrill.status === 'RUNNING' ? 'text-emerald-400' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${activeDrill && activeDrill.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
              {activeDrill && activeDrill.status === 'RUNNING' ? 'AUTONOMOUS EXECUTION' : 'STANDBY IDLE'}
            </span>
          </div>

          <div className="hidden sm:block h-8 w-[1px] bg-slate-800"></div>

          {/* RBAC Credential token display switcher */}
          <div className="text-right">
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Credential Token</span>
            <button
              onClick={() => setShowRbacModal(true)}
              className="text-xs font-mono font-semibold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              🔑 {currentUser.role} ({currentUser.name.split(' ')[0]})
            </button>
          </div>

          {activeDrill && activeDrill.status === 'RUNNING' && (
            <>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <button
                onClick={handleStopDrill}
                className="px-4 py-2 bg-red-655 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors uppercase tracking-widest shadow-lg shadow-red-900/20 cursor-pointer"
              >
                Emergency Stop
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 grid grid-cols-12 gap-0">
        
        {/* Left Sidebar Menu */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 bg-[#0F172A] border-r border-b lg:border-b-0 border-slate-800 flex flex-col p-4">
          <nav className="flex-1 space-y-1">
            
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-2">Command</div>
            {[
              { id: 'agent' as const, label: 'Agent Monitor', icon: Compass },
              { id: 'runbooks' as const, label: 'Runbooks Desk', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all text-left cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-sm' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}

            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-8">Management</div>
            {[
              { id: 'compliance' as const, label: 'Compliance Reports', icon: Shield },
              { id: 'devops' as const, label: 'DevOps & SRE Analytics', icon: Activity },
              { id: 'audit' as const, label: 'Audit Trail Ledger', icon: Layers },
              { id: 'docs' as const, label: 'Systems Manuals', icon: HelpCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all text-left cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-sm' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Current Operator Profile */}
          <div className="p-2 border-t border-slate-850 mt-8 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-xs text-blue-400">
                RK
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">{currentUser.name}</span>
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">{currentUser.email}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="col-span-12 lg:col-span-9 xl:col-span-10 p-6 flex flex-col gap-6 overflow-y-auto bg-[#0B0F1A]">
          
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overall RTO Compliance</div>
              <div className="text-2xl font-semibold text-emerald-400 mt-1">{systemMetrics?.rtoComplianceAvg || 98.4}%</div>
              <div className="text-[10px] text-slate-500 mt-1">SLA guarantee performance</div>
            </div>
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Active Drill Target</div>
              <div className="text-md font-semibold text-white mt-1.5 truncate">
                {activeDrill ? (activeDrill.runbookTitle || '').slice(0, 18) + '...' : 'DR-STANDBY_IDLE'}
              </div>
              <div className="text-[10px] text-blue-400 mt-1 font-mono uppercase">
                {activeDrill ? `Stage: ${activeDrill.agentState}` : 'Ready for dispatch'}
              </div>
            </div>
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sans">Live API Latency</div>
              <div className="text-2xl font-semibold text-white mt-1">
                {systemMetrics?.apiLatencyAvg || 14} <span className="text-xs text-slate-600">ms</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[40%]"></div>
              </div>
            </div>
            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Health status</div>
              <div className="text-2xl font-semibold text-white mt-1">Optimal</div>
              <div className="flex gap-1 mt-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 opacity-50"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 opacity-20"></div>
              </div>
            </div>
          </div>

          {/* API Error alerts */}
          {errorMessage && (
            <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs px-4 py-3 rounded-xl flex items-center justify-between gap-2 shadow animate-bounce">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage('')} className="text-red-400 font-bold hover:underline font-mono">Dismiss</button>
            </div>
          )}

          {/* Viewport switch container */}
          <div className="flex-1 min-h-0">
            {globalLoading ? (
              <div className="flex flex-col justify-center items-center py-40">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <span className="text-sm font-medium text-slate-400 tracking-wide">Initializing telemetry channels...</span>
              </div>
            ) : (
              <div id="active-viewport-card" className="space-y-6">
                
                {activeTab === 'runbooks' && (
                  <RunbookEditor
                    runbooks={runbooks}
                    onUpload={handleUploadRunbook}
                    onSelect={setSelectedRunbook}
                    selectedRunbook={selectedRunbook}
                    activeDrillRunning={!!activeDrill && activeDrill.status === 'RUNNING'}
                    onStartDrill={handleStartDrill}
                    currentUser={currentUser}
                  />
                )}

                {activeTab === 'agent' && (
                  <AgentMonitor
                    drill={activeDrill}
                    onDrillUpdate={handleDrillUpdate}
                    onStopDrill={handleStopDrill}
                    onGenerateReport={handleGenerateReport}
                  />
                )}

                {activeTab === 'compliance' && (
                  <ComplianceViewer
                    report={activeReport}
                    selectedDrill={activeDrill || (drills.length > 0 ? drills[0] : null)}
                    loading={reportLoading}
                  />
                )}

                {activeTab === 'devops' && (
                  <DevOpsConsole
                    metrics={systemMetrics}
                    onRefreshMetrics={fetchGeneralMetrics}
                    onSimulateRateLimit={handleSimulateRateLimit}
                  />
                )}

                {activeTab === 'audit' && (
                  <AuditTrail auditTrail={auditTrail} />
                )}

                {activeTab === 'docs' && (
                  <div id="manuals-view" className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-500" />
                        System Manual: Disaster Recovery (DR) Orchestration
                      </h2>
                      <p className="text-xs text-slate-400 mt-1 font-sans">Written by SRE Technical Advisory Board.</p>
                    </div>

                    <div className="prose prose-invert prose-xs text-slate-400 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-200">1. Architectural Blueprint</h3>
                      <p className="text-xs leading-relaxed">
                        This drill walkthrough agent acts as an autonomous execution plane inside localized subnets, validating configurations. It operates using the Observe-Reason-Plan-Execute-Verify state tracker, maintaining continuous TLS checks.
                      </p>

                      <h3 className="text-sm font-semibold text-slate-200">2. Security Parameters</h3>
                      <p className="text-xs leading-relaxed">
                        Authentication triggers JWT tokens with refresh options over secure TLS ports. Rates are limited by sliding-window buckets (Redis default: 30 requests/30s maximum per source subnet pointer).
                      </p>

                      <h3 className="text-sm font-semibold text-slate-200">3. RTO SLA Targets</h3>
                      <p className="text-xs leading-relaxed">
                        Timeline goals are compared automatically via synthetic test blocks. If promotion latencies exceed targets, warning alerts are logged directly within the compliance audit records.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Footer Status Bar inside Right Column */}
          <footer className="h-12 bg-[#111827] border border-slate-800 rounded-lg flex items-center px-6 justify-between shrink-0 text-xs text-slate-500 mt-4">
            <div className="flex gap-8">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-sans">SLA Target</span>
                <span className="text-[10px] text-emerald-500 font-mono">0 Unresolved</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-sans font-medium">PostgreSQL</span>
                <span className="text-[10px] text-emerald-500 font-mono">Connected (2ms)</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-600 font-mono">TRACER-ID: F9A-22B1-X</span>
              <div className="h-4 w-[1px] bg-slate-800"></div>
              <span className="text-[10px] text-slate-500 font-mono">Region: <span className="text-white font-semibold">us-east-1a</span></span>
            </div>
          </footer>

        </main>
      </div>

      {/* RBAC Simulation Modal Dialog */}
      {showRbacModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-md font-bold text-slate-100 flex items-center gap-2 font-display">
                🔐 Toggle Role-Based Access Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Dynamically switch active privileges to evaluate system permissions boundaries for compliance test evaluations.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { role: 'Admin' as const, label: 'Admin (Full Scope Executions)', desc: 'Has complete access to uploads, runs, tools, metrics, settings.' },
                { role: 'Operator' as const, label: 'Operator (Run Trigger Allowed)', desc: 'Has access to trigger drills and view log results.' },
                { role: 'Auditor' as const, label: 'Compliance Auditor', desc: 'Read-only access restricted solely to auditor checklists and reports.' },
                { role: 'Viewer' as const, label: 'Viewer (Read Only)', desc: 'General visitor access block, restricted parameters.' }
              ].map((matrix) => (
                <div
                  key={matrix.role}
                  onClick={() => {
                    setCurrentUser({ ...currentUser, role: matrix.role });
                    setShowRbacModal(false);
                  }}
                  className={`border p-3 rounded-lg cursor-pointer transition-all ${
                    currentUser.role === matrix.role
                      ? 'bg-blue-950/40 border-blue-500 shadow-sm'
                      : 'bg-[#0B0F1A] border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-200 block">{matrix.label}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{matrix.desc}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRbacModal(false)}
                className="bg-[#0B0F1A] hover:bg-slate-900 border border-slate-800 hover:border-slate-705 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
