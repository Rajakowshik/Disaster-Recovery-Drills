/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, Play, AlertCircle, RefreshCw } from 'lucide-react';
import { Runbook, User } from '../types';

interface RunbookEditorProps {
  runbooks: Runbook[];
  onUpload: (title: string, markdown: string) => Promise<void>;
  onSelect: (runbook: Runbook) => void;
  selectedRunbook: Runbook | null;
  activeDrillRunning: boolean;
  onStartDrill: () => void;
  currentUser: User;
}

export default function RunbookEditor({
  runbooks,
  onUpload,
  onSelect,
  selectedRunbook,
  activeDrillRunning,
  onStartDrill,
  currentUser
}: RunbookEditorProps) {
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState(`# AWS Multi-Region Regional Failover Runbook

## Step 1
Function: check_network
RTO Target: 6s
Description: Verify active network segments and secondary VPC readiness under DR configurations.

---

## Step 2
Function: stop_primary_replica
RTO Target: 12s
Description: Isolate master Database cluster state by shutting down writing sockets.

---

## Step 3
Function: failover_database
RTO Target: 18s
Description: Promote standby cluster replica to full read-write transactional authority.

---

## Step 4
Function: verify_read_write
RTO Target: 8s
Description: Execute heartbeat injections into transaction tables to guarantee replication integrity.

---

## Step 5
Function: dns_switchover
RTO Target: 10s
Description: Rewrite active DNS pointers to target DR server IP locations.`);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a descriptive title.');
      return;
    }
    if (!markdown.trim()) {
      setError('Runbook markdown cannot be empty.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await onUpload(title, markdown);
      setSuccess(true);
      setTitle('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse and import markdown specifications.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="runbook-editor-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Upload Markdown Form */}
      <div id="upload-panel" className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-blue-400" />
          Ingest New Markdown Runbook
        </h3>
        
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Runbook Action Title
            </label>
            <input
              type="text"
              placeholder="e.g. AWS Postgres regional failover checklist"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Runbook Markdown (SRE Template)
              </label>
              <button
                type="button"
                onClick={() => setMarkdown(`# Custom Failover Scheme\n\n## Step 1\nFunction: check_network\nRTO Target: 8s\nDescription: Validate subnet reachability.`)}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset Template
              </button>
            </div>
            <textarea
              rows={12}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
            />
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-950/40 border border-emerald-905 text-emerald-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Runbook parsed and compiled into procedures list!</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || activeDrillRunning}
              className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                activeDrillRunning 
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
              }`}
            >
              <Upload className="w-4 h-4" />
              {loading ? 'Compiling Markdown...' : 'Parse & Load Runbook'}
            </button>
          </div>
        </form>
      </div>

      {/* Select and Run Active Runbook */}
      <div id="selection-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            Loaded Manuals Registry
          </h3>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {runbooks.map((rb) => {
              const isSelected = selectedRunbook?.id === rb.id;
              return (
                <div
                  key={rb.id}
                  onClick={() => onSelect(rb)}
                  className={`border p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 shadow'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-semibold text-slate-200 line-clamp-1">{rb.title}</h4>
                    <span className="text-[10px] font-mono text-slate-500">{rb.steps.length} Steps</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rb.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {selectedRunbook && (
          <div className="border-t border-slate-800 pt-4 mt-4">
            <div className="bg-slate-950 p-3 rounded-lg mb-4">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Active Configuration</span>
              <h4 className="text-sm font-medium text-slate-200 mt-1">{selectedRunbook.title}</h4>
              <ul className="text-xs text-slate-400 space-y-1 mt-2">
                {selectedRunbook.steps.map((st, i) => (
                  <li key={st.id} className="flex gap-1 items-center">
                    <span className="text-slate-500 font-mono text-[10px]/none">[{i+1}]</span>
                    <span className="truncate">{st.name}</span>
                    <span className="text-[10px] font-mono text-emerald-500 ml-auto">{st.rtoTarget}s RTO</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={onStartDrill}
              disabled={activeDrillRunning}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeDrillRunning
                  ? 'bg-amber-950/30 text-amber-500 border border-amber-900/50 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-700/20'
              }`}
            >
              <Play className="w-4 h-4 fill-current text-white" />
              {activeDrillRunning ? 'Drill Execution In Progress' : 'Initialize Automated Agent Drill'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
