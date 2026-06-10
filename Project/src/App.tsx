/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Shield, FileText, Activity, Layers, RefreshCw, LogIn, UserPlus, LogOut,
  Compass, AlertTriangle, AlertCircle, LayoutDashboard, Database, HelpCircle,
  Users, Key, Trash2, Edit3, CheckCircle, ShieldCheck
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
import InfrastructureStatus from './components/InfrastructureStatus';

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('dr_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Login Form Input State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Tab Navigation & RBAC
  const [activeTab, setActiveTab] = useState<'runbooks' | 'agent' | 'compliance' | 'devops' | 'audit' | 'docs' | 'users'>('agent');
  const [showRbacModal, setShowRbacModal] = useState(false);

  // Database / SRE Telemetry State
  const [runbooks, setRunbooks] = useState<Runbook[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [selectedRunbook, setSelectedRunbook] = useState<Runbook | null>(null);
  const [activeReport, setActiveReport] = useState<ComplianceReport | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  // Admin User List State
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [adminUserForm, setAdminUserForm] = useState({ name: '', email: '', role: 'Operator' as UserRole, password: '' });
  const [adminFormError, setAdminFormError] = useState('');
  const [adminFormSuccess, setAdminFormSuccess] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<UserRole>('Operator');

  // Interactive UI indicators
  const [globalLoading, setGlobalLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Helper to safely parse JSON response and avoid HTML fallback unhandled rejections
  const safeFetchJson = async (res: Response) => {
    const text = await res.text().catch(() => '');
    const cleanText = text.trim();

    if (!res.ok) {
      try {
        if (cleanText && !cleanText.startsWith('<')) {
          const parsed = JSON.parse(cleanText);
          if (parsed && parsed.error) {
            throw new Error(parsed.error);
          }
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('HTTP Error')) {
          throw e;
        }
      }
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    if (cleanText.startsWith('<')) {
      throw new Error(`Expected JSON response, but received HTML content instead. The server might still be booting up.`);
    }

    if (!cleanText) {
      return {};
    }

    try {
      return JSON.parse(cleanText);
    } catch (parseError: any) {
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }
  };

  // Secure API fetch client appending token headers and gracefully trapping 401s
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const currentToken = token || localStorage.getItem('dr_token');
    const headers = {
      ...(options.headers || {}),
      'Authorization': currentToken ? `Bearer ${currentToken}` : ''
    };
    if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.method && options.method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      // Security session expired or rejected token
      const expiredUser = currentUser;
      localStorage.removeItem('dr_token');
      localStorage.removeItem('dr_user');
      setToken(null);
      setCurrentUser(null);
      if (expiredUser) {
        fetch('/api/auth/log-expired', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: expiredUser })
        }).catch((err) => console.error('Session expiration log failed', err));
      }
      setErrorMessage('Your security session token is expired or unauthorized. Please recheck credentials.');
    }
    return res;
  };

  // Check Session Status on Startup
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem('dr_token');
      if (!storedToken) {
        setAuthChecking(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        if (res.ok) {
          const profile = await safeFetchJson(res);
          const userData = profile.user;
          if (userData && !userData.name) {
            userData.name = userData.username || userData.email || 'SRE Operator';
          }
          setCurrentUser(userData);
          // Auto switch tab permissions matching role
          if (userData && userData.role === 'Auditor') {
            setActiveTab('compliance');
          } else if (userData && userData.role === 'Viewer') {
            setActiveTab('docs');
          } else {
            setActiveTab('agent');
          }
        } else {
          localStorage.removeItem('dr_token');
          setToken(null);
        }
      } catch (err) {
        console.warn('Initial session lookup rejected. Standard login required.');
      } finally {
        setAuthChecking(false);
      }
    };
    checkSession();
  }, [token]);

  // General telemetry update triggers if logged in
  useEffect(() => {
    if (!currentUser) return;
    fetchInitialTelemetry();
    
    const interval = setInterval(() => {
      syncActiveDrillState();
      fetchGeneralMetrics();
    }, 4000);

    return () => clearInterval(interval);
  }, [currentUser, activeDrill?.id]);

  // Sync users list if active tab changes to user management
  useEffect(() => {
    if (currentUser?.role === 'Admin' && activeTab === 'users') {
      syncAdminUserList();
    }
  }, [currentUser, activeTab]);

  const syncAdminUserList = async () => {
    try {
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        const data = await safeFetchJson(res);
        setAllUsers(data);
      }
    } catch (e) {
      console.error('Failed to sync user ledger database', e);
    }
  };

  const fetchInitialTelemetry = async (attempt = 1) => {
    setGlobalLoading(true);
    setErrorMessage('');
    setRetryCount(attempt - 1);
    try {
      const rbRes = await authFetch('/api/runbooks');
      if (rbRes.ok) {
        const rbs = await safeFetchJson(rbRes);
        setRunbooks(rbs);
        if (rbs.length > 0) {
          setSelectedRunbook(rbs[0]);
        }
      }

      await fetchDrillsAndAudits();
      await fetchGeneralMetrics();
      setRetryCount(0);
      setGlobalLoading(false);
    } catch (err: any) {
      console.warn(`[Telemetry Sync] Connection attempt ${attempt} failed:`, err);
      const isNetworkOrBootErr = !err?.message || err?.message?.includes('fetch') || err?.message?.includes('HTML');
      if (isNetworkOrBootErr && attempt < 8) {
        setTimeout(() => {
          fetchInitialTelemetry(attempt + 1);
        }, 2000);
      } else {
        setErrorMessage(`Failed to connect to backend microservices: ${err?.message || err}`);
        setGlobalLoading(false);
      }
    }
  };

  const fetchDrillsAndAudits = async () => {
    try {
      const drillRes = await authFetch('/api/drills');
      if (drillRes.ok) {
        const drs = await safeFetchJson(drillRes);
        setDrills(drs);
        const runningDrill = drs.find((d: Drill) => d.status === 'RUNNING');
        if (runningDrill) {
          setActiveDrill(runningDrill);
          setActiveTab('agent');
        }
      }
      
      // Compliance check for roles
      if (currentUser?.role === 'Admin' || currentUser?.role === 'Auditor') {
        const auditRes = await authFetch('/api/audit-trail');
        if (auditRes.ok) {
          const audits = await safeFetchJson(auditRes);
          setAuditTrail(audits);
        }
      }
    } catch (err) {
      console.error('Failed to update log state', err);
    }
  };

  const fetchGeneralMetrics = async () => {
    try {
      const metRes = await authFetch('/api/system/metrics');
      if (metRes.ok) {
        const data = await safeFetchJson(metRes);
        setSystemMetrics(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const syncActiveDrillState = async () => {
    if (!activeDrill || activeDrill.status !== 'RUNNING') return;
    try {
      const res = await authFetch(`/api/drills/${activeDrill.id}`);
      if (res.ok) {
        const data = await safeFetchJson(res);
        setActiveDrill(data);
        if (data.status !== 'RUNNING') {
          fetchDrillsAndAudits();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('SRE authentication requires both email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      if (!res.ok) {
        const parsed = await safeFetchJson(res).catch(() => ({ error: 'Invalid user token matches.' }));
        throw new Error(parsed.error || 'Authentication denied.');
      }

      const data = await safeFetchJson(res);
      localStorage.setItem('dr_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      
      // Default page routing
      if (data.user.role === 'Auditor') {
        setActiveTab('compliance');
      } else if (data.user.role === 'Viewer') {
        setActiveTab('docs');
      } else {
        setActiveTab('agent');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Vector mismatch.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Backend logout routing error', e);
    } finally {
      localStorage.removeItem('dr_token');
      localStorage.removeItem('dr_user');
      setToken(null);
      setCurrentUser(null);
      setRunbooks([]);
      setDrills([]);
      setActiveDrill(null);
      setAuditTrail([]);
    }
  };

  // Admin user creator
  const handleCreateSreUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError('');
    setAdminFormSuccess('');
    
    const { name, email, role, password } = adminUserForm;
    if (!name.trim() || !email.trim() || !password.trim()) {
      setAdminFormError('All fields including initial security password are required.');
      return;
    }

    try {
      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, role, password })
      });

      if (!res.ok) {
        const parsed = await safeFetchJson(res).catch(() => ({ error: 'Fail user node insertion' }));
        throw new Error(parsed.error || 'User creation pipeline failed.');
      }

      setAdminFormSuccess(`SRE Profile for ${name} (${role}) provisioned successfully!`);
      setAdminUserForm({ name: '', email: '', role: 'Operator' as UserRole, password: '' });
      syncAdminUserList();
    } catch (ex: any) {
      setAdminFormError(ex.message || 'Error occurred inserting database node.');
    }
  };

  // Admin edit user roles
  const handleSaveUserRoleUpdate = async (userId: string) => {
    setAdminFormError('');
    setAdminFormSuccess('');
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: editingUserRole })
      });

      if (!res.ok) {
        const parsed = await safeFetchJson(res).catch(() => ({ error: 'Error modifying profile data' }));
        throw new Error(parsed.error || 'Failed updating user node.');
      }

      setAdminFormSuccess('SRE Role criteria successfully updated in database schemas.');
      setEditingUserId(null);
      syncAdminUserList();
      fetchDrillsAndAudits(); // Updates audit ledger
    } catch (ex: any) {
      setAdminFormError(ex.message || 'Error updating target schema properties.');
    }
  };

  // Admin delete users
  const handleDeleteSreUser = async (userId: string, targetName: string) => {
    if (userId === currentUser?.id) {
      setAdminFormError('Constraint violation: Admins cannot de-provision their own active tokens.');
      return;
    }
    if (!window.confirm(`Are you sure you want to completely de-provision SRE credential profile of "${targetName}"?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const parsed = await safeFetchJson(res).catch(() => ({ error: 'User deletion pipeline error' }));
        throw new Error(parsed.error || 'Failed deleting user node.');
      }
      setAdminFormSuccess(`Credential profile of "${targetName}" deactivated successfully.`);
      syncAdminUserList();
      fetchDrillsAndAudits(); // Updates logs
    } catch (ex: any) {
      setAdminFormError(ex.message || 'User node deletion aborted.');
    }
  };

  // Fast-fill test logins
  const handleFastFillLogin = (role: string) => {
    setLoginPassword('adminpassword'); // common default seeded password for convenience
    if (role === 'admin') {
      setLoginEmail('admin@dragent.com');
    } else if (role === 'operator') {
      setLoginEmail('operator@dragent.com');
      setLoginPassword('operatorpassword');
    } else if (role === 'auditor') {
      setLoginEmail('auditor@dragent.com');
      setLoginPassword('auditorpassword');
    } else if (role === 'viewer') {
      setLoginEmail('viewer@dragent.com');
      setLoginPassword('viewerpassword');
    }
  };

  // Upload/Parse Runbook Markdown API call
  const handleUploadRunbook = async (title: string, markdown: string) => {
    const res = await authFetch('/api/runbooks/upload', {
      method: 'POST',
      body: JSON.stringify({ title, rawMarkdown: markdown })
    });
    
    if (!res.ok) {
      const errData = await safeFetchJson(res).catch(() => ({ error: 'Upload parsing constraint failure' }));
      throw new Error(errData.error || 'Failed to parse');
    }

    const data = await safeFetchJson(res);
    setRunbooks((prev) => [data, ...prev]);
    setSelectedRunbook(data);
    fetchDrillsAndAudits();
  };

  // Trigger SRE Agent Drill Start payload
  const handleStartDrill = async () => {
    if (!selectedRunbook) return;
    setErrorMessage('');
    try {
      const res = await authFetch('/api/drills/start', {
        method: 'POST',
        body: JSON.stringify({ runbookId: selectedRunbook.id })
      });

      if (!res.ok) {
        const err = await safeFetchJson(res).catch(() => ({ error: 'Concurrent Drill limit checks blocked execution.' }));
        setErrorMessage(err.error || 'Concurrent Drill limit exceeded.');
        return;
      }

      const drill = await safeFetchJson(res);
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
      await authFetch(`/api/drills/${updatedDrill.id}/update`, {
        method: 'POST',
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
      logs: [...activeDrill.logs, `[STATE: IDLE] SRE automated failure rollback execution terminated manually by administrator.`].slice(-100)
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
      const res = await authFetch('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({ drillId })
      });
      const data = await safeFetchJson(res);
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
      await authFetch('/api/system/simulate-rate-limit', { method: 'POST' });
      fetchDrillsAndAudits();
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic privilege boundary checking for SRE layouts
  const checkPermission = (action: string): boolean => {
    if (!currentUser) return false;
    const permissions: Record<UserRole, string[]> = {
      Admin: ['upload_runbook', 'start_drill', 'stop_drill', 'execute_tools', 'view_reports', 'view_audit_trail', 'configure_settings', 'manage_users'],
      Operator: ['upload_runbook', 'start_drill', 'stop_drill', 'execute_tools', 'view_reports', 'view_audit_trail'],
      Auditor: ['view_reports', 'view_audit_trail'],
      Viewer: ['view_reports']
    };
    return permissions[currentUser.role]?.includes(action) || false;
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#070A13] flex flex-col items-center justify-center font-sans text-slate-400">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <span className="text-xs tracking-widest font-mono uppercase text-slate-500">Decrypting SRE Keychain...</span>
      </div>
    );
  }

  // --- UNAUTHENTICATED RENDER STATE (Enterprise SRE Login Panel) ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#070A13] text-slate-200 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white relative overflow-hidden">
        
        {/* Vector Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-15%] left-[-15%] w-[600px] h-[600px] bg-indigo-950/20 rounded-full blur-[150px]"></div>
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-900 sticky top-0 bg-[#070A13]/90 backdrop-blur-md z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-4 h-4 text-white fill-current" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white font-display">
                DR DRILL <span className="text-blue-400">WALKTHROUGH AGENT</span>
              </h1>
              <p className="text-[9px] uppercase tracking-widest text-slate-600 font-mono">Failover Verification Engine</p>
            </div>
          </div>
          <div className="text-slate-600 font-mono text-[10px] hidden sm:block">STATUS: SECURE_CHANNEL_ACTIVE</div>
        </header>

        {/* Content Body */}
        <main className="flex-1 flex flex-col justify-center items-center px-4 py-12 z-10 w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          
          <div className="space-y-6 max-w-sm">
            <div className="space-y-2">
              <span className="px-2 py-0.5 text-[9px] font-mono bg-blue-900/50 text-blue-300 border border-blue-800 rounded uppercase tracking-wider">
                Enterprise Shield V2.4.0
              </span>
              <h2 className="text-2xl font-bold font-display text-white tracking-tight leading-tight">
                Role-Based SRE Failure Verification Client
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Authenticate via standard SRE credentials to view telemetry drills, upload doc catalog checklists, compile Gemini audit audits, and run processes failover commands locally.
            </p>
            
            <div className="space-y-4 pt-2 bg-slate-950/50 border border-slate-900 p-4 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Role Testing Credentials:</span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleFastFillLogin('admin')}
                  className="bg-slate-900/80 hover:bg-slate-900 hover:border-blue-500/40 border border-slate-800/80 px-2 py-1.5 rounded text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-red-400 font-bold block">🚨 Admin</span>
                  <span className="text-[8px] text-slate-500 font-mono truncate block">admin@dragent.com</span>
                </button>
                <button 
                  onClick={() => handleFastFillLogin('operator')}
                  className="bg-slate-900/80 hover:bg-slate-900 hover:border-amber-500/40 border border-slate-800/80 px-2 py-1.5 rounded text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-amber-400 font-bold block">⚙️ Operator</span>
                  <span className="text-[8px] text-slate-500 font-mono truncate block">operator@dragent.com</span>
                </button>
                <button 
                  onClick={() => handleFastFillLogin('auditor')}
                  className="bg-slate-900/80 hover:bg-slate-900 hover:border-emerald-500/40 border border-slate-800/80 px-2 py-1.5 rounded text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-emerald-400 font-bold block">🔍 Auditor</span>
                  <span className="text-[8px] text-slate-500 font-mono truncate block">auditor@dragent.com</span>
                </button>
                <button 
                  onClick={() => handleFastFillLogin('viewer')}
                  className="bg-slate-900/80 hover:bg-slate-900 hover:border-slate-500/40 border border-slate-800/80 px-2 py-1.5 rounded text-left transition-all cursor-pointer"
                >
                  <span className="text-[10px] text-slate-400 font-bold block">👁️ Viewer</span>
                  <span className="text-[8px] text-slate-500 font-mono truncate block">viewer@dragent.com</span>
                </button>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-2xl p-6 shadow-2xl shadow-blue-950/10 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-6">
              <Key className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold text-slate-100 uppercase tracking-wide">Secure Token Gateway</span>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  Operator Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@dragent.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  SRE Authorization Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                />
              </div>

              {loginError && (
                <div className="bg-red-950/30 border border-red-900 rounded-lg p-2.5 text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {errorMessage && (
                <div className="bg-amber-955/35 border border-amber-900/80 text-amber-200 text-xs p-2.5 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-900/20 active:scale-[0.98]"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Validating TLS Tokens...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-white" />
                    Verify SRE Sign-In
                  </>
                )}
              </button>
            </form>

            <div className="text-[10px] text-slate-500 text-center mt-5 font-mono">
              IP tracking authorized. JWT authentication token validity: 24h.
            </div>
          </div>

        </main>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-900 text-[10px] text-slate-650 font-mono">
          © {new Date().getFullYear()} SRE Global Networks. Authenticated via SHA-256 local keystore.
        </footer>
      </div>
    );
  }

  // --- AUTHENTICATED RENDER STATE (Main Dynamic Dashboard App) ---
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
            <p className="text-[10px] text-slate-500 font-medium font-sans">SRE Authorization Mode: <span className="font-bold text-slate-400 uppercase">{currentUser.role}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* Active Agent Mode banner */}
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Active Agent Mode</span>
            <span className={`font-mono text-xs flex items-center gap-1.5 ${activeDrill && activeDrill.status === 'RUNNING' ? 'text-emerald-400' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${activeDrill && activeDrill.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
              {activeDrill && activeDrill.status === 'RUNNING' ? 'AUTONOMOUS EXECUTION' : 'STANDBY IDLE'}
            </span>
          </div>

          <div className="hidden md:block h-8 w-[1px] bg-slate-800"></div>

          {/* User Details & Management switcher */}
          <div className="text-right flex items-center gap-3.5">
            <div className="hidden sm:block">
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider">SECURE SRE_ID</span>
              <button
                onClick={() => setShowRbacModal(true)}
                className="text-xs font-mono font-semibold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                🔐 {currentUser.role} ({(currentUser.name || currentUser.username || currentUser.email || 'SRE').split(' ')[0]})
              </button>
            </div>
            
            {/* Real Logout trigger */}
            <div className="h-8 w-[1px] bg-slate-800 hidden sm:block"></div>
            <button
              onClick={handleLogout}
              title="De-provision secure token"
              className="p-1.5 bg-slate-900 hover:bg-red-955 hover:text-red-300 text-slate-400 border border-slate-800 hover:border-red-900/40 rounded transition-all cursor-pointer flex items-center justify-center gap-1 px-2.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase">Exit</span>
            </button>
          </div>

          {activeDrill && activeDrill.status === 'RUNNING' && checkPermission('stop_drill') && (
            <>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <button
                onClick={handleStopDrill}
                className="px-4 py-2 bg-red-655 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors uppercase tracking-widest shadow-lg shadow-red-900/20 cursor-pointer animate-pulse"
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
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 bg-[#0F172A] border-r border-b lg:border-b-0 border-slate-800 flex flex-col p-4 justify-between">
          <nav className="space-y-1">
            
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-2">Command</div>
            {[
              { id: 'agent' as const, label: 'Agent Monitor', icon: Compass, permission: 'view_reports' },
              { id: 'runbooks' as const, label: 'Runbooks Desk', icon: FileText, permission: 'view_reports' }
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
              { id: 'compliance' as const, label: 'Compliance Reports', icon: Shield, permission: 'view_reports' },
              { id: 'devops' as const, label: 'DevOps & SRE Analytics', icon: Activity, permission: 'view_reports' },
              { id: 'audit' as const, label: 'Audit Trail Ledger', icon: Layers, permission: 'view_audit_trail' },
              { id: 'docs' as const, label: 'Systems Manuals', icon: HelpCircle, permission: 'view_reports' }
            ].map((tab) => {
              if (tab.permission === 'view_audit_trail' && !checkPermission('view_audit_trail')) {
                return null;
              }
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

            {/* Admin Exclusive User Management */}
            {currentUser.role === 'Admin' && (
              <>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-8">SRE Authorization Matrix</div>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all text-left cursor-pointer ${
                    activeTab === 'users' 
                      ? 'bg-[#ef4444]/10 text-red-400 border border-red-500/20 shadow-sm' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Users className={`w-4 h-4 ${activeTab === 'users' ? 'text-red-400' : 'text-slate-550'}`} />
                  User Management
                </button>
              </>
            )}
          </nav>

          {/* Current Operator Profile Panel */}
          <div className="p-2 border-t border-slate-850 mt-8 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/35 flex items-center justify-center font-bold text-xs text-blue-400">
                {(currentUser.name || currentUser.username || currentUser.email || 'SR').slice(0,2).toUpperCase()}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-slate-200 truncate">{currentUser.name || currentUser.username || currentUser.email || 'SRE Operator'}</span>
                <span className="text-[9px] text-slate-500 font-mono truncate max-w-[130px] uppercase">{currentUser.role} Badge</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="col-span-12 lg:col-span-9 xl:col-span-10 p-6 flex flex-col gap-6 overflow-y-auto bg-[#0B0F1A]">
          
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 shrink-0 font-sans">
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
            <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs px-4 py-3 rounded-xl flex items-center justify-between gap-4 shadow">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => fetchInitialTelemetry()} 
                  className="text-emerald-400 font-semibold hover:underline font-mono cursor-pointer"
                >
                  Retry
                </button>
                <span className="text-slate-600">|</span>
                <button 
                  onClick={() => setErrorMessage('')} 
                  className="text-red-400 font-semibold hover:underline font-mono cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Viewport switch container */}
          <div className="flex-1 min-h-0">
            {globalLoading ? (
              <div className="flex flex-col justify-center items-center py-40">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <span className="text-sm font-medium text-slate-400 tracking-wide">
                  {retryCount > 0 
                    ? `Attempting to reconnect (Attempt ${retryCount}/8)...` 
                    : "Initializing telemetry channels..."}
                </span>
                {retryCount > 0 && (
                  <span className="text-xs text-slate-500 mt-2 font-mono">
                    Backend container is initializing. Re-establishing link stream...
                  </span>
                )}
              </div>
            ) : (
              <div id="active-viewport-card" className="space-y-6">
                
                <InfrastructureStatus />
                
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
                      <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-display">
                        <Database className="w-5 h-5 text-blue-500" />
                        System Manual: Disaster Recovery (DR) Orchestration
                      </h2>
                      <p className="text-xs text-slate-400 mt-1 font-sans">Written by SRE Technical Advisory Board.</p>
                    </div>

                    <div className="prose prose-invert prose-xs text-slate-400 space-y-4 font-sans text-xs">
                      <h3 className="text-sm font-semibold text-slate-200">1. Architectural Blueprint</h3>
                      <p className="leading-relaxed">
                        This drill walkthrough agent acts as an autonomous execution plane inside localized subnets, validating configurations. It operates using the Observe-Reason-Plan-Execute-Verify state tracker, maintaining continuous TLS checks.
                      </p>

                      <h3 className="text-sm font-semibold text-slate-200">2. Security Parameters</h3>
                      <p className="leading-relaxed">
                        Authentication triggers JWT tokens with refresh options over secure TLS ports. Rates are limited by sliding-window buckets (Redis default: 30 requests/30s maximum per source subnet pointer).
                      </p>

                      <h3 className="text-sm font-semibold text-slate-200">3. RTO SLA Targets</h3>
                      <p className="leading-relaxed font-sans">
                        Timeline goals are compared automatically via synthetic test blocks. If promotion latencies exceed targets, warning alerts are logged directly within the compliance audit records.
                      </p>
                    </div>
                  </div>
                )}

                {/* --- ADMIN EXCLUSIVE USER MANAGEMENT DESK --- */}
                {activeTab === 'users' && currentUser.role === 'Admin' && (
                  <div id="user-management-panel" className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade duration-200">
                    
                    {/* User creation component */}
                    <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                      <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-red-400" />
                        Provision SRE Profile Node
                      </h3>
                      <p className="text-slate-400 text-xs font-sans">
                        Submit authorization keys to persist new credentials into the local secure SQLite keystores.
                      </p>

                      <form onSubmit={handleCreateSreUser} className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. SRE Leader David"
                            value={adminUserForm.name}
                            onChange={(e) => setAdminUserForm({ ...adminUserForm, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Connection Code</label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. david@dragent.com"
                            value={adminUserForm.email}
                            onChange={(e) => setAdminUserForm({ ...adminUserForm, email: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Initial Security Password</label>
                          <input
                            type="password"
                            required
                            placeholder="Initial password key"
                            value={adminUserForm.password}
                            onChange={(e) => setAdminUserForm({ ...adminUserForm, password: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Role Permission Matrix</label>
                          <select
                            value={adminUserForm.role}
                            onChange={(e) => setAdminUserForm({ ...adminUserForm, role: e.target.value as UserRole })}
                            className="w-full bg-slate-950 border border-slate-855 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none"
                          >
                            <option value="Admin">Admin (All Access Controls)</option>
                            <option value="Operator">Operator (Drill Trigger Allowed)</option>
                            <option value="Auditor">Compliance Auditor (Read Audits)</option>
                            <option value="Viewer">Viewer (Read Manuals)</option>
                          </select>
                        </div>

                        {adminFormError && (
                          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs p-2.5 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400" />
                            <span>{adminFormError}</span>
                          </div>
                        )}

                        {adminFormSuccess && (
                          <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs p-2.5 rounded-lg flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                            <span>{adminFormSuccess}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full bg-blue-600 hover:bg-blue-550 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          Construct Credentials
                        </button>
                      </form>
                    </div>

                    {/* Users list database ledger */}
                    <div className="xl:col-span-2 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
                          <Users className="w-5 h-5 text-blue-400" />
                          SRE Credential Node Registry
                        </h3>
                        <button 
                          onClick={syncAdminUserList}
                          className="p-1 px-2.5 rounded bg-slate-950 text-slate-400 hover:text-white border border-slate-850 hover:border-slate-700 text-xs font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" /> Sync SQLite
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-350 border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[9px] bg-slate-950/40">
                              <th className="p-3">User Profile Name</th>
                              <th className="p-3">Email Key</th>
                              <th className="p-3">Security Badge</th>
                              <th className="p-3">Enrolled Time</th>
                              <th className="p-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allUsers.map((u) => (
                              <tr key={u.id} className="border-b border-slate-850 hover:bg-slate-950/20">
                                <td className="p-3 font-semibold text-slate-200">{u.name}</td>
                                <td className="p-3 font-mono text-slate-400 select-all">{u.email}</td>
                                <td className="p-3">
                                  {editingUserId === u.id ? (
                                    <select
                                      value={editingUserRole}
                                      onChange={(e) => setEditingUserRole(e.target.value as UserRole)}
                                      className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-blue-300"
                                    >
                                      <option value="Admin">Admin</option>
                                      <option value="Operator">Operator</option>
                                      <option value="Auditor">Auditor</option>
                                      <option value="Viewer">Viewer</option>
                                    </select>
                                  ) : (
                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded capitalize tracking-wider ${
                                      u.role === 'Admin' ? 'bg-red-900/40 text-red-300 border border-red-800' :
                                      u.role === 'Operator' ? 'bg-amber-900/40 text-amber-300 border border-amber-800' :
                                      u.role === 'Auditor' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800' :
                                      'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}>
                                      {u.role}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-slate-500 text-[10px]">
                                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'System Seed'}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    {editingUserId === u.id ? (
                                      <>
                                        <button
                                          onClick={() => handleSaveUserRoleUpdate(u.id)}
                                          className="text-emerald-400 hover:underline hover:text-emerald-300 font-semibold cursor-pointer"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => setEditingUserId(null)}
                                          className="text-slate-500 hover:underline hover:text-slate-400 font-semibold cursor-pointer font-sans"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingUserId(u.id);
                                            setEditingUserRole(u.role);
                                          }}
                                          title="Modify role criteria"
                                          className="p-1 rounded hover:bg-slate-850 hover:text-blue-400 text-slate-500 transition-all cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSreUser(u.id, u.name)}
                                          disabled={u.id === currentUser?.id}
                                          title={u.id === currentUser?.id ? "Self-deletion blocked" : "Deprovision user"}
                                          className={`p-1 rounded hover:bg-slate-850 text-slate-550 transition-all ${
                                            u.id === currentUser?.id ? 'opacity-30 cursor-not-allowed text-slate-700' : 'hover:text-red-400 cursor-pointer'
                                          }`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}
          </div>

          {/* Footer Status Bar inside Right Column */}
          <footer className="h-12 bg-[#111827] border border-slate-800 rounded-lg flex items-center px-6 justify-between shrink-0 text-xs text-slate-500 mt-4">
            <div className="flex gap-8 font-sans">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-sans">SLA Target</span>
                <span className="text-[10px] text-emerald-500 font-mono">0 Unresolved</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest font-sans font-medium">SQLite Keystore</span>
                <span className="text-[10px] text-emerald-500 font-mono">Connected (1ms)</span>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-[10px] text-slate-600">SECURE-SESSION-KEY</span>
              <div className="h-4 w-[1px] bg-slate-800"></div>
              <span className="text-[10px] text-slate-500">Region: <span className="text-white font-semibold">us-east-1a</span></span>
            </div>
          </footer>

        </main>
      </div>

      {/* RBAC Simulation Modal Dialog */}
      {showRbacModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-md font-bold text-slate-105 flex items-center gap-2 font-display">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                Active SRE Permissions Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your role credentials define which access tags are verified by the server-side API routers. Toggle-role simulator is disabled. To shift privileges, sign in as a different credential level.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { role: 'Admin' as const, label: 'Admin Access', desc: 'Can upload and parser documents, trigger system drills, and provision logins.' },
                { role: 'Operator' as const, label: 'Operator Access', desc: 'Can review runbooks, parse schemas, and trigger automated drills.' },
                { role: 'Auditor' as const, label: 'Compliance Auditor', desc: 'Read-only access restricted solely to auditor checklists, reports, and events logs.' },
                { role: 'Viewer' as const, label: 'Viewer Access', desc: 'Read-only layout dashboard and educational systems manuals.' }
              ].map((matrix) => (
                <div
                  key={matrix.role}
                  className={`border p-3 rounded-lg transition-all ${
                    currentUser.role === matrix.role
                      ? 'bg-blue-950/40 border-blue-500 shadow-sm'
                      : 'bg-[#0B0F1A] border-slate-850 opacity-40'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-200 block">{matrix.label} {currentUser.role === matrix.role && '⭐ (ACTIVE SESSION)'}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{matrix.desc}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRbacModal(false)}
                className="bg-[#0B0F1A] hover:bg-slate-900 border border-slate-800 hover:border-slate-705 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 transition-all cursor-pointer"
              >
                Dismiss Matrix
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
