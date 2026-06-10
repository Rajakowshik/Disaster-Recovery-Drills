/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileCheck, Shield, Award, AlertCircle, Copy, Check, Download, 
  Clock, BookOpen, AlertOctagon, Printer, CloudLightning, FileText 
} from 'lucide-react';
import { ComplianceReport, Drill, User } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ComplianceViewerProps {
  report: ComplianceReport | null;
  selectedDrill: Drill | null;
  loading: boolean;
  currentUser?: User | null;
}

const downloadFile = (content: string, fileName: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const generateTextReport = (report: ComplianceReport) => {
  let checklistStr = '';
  report.auditorChecklist.forEach((item, index) => {
    checklistStr += `[${item.passed ? 'PASSED' : 'FAILED'}] ${index + 1}. ${item.rule}\n   Evidence: ${item.evidence}\n\n`;
  });

  return `================================================================================
                    DISASTER RECOVERY COMPLIANCE DRILL REPORT
================================================================================
Drill Title:              ${report.drillTitle}
Audit Drill ID:           ${report.drillId}
Executed Date:            ${new Date(report.createdAt).toLocaleString()}
Compliance Status:        ${report.isCompliant ? 'FULLY COMPLIANT' : 'NON-COMPLIANT'}
RTO SLA Target Met:       ${report.rtoCompliancePercent}%
Total Steps Executed:     ${report.totalSteps}
Passed Procedures:        ${report.passed} / ${report.totalSteps}
RTO SLA Violations:       ${report.rtoViolations}
Total SLA Duration:       ${report.totalDuration}s
--------------------------------------------------------------------------------

EXECUTIVE LEADERSHIP SUMMARY (CTO STATEMENT)
============================================
${report.executiveSummary}

DBA & CLOUD SRE TECHNICAL LEDGER
================================
${report.technicalSummary}

REGULATORY CERTIFICATIONS AUDIT CHECKLIST
==========================================
${checklistStr}--------------------------------------------------------------------------------
This report is a dynamic compliance record. Automated verifications compiled 
under continuous SRE testing pipelines.
================================================================================`;
};

const generateHtmlReport = (report: ComplianceReport) => {
  let checklistHtml = '';
  report.auditorChecklist.forEach((item) => {
    checklistHtml += `
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 8px; background-color: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="font-size: 14px; color: #1e293b;">${item.rule}</strong>
          <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px; ${item.passed ? 'background-color: #d1fae5; color: #065f46;' : 'background-color: #fee2e2; color: #991b1b;'}">
            ${item.passed ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0;">${item.evidence}</p>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Compliance Report - ${report.drillTitle}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 2fr 2fr;
      gap: 16px;
      background-color: #f1f5f9;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .meta-item {
      font-size: 13px;
    }
    .meta-label {
      font-weight: bold;
      color: #64748b;
    }
    .badge {
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      text-transform: uppercase;
    }
    .badge-compliant {
      background-color: #d1fae5;
      color: #065f46;
    }
    .badge-noncompliant {
      background-color: #fee2e2;
      color: #991b1b;
    }
    h2 {
      font-size: 18px;
      color: #0f172a;
      border-left: 4px solid #3b82f6;
      padding-left: 10px;
      margin-top: 32px;
      margin-bottom: 12px;
    }
    .section-box {
      background-color: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px;
      font-size: 13.5px;
      white-space: pre-wrap;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      margin-top: 48px;
      padding-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6;">Compliance Audit record</span>
      <span class="badge ${report.isCompliant ? 'badge-compliant' : 'badge-noncompliant'}">
        ${report.isCompliant ? 'FULLY COMPLIANT' : 'NON-COMPLIANT'}
      </span>
    </div>
    <h1 class="title">${report.drillTitle}</h1>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
      Compiled on ${new Date(report.createdAt).toLocaleString()} • ID: ${report.drillId}
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">Passed Procedures:</span> ${report.passed} / ${report.totalSteps}</div>
    <div class="meta-item"><span class="meta-label">RTO SLA Guarantee:</span> ${report.rtoCompliancePercent}%</div>
    <div class="meta-item"><span class="meta-label">Total SLA Duration:</span> ${report.totalDuration}s</div>
    <div class="meta-item"><span class="meta-label">RTO SLA Violations:</span> ${report.rtoViolations}</div>
  </div>

  <h2>executive leadership summary (CTO statement)</h2>
  <div class="section-box" style="font-family: inherit;">${report.executiveSummary}</div>

  <h2>DBA & cloud SRE technical ledger</h2>
  <div class="section-box" style="font-family: monospace; font-size: 12px;">${report.technicalSummary}</div>

  <h2>compliance audit checklist</h2>
  <div style="margin-top: 12px;">
    ${checklistHtml}
  </div>

  <div class="footer">
    This document was generated automatically by the SRE Drill Walkthrough Agent. CONFIDENTIAL - FOR INTERNAL USE ONLY.
  </div>
</body>
</html>`;
};

export default function ComplianceViewer({
  report,
  selectedDrill,
  loading,
  currentUser
}: ComplianceViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyText = () => {
    if (!report) return;
    const body = `CTO EXECUTIVE COMPLIANCE REPORT\n--------------------\nDrill Ref: ${report.drillId}\nDrill Title: ${report.drillTitle}\nStatus: ${report.isCompliant ? 'FULLY COMPLIANT' : 'NON-COMPLIANT'}\nRTO Met Checklist: ${report.rtoMet}/${report.totalSteps}\n\n${report.executiveSummary}\n\nTECHNICAL DEPRECIATION DETAIL\n--------------------\n${report.technicalSummary}`;
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!report) return;
    const txtContent = generateTextReport(report);
    downloadFile(txtContent, `compliance-report-${report.drillId}.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadHtml = () => {
    if (!report) return;
    const htmlContent = generateHtmlReport(report);
    downloadFile(htmlContent, `compliance-report-${report.drillId}.html`, 'text/html;charset=utf-8');
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
    name: (st.name || '').slice(0, 15) + '...',
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

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopyText}
            className="bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Ledger' : 'Copy Full Report'}
          </button>

          {currentUser?.role === 'Viewer' ? (
            <div className="text-[10px] bg-slate-950 border border-slate-850 text-slate-500 px-3 py-2 rounded-lg font-mono flex items-center gap-1.5">
              🔒 DOWNLOAD_RESTRICTED (VIEWER PRIVILEGES)
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                title="Download report as plain text"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Download (.txt)</span>
              </button>
              
              <button
                type="button"
                onClick={handleDownloadHtml}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/10 cursor-pointer"
                title="Generate and download formatted HTML report ready to print or view"
              >
                <Printer className="w-4 h-4" /> Print Form
              </button>
            </>
          )}
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
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
