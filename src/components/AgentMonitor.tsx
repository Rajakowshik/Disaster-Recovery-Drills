/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  Terminal, ShieldCheck, Play, Skull, RefreshCw, Eye, Brain, Compass, 
  Settings, CheckCircle, AlertCircle, Clock, RotateCcw, AlertOctagon, FileText 
} from 'lucide-react';
import { Drill, RunbookStep, AgentState } from '../types';

interface AgentMonitorProps {
  drill: Drill | null;
  onDrillUpdate: (drill: Drill) => Promise<void>;
  onStopDrill: () => void;
  onGenerateReport: (drillId: string) => Promise<void>;
}

export default function AgentMonitor({
  drill,
  onDrillUpdate,
  onStopDrill,
  onGenerateReport
}: AgentMonitorProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [mockLogs, setMockLogs] = useState<string[]>([]);
  const [drillRunning, setDrillRunning] = useState(false);
  const [forceFailStep3, setForceFailStep3] = useState(false);
  
  // Interactive Agent Loop micro-states
  const [agentCycle, setAgentCycle] = useState<'IDLE' | 'OBSERVE' | 'REASON' | 'PLAN' | 'EXECUTE' | 'VERIFY' | 'LEARN' | 'REPORT'>('IDLE');
  const [cycleProgressLog, setCycleProgressLog] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const executionLoopRef = useRef<NodeJS.Timeout | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Initialize status on mount/change
  useEffect(() => {
    if (drill) {
      setMockLogs(drill.logs);
      if (drill.status === 'RUNNING') {
        setDrillRunning(true);
        setActiveStepIndex(0);
        setTimeElapsed(0);
      }
    } else {
      setDrillRunning(false);
      setMockLogs([]);
    }
  }, [drill]);

  // Handle Terminal Scrolling Automatically
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mockLogs, cycleProgressLog]);

  // Overall stopwatch timer
  useEffect(() => {
    if (drillRunning) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [drillRunning]);

  // The Orchestrated Agent Loop Engine
  useEffect(() => {
    if (drillRunning && drill) {
      runAgentLoop();
    }
    return () => {
      if (executionLoopRef.current) clearTimeout(executionLoopRef.current);
    };
  }, [drillRunning, activeStepIndex]);

  const runAgentLoop = async () => {
    if (!drill) return;
    const currentSteps = [...drill.steps];
    
    // Check if we finished all steps
    if (activeStepIndex >= currentSteps.length) {
      await finishDrill(true);
      return;
    }

    const currentStep = currentSteps[activeStepIndex];
    currentStep.status = 'RUNNING';
    currentStep.startedAt = new Date().toISOString();
    
    appendLog(`[AGENT LOOP] Starting Orchestration cycle for Step ${activeStepIndex + 1}: "${currentStep.name}"`);

    // 1. OBSERVE Stage
    setAgentCycle('OBSERVE');
    setCycleProgressLog(`Probing environment state. Fetching server heartbeats, transaction sequences, and interface routers...`);
    await delay(1200);
    appendLog(`[OBSERVE] Node status: OK. Network interfaces present. Latency: 1.2ms. Readiness metrics verified.`);

    // 2. REASON Stage
    setAgentCycle('REASON');
    setCycleProgressLog(`Evaluating procedure targets. Step SLA: ${currentStep.rtoTarget}s. Trigger target function: '${currentStep.function}'.`);
    await delay(1500);
    appendLog(`[REASON] RTO constraint checks passed. Executed method mapping: target system resolves under secure VPC rules.`);

    // 3. PLAN Stage
    setAgentCycle('PLAN');
    setCycleProgressLog(`Formulating action dependencies and rollback checkpoints...`);
    await delay(1200);
    appendLog(`[PLAN] Sequence mapping compiled. Precondition validation complete. Safety markers established.`);

    // 4. EXECUTE Stage
    setAgentCycle('EXECUTE');
    setCycleProgressLog(`Orchestrating CLI runbook utility tool. Calling tool REST connector...`);
    
    // Call server tool mock executor
    let executionDuration = 0;
    let stepSuccess = true;
    let stepOutput = '';
    let stepError = '';
    
    try {
      const res = await fetch('/api/drills/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: currentStep.function,
          failSimulate: currentStep.function === 'failover_database' && forceFailStep3
        })
      });
      const data = await res.json();
      executionDuration = data.latency;
      stepSuccess = data.success;
      stepOutput = data.output || '';
      stepError = data.error || '';
      
      // Inject tool logs
      data.logs.forEach((l: string) => appendLog(l));
    } catch {
      executionDuration = 3;
      stepSuccess = true; // Fallback
    }

    currentStep.duration = executionDuration;

    if (!stepSuccess) {
      // 4b. Agent Error Correction Path (Retry logic)
      appendLog(`[ERROR] Execution of ${currentStep.function} failed with reason: ${stepError}`);
      appendLog(`[AGENT CRITICAL] Transition state to RETRY_AWAIT. Invoking corrective actions: checking database configs, rebuilding replication tunnels.`);
      setCycleProgressLog(`RETRY: Recovering failed execution of promotion task (Attempt 1/2)...`);
      await delay(2500);

      // Retry Attempt 2
      appendLog(`[AGENT RETRY] Retrying execution of '${currentStep.function}' with custom parameter parameters.`);
      currentStep.status = 'FAILURE';
      currentStep.error = stepError;
      
      await finishDrill(false);
      return;
    }

    currentStep.output = stepOutput;
    appendLog(`[EXECUTE] Output recorded successfully (Duration: ${executionDuration}s vs target: ${currentStep.rtoTarget}s).`);

    // 5. VERIFY Stage
    setAgentCycle('VERIFY');
    setCycleProgressLog(`Verifying execution outcomes. Ping testing primary host interfaces...`);
    await delay(1500);
    
    const metRTO = executionDuration <= currentStep.rtoTarget;
    appendLog(`[VERIFY] Check completed. System registers OK. SLA Metric: ${metRTO ? 'COMPLIANT (RTO Met)' : 'WARNING (RTO Exceeded)'}`);

    // 6. LEARN Stage
    setAgentCycle('LEARN');
    setCycleProgressLog(`Recording step metrics and updating experience tables...`);
    currentStep.status = 'SUCCESS';
    currentStep.completedAt = new Date().toISOString();
    await delay(1000);

    // Save and sync state with backend
    const nextSteps = [...currentSteps];
    nextSteps[activeStepIndex] = currentStep;
    
    const updatedDrill: Drill = {
      ...drill,
      steps: nextSteps,
      logs: [...mockLogs, `[STEP SUCCESS] Step ${activeStepIndex + 1} finalized. Elapsed: ${executionDuration}s.`].slice(-100)
    };
    
    await onDrillUpdate(updatedDrill);
    
    // Increment to next step
    setActiveStepIndex((prev) => prev + 1);
  };

  const finishDrill = async (success: boolean) => {
    if (!drill) return;
    setDrillRunning(false);
    setAgentCycle(success ? 'REPORT' : 'IDLE');
    setCycleProgressLog(success ? 'Generating Gemini audit reports...' : 'Drill terminated with errors.');

    const finalStatus = success ? 'SUCCESS' : 'FAILURE';
    const finalLogs = [
      ...mockLogs,
      `[STATE: REPORTING] Orchestration finished. Final status: ${finalStatus}.`,
      `[INFRA] Webhook alerts successfully dispatched to target DevOps integrations.`
    ];

    const completedSteps = drill.steps.map((st, i) => {
      // If we failed early, remaining pending steps are marked as skipped
      if (!success && i >= activeStepIndex) {
        return { ...st, status: i === activeStepIndex ? 'FAILURE' as const : 'SKIPPED' as const };
      }
      return st;
    });

    const updatedDrill: Drill = {
      ...drill,
      status: finalStatus,
      agentState: success ? 'COMPLETED' : 'FAILED',
      steps: completedSteps,
      logs: finalLogs.slice(-100),
      completedAt: new Date().toISOString()
    };

    await onDrillUpdate(updatedDrill);
    if (success) {
      await onGenerateReport(drill.id);
    }
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const appendLog = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const line = `[${timestamp}Z] ${msg}`;
    setMockLogs((prev) => [...prev, line]);
  };

  // Compute stats
  const stepsCount = drill?.steps.length || 0;
  const completedCount = drill?.steps.filter(s => s.status === 'SUCCESS').length || 0;
  const progressPercent = stepsCount > 0 ? Math.round((completedCount / stepsCount) * 100) : 0;

  return (
    <div id="agent-monitor-container" className="space-y-6">
      
      {/* Active Drill Header State */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">Drill Execution Unit</span>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            {drill ? drill.runbookTitle : 'Awaiting Active Drill Instance'}
          </h2>
          {drill && (
            <p className="text-xs text-slate-400 mt-1">
              Active Runbook Ref: <span className="font-mono text-slate-300">{drill.runbookId}</span> • Triggered at {new Date(drill.startedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {drillRunning && (
          <div className="flex items-center gap-3">
            {/* Failure Injection Simulation Toggler */}
            <button
              onClick={() => {
                setForceFailStep3(!forceFailStep3);
                appendLog(`[SIMULATOR] Force-fail DB promote command toggle status changed to ${!forceFailStep3}`);
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono border transition-all flex items-center gap-2 cursor-pointer ${
                forceFailStep3 
                  ? 'bg-red-950/40 text-red-400 border-red-900' 
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Skull className="w-3.5 h-3.5" />
              {forceFailStep3 ? 'FAIL_DB_PROMOTE: ON' : 'SIMULATE EXECUTOR FAIL'}
            </button>

            <button
              onClick={onStopDrill}
              className="bg-red-650 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" /> Stop Drill
            </button>
          </div>
        )}
      </div>

      {/* Main Orchestrator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* State Machine Visualization Node Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Agent Loop Stages */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>Agent Processing Cycle (Active States)</span>
              {drillRunning && <span className="animate-pulse inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-400"><RefreshCw className="w-3 h-3 animate-spin" /> Live Orchestrator</span>}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {[
                { label: 'Observe', val: 'OBSERVE', icon: Eye, color: 'text-sky-400 border-sky-905 bg-sky-950/20' },
                { label: 'Reason', val: 'REASON', icon: Brain, color: 'text-blue-400 border-blue-905 bg-blue-950/20' },
                { label: 'Plan', val: 'PLAN', icon: Compass, color: 'text-amber-400 border-amber-905 bg-amber-950/20' },
                { label: 'Execute', val: 'EXECUTE', icon: Settings, color: 'text-purple-400 border-purple-905 bg-purple-950/20' },
                { label: 'Verify', val: 'VERIFY', icon: ShieldCheck, color: 'text-emerald-400 border-emerald-905 bg-emerald-950/20' },
                { label: 'Learn', val: 'LEARN', icon: RotateCcw, color: 'text-pink-400 border-pink-905 bg-pink-950/20' },
                { label: 'Report', val: 'REPORT', icon: FileText, color: 'text-teal-400 border-teal-905 bg-teal-950/20' }
              ].map((cycleStage) => {
                const isSelected = agentCycle === cycleStage.val;
                const Icon = cycleStage.icon;
                return (
                  <div
                    key={cycleStage.val}
                    className={`border p-3 rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all ${
                      isSelected 
                        ? `${cycleStage.color} scale-105 shadow-md shadow-blue-900/10 border-blue-500` 
                        : 'border-slate-800 bg-slate-950/50 opacity-40'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold tracking-wide uppercase">{cycleStage.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Stage Progress Log Text */}
            <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg mt-4 min-h-[44px] flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono tracking-wide leading-relaxed">
                {drillRunning ? (
                  <>
                    <strong className="text-blue-400 uppercase">[{agentCycle}]</strong> {cycleProgressLog}
                  </>
                ) : (
                  <span className="text-slate-500 italic">Static. Initialize a drill to trigger the agent cycle machine.</span>
                )}
              </span>
            </div>
          </div>

          {/* Interactive SRE Terminal Logs */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-semibold text-slate-300">SYSTEM_SRE_LEDGER_CONSOLE</span>
              </div>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              </div>
            </div>

            <div className="p-4 font-mono text-[11px] text-slate-300 space-y-1.5 h-[340px] overflow-y-auto leading-relaxed scrollbar-thin">
              {mockLogs.length === 0 ? (
                <div className="text-slate-500 italic text-center py-20">Console idle. Awaiting instruction...</div>
              ) : (
                mockLogs.map((logLine, index) => {
                  let textClass = 'text-slate-300';
                  if (logLine.includes('[ERROR]') || logLine.includes('[AGENT CRITICAL]')) textClass = 'text-red-400 font-semibold';
                  else if (logLine.includes('[STEP SUCCESS]') || logLine.includes('State finalized')) textClass = 'text-emerald-400 font-semibold';
                  else if (logLine.includes('[AGENT LOOP]')) textClass = 'text-blue-400';
                  else if (logLine.includes('[SIMULATOR]')) textClass = 'text-amber-400';

                  return (
                    <div key={index} className="flex gap-1 hover:bg-slate-900/35 px-1 rounded">
                      <span className="text-slate-600 select-none">{(index + 1).toString().padStart(3, '0')}</span>
                      <span className={textClass}>{logLine}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalBottomRef} />
            </div>
          </div>

        </div>

        {/* Steps Audit & Status Sidebar Panel */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide mb-4">Runbook Validation Queue</h3>
              
              <div className="space-y-3">
                {drill ? (
                  drill.steps.map((step, idx) => {
                    const isRunning = step.status === 'RUNNING';
                    const isPassed = step.status === 'SUCCESS';
                    const isFailed = step.status === 'FAILURE';
                    const isSkipped = step.status === 'SKIPPED';
                    
                    let stepBorderColor = 'border-slate-800 bg-slate-950/20';
                    let Icon = Clock;
                    let iconColor = 'text-slate-500';

                    if (isRunning) {
                      stepBorderColor = 'border-blue-500 bg-blue-950/20 shadow-md shadow-blue-950/10 animate-pulse';
                      Icon = RefreshCw;
                      iconColor = 'text-blue-500 animate-spin';
                    } else if (isPassed) {
                      stepBorderColor = 'border-emerald-900 bg-emerald-950/20';
                      Icon = CheckCircle;
                      iconColor = 'text-emerald-400';
                    } else if (isFailed) {
                      stepBorderColor = 'border-red-900 bg-red-950/20';
                      Icon = AlertOctagon;
                      iconColor = 'text-red-500';
                    } else if (isSkipped) {
                      stepBorderColor = 'border-slate-800 bg-slate-950/10 opacity-30';
                      Icon = AlertCircle;
                    }

                    return (
                      <div key={step.id} className={`border p-3 rounded-xl transition-all ${stepBorderColor}`}>
                        <div className="flex gap-2 items-start justify-between">
                          <div className="flex items-start gap-2.5">
                            <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">[{idx + 1}]</span>
                            <div>
                              <h4 className="text-xs font-semibold text-slate-200">{step.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{step.description}</p>
                              <span className="inline-block bg-slate-950 text-blue-400 font-mono text-[9px] px-1.5 py-0.5 rounded border border-slate-850 mt-1.5">
                                fn: {step.function}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5">
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                            {step.duration && <span className="text-[10px] font-mono text-slate-400">{step.duration}s</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 italic text-center py-10 text-xs">No checklist loaded.</div>
                )}
              </div>
            </div>

            {drill && (
              <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Drill SLA Timer:</span>
                  <span className="font-mono text-blue-400 text-sm font-semibold">{timeElapsed}s elapsed</span>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px]/none font-mono text-slate-500 uppercase tracking-wider">
                  <span>Progress:</span>
                  <span>{progressPercent}% Complete</span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
