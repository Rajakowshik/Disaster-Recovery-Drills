import React, { useEffect, useState } from 'react';
import { Database, ShieldAlert, Cpu, CheckCircle, RefreshCw, AlertTriangle, Play, Square, Loader } from 'lucide-react';

interface InfraMetrics {
  primary: 'RUNNING' | 'STOPPED';
  backup: 'RUNNING' | 'STOPPED';
  audit: 'RUNNING' | 'STOPPED';
  activeDatabase: 'primary' | 'backup';
  lastFailoverTime: string | null;
  recoveryDurationS: number;
  rtoCompliance: number;
}

export default function InfrastructureStatus() {
  const [data, setData] = useState<InfraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionLogs, setActionLogs] = useState<string[]>([]);

  const fetchInfraStatus = async () => {
    try {
      const token = localStorage.getItem('dr_token');
      const res = await fetch('/api/system/infrastructure', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
        setError(null);
      } else {
        throw new Error(`Failed to load infrastructure metrics (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed connecting to SRE metrics network.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfraStatus();
    const interval = setInterval(fetchInfraStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerAction = async (toolName: string, label: string) => {
    setActionLoading(label);
    setActionLogs([]);
    try {
      const token = localStorage.getItem('dr_token');
      const res = await fetch('/api/drills/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          toolName,
          drillId: 'ops-maintenance',
          stepId: 'manual-trigger'
        })
      });
      
      const payload = await res.json();
      if (payload.logs) {
        setActionLogs(payload.logs);
      }
      await fetchInfraStatus();
    } catch (err: any) {
      setActionLogs([`[CRITICAL ERROR] Failed dispatching control action: ${err.message}`]);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex items-center justify-center gap-3">
        <Loader className="w-5 h-5 text-blue-500 animate-spin" />
        <span className="text-xs text-slate-400 font-mono">Quering real-time docker database orchestration channels...</span>
      </div>
    );
  }

  const primaryStatus = data?.primary || 'RUNNING';
  const backupStatus = data?.backup || 'RUNNING';
  const auditStatus = data?.audit || 'RUNNING';
  const activeDB = data?.activeDatabase || 'primary';
  const compliance = data?.rtoCompliance ?? 100;

  return (
    <div id="infrastructure-status-deck" className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      
      {/* Title & Network Status indicator header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-md font-bold text-slate-100 flex items-center gap-2 font-display">
            <Database className="w-5 h-5 text-blue-500 animate-pulse" />
            SRE Infrastructure Status Deck
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Managing real physical-port database replica containers locally.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={fetchInfraStatus}
            className="p-1 px-2.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-750 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-blue-400" />
            Query Cluster
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of 3 Databases */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Postgres Primary */}
        <div className={`p-4 rounded-xl border transition-all ${
          primaryStatus === 'RUNNING' 
            ? 'bg-slate-900/60 border-slate-800 hover:border-slate-750' 
            : 'bg-red-950/10 border-red-900/30'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Active Writer Node</span>
              <h4 className="text-sm font-bold text-slate-200 mt-1 font-mono">postgres-primary</h4>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Port 5432</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              primaryStatus === 'RUNNING' 
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' 
                : 'bg-red-950/40 text-red-300 border border-red-900/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${primaryStatus === 'RUNNING' ? 'bg-emerald-500' : 'bg-red-500 animate-ping'}`} />
              {primaryStatus === 'RUNNING' ? 'Running' : 'Stopped'}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed">
            Maintains the primary transactional workload, serving read-write traffic on standard loopback connections.
          </p>
        </div>

        {/* Postgres Backup */}
        <div className={`p-4 rounded-xl border transition-all ${
          backupStatus === 'RUNNING' 
            ? 'bg-slate-900/60 border-slate-800 hover:border-slate-750' 
            : 'bg-red-950/10 border-red-900/30'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Standby DR Replica</span>
              <h4 className="text-sm font-bold text-slate-200 mt-1 font-mono">postgres-backup</h4>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Port 5433</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              backupStatus === 'RUNNING' 
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40' 
                : 'bg-red-950/40 text-red-300 border border-red-900/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${backupStatus === 'RUNNING' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {backupStatus === 'RUNNING' ? 'Running' : 'Stopped'}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed">
            Standby replication target. Automatically promoted to ACTIVE status and ready to serve traffic during primary failure.
          </p>
        </div>

        {/* Postgres Audit */}
        <div className={`p-4 rounded-xl border transition-all ${
          auditStatus === 'RUNNING' 
            ? 'bg-slate-900/60 border-slate-800 hover:border-slate-750' 
            : 'bg-red-950/10 border-red-900/30'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">SLA Audit Ledger DB</span>
              <h4 className="text-sm font-bold text-slate-200 mt-1 font-mono">postgres-audit</h4>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Port 5434</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Isolated
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 leading-relaxed">
            Audit logs ledger. Operates in strict network isolation, ensuring regulatory evidence is preserved through any drill failure.
          </p>
        </div>

      </div>

      {/* Failover / RTO Stats banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950 border border-slate-850 p-4 rounded-xl">
        
        <div>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Active Master Database</span>
          <span className={`block mt-1 font-mono text-sm font-bold ${
            activeDB === 'primary' ? 'text-blue-400' : 'text-amber-400'
          }`}>
            {activeDB === 'primary' ? '★ postgres-primary (Port 5432)' : '⚠ postgres-backup (Port 5433)'}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Last Failover Timestamp</span>
          <span className="block mt-1 text-slate-300 font-mono text-xs font-semibold truncate">
            {data?.lastFailoverTime ? new Date(data.lastFailoverTime).toLocaleString() : 'No active failovers recorded'}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Recovery Duration (RTO)</span>
          <span className="block mt-1 text-slate-300 font-mono text-sm font-bold">
            {data?.recoveryDurationS ? `${data.recoveryDurationS} seconds` : '0.00 seconds (Normal)'}
          </span>
        </div>

        <div>
          <span className="text-[9px] font-mono text-slate-500 uppercase">SLA Compliance Check</span>
          <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded font-bold uppercase border ${
            compliance >= 80 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' 
              : 'bg-red-950/40 text-red-300 border-red-900/40'
          }`}>
            {compliance >= 80 ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
          </span>
        </div>

      </div>

      {/* Manual Action Controller */}
      <div className="border-t border-slate-850 pt-4 space-y-3.5">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Operator Interactive Drifts Console (Actual Docker Commands)
        </h4>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => triggerAction('stop_primary_database', 'Stopping Primary')}
            disabled={actionLoading !== null}
            className="p-2 px-3 rounded-lg bg-red-955 hover:bg-red-900/50 text-red-300 border border-red-900/45 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            Stop Primary DB
          </button>

          <button
            onClick={() => triggerAction('start_primary_database', 'Starting Primary')}
            disabled={actionLoading !== null}
            className="p-2 px-3 rounded-lg bg-emerald-955 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-900/45 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            Start Primary DB
          </button>

          <button
            onClick={() => triggerAction('switch_to_backup_database', 'Failover standby')}
            disabled={actionLoading !== null}
            className="p-2 px-3 rounded-lg bg-amber-955 hover:bg-amber-900/50 text-amber-300 border border-amber-900/45 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Switch Standby Active
          </button>

          <button
            onClick={() => triggerAction('verify_database_connection', 'Verifying Connection')}
            disabled={actionLoading !== null}
            className="p-2 px-3 rounded-lg bg-blue-955 hover:bg-blue-900/50 text-blue-300 border border-blue-900/45 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Verify Connection (SELECT 1)
          </button>

          <button
            onClick={() => triggerAction('restore_primary_database', 'Restoring Primary')}
            disabled={actionLoading !== null}
            className="p-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-750 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            Restore Primary Replication
          </button>
        </div>

        {actionLoading && (
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex items-center gap-2 text-xs text-slate-400">
            <Loader className="w-4 h-4 text-blue-400 animate-spin" />
            <span>Operational SRE workflow: <strong className="text-slate-300">{actionLoading}</strong>... executing CLI processes...</span>
          </div>
        )}

        {actionLogs.length > 0 && (
          <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg font-mono text-[10px] text-slate-400 space-y-1 h-[140px] overflow-y-auto box-border">
            {actionLogs.map((log, i) => (
              <div key={i} className={
                log.startsWith('[STDOUT]') ? 'text-slate-200' :
                log.startsWith('[STDERR]') || log.startsWith('[ERROR]') ? 'text-red-400' :
                log.startsWith('[VERIFICATION') ? 'text-blue-300' : 'text-slate-500'
              }>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
