/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileCheck, Shield, Award, AlertCircle, Copy, Check, Download, 
  Clock, BookOpen, AlertOctagon, Printer, CloudLightning, FileText 
} from 'lucide-react';
import { ComplianceReport, Drill } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ComplianceViewerProps {
  report: ComplianceReport | null;
  selectedDrill: Drill | null;
  loading: boolean;
}

export default function ComplianceViewer({
  report,
  selectedDrill,
  loading
}: ComplianceViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyText = () => {
    if (!report) return;
    const body = `CTO EXECUTIVE COMPLIANCE REPORT\n--------------------\nDrill Ref: ${report.drillId}\nDrill Title: ${report.drillTitle}\nStatus: ${report.isCompliant ? 'FULLY COMPLIANT' : 'NON-COMPLIANT'}\nRTO Met Checklist: ${report.rtoMet}/${report.totalSteps}\n\n${report.executiveSummary}\n\nTECHNICAL DEPRECIATION DETAIL\n--------------------\n${report.technicalSummary}`;
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div id="compliance-loading" className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        <AlertCircle className="w-8 h-8 text-blue-400 animate-pulse mb-3" />
        <span className="text-sm font-medium text-slate-300">Evaluating runbook telemetry datasets...</span>
        <span className="text-xs text-slate-500 mt-1">Generating custom SRE and Executive summaries using Gemini API...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div id="compliance-empty" className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-lg text-center min-h-[300px] flex flex-col justify-center items-center">
        <FileCheck className="w-12 h-12 text-slate-600 mb-3" />
        <h3 className="text-lg font-semibold text-slate-300">Audit Desk Unoccupied</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Start and successfully finalize a Disaster Recovery drill to generate a formal Gemini compliance statement.
        </p>
      </div>
    );
  }

  // Pre-process chart values comparing Actual timing versus RTO targets
  const chartData = selectedDrill?.steps.map((st) => ({
    name: st.name.slice(0, 15) + '...',
    Actual: st.duration || 0,
    Goal: st.rtoTarget
  })) || [];

  return (
    <div id="compliance-viewer-container" className="space-y-6">
      
      {/* Compliance Target Badging Metadata */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-blue-400">Compliance Audit statement</span>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1">
            <Shield className="w-6 h-6 text-blue-400" />
            Audit Ledger: {report.drillTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Compiled on {new Date(report.createdAt).toLocaleString()} • Audit Node Reference: <span className="font-mono text-slate-300">{report.drillId}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopyText}
            className="bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Ledger' : 'Copy Full Report'}
          </button>
          
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/10 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Form
          </button>
        </div>
      </div>

      {/* Numerical targets breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Passed Procedures', value: `${report.passed} / ${report.totalSteps}`, status: report.passed === report.totalSteps ? 'COMPLIANT' : 'WARNING', color: 'text-emerald-400 bg-emerald-950/20 border-emerald-905' },
          { label: 'RTO Violations', value: report.rtoViolations, status: report.rtoViolations === 0 ? 'COMPLIANT' : 'WARNING', color: report.rtoViolations === 0 ? 'text-emerald-400 bg-emerald-950/20 border-emerald-905' : 'text-amber-400 bg-amber-950/20 border-amber-905' },
          { label: 'Total Drill SLA', value: `${report.totalDuration}s`, status: 'NOMINAL', color: 'text-blue-400 bg-blue-950/20 border-blue-900' },
          { label: 'RTO SLA Guarantee', value: `${report.rtoCompliancePercent}%`, status: report.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT', color: report.isCompliant ? 'text-emerald-400 bg-emerald-950/20 border-emerald-905' : 'text-red-400 bg-red-950/20 border-red-905' }
        ].map((item, idx) => (
          <div key={idx} className={`border p-4 rounded-xl shadow-sm ${item.color}`}>
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider block">{item.label}</span>
            <span className="text-2xl font-bold mt-1 block">{item.value}</span>
            <span className="inline-block border text-[8px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 mt-2 bg-slate-950/65">
              {item.status}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline vs RTO Goal chart and checklists */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Comparison charts */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-4">
            <Clock className="w-4 h-4 text-blue-400" />
            RTO Timelines Validation (Goal vs. Actual)
          </h3>
          
          <div className="h-[240px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} unit="s" />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', color: '#f1f5f9' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', marginTop: '10px' }} />
                  <Bar dataKey="Goal" fill="#1e3a8a" name="SLA Goal (Target)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#3b82f6" name="Actual Duration" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">No chart timelines compiled.</div>
            )}
          </div>
        </div>

        {/* Legal Regulatory Compliance Audits Checklist */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-4">
            <Award className="w-4 h-4 text-blue-400" />
            Certifications audit Checklist
          </h3>

          <div className="space-y-4">
            {report.auditorChecklist.map((item, idx) => (
              <div key={idx} className="border border-slate-805 bg-slate-950 p-3 rounded-lg flex items-start gap-2.5">
                {item.passed ? (
                  <FileCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">{item.rule}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.evidence}</p>
                  <span className={`inline-block text-[9px] uppercase font-bold mt-1 px-1.5 rounded ${
                    item.passed ? 'text-emerald-400 bg-emerald-950/20' : 'text-red-400 bg-red-950/20'
                  }`}>
                    {item.passed ? 'PASSED_CONTROL' : 'FAILED_CONTROL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Generative summaries generated by Gemini API */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Leadership Executive overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span>Executive leadership Summary (CTO statement)</span>
            <span className="bg-blue-950/40 text-blue-300 text-[8px] font-mono px-2 py-0.5 rounded border border-blue-900 uppercase ml-auto">Gemini Inferred</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-4 border border-slate-850 rounded-xl whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </div>

        {/* Database & Cloud Technical Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
            <CloudLightning className="w-4 h-4 text-blue-400" />
            <span>DBA & Cloud SRE technical ledger</span>
            <span className="bg-blue-950/40 text-blue-300 text-[8px] font-mono px-2 py-0.5 rounded border border-blue-900 uppercase ml-auto">Gemini Inferred</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-4 border border-slate-850 rounded-xl whitespace-pre-wrap font-mono">
            {report.technicalSummary}
          </p>
        </div>

      </div>

    </div>
  );
}
