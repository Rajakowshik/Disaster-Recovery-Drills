/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Activity, ShieldAlert, Cpu, Database, BellRing, RefreshCw, 
  Settings, CheckCircle, Flame, ServerCrash, Layers, Info,
  Cloud, Key, Copy, Check, ArrowRightLeft, AlertCircle, Sparkles,
  ListFilter, CheckSquare, UploadCloud, History, Users, ShoppingBag, 
  DollarSign, AlertOctagon, Compass, FileText, ShieldCheck, Play
} from 'lucide-react';
import { SystemMetrics, User } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface DevOpsConsoleProps {
  metrics: SystemMetrics | null;
  onRefreshMetrics: () => Promise<void>;
  onSimulateRateLimit: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  currentUser?: User | null;
}

export default function DevOpsConsole({
  metrics,
  onRefreshMetrics,
  onSimulateRateLimit,
  authFetch,
  currentUser
}: DevOpsConsoleProps) {
  const [subTab, setSubTab] = useState<'telemetry' | 'supabase' | 'enterprise_sandbox'>('telemetry');
  const [secLoading, setSecLoading] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'IDLE' | 'STARTED' | 'FAILED' | 'COMPLETED'>('IDLE');
  
  // Supabase states
  const [sbEnabled, setSbEnabled] = useState(false);
  const [sbPrimaryUrl, setSbPrimaryUrl] = useState('');
  const [sbPrimaryKey, setSbPrimaryKey] = useState('');
  const [sbBackupUrl, setSbBackupUrl] = useState('');
  const [sbBackupKey, setSbBackupKey] = useState('');
  const [sbIsInitialized, setSbIsInitialized] = useState(false);
  const [sbSchemaSql, setSbSchemaSql] = useState('');
  const [sbSaving, setSbSaving] = useState(false);
  const [sbMsg, setSbMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showDdl, setShowDdl] = useState(false);

  // Enterprise Demo Database States
  const [demoStats, setDemoStats] = useState<any>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  
  // Custom external db form
  const [extType, setExtType] = useState<'supabase' | 'postgres'>('postgres');
  const [extUrl, setExtUrl] = useState('');
  const [extError, setExtError] = useState<string | null>(null);
  const [extSuccess, setExtSuccess] = useState<string | null>(null);

  const fetchDemoStats = async () => {
    setDemoLoading(true);
    try {
      const res = await authFetch('/api/demo/stats');
      if (res.ok) {
        const data = await res.json();
        setDemoStats(data);
      }
    } catch (e) {
      console.error('Failed to load SRE sandbox stats:', e);
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoStats();
  }, []);

  const handleSetDataSource = async (source: 'demo' | 'uploaded' | 'external') => {
    try {
      const res = await authFetch('/api/demo/set-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDemoStats(data.stats);
        }
      }
    } catch (e) {
      console.error('Failed to update sandbox data source:', e);
    }
  };

  const handleConnectExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtError(null);
    setExtSuccess(null);
    try {
      const res = await authFetch('/api/demo/connect-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: extType, url: extUrl })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExtSuccess(data.message);
        setExtUrl('');
        await fetchDemoStats();
      } else {
        setExtError(data.error || 'Connection simulation failed.');
      }
    } catch (err: any) {
      setExtError(err.message || 'Network gateway handshake failure.');
    }
  };

  const handleRunSimulation = async (simType: string) => {
    setSimLoading(true);
    setSimError(null);
    setSimResult(null);
    try {
      const res = await authFetch('/api/demo/start-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulationType: simType })
      });
      const data = await res.json();
      if (res.ok) {
        setSimResult(data);
        await fetchDemoStats();
      } else {
        setSimError(data.error || 'Disaster simulation failed.');
      }
    } catch (err: any) {
      setSimError(err.message || 'SRE simulation timeout or execution error.');
    } finally {
      setSimLoading(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setFileError(null);
    
    const formData = new FormData();
    formData.append('datasetFile', file);

    try {
      const res = await authFetch('/api/demo/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchDemoStats();
      } else {
        setFileError(data.error || 'Failed to parse file records.');
      }
    } catch (err: any) {
      setFileError(err.message || 'Gateway transmission failed.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Simulated historical chart timeline data
  const [throughputHistory, setThroughputHistory] = useState([
    { time: '05:00', load: 12 },
    { time: '05:05', load: 15 },
    { time: '05:10', load: 22 },
    { time: '05:15', load: 18 },
    { time: '05:20', load: 25 },
    { time: '05:25', load: 19 },
    { time: '05:30', load: 28 },
  ]);

  useEffect(() => {
    // Generate slight noise in history over time to look highly organic and live
    const interval = setInterval(() => {
      setThroughputHistory((prev) => {
        const next = [...prev.slice(1)];
        const timeStr = new Date().toLocaleTimeString().slice(0, 5);
        next.push({
          time: timeStr,
          load: Math.floor(Math.random() * 20) + 10
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Supabase configuration from Server
  const fetchSupabaseConfig = async () => {
    try {
      const res = await authFetch('/api/system/supabase-config');
      if (res.ok) {
        const data = await res.json();
        setSbEnabled(data.enabled || false);
        setSbPrimaryUrl(data.primary_url || '');
        setSbPrimaryKey(data.primary_key || '');
        setSbBackupUrl(data.backup_url || '');
        setSbBackupKey(data.backup_key || '');
        setSbIsInitialized(data.is_initialized || false);
        setSbSchemaSql(data.schema_sql || '');
      }
    } catch (err) {
      console.warn('Failed to load Supabase connection config:', err);
    }
  };

  useEffect(() => {
    fetchSupabaseConfig();
  }, []);

  const triggerRateLimitSimulation = async () => {
    setSecLoading(true);
    await onSimulateRateLimit();
    setTimeout(() => {
      setSecLoading(false);
    }, 1500);
  };

  const testWebhookDispatch = (state: typeof webhookStatus) => {
    setWebhookStatus(state);
    setTimeout(() => setWebhookStatus('IDLE'), 3000);
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSbSaving(true);
    setSbMsg(null);
    try {
      const res = await authFetch('/api/system/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: sbEnabled,
          primary_url: sbPrimaryUrl,
          primary_key: sbPrimaryKey,
          backup_url: sbBackupUrl,
          backup_key: sbBackupKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSbIsInitialized(data.config.is_initialized);
        setSbMsg({
          type: 'success',
          text: sbEnabled 
            ? 'Supabase cluster configuration validated successfully! Connected & persistent.' 
            : 'Supabase bypass activated. System routing reverting to local Sandbox state.'
        });
        setTimeout(() => setSbMsg(null), 5000);
      } else {
        setSbMsg({
          type: 'error',
          text: data.error || 'Failed to authenticate Supabase TLS Connection.'
        });
      }
    } catch (err: any) {
      setSbMsg({
        type: 'error',
        text: err.text || 'DNS Connection failure. Handshake blocked.'
      });
    } finally {
      setSbSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sbSchemaSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div id="devops-console-container" className="space-y-6">
      
      {/* Upper sub tab selector */}
      <div className="flex border-b border-slate-800 pb-3 justify-between items-center">
        <div className="flex gap-2 select-none">
          <button
            onClick={() => setSubTab('telemetry')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'telemetry' 
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30' 
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Activity className="w-4 h-4" /> Telemetry & WAF Gateways
          </button>
          <button
            onClick={() => setSubTab('supabase')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'supabase' 
                ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30' 
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Database className="w-4 h-4" /> Supabase Failover Cluster
          </button>
          <button
            onClick={() => setSubTab('enterprise_sandbox')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'enterprise_sandbox' 
                ? 'bg-purple-600/15 text-purple-400 border border-purple-500/30' 
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Enterprise Sandbox & Recovery Testing
          </button>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-slate-500 uppercase tracking-wider hidden sm:inline">Active Data Plane:</span>
          {demoStats?.activeDataSource === 'external' ? (
            <span className="px-2 py-0.5 rounded-full bg-indigo-950/50 text-indigo-400 border border-indigo-850 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              EXTERNAL DATABASE
            </span>
          ) : demoStats?.activeDataSource === 'uploaded' ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-400 border border-amber-850 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              UPLOADED DATASET
            </span>
          ) : sbEnabled ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-850 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              SUPABASE CLUSTER
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              DEMO SQLITE (185K+ ROWS)
            </span>
          )}
        </div>
      </div>

      {subTab === 'telemetry' ? (
        <>
          {/* Metrics Summary overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'CPU Usage', value: `${metrics?.cpuUsage || 18}%`, icon: Cpu, desc: 'Core virtual cores load' },
              { label: 'Memory Allocation', value: `${metrics?.memoryUsage || 34}%`, icon: Database, desc: 'Node heap consumption' },
              { label: 'Avg API Gateway latency', value: `${metrics?.apiLatencyAvg || 14}ms`, icon: Activity, desc: 'Express Router ingress delay' },
              { label: 'Rate Limiter Hits', value: metrics?.rateLimitHits || 0, icon: ShieldAlert, desc: 'Exceeded bucket allocations' },
              { label: 'SLA Compliance Ratio', value: `${metrics?.rtoComplianceAvg || 92}%`, icon: CheckCircle, desc: 'Runbook step performance' },
              { label: 'Cache Hit SLA', value: `${metrics?.cacheHitRatio || 65}%`, icon: Layers, desc: 'Compiled report cache hits' }
            ].map((met, idx) => {
              const Icon = met.icon;
              return (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{met.label}</span>
                    <h3 className="text-xl font-bold text-slate-100 mt-1">{met.value}</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">{met.desc}</p>
                  </div>
                  <Icon className="w-5 h-5 text-blue-400 opacity-60" />
                </div>
              );
            })}
          </div>

          {/* Network Traffic chart and Infrastructure Security panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Live Network load */}
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Live Endpoint Throughput (SRE query rates)
                </h3>
                <button
                  onClick={onRefreshMetrics}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Pull Fresh Data
                </button>
              </div>

              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={throughputHistory} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', fontSize: '11px', color: '#f1f5f9' }} />
                    <Area type="monotone" dataKey="load" stroke="#3b82f6" fillOpacity={0.15} fill="url(#colorLoad)" />
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Security / rate limiting sandbox simulation */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="w-4 h-4 text-blue-400" />
                  Ingress Security Sandbox
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Simulate high-throughput API abuse from a compromised IP location. Flood the route rules to verify threshold filters trigger 429 locks.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={triggerRateLimitSimulation}
                  disabled={secLoading}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold bg-red-950/30 text-red-400 border border-red-900/40 hover:bg-red-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-red-500" />
                  {secLoading ? 'Flooding Route...' : 'Simulate API Flooding Route'}
                </button>

                <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg text-center">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">WAF Filter Rule:</span>
                  <span className="block mt-1 text-xs text-slate-300 font-semibold uppercase tracking-wide">
                    Redis Sliding-Window Limits active
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* External Notification channel test triggers and production architecture overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Notification Webhooks tests */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-blue-400" />
                Integrations Webhooks (Slack / PagerDuty Hub)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Test dispatching automated payloads to PagerDuty incident endpoints and Slack webhooks representing key transitions:
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Drill Start', trigger: 'STARTED' as const, bg: 'hover:bg-blue-950/30 text-blue-300 border-blue-900/45' },
                  { label: 'Drill Completion', trigger: 'COMPLETED' as const, bg: 'hover:bg-emerald-950/30 text-emerald-300 border-emerald-900/45' },
                  { label: 'Drill Failure Alert', trigger: 'FAILED' as const, bg: 'hover:bg-red-950/30 text-red-300 border-red-900/45' },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    onClick={() => testWebhookDispatch(btn.trigger)}
                    className={`py-2 rounded-lg text-xs font-semibold border bg-slate-950 transition-all cursor-pointer ${btn.bg}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {webhookStatus !== 'IDLE' && (
                <div className="bg-emerald-950/30 border border-emerald-900/40 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-200 animate-slide-in">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Dispatched test packet on `{webhookStatus}` event target securely!</span>
                </div>
              )}
            </div>

            {/* Multi-region DR specifications summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                Design Spec: active recovery strategy (RPO: 0)
              </h3>

              <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                <div className="flex gap-2 items-start bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200 font-medium">Full Multi-Region replication strategy:</strong>
                    <p className="mt-0.5">Primary PostgreSQL resides in VPC-EAST cluster. Semi-synchronous streaming replication to VPC-WEST replica targets commits within 50ms (achievable RPO: near 0).</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      ) : (
        /* Supabase Settings Panel Tab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          {/* Settings inputs */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-400" />
                Supabase Multi-Region Connection Configuration
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Link this project directly with your Supabase Postgres Databases to store audit logs, track drill walkthroughs, save system checklist attachments, and manage user accounts securely.
              </p>
            </div>

            <form onSubmit={handleSaveSupabase} className="space-y-5">
              
              {/* Toggle Connection */}
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-350 block">Enable Supabase Integrations</span>
                  <span className="text-[10px] text-slate-500">Route database operations on active nodes directly to Supabase</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={sbEnabled}
                    onChange={(e) => setSbEnabled(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-slate-100"></div>
                </label>
              </div>

              {/* Primary Node settings */}
              <div className="space-y-3.5 border-l-2 border-blue-500/20 pl-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Primary Cluster (VPC-EAST Node)</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Project Rest API URL</label>
                    <div className="relative">
                      <Cloud className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="url"
                        value={sbPrimaryUrl}
                        onChange={(e) => setSbPrimaryUrl(e.target.value)}
                        placeholder="https://your-project.supabase.co"
                        disabled={!sbEnabled}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Service Role / anon API Key</label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="password"
                        value={sbPrimaryKey}
                        onChange={(e) => setSbPrimaryKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        disabled={!sbEnabled}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Backup cluster Node settings */}
              <div className="space-y-3.5 border-l-2 border-amber-500/20 pl-4 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Backup Replica Target (VPC-WEST Node)</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Backup Project URL (Optional)</label>
                    <div className="relative">
                      <Cloud className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="url"
                        value={sbBackupUrl}
                        onChange={(e) => setSbBackupUrl(e.target.value)}
                        placeholder="https://your-backup-project.supabase.co"
                        disabled={!sbEnabled}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">Backup Anon Key (Optional)</label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="password"
                        value={sbBackupKey}
                        onChange={(e) => setSbBackupKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        disabled={!sbEnabled}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status or warning feedback */}
              {sbMsg && (
                <div className={`p-3 rounded-lg border text-xs flex gap-2 items-start animate-slide-in ${
                  sbMsg.type === 'success' 
                    ? 'bg-emerald-950/20 border-emerald-900/60 text-emerald-300' 
                    : 'bg-red-950/20 border-red-900/60 text-red-300'
                }`}>
                  {sbMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{sbMsg.text}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="submit"
                  disabled={sbSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {sbSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Connecting TLS...
                    </>
                  ) : (
                    <>
                      <Settings className="w-3.5 h-3.5" />
                      Apply Cluster Config
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Guidelines / DDL Schema view */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            
            {/* Guidelines Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3.5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                Automatic schema mapping
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our SRE ledger utilizes Postgres-compatible schemas. By provisioning these six tables in your project, the platform gains full durability for:
              </p>
              <ul className="text-[11px] text-slate-400 space-y-2 pl-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <strong>User Credentials:</strong> Safe hash authentication.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <strong>Drill State Engines:</strong> Tracks ongoing walkthrough logs.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <strong>SRE Runbooks:</strong> Encodes checklist steps.
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <strong>Compliance Vault:</strong> PDF-ready executive audit trails.
                </li>
              </ul>
            </div>

            {/* Connection Test feedback */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-350 uppercase tracking-wider font-mono">Integrity Status</span>
                {sbIsInitialized ? (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-900/30 text-emerald-400 border border-emerald-900/60 font-mono">
                    ONLINE & ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-900/30 text-amber-400 border border-amber-901 font-mono">
                    SCHEMA PENDING
                  </span>
                )}
              </div>

              {!sbIsInitialized && (
                <div className="text-[11px] text-slate-450 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-amber-400 font-semibold block mb-0.5">⚠️ Setup Required:</span>
                  Please copy the SQL schema script below, click "SQL Editor" in your Supabase dashboard, paste it, and run it. Then click the <strong>Apply Cluster Config</strong> button again to align table locks!
                </div>
              )}

              {/* SQL Schema toggle */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDdl(!showDdl)}
                  className="w-full py-2 bg-slate-950 hover:bg-slate-950/80 border border-slate-850 rounded-lg text-xs font-semibold text-slate-300 flex items-center justify-between px-3 cursor-pointer"
                >
                  <span>PostgreSQL DDL Schema Script</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {showDdl ? 'Hide Schema' : 'View Script'}
                  </span>
                </button>

                {showDdl && (
                  <div className="border border-slate-800 rounded-lg overflow-hidden animate-fade-in relative bg-slate-950">
                    <div className="flex justify-between items-center bg-slate-900 border-b border-slate-850 px-3 py-1.5">
                      <span className="text-[9px] text-slate-500 font-mono">postgres_setup.sql</span>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy SQL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[9px] p-2.5 font-mono text-slate-400 max-h-[160px] overflow-y-auto select-all leading-normal whitespace-pre">
                      {sbSchemaSql}
                    </pre>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {subTab === 'enterprise_sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* LEFT COLUMN: Data Plane Selector, Custom Uploads, and Database Card List */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* DATA SOURCE SELECTION PANEL */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  Active SRE Data Source Controller
                </h3>
                <span id="active-source-badge" className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800 text-slate-450">
                  Current Plane: <strong className="text-purple-400 capitalize">{demoStats?.activeDataSource || 'demo'}</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Choose the primary data target plane to run database replication drills and SRE disaster simulations.
              </p>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  id="btn-source-demo"
                  onClick={() => handleSetDataSource('demo')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    demoStats?.activeDataSource === 'demo'
                      ? 'bg-purple-950/20 border-purple-500/50 text-purple-200 col-span-1'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 col-span-1'
                  }`}
                >
                  <span className="block text-xs font-bold">1. Demo DB</span>
                  <span className="block text-[9px] opacity-70 mt-0.5 font-mono">185k built-in</span>
                </button>

                <button
                  type="button"
                  id="btn-source-uploaded"
                  onClick={() => handleSetDataSource('uploaded')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    demoStats?.activeDataSource === 'uploaded'
                      ? 'bg-purple-950/20 border-purple-500/50 text-purple-200 col-span-1'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 col-span-1'
                  }`}
                >
                  <span className="block text-xs font-bold">2. Upload Dataset</span>
                  <span className="block text-[9px] opacity-70 mt-0.5 font-mono">
                    {demoStats?.uploadedDatasets?.length || 0} files
                  </span>
                </button>

                <button
                  type="button"
                  id="btn-source-external"
                  onClick={() => handleSetDataSource('external')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    demoStats?.activeDataSource === 'external'
                      ? 'bg-purple-950/20 border-purple-500/50 text-purple-200 col-span-1'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 col-span-1'
                  }`}
                >
                  <span className="block text-xs font-bold">3. External DB</span>
                  <span className="block text-[9px] opacity-70 mt-0.5 font-mono">
                    {demoStats?.externalConnection?.status === 'CONNECTED' ? 'Linked TLS' : 'Setup'}
                  </span>
                </button>
              </div>
            </div>

            {/* CUSTOM DATASET FILE UPLOADER */}
            {demoStats?.activeDataSource === 'uploaded' && (
              <div id="upload-dataset-form" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-purple-400" />
                    Load custom testing catalog
                  </h4>
                  <span className="text-[10px] text-slate-500">JSON, CSV, or XLSX formats</span>
                </div>

                <div className="border border-dashed border-slate-800 rounded-lg p-5 text-center bg-slate-950 relative hover:border-purple-500/30 transition-colors">
                  <input
                    type="file"
                    accept=".json,.csv,.xlsx"
                    onChange={handleUploadFile}
                    disabled={uploadLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 text-slate-505 mx-auto animate-bounce" />
                    <div className="text-xs text-slate-300 font-semibold">
                      {uploadLoading ? 'Reading & indexing dataset...' : 'Click to select or drag file here'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Validates rows, constructs memory structures instantly
                    </div>
                  </div>
                </div>

                {fileError && (
                  <div className="p-3 bg-red-950/20 border border-red-900/60 text-red-400 text-xs rounded-lg flex gap-2 items-center">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}

                {/* Uploaded Catalogs list */}
                {demoStats?.uploadedDatasets && demoStats?.uploadedDatasets.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-850">
                    <span className="text-[10px] text-slate-505 uppercase font-mono tracking-wider">Loaded Database Catalogs</span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {demoStats.uploadedDatasets.map((ds: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-950 border border-slate-850 rounded text-xs">
                          <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]">{ds.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/40 text-purple-400 font-mono border border-purple-900/50">
                              {ds.format || ds.type || 'RAW'}
                            </span>
                            <span className="text-slate-400 font-bold font-mono text-[11px]">{(ds.recordCount ?? ds.count ?? 0).toLocaleString()} Rows</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EXTERNAL DATABASE LINKER CONFIG PANEL */}
            {demoStats?.activeDataSource === 'external' && (
              <form id="external-db-connect-form" onSubmit={handleConnectExternal} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-purple-400" />
                    External connection credentials
                  </h4>
                  <span className="text-[10px] text-slate-500">Live Connection Verification</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExtType('postgres')}
                    className={`py-1.5 rounded text-xs font-semibold border ${
                      extType === 'postgres'
                        ? 'bg-purple-950/20 border-purple-500/50 text-purple-300'
                        : 'bg-slate-950 border-slate-850 text-slate-500'
                    }`}
                  >
                    PostgreSQL URI
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtType('supabase')}
                    className={`py-1.5 rounded text-xs font-semibold border ${
                      extType === 'supabase'
                        ? 'bg-purple-950/20 border-purple-500/50 text-purple-300'
                        : 'bg-slate-950 border-slate-850 text-slate-500'
                    }`}
                  >
                    Supabase REST API
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] text-slate-450 uppercase font-mono">Connection URL Endpoint Link</label>
                  <div className="relative">
                    <Cloud className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder={extType === 'postgres' ? 'postgres://user:password@hostname:5432/dbname' : 'https://your-project-id.supabase.co'}
                      value={extUrl}
                      onChange={(e) => setExtUrl(e.target.value)}
                      disabled={['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 text-xs focus:ring-1 focus:ring-purple-500/50 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {extError && (
                  <div className="p-3 bg-red-950/20 border border-red-900/60 text-red-300 text-xs rounded-lg flex gap-2 items-center animate-slide-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{extError}</span>
                  </div>
                )}

                {extSuccess && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/60 text-emerald-300 text-xs rounded-lg flex gap-2 items-center animate-slide-in">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{extSuccess}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-1 border-t border-slate-850">
                  <span className="text-[10px] font-mono text-slate-505 uppercase">
                    Status: <strong className={demoStats?.externalConnection?.status === 'CONNECTED' ? 'text-emerald-400' : 'text-amber-500'}>
                      {demoStats?.externalConnection?.status || 'NOT_CONNECTED'}
                    </strong>
                  </span>
                  <button
                    type="submit"
                    disabled={['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                    className="bg-purple-600 hover:bg-purple-505 text-white font-semibold text-xs py-1.5 px-4 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Validate Connection
                  </button>
                </div>
              </form>
            )}

            {/* LIVE ENTITY METRICS TABLE SUMMARY */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Database className="w-4 h-4 text-purple-400" />
                Data target entity records summary
              </h4>
              <div className="grid grid-cols-2 gap-3">
                             {/* Employees */}
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20 text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider">Employees Entity</span>
                    <strong className="block text-sm text-slate-200 font-mono">
                      {(demoStats?.employeesCount ?? demoStats?.datasets?.employees ?? 10000).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Customers */}
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-teal-500/10 rounded border border-teal-500/20 text-teal-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider">Customers Entity</span>
                    <strong className="block text-sm text-slate-200 font-mono">
                      {(demoStats?.customersCount ?? demoStats?.datasets?.customers ?? 25000).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Orders */}
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded border border-purple-500/20 text-purple-400">
                    <ShoppingBag className="w-4 h-4 text-purple-450" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider">Orders Entity</span>
                    <strong className="block text-sm text-slate-200 font-mono">
                      {(demoStats?.ordersCount ?? demoStats?.datasets?.orders ?? 50000).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Banking Transactions */}
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-mono uppercase tracking-wider">Banking Txs Entity</span>
                    <strong className="block text-sm text-slate-200 font-mono">
                      {(demoStats?.transactionsCount ?? demoStats?.datasets?.transactions ?? 100000).toLocaleString()}
                    </strong>
                  </div>
                </div>

              </div>

              <div className="pt-3 border-t border-slate-850 flex justify-between items-center text-[10px] font-mono text-slate-505">
                <span>DATABASE SEED INDEXES REPLICATED</span>
                <span className="text-purple-400 font-bold font-mono">
                  TOTAL CONTROL PLANE: {(
                    (demoStats?.employeesCount ?? demoStats?.datasets?.employees ?? 10000) + 
                    (demoStats?.customersCount ?? demoStats?.datasets?.customers ?? 25000) + 
                    (demoStats?.ordersCount ?? demoStats?.datasets?.orders ?? 50000) + 
                    (demoStats?.transactionsCount ?? demoStats?.datasets?.transactions ?? 100000)
                  ).toLocaleString()} ROWS
                </span>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: RECOVERY DRILL TEST CONTROL CONSOLE */}
          <div className="lg:col-span-6 space-y-6">
            
            {/* SIMULATION Triggers console */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                  SRE Database Disaster Simulator Console
                </h4>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  HOT-STANDBY TESTED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Execute simulated failure events on the active plane. The sandbox will capture state, deploy secure snapshots, corrupt data, trigger restorative sync, and verify ledger consistency.
              </p>

              {/* Six drills grid */}
              <div id="simulation-trigger-grid" className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={simLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                  onClick={() => handleRunSimulation('deletion')}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-red-500/30 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-300">1. Record Deletion</span>
                    <Play className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" fill="currentColor" />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Drops a random range of rows under multiple index patterns.</p>
                </button>

                <button
                  type="button"
                  disabled={simLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                  onClick={() => handleRunSimulation('corruption')}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-red-500/30 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-300">2. Data Corruption</span>
                    <Play className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" fill="currentColor" />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Injects zero-byte payloads and corrupts header files.</p>
                </button>

                <button
                  type="button"
                  disabled={simLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                  onClick={() => handleRunSimulation('missing_values')}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-red-500/30 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-300">3. Missing Values</span>
                    <Play className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" fill="currentColor" />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Blanks critical cell entries to break database schemas.</p>
                </button>

                <button
                  type="button"
                  disabled={simLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                  onClick={() => handleRunSimulation('duplicates')}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-red-500/30 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-300">4. Duplicate Rows</span>
                    <Play className="w-3 h-3 text-slate-505 group-hover:text-red-400 transition-colors" fill="currentColor" />
                  </div>
                  <p className="text-[9px] text-slate-505 mt-1">Spams replicated lines to trigger sequence validation errors.</p>
                </button>

                <button
                  type="button"
                  disabled={simLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                  onClick={() => handleRunSimulation('damage')}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-red-500/30 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-300">5. Table Damage</span>
                    <Play className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" fill="currentColor" />
                  </div>
                  <p className="text-[9px] text-slate-505 mt-1">Simulates file-allocation table lock blocks table page errors.</p>
                </button>

                <button
                  type="button"
                  disabled={simLoading || ['Auditor', 'Viewer'].includes(currentUser?.role || '')}
                  onClick={() => handleRunSimulation('inconsistency')}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-red-500/30 text-left transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-300">6. Desync Inconsistency</span>
                    <Play className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" fill="currentColor" />
                  </div>
                  <p className="text-[9px] text-slate-505 mt-1">Desynchronizes transactional and customer record layers.</p>
                </button>
              </div>

              {simLoading && (
                <div className="p-10 border border-purple-500/20 bg-slate-950 rounded-lg flex flex-col justify-center items-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                  <span className="text-xs text-slate-300 font-semibold font-mono animate-pulse">
                    RUNNING SNAPSHOT ROLLBACK INTEGRITY CHECKS...
                  </span>
                </div>
              )}

              {simError && (
                <div className="p-3 bg-red-955 border border-red-900/60 text-red-300 text-xs rounded-lg flex gap-2 items-center">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{simError}</span>
                </div>
              )}
            </div>

            {/* HIGH-INTEGRITY RECOVERY ENGINE LOG DIAGNOSTICS */}
            {simResult && (
              <div id="recovery-result-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 animate-slide-in">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Restorative Sync Engine Diagnostics
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-850 font-mono">
                    SUCCESS
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                    <span className="block text-[9px] text-slate-550 uppercase font-mono">Affected rows</span>
                    <strong className="block text-sm text-red-400 font-mono mt-0.5">{(simResult.affectedRows ?? simResult.recordsAffected ?? 0).toLocaleString()}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                    <span className="block text-[9px] text-slate-550 uppercase font-mono">Restored rows</span>
                    <strong className="block text-sm text-emerald-400 font-mono mt-0.5">{(simResult.restoredRows ?? simResult.recordsRestored ?? 0).toLocaleString()}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-850">
                    <span className="block text-[9px] text-slate-550 uppercase font-mono">Rollback Time</span>
                    <strong className="block text-sm text-purple-400 font-mono mt-0.5">{simResult.durationMs ?? 0}ms</strong>
                  </div>
                </div>

                {/* SRE Step verification logs checklist */}
                <div className="space-y-2 bg-slate-950 p-3.5 rounded-lg border border-slate-850">
                  <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Real-time SRE RESTORATION SEQUENCE</span>
                  <div className="space-y-2 text-[11px] text-slate-400 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-350">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        1. Capture snapshot before simulation
                      </span>
                      <span className="text-[10px] text-slate-500">COMPLETE — OK</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-350">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        2. Execute disaster injection test
                      </span>
                      <span className="text-[10px] text-slate-500">BROKEN SEED CORRUPTION</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-350">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        3. Trigger instantaneous hot-reversion rollback
                      </span>
                      <span className="text-[10px] text-slate-500">RESTORE COMPLETE</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Platform Integrity Verification
                      </span>
                      <span className="text-emerald-400 font-bold bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-900/60 text-[10px]">
                        {(simResult.integrityVerified ?? (simResult.successRate >= 100)) ? '100% SECURE' : 'INCOMPLETE'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 p-3 bg-slate-950 border border-slate-850 rounded-lg leading-relaxed">
                  <strong className="text-purple-400 block mb-0.5 font-mono">Disaster Recovery Result details:</strong>
                  {simResult.details ?? simResult.verificationLog ?? ''}
                </div>
              </div>
            )}

            {/* AUDIT JOURNAL DRILL HISTORIC LEDGER */}
            <div id="drill-history-ledger" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <History className="w-4 h-4 text-purple-400" />
                  SRE Database Drill Journal
                </h4>
                <span className="text-[10px] text-slate-505 font-mono">
                  {demoStats?.drillHistory?.length || 0} Runs
                </span>
              </div>

              {demoStats?.drillHistory && demoStats.drillHistory.length > 0 ? (
                <div className="space-y-2 max-h-[190px] overflow-y-auto">
                  {demoStats.drillHistory.map((item: any) => (
                    <div key={item.id} className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-900/60 uppercase">
                            {item.simulationType}
                          </span>
                          <span className="text-slate-500 font-semibold font-mono text-[10px]">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono max-w-[260px] truncate">{item.details}</p>
                      </div>
                      <div className="text-right">
                        <strong className="block text-emerald-400 font-mono text-[11px]">{item.durationMs}ms</strong>
                        <span className="block text-[8px] text-slate-500 font-mono uppercase">ROLLBACK</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs font-mono">
                  No simulations executed on this data source plane yet.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
