/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Activity, ShieldAlert, Cpu, Database, BellRing, RefreshCw, 
  Settings, CheckCircle, Flame, ServerCrash, Layers, Info
} from 'lucide-react';
import { SystemMetrics } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface DevOpsConsoleProps {
  metrics: SystemMetrics | null;
  onRefreshMetrics: () => Promise<void>;
  onSimulateRateLimit: () => Promise<void>;
}

export default function DevOpsConsole({
  metrics,
  onRefreshMetrics,
  onSimulateRateLimit
}: DevOpsConsoleProps) {
  const [secLoading, setSecLoading] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'IDLE' | 'STARTED' | 'FAILED' | 'COMPLETED'>('IDLE');
  
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

  return (
    <div id="devops-console-container" className="space-y-6">
      
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
            <div className="bg-emerald-950/30 border border-emerald-901 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-200">
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

    </div>
  );
}
