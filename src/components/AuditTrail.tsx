/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Search, ShieldAlert, ArrowDownWideNarrow, ListPlus } from 'lucide-react';
import { AuditEvent } from '../types';

interface AuditTrailProps {
  auditTrail: AuditEvent[];
}

export default function AuditTrail({ auditTrail }: AuditTrailProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const filteredTrails = auditTrail.filter((evt) => {
    const matchesSearch = 
      evt.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
      evt.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'ALL' || evt.userRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div id="audit-trail-container" className="space-y-6">
      
      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row gap-4 justify-between items-center">
        
        {/* Search input field */}
        <div className="relative w-full sm:w-1/2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search action keyword, email address, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Role filters select options */}
        <div id="filter-controls" className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <ArrowDownWideNarrow className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">User Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Operator">Operator</option>
            <option value="Auditor">Auditor</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>

      </div>

      {/* Audit ledger list log table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-semibold uppercase font-mono text-slate-400">SOC 2 compliant Audit Ledger</span>
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{filteredTrails.length} Events captured</span>
        </div>

        <div className="divide-y divide-slate-800 max-h-[480px] overflow-y-auto">
          {filteredTrails.length === 0 ? (
            <div className="py-20 text-center text-slate-500 italic text-xs">No audit logs matching selection bounds.</div>
          ) : (
            filteredTrails.map((evt) => {
              const isCrit = evt.action.includes('RATE_LIMITER') || evt.action.includes('ABUSE');
              const isDoc = evt.action.includes('SYSTEM_BOOTUP') || evt.action.includes('COMPILER');
              
              let auditIconColor = 'text-blue-400 border-blue-905 bg-blue-950/20';
              if (isCrit) auditIconColor = 'text-red-400 border-red-905 bg-red-950/20';
              else if (isDoc) auditIconColor = 'text-teal-400 border-teal-905 bg-teal-950/20';

              return (
                <div key={evt.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start hover:bg-slate-950/35 transition-all">
                  
                  <div className={`p-2 rounded-lg border flex-shrink-0 ${auditIconColor}`}>
                    {isCrit ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1 w-full">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs uppercase text-slate-200 tracking-wider">
                        {evt.action}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-350">{evt.details}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                      <span>Operator: <strong className="text-slate-400">{evt.userEmail}</strong></span>
                      <span>•</span>
                      <span>Role: <strong className="text-slate-400">{evt.userRole}</strong></span>
                      <span>•</span>
                      <span>IP Source: <strong className="text-slate-400">{evt.ipAddress}</strong></span>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
