/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, Play, AlertCircle, RefreshCw, 
  Layers, History, FileUp, AlertTriangle, UserCheck 
} from 'lucide-react';
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

  // SRE Document Upload & history states
  const [uploadTab, setUploadTab] = useState<'editor' | 'upload'>('editor');
  const [dragActive, setDragActive] = useState(false);
  const [fileParsing, setFileParsing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  const fetchUploadHistory = async () => {
    try {
      const token = localStorage.getItem('dr_token');
      const res = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUploadedDocs(data);
      }
    } catch (e) {
      console.error('Failed to retrieve uploaded documents history', e);
    }
  };

  useEffect(() => {
    fetchUploadHistory();
  }, []);

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
      setWarnings([]);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse and import markdown specifications.');
    } finally {
      setLoading(false);
    }
  };

  // Drag-and-drop mechanics
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadAndProcessFile(e.target.files[0]);
    }
  };

  const uploadAndProcessFile = async (file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.txt', '.md', '.docx', '.pdf'];
    if (!allowed.includes(ext)) {
      setError(`Invalid file type "${ext}". Supported runbook formats are: .txt, .md, .docx, .pdf`);
      return;
    }

    setFileParsing(true);
    setError('');
    setWarnings([]);
    setSuccess(false);

    const formData = new FormData();
    formData.append('runbookFile', file);

    try {
      const token = localStorage.getItem('dr_token');
      const res = await fetch('/api/runbooks/upload-document', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Upload translation pipeline failed' }));
        throw new Error(errJson.error || 'Server processing error.');
      }

      const data = await res.json();
      setTitle(data.title || file.name.replace(/\.[^/.]+$/, ""));
      setMarkdown(data.markdown || '');
      
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings);
      }
      
      setSuccess(true);
      setUploadTab('editor'); // Instantly route to editor so user can review the parsed steps
      fetchUploadHistory();
    } catch (err: any) {
      setError(err?.message || 'Failed to parse runbook document.');
    } finally {
      setFileParsing(false);
    }
  };

  return (
    <div id="runbook-editor-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Upload Markdown Form */}
      <div id="upload-panel" className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col">
        
        {/* Toggle options */}
        <div className="flex border-b border-slate-800 mb-5">
          <button
            onClick={() => setUploadTab('editor')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              uploadTab === 'editor'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✍️ Manual SRE Markdown
          </button>
          <button
            onClick={() => setUploadTab('upload')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              uploadTab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📄 Runbook Document Upload
          </button>
        </div>

        {uploadTab === 'editor' ? (
          <div>
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-blue-400" />
              Ingest Core Markdown Runbook
            </h3>
            
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Runbook Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Postgres DB Regional Failover Checksheet"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Runbook Instructions Markdown
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

              {/* Parser warnings */}
              {warnings.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-900 rounded-lg p-3 text-amber-200 text-xs space-y-1 max-h-[140px] overflow-y-auto">
                  <span className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-400">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> 
                    Runbook Validation Feedback ({warnings.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="bg-emerald-950/40 border border-emerald-905 text-emerald-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>SRE Runbook verified and compiled into telemetry stack successfully!</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={loading || activeDrillRunning}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    activeDrillRunning 
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  {loading ? 'Compiling Runbook...' : 'Verify & Mount SRE Runbook'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-1">
                <FileUp className="w-5 h-5 text-blue-400" />
                SRE Smart Document Ingestion
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Drag-and-drop your DR runbooks here. Supports <span className="text-blue-300">.txt, .md, .docx, and .pdf</span> formats. Core parsing extracts SRE function bindings automatically.
              </p>

              {/* Drag Area */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all ${
                  dragActive 
                    ? 'border-blue-505 bg-blue-950/20 shadow-lg shadow-blue-500/10 scale-[0.99]' 
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <input
                  type="file"
                  id="file-upload-input"
                  multiple={false}
                  onChange={handleFileChange}
                  accept=".txt,.md,.docx,.pdf"
                  className="hidden"
                />
                
                {fileParsing ? (
                  <div className="text-center space-y-2">
                    <RefreshCw className="w-10 h-10 text-blue-505 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-slate-300">Executing SRE semantic parser pipeline...</p>
                  </div>
                ) : (
                  <label htmlFor="file-upload-input" className="text-center cursor-pointer block w-full space-y-2">
                    <Upload className="w-10 h-10 text-slate-500 hover:text-blue-400 transition-colors mx-auto" />
                    <p className="text-xs text-slate-300">
                      <span className="font-bold text-blue-400">Click to select SRE schema</span> or drag & drop runbooks here
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">Supported catalog keys: TXT | Markdown | MS Word | PDF</p>
                  </label>
                )}
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-900 text-red-100 text-xs px-3 py-2 rounded-lg flex items-center gap-2 mt-4">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Upload History list */}
            <div className="border-t border-slate-800/80 pt-5 mt-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                SRE Document Upload Audit History ({uploadedDocs.length})
              </h4>

              {uploadedDocs.length === 0 ? (
                <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 text-center text-xs text-slate-600">
                  No previous runbook files have been ingested yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {uploadedDocs.map((doc: any) => (
                    <div key={doc.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex items-center justify-between text-xs hover:border-slate-800 transition-all">
                      <div className="flex items-center gap-2 max-w-[70%]">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-slate-300 block truncate">{doc.fileName}</span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-slate-600" /> Ingested by {doc.uploadedBy}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-900 text-blue-400 border border-slate-800 rounded uppercase font-mono">{doc.fileType?.replace('.', '')}</span>
                        <span className="block text-[9px] text-slate-600 font-mono mt-1">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Select and Run Active Runbook */}
      <div id="selection-panel" className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-blue-400" />
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
                      : 'bg-slate-950 border-slate-850 hover:border-slate-800'
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
              <span className="text-[10px] uppercase font-bold text-blue-405 tracking-wider font-mono">Active Configuration</span>
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
                  : 'bg-emerald-600 hover:bg-emerald-550 text-white shadow-lg shadow-emerald-700/20'
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
