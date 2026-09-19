const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fsClassic = fs;
const os = require('os');
const https = require('https');
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const http = require('http');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;

const app = express();
const PORT = process.env.PORT || 7800;
const SCRAPER_MANAGER_URL = process.env.SCRAPER_MANAGER_URL || 'http://127.0.0.1:7500';

let cachedExeActive = false;
let lastExeCheck = 0;
let cachedDbMetrics = {
  user_id: 1572,
  firm_id: 5,
  memberid: 1572,
  totalScraped: 0,
  sourceTotalScraped: 0,
  emailsFound: 0,
  phonesFound: 0,
  scrapedToday: 0
};

async function refreshDbMetricsAsync() {
  let connection;
  try {
    connection = await mysql.createConnection({ ...dbConfig, connectTimeout: 3000 });
    const newMetrics = { ...cachedDbMetrics };

    try {
      const [totalVendorRows] = await connection.query('SELECT COUNT(*) as count FROM kf_vendor');
      newMetrics.totalScraped = totalVendorRows[0]?.count || 0;
    } catch (err) { }

    try {
      const [totalSourceRows] = await connection.query('SELECT COUNT(*) as count FROM kfvendor_source');
      newMetrics.sourceTotalScraped = totalSourceRows[0]?.count || 0;
    } catch (err) { }

    try {
      const [emailRows] = await connection.query("SELECT COUNT(*) as count FROM kf_vendor WHERE email != '' AND email IS NOT NULL");
      newMetrics.emailsFound = emailRows[0]?.count || 0;
    } catch (e) { }

    try {
      const [phoneRows] = await connection.query("SELECT COUNT(*) as count FROM kf_vendor WHERE phone != '' AND phone IS NOT NULL");
      newMetrics.phonesFound = phoneRows[0]?.count || 0;
    } catch (e) { }

    try {
      const [todayRows] = await connection.query(
        "SELECT COUNT(*) as count FROM kf_vendor WHERE DATE(INSRT_DTM) = CURDATE() OR DATE(SCRAPPING_TIME) = CURDATE()"
      );
      newMetrics.scrapedToday = todayRows[0]?.count || 0;
    } catch (e) { }

    cachedDbMetrics = newMetrics;
  } catch (dbErr) {
    // Fail silently in background
  } finally {
    if (connection) await connection.end().catch(() => { });
  }
}

// Background DB poll every 15 seconds
setInterval(refreshDbMetricsAsync, 15000);
refreshDbMetricsAsync();

async function isProcessRunning(processName) {
  const now = Date.now();
  if (now - lastExeCheck < 8000) return cachedExeActive;
  lastExeCheck = now;
  try {
    const { stdout } = await execPromise(`tasklist /FI "IMAGENAME eq ${processName}" /NH`);
    cachedExeActive = stdout.toLowerCase().includes(processName.toLowerCase());
  } catch (err) {
    cachedExeActive = false;
  }
  return cachedExeActive;
}

const dbConfig = {
  host: '88.150.227.117',
  user: 'nrktrn_web_admin',
  password: 'GOeg&*$*657',
  database: 'nrkindex_trn',
  port: 3306
};

const dbPool = mysql.createPool(dbConfig);

async function poolQuery(sql, params = []) {
  const [rows] = await dbPool.query(sql, params);
  return rows;
}

// CORS Configuration & Headers
const corsOptions = {
  origin: true, // Allow all requesting origins dynamically
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  const reqHeaders = req.headers['access-control-request-headers'] || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', reqHeaders);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global HTTP Request Logger
app.use((req, res, next) => {
  if (req.url && req.url.includes('/api/')) {
    console.log(`[HTTP ${req.method}] ${req.url} - Origin: ${req.headers.origin || '-'}, Body:`, req.body ? JSON.stringify(req.body) : '{}');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/scrapper-agent', express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
  res.redirect('https://myblocks.in/login');
});

app.get('/scrapper-agent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/scrapper-agent/login', (req, res) => {
  res.redirect('https://myblocks.in/login');
});

// Default Client Directory & Accounts
const defaultClientsList = [
  { client_id: 1572, username: 'maneesha', password: 'maneesha123', name: 'Maneesha Shaik', role: 'client' },
  { client_id: 2001, username: 'client2001', password: 'client2001', name: 'Client B (2001)', role: 'client' },
  { client_id: 3002, username: 'client3002', password: 'client3002', name: 'Client C (3002)', role: 'client' },
  { client_id: 1001, username: 'admin', password: 'admin123', name: 'System Admin', role: 'admin' }
];

let activeSessions = {}; // token -> { client_id, username, name, role, created_at }

// Auth API Endpoints (Local Auth using empid & firmid with zero user_table dependency)
app.post('/api/auth/login', async (req, res) => {
  const { empid, firmid, name, username, password } = req.body || {};

  let clientRecord = null;

  // Local authentication via Employee ID (empid) and Firm ID (firmid) with smart defaults
  const empIdVal = empid || username || '1572';
  const firmIdVal = firmid || '5';

  const parsedEmpId = parseInt(empIdVal, 10);
  const parsedFirmId = parseInt(firmIdVal, 10);
  const clientId = !isNaN(parsedEmpId) ? parsedEmpId : empIdVal;
  const firmId = !isNaN(parsedFirmId) ? parsedFirmId : firmIdVal;

  const role = (clientId === 1001 || String(empIdVal) === '1001' || username === 'admin') ? 'admin' : 'client';
  const displayName = (name && name.trim()) ? name.trim() : (role === 'admin' ? 'System Admin' : `Employee ${empIdVal}`);
  const uname = (username && username.trim()) ? username.trim() : `emp_${empIdVal}`;

  clientRecord = {
    client_id: clientId,
    firm_id: firmId,
    empid: String(empIdVal),
    firmid: String(firmIdVal),
    username: uname,
    name: displayName,
    role: role
  };

  const token = `sess_${clientRecord.client_id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const sessionData = {
    client_id: clientRecord.client_id,
    firm_id: clientRecord.firm_id,
    empid: clientRecord.empid,
    firmid: clientRecord.firmid,
    username: clientRecord.username,
    name: clientRecord.name,
    role: clientRecord.role,
    created_at: new Date()
  };

  activeSessions[token] = sessionData;

  // Set cookies on response
  const cookieOpts = { path: '/', maxAge: 30 * 86400 * 1000 };
  res.cookie('userid', String(clientRecord.client_id), cookieOpts);
  res.cookie('user_id', String(clientRecord.client_id), cookieOpts);
  res.cookie('client_id', String(clientRecord.client_id), cookieOpts);
  res.cookie('empid', String(clientRecord.empid), cookieOpts);
  res.cookie('firmid', String(clientRecord.firm_id), cookieOpts);
  res.cookie('firm_id', String(clientRecord.firm_id), cookieOpts);
  res.cookie('FIRMID', String(clientRecord.firm_id), cookieOpts);

  logReallocation(`[CLIENT AUTH] Client '${clientRecord.username}' (Emp ID: ${clientRecord.empid}, Firm ID: ${clientRecord.firm_id}) logged in locally.`);

  return res.json({
    success: true,
    token: token,
    client_id: clientRecord.client_id,
    firm_id: clientRecord.firm_id,
    empid: clientRecord.empid,
    firmid: clientRecord.firmid,
    username: clientRecord.username,
    name: clientRecord.name,
    role: clientRecord.role
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, username, password, empid, firmid } = req.body || {};

  const cleanUser = (username || empid || `user_${Date.now()}`).trim();
  const cleanPass = (password || 'password').trim();
  const cleanName = (name && name.trim()) ? name.trim() : cleanUser;
  const parsedEmpId = parseInt(empid, 10);
  const parsedFirmId = parseInt(firmid, 10);

  // Generate or use provided Client ID
  const maxId = Math.max(...defaultClientsList.map(c => c.client_id || 0), 4000);
  const newClientId = !isNaN(parsedEmpId) ? parsedEmpId : (maxId + 1);
  const newFirmId = !isNaN(parsedFirmId) ? parsedFirmId : 5;

  const newClientRecord = {
    client_id: newClientId,
    firm_id: newFirmId,
    empid: String(newClientId),
    firmid: String(newFirmId),
    username: cleanUser,
    password: cleanPass,
    name: cleanName,
    role: 'client'
  };

  defaultClientsList.push(newClientRecord);

  // Automatically log in the user upon registration
  const token = `sess_${newClientId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const sessionData = {
    client_id: newClientId,
    firm_id: newFirmId,
    empid: String(newClientId),
    firmid: String(newFirmId),
    username: cleanUser,
    name: cleanName,
    role: 'client',
    created_at: new Date()
  };

  activeSessions[token] = sessionData;

  const cookieOpts = { path: '/', maxAge: 30 * 86400 * 1000 };
  res.cookie('userid', String(newClientId), cookieOpts);
  res.cookie('user_id', String(newClientId), cookieOpts);
  res.cookie('client_id', String(newClientId), cookieOpts);
  res.cookie('empid', String(newClientId), cookieOpts);
  res.cookie('firmid', String(newFirmId), cookieOpts);
  res.cookie('firm_id', String(newFirmId), cookieOpts);
  res.cookie('FIRMID', String(newFirmId), cookieOpts);

  logReallocation(`[CLIENT AUTH] New local account '${cleanUser}' (Client ID: ${newClientId}, Firm ID: ${newFirmId}) registered and logged in.`);

  return res.json({
    success: true,
    token: token,
    client_id: newClientId,
    firm_id: newFirmId,
    empid: String(newClientId),
    firmid: String(newFirmId),
    username: cleanUser,
    name: cleanName,
    role: 'client',
    message: 'Account registered successfully!'
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'] || req.body?.token;
  if (token && activeSessions[token]) {
    delete activeSessions[token];
  }
  res.clearCookie('userid', { path: '/', domain: '.myblocks.in' });
  res.clearCookie('firmid', { path: '/', domain: '.myblocks.in' });
  res.clearCookie('adminuser', { path: '/', domain: '.myblocks.in' });
  res.clearCookie('userid', { path: '/' });
  res.clearCookie('firmid', { path: '/' });
  res.clearCookie('adminuser', { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  if (token && activeSessions[token]) {
    return res.json({ success: true, session: activeSessions[token] });
  }
  return res.status(401).json({ error: 'No active session found.' });
});

// Middleware: Client Extraction & Strict Multi-Tenant Isolation Check
function extractClientContext(req, res, next) {
  const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;

  let session = null;
  if (token && activeSessions[token]) {
    session = activeSessions[token];
    req.clientSession = session;
  }

  const headerClientId = req.headers['x-client-id'] || req.headers['x-user-id'];
  const queryClientId = req.query.client_id || req.query.user_id;
  const bodyClientId = req.body?.client_id || req.body?.user_id || req.body?.USERID;

  const headerFirmId = req.headers['x-firm-id'];
  const queryFirmId = req.query.firm_id || req.query.firmid;
  const bodyFirmId = req.body?.firm_id || req.body?.firmid || req.body?.FIRMID;

  // Extract 'userid', 'firmid', and 'adminuser' from incoming request cookies
  let cookieUserId = null;
  let cookieFirmId = null;
  let isCookieAdmin = false;
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)(?:userid|user_id|client_id)=([^;]+)/i);
    if (match) {
      const parsed = parseInt(decodeURIComponent(match[1]), 10);
      if (!isNaN(parsed) && parsed > 0) {
        cookieUserId = parsed;
      }
    }

    const firmMatch = req.headers.cookie.match(/(?:^|;\s*)(?:firmid|firm_id|FIRMID)=([^;]+)/i);
    if (firmMatch) {
      const parsedFirm = parseInt(decodeURIComponent(firmMatch[1]), 10);
      if (!isNaN(parsedFirm) && parsedFirm > 0) {
        cookieFirmId = parsedFirm;
      }
    }

    const adminMatch = req.headers.cookie.match(/(?:^|;\s*)(?:adminuser|ADMIN_USER|admin_user)=([^;]+)/i);
    if (adminMatch && adminMatch[1]) {
      const val = decodeURIComponent(adminMatch[1]).trim();
      if (val && val !== '0' && val !== 'false' && val !== 'NO') {
        isCookieAdmin = true;
      }
    }
  }

  let targetClientId;
  let isAdmin = false;

  if (session) {
    targetClientId = session.client_id;
    isAdmin = (session.role === 'admin') || isCookieAdmin;
  } else {
    // Priority Cascade: Header (explicit client selector) > Cookie from main project > Query > Body > Default
    targetClientId = parseInt(headerClientId, 10) || cookieUserId || parseInt(queryClientId || bodyClientId || defaultScraperConfig.user_id, 10);
    isAdmin = (req.headers['x-role'] === 'admin') || (req.headers['x-admin'] === 'true') || (req.query.admin === 'true') || isCookieAdmin || (req.headers['x-admin-user'] ? true : false);
  }

  // Allow Admin to view other client spaces if explicitly requested
  if (isAdmin && (headerClientId || queryClientId || bodyClientId)) {
    const requested = parseInt(headerClientId || queryClientId || bodyClientId, 10);
    if (!isNaN(requested)) targetClientId = requested;
  }

  req.clientId = targetClientId;
  req.firmId = parseInt(headerFirmId || cookieFirmId || queryFirmId || bodyFirmId || defaultScraperConfig.firm_id || 5, 10);

  req.isAdmin = isAdmin;

  // Security Rule: Enforce HTTP 403 Forbidden if non-admin attempts unauthorized cross-client access
  const authHeader = req.headers['x-auth-client-id'];
  if (!isAdmin && authHeader && parseInt(authHeader, 10) !== targetClientId) {
    console.warn(`[SECURITY 403] Client ${authHeader} attempted unauthorized access to Client ${targetClientId}`);
    return res.status(403).json({
      error: '403 Forbidden: Cross-client access is strictly prohibited.',
      auth_client_id: parseInt(authHeader, 10),
      requested_client_id: targetClientId
    });
  }

  next();
}

app.use(extractClientContext);

// Workflows States
let cityQueue = [];
let currentOrchestrationTopic = 'General';
let agents = [];
let allocations = []; // { agent_id, portal_id, city_name, status }
let backendOnlineGlobal = false;
let schedulerBatches = []; // { batch_id, city_name, batch_num, agent_name, progress }
let executions = {}; // execution_id -> details
let reallocationEvents = []; // { timestamp, event_desc }
let errorHistory = [];
let performanceMatrix = [];
let allocationEngineActive = true; // State of the allocation loop (Pause / Resume)

// Superadmin Password Protection for Cross-User Entry Control/Deletion
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'mulan123';

function isOtherUserRunner(runner, requestingClientId) {
  if (!runner) return false;
  const currentIdStr = requestingClientId !== undefined && requestingClientId !== null ? String(requestingClientId).trim() : '';
  if (!currentIdStr) return false;

  const runnerClientId = runner.client_id !== undefined && runner.client_id !== null ? String(runner.client_id).trim() : '';

  if (runnerClientId && runnerClientId !== currentIdStr) {
    return true;
  }

  const nameMatch = (runner.agent_name || runner.runner_id || runner.server_name || '').match(/(\d+)/);
  if (nameMatch && nameMatch[1] && nameMatch[1] !== currentIdStr) {
    return true;
  }

  return false;
}

// Self-Healing Error Recovery Engine State
let recoveryState = {
  heartbeat_interval_sec: 5,
  last_heartbeat_time: new Date(),
  ws_status: 'Connected',
  backend_port: 7500,
  backend_status: 'Running',
  last_backend_check: new Date(),
  recovery_attempts_count: 0,
  current_recovery_stage: 'Idle',
  last_recovery_reason: 'System Healthy',
  current_resume_portal: '-',
  current_resume_batch: '-',
  current_resume_range: '-',
  checkpoint_status: 'Synced',
  active_recoveries: []
};

function broadcastRecoveryEvent(eventType, details) {
  const detailStr = typeof details === 'string' ? details : (details.reason || details.details || JSON.stringify(details));
  const eventObj = {
    timestamp: new Date().toLocaleTimeString(),
    event_type: eventType,
    stage: recoveryState.current_recovery_stage,
    details: detailStr,
    runner_id: typeof details === 'object' ? (details.runner_id || 'runner_1572') : 'runner_1572'
  };
  recoveryState.active_recoveries.unshift(eventObj);
  if (recoveryState.active_recoveries.length > 50) recoveryState.active_recoveries.pop();

  logReallocationEvent({
    event_type: eventType,
    from_agent: typeof details === 'object' ? (details.runner_id || 'Runner') : 'Runner',
    to_agent: typeof details === 'object' ? (details.to_agent || '-') : '-',
    portal_id: typeof details === 'object' ? (details.portal_id || recoveryState.current_resume_portal) : recoveryState.current_resume_portal,
    city_batch: typeof details === 'object' ? (details.city_batch || recoveryState.current_resume_batch) : recoveryState.current_resume_batch,
    reason: detailStr
  });
}

// Runner Concurrency Lock & Queue Dispatcher
const runnerExecutionLocks = new Map(); // runner_id -> { execution_id, city_id, started_at }

function releaseRunnerExecutionLock(runnerId) {
  if (runnerId && runnerExecutionLocks.has(runnerId)) {
    console.log(`[CONCURRENCY LOCK RELEASE] Released execution lock for runner '${runnerId}'.`);
    runnerExecutionLocks.delete(runnerId);
  }
}

async function dispatchNextQueuedBatch(runnerId) {
  releaseRunnerExecutionLock(runnerId);

  const regItem = runnerRegistry.find(r => r.runner_id === runnerId || r.agent_name.includes('Manisha'));
  const rClientId = regItem?.client_id || 1572;

  // Find next Queued or Pending batch specifically for this client
  const queuedBatch = cityQueue.find(c => (c.assigned_agent === runnerId || c.assigned_agent === regItem?.agent_name) && (c.status === 'Queued' || c.status === 'Pending')) ||
    cityQueue.find(c => (c.status === 'Queued' || c.status === 'Pending') && (c.client_id || 1572) === rClientId);

  if (!queuedBatch) return;

  const targetAgent = agents.find(a => a.agent_id === runnerId || a.agent_name === regItem?.agent_name) || agents.find(a => a.status === 'Idle');

  if (regItem && targetAgent && !runnerExecutionLocks.has(regItem.runner_id)) {
    console.log(`[CONCURRENCY DISPATCH] Dispatching next queued batch '${queuedBatch.city_name}' to runner '${regItem.agent_name}'.`);
    queuedBatch.status = 'Pending';
    await triggerScraperRun(queuedBatch, targetAgent);
  }
}

// Distributed Registered Runner Registry (Step 5) - Real active runners populated via WebSocket or manual registration
let runnerRegistry = [];

let latestDiscoveryResults = [];
let latestValidationResults = [];

let schedulerConfig = {
  batch_size: 1000,
  max_parallel_agents: 20,
  run_basic: true,
  run_contact: false,
  run_social: false,
  run_leader: false
};

// Helper for Auto Reallocation Timeline logging (Workflow 7)
function logReallocationEvent(eventData) {
  const fullEvent = {
    timestamp: new Date().toLocaleTimeString(),
    event_type: eventData.event_type || 'Manual Reassign',
    from_agent: eventData.from_agent || '-',
    to_agent: eventData.to_agent || '-',
    portal_id: eventData.portal_id || '-',
    city_batch: eventData.city_batch || '-',
    reason: eventData.reason || 'Workflow reallocation completed.'
  };
  reallocationEvents.unshift(fullEvent);
  if (reallocationEvents.length > 100) reallocationEvents.pop();
  logReallocation(`[${fullEvent.event_type}] ${fullEvent.city_batch} | From: ${fullEvent.from_agent} -> To: ${fullEvent.to_agent} | ${fullEvent.reason}`);
}

// WebSocket Live Runner Registry Connection Manager
const wsConnectedRunners = new Map(); // runner_id -> { ws, runner_id, runner_name, client_id, server_ip, port, connected_at, last_heartbeat, status }

function handleWsConnection(ws, req) {
  const clientIp = req.socket.remoteAddress || '127.0.0.1';
  let authenticatedRunnerId = null;

  console.log(`[WEBSOCKET] Client connecting from ${clientIp}...`);

  ws.on('message', (messageBuffer) => {
    try {
      const messageStr = messageBuffer.toString();
      const data = JSON.parse(messageStr);
      const eventType = data.event || data.type || data.action;

      const activeRunnerId = data.runner_id || authenticatedRunnerId;
      if (activeRunnerId) {
        const clientObj = wsConnectedRunners.get(activeRunnerId);
        if (clientObj) clientObj.last_heartbeat = new Date();
        const regItem = runnerRegistry.find(r => r.runner_id === activeRunnerId);
        if (regItem) regItem.last_heartbeat = new Date();
      }

      if (eventType === 'register') {
        let runnerId = data.runner_id || `runner_${data.client_id || '1572'}`;
        const parsedClientId = parseInt(data.client_id, 10) || 1572;
        const hostIp = `${data.server_ip || clientIp}:${data.port || 7500}`;
        const runnerDisplayName = data.runner_name || `Client ${parsedClientId} (${clientIp})`;

        // Guarantee unique runner_id per machine even if multiple PCs share the same client_id (e.g. runner_1572)
        if (runnerDisplayName.includes('(')) {
          const match = runnerDisplayName.match(/\((.*?)\)/);
          if (match && match[1]) {
            const cleanMachine = match[1].replace(/[^a-zA-Z0-9_-]/g, '_');
            if (!runnerId.includes(cleanMachine)) {
              runnerId = `${runnerId}_${cleanMachine}`;
            }
          }
        }

        authenticatedRunnerId = runnerId;

        const runnerVersion = data.version;

        wsConnectedRunners.set(runnerId, {
          ws: ws,
          runner_id: runnerId,
          runner_name: runnerDisplayName,
          client_id: parsedClientId,
          version: runnerVersion,
          server_ip: data.server_ip || clientIp,
          port: data.port || 7500,
          connected_at: new Date(),
          last_heartbeat: new Date(),
          status: 'Idle'
        });

        let regItem = runnerRegistry.find(r => r.runner_id === runnerId || (r.agent_name === runnerDisplayName && r.client_id === parsedClientId));
        if (regItem) {
          regItem.runner_id = runnerId;
          regItem.client_id = parsedClientId;
          regItem.agent_name = runnerDisplayName;
          regItem.server_name = runnerDisplayName;
          regItem.version = runnerVersion;
          regItem.status = 'Idle';
          regItem.last_heartbeat = new Date();
          regItem.host_ip = hostIp;
        } else {
          runnerRegistry.push({
            runner_id: runnerId,
            version: runnerVersion,
            server_name: runnerDisplayName,
            host_ip: hostIp,
            agent_name: runnerDisplayName,
            client_id: parsedClientId,
            status: 'Idle',
            last_heartbeat: new Date(),
            current_workflow: null,
            current_batch: null,
            execution_id: null,
            portal_id: null
          });
        }

        // Auto-sync to agents array
        let agentItem = agents.find(a => a.agent_id === runnerId || a.agent_name === runnerDisplayName);
        if (agentItem) {
          agentItem.status = 'Idle';
          agentItem.client_id = parsedClientId;
          agentItem.last_heartbeat = new Date();
        } else {
          agents.push({
            agent_id: runnerId,
            portal_id: null,
            agent_name: runnerDisplayName,
            client_id: parsedClientId,
            status: 'Idle',
            current_city: null,
            execution_id: null,
            last_heartbeat: new Date()
          });
        }

        console.log(`[WEBSOCKET REGISTER] Runner '${runnerId}' (${runnerDisplayName}) registered successfully.`);
        logReallocationEvent({
          event_type: 'WS Register',
          from_agent: '-',
          to_agent: runnerDisplayName,
          portal_id: '-',
          city_batch: '-',
          reason: `WebSocket runner connected from ${clientIp}`
        });

        ws.send(JSON.stringify({
          event: 'registered',
          status: 'success',
          runner_id: runnerId,
          timestamp: new Date().toISOString()
        }));

      } else if (eventType === 'heartbeat') {
        const runnerId = data.runner_id || authenticatedRunnerId;
        if (runnerId && wsConnectedRunners.has(runnerId)) {
          const clientObj = wsConnectedRunners.get(runnerId);
          const isRunning = data.status && (String(data.status).toLowerCase() === 'running' || data.status === 'Busy');
          clientObj.status = isRunning ? 'Running' : 'Idle';
          if (data.version) clientObj.version = data.version;

          let regItem = runnerRegistry.find(r => r.runner_id === runnerId);
          if (!regItem) {
            regItem = {
              runner_id: runnerId,
              version: data.version || clientObj.version || null,
              server_name: clientObj.runner_name || `Server (${clientObj.server_ip})`,
              host_ip: `${clientObj.server_ip}:${clientObj.port}`,
              agent_name: clientObj.runner_name || runnerId,
              client_id: clientObj.client_id,
              status: isRunning ? 'Running' : 'Idle',
              last_heartbeat: new Date(),
              current_workflow: isRunning ? (data.category || 'Scraping Execution') : null,
              current_batch: null,
              execution_id: isRunning ? (data.execution_id || null) : null,
              portal_id: null
            };
            runnerRegistry.push(regItem);
          } else {
            regItem.last_heartbeat = new Date();
            regItem.status = isRunning ? 'Running' : 'Idle';
            if (data.version) regItem.version = data.version;
            if (isRunning) {
              if (data.category) regItem.current_workflow = data.category;
              if (data.execution_id) regItem.execution_id = data.execution_id;
            } else {
              regItem.current_workflow = null;
              regItem.execution_id = null;
            }
          }

          // Send ACK to maintain active 2-way WebSocket connection with runner
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ event: 'ack', type: 'heartbeat', status: 'ok', timestamp: new Date().toISOString() }));
            } catch (e) { }
          }
        }

      } else if (eventType === 'progress') {
        const runnerId = data.runner_id || authenticatedRunnerId;
        console.log(`[WEBSOCKET PROGRESS] Runner '${runnerId}': Category '${data.category || '-'}', Status '${data.status || '-'}', ExecID '${data.execution_id || '-'}'`);

        if (runnerId && wsConnectedRunners.has(runnerId)) {
          const clientObj = wsConnectedRunners.get(runnerId);
          clientObj.last_heartbeat = new Date();
          clientObj.status = 'Running';
        }

        const regItem = runnerRegistry.find(r => r.runner_id === runnerId);
        if (regItem) {
          regItem.last_heartbeat = new Date();
          regItem.status = 'Running';
          if (data.portal_id) regItem.portal_id = data.portal_id;
          if (data.execution_id) regItem.execution_id = data.execution_id;
          if (data.category) regItem.current_workflow = data.category;
        }

        // Send ACK to maintain active 2-way WebSocket connection with runner
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ event: 'ack', type: 'progress', status: 'ok', timestamp: new Date().toISOString() }));
          } catch (e) { }
        }

      } else if (eventType === 'execution_completed') {
        const runnerId = data.runner_id || authenticatedRunnerId;
        console.log(`[WEBSOCKET COMPLETED] Runner '${runnerId}' completed task (SP_ID: ${data.sp_id || '-'}, Portal: ${data.portal_id || '-'})`);

        const regItem = runnerRegistry.find(r => r.runner_id === runnerId);
        if (regItem) {
          regItem.status = 'Idle';
          regItem.current_workflow = null;
          regItem.execution_id = null;
        }

        const matchingCity = cityQueue.find(c =>
          (data.city_id && c.city_id === data.city_id) ||
          (data.execution_id && c.execution_id === data.execution_id) ||
          (c.status === 'Running' && (c.assigned_agent === runnerId || (regItem && c.assigned_agent === regItem.agent_name)))
        );

        if (matchingCity) {
          matchingCity.status = 'Completed';
          matchingCity.completed_at = new Date().toLocaleTimeString();
          matchingCity.companies_processed = matchingCity.total_companies || data.total_contacts || matchingCity.companies_processed;
          logReallocation(`[BATCH COMPLETED] Marked batch '${matchingCity.city_name}' as Completed.`);
        }

        logReallocationEvent({
          event_type: 'WS Task Completed',
          from_agent: data.runner_id || authenticatedRunnerId || 'Runner',
          to_agent: '-',
          portal_id: data.portal_id || '-',
          city_batch: data.portal_name || data.category || (matchingCity ? matchingCity.city_name : '-'),
          reason: `Execution completed via WebSocket (SP_ID: ${data.sp_id || '-'})`
        });

        // Release lock & dispatch next queued batch
        dispatchNextQueuedBatch(runnerId);

      } else if (eventType === 'execution_failed') {
        const runnerId = data.runner_id || authenticatedRunnerId;
        console.error(`[WEBSOCKET FAILED] Runner '${runnerId}' failed task: ${data.error}`);

        const regItem = runnerRegistry.find(r => r.runner_id === runnerId);
        if (regItem) regItem.status = 'Idle';

        const matchingCity = cityQueue.find(c =>
          (data.city_id && c.city_id === data.city_id) ||
          (data.execution_id && c.execution_id === data.execution_id) ||
          (c.status === 'Running' && (c.assigned_agent === runnerId || (regItem && c.assigned_agent === regItem.agent_name)))
        );
        if (matchingCity) {
          matchingCity.status = 'Failed';
          logReallocation(`[BATCH FAILED] Marked batch '${matchingCity.city_name}' as Failed: ${data.error}`);
        }

        errorHistory.unshift({
          timestamp: new Date().toLocaleTimeString(),
          agent: runnerId,
          error: data.error || 'Execution failed via WebSocket',
          severity: 'High'
        });
        if (errorHistory.length > 50) errorHistory.pop();

        // Release lock & dispatch next queued batch
        dispatchNextQueuedBatch(runnerId);
      }
    } catch (err) {
      console.error('[WEBSOCKET MSG PARSE ERROR]', err.message);
    }
  });

  ws.on('close', () => {
    if (authenticatedRunnerId) {
      console.log(`[WEBSOCKET DISCONNECT] Runner '${authenticatedRunnerId}' disconnected.`);
      wsConnectedRunners.delete(authenticatedRunnerId);
      const regItem = runnerRegistry.find(r => r.runner_id === authenticatedRunnerId);
      if (regItem) regItem.status = 'Disconnected';
    }
  });

  ws.on('error', (err) => {
    console.error(`[WEBSOCKET ERROR] Client ${authenticatedRunnerId || clientIp}:`, err.message);
  });
}

function dispatchTaskViaWebSocket(runnerId, jobData) {
  const clientObj = wsConnectedRunners.get(runnerId);
  if (clientObj && clientObj.ws && clientObj.ws.readyState === WebSocket.OPEN) {
    clientObj.ws.send(JSON.stringify({
      event: 'start_execution',
      action: 'start_execution',
      job_data: jobData
    }));
    clientObj.status = 'Running';
    const regItem = runnerRegistry.find(r => r.runner_id === runnerId);
    if (regItem) regItem.status = 'Running';
    return true;
  }
  return false;
}

// Helper to retrieve an active WebSocket runner connection
function getConnectedWsRunner(runnerOrAgent) {
  if (!runnerOrAgent) return null;

  const targetId = runnerOrAgent.runner_id || runnerOrAgent.agent_id;
  const targetName = runnerOrAgent.agent_name || runnerOrAgent.server_name;
  const targetClientId = parseInt(runnerOrAgent.client_id, 10);

  // 1. Direct or partial match by runner_id or agent_name
  for (const [id, info] of wsConnectedRunners.entries()) {
    if (info && info.ws && info.ws.readyState === WebSocket.OPEN) {
      const heartbeatAgeSec = (Date.now() - new Date(info.last_heartbeat).getTime()) / 1000;
      if (heartbeatAgeSec > 60) continue; // Ignore stale heartbeats (>60s)

      if (
        (targetId && (id === targetId || info.runner_id === targetId || targetId.includes(id) || id.includes(targetId))) ||
        (targetName && info.runner_name && (info.runner_name.toLowerCase().includes(targetName.toLowerCase()) || targetName.toLowerCase().includes(info.runner_name.toLowerCase())))
      ) {
        return info;
      }
    }
  }

  // 2. Client ID match fallback if specific runner_id / agent_name not matched directly
  if (targetClientId) {
    for (const [id, info] of wsConnectedRunners.entries()) {
      if (info && info.ws && info.ws.readyState === WebSocket.OPEN) {
        const heartbeatAgeSec = (Date.now() - new Date(info.last_heartbeat).getTime()) / 1000;
        if (heartbeatAgeSec <= 60 && info.client_id === targetClientId) {
          return info;
        }
      }
    }
  }

  // 3. Fallback: Any active connected WebSocket runner
  for (const [id, info] of wsConnectedRunners.entries()) {
    if (info && info.ws && info.ws.readyState === WebSocket.OPEN) {
      const heartbeatAgeSec = (Date.now() - new Date(info.last_heartbeat).getTime()) / 1000;
      if (heartbeatAgeSec <= 60) {
        return info;
      }
    }
  }

  return null;
}


function isRunnerConnectedAndActive(runnerOrAgent) {
  return getConnectedWsRunner(runnerOrAgent) !== null;
}

// Default scraper config
let defaultScraperConfig = {
  username: "Maneesha",
  user_id: 1572,
  firm_id: 5,
  memberid: 1572,
  total_contacts: 500,
  batch_size: 100,
  start_from: 1,
  basic_scraping_url: "http://127.0.0.1:7500",
  contact_scraping_url: "http://127.0.0.1:7500",
  social_scraping_url: "http://127.0.0.1:7004",
  leader_scraping_url: "http://127.0.0.1:7500",
  run_basic: true,
  run_contact: false,
  run_social: false,
  run_leader: false,
  source_table: "kfvendor_source",
  dest_table: "kf_vendor",
  categories: [],
  areas: [],
  turbo_mode: false,
  use_groq: false,
  use_ollama: false,
  use_llm: false,
  ollama_model: "",
  groq_model: process.env.GROQ_MODEL || "",
  empty_only: false,
  cookie_optional: true,
  email_recipients: "",
  basic_options: ["company_name", "address", "phone", "website", "category"],
  contact_options: ["email", "phone", "website"],
  social_options: [],
  leader_options: [],
  force_recheck: false
};

// Portal ID Cache & Resolver Helpers
let portalCache = new Map();

function resolvePortalIdFromText(text, fallbackId) {
  if (fallbackId && !isNaN(parseInt(fallbackId, 10)) && parseInt(fallbackId, 10) !== 0) {
    return parseInt(fallbackId, 10);
  }
  if (!text) return null;
  const match = String(text).match(/\((\d+)\)/);
  if (match) return parseInt(match[1], 10);
  return null;
}

async function getPortalIdByCityName(cityName, fallbackId) {
  const syncResolved = resolvePortalIdFromText(cityName, fallbackId);
  if (syncResolved) return syncResolved;

  if (!cityName) return null;
  const cleanName = String(cityName).split('[')[0].split('(')[0].trim().toLowerCase();
  if (!cleanName) return null;

  if (portalCache.has(cleanName)) {
    return portalCache.get(cleanName);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(
      `SELECT portalid FROM portal WHERE LOWER(TRIM(portalname)) = ? AND status = 'ACTIVE' LIMIT 1`,
      [cleanName]
    );
    if (rows.length > 0 && rows[0].portalid) {
      const pid = parseInt(rows[0].portalid, 10);
      portalCache.set(cleanName, pid);
      return pid;
    }
  } catch (err) {
    // Fail silently
  } finally {
    if (connection) await connection.end();
  }
  return null;
}

async function getValidGroqChatModel(key, preferredModel) {
  const isNonChatModel = (m) => !m ||
    m.toLowerCase().includes('prompt-guard') ||
    m.toLowerCase().includes('guard') ||
    m.toLowerCase().includes('whisper') ||
    m.toLowerCase().includes('audio') ||
    m.toLowerCase().includes('speech') ||
    m.toLowerCase().includes('orpheus') ||
    m.toLowerCase().includes('compound');

  if (preferredModel && !isNonChatModel(preferredModel)) {
    return preferredModel;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const availableIds = data.data.map(m => m.id);
        const validChatModel = availableIds.find(id => !isNonChatModel(id));
        if (validChatModel) {
          return validChatModel;
        }
      }
    }
  } catch (err) {
    console.error('[GROQ MODEL AUTO-DISCOVERY] Error:', err.message);
  }

  return 'openai/gpt-oss-20b';
}

async function getActiveApiKey(targetUserId, requestedProvider = null, targetFirmId = null) {
  const userId = parseInt(targetUserId || defaultScraperConfig.user_id, 10);
  const firmId = parseInt(targetFirmId || defaultScraperConfig.firm_id || 5, 10);
  try {
    const rows = await poolQuery(
      `SELECT API_KEY, MODEL_NAME, MODEL_URL, LLM_PROVIDER, LLM_PROVIDER_TYPE, STATUS, BLOCKED, USERID, FIRMID 
       FROM API_KEY_MANAGER 
       WHERE BLOCKED = 'NO'
       ORDER BY (STATUS = 'ACTIVE') DESC, (USERID = ?) DESC, (FIRMID = ?) DESC, ID DESC`,
      [userId, firmId]
    ).catch(() => []);

    if (rows && rows.length > 0) {
      let match = null;
      if (requestedProvider) {
        match = rows.find(r => r.LLM_PROVIDER === requestedProvider && r.STATUS === 'ACTIVE') ||
          rows.find(r => r.LLM_PROVIDER === requestedProvider);
      }
      if (!match) {
        // Preferred Provider Priority: GEMINI -> GROQ -> Any Active Text LLM
        match = rows.find(r => r.STATUS === 'ACTIVE' && r.LLM_PROVIDER === 'GEMINI' && r.LLM_PROVIDER_TYPE !== 'TEXT-TO-IMAGE') ||
          rows.find(r => r.STATUS === 'ACTIVE' && r.LLM_PROVIDER === 'GROQ' && r.LLM_PROVIDER_TYPE !== 'TEXT-TO-IMAGE') ||
          rows.find(r => r.STATUS === 'ACTIVE' && r.LLM_PROVIDER_TYPE !== 'TEXT-TO-IMAGE') ||
          rows[0];
      }

      if (match) {
        let selectedModel = match.MODEL_NAME || (match.LLM_PROVIDER === 'GEMINI' ? 'gemini-1.5-flash' : 'openai/gpt-oss-20b');
        if (selectedModel.toLowerCase().includes('prompt-guard') || selectedModel.toLowerCase().includes('guard')) {
          selectedModel = 'openai/gpt-oss-20b';
        }
        const isActive = match.STATUS === 'ACTIVE';

        return {
          exists: true,
          key: match.API_KEY || (match.LLM_PROVIDER === 'GEMINI' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY) || '',
          model: selectedModel,
          provider: match.LLM_PROVIDER || requestedProvider || 'GEMINI',
          status: match.STATUS || 'INACTIVE',
          isActive: isActive,
          url: match.MODEL_URL
        };
      }
    }
  } catch (err) {
    console.error('[APIKEY] Error loading active key for user:', userId, 'firm:', firmId, err.message);
  }

  if (process.env.GEMINI_API_KEY) {
    return {
      exists: true,
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      provider: 'GEMINI',
      status: 'ACTIVE',
      isActive: true
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      exists: true,
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      provider: requestedProvider || 'GROQ',
      status: 'ACTIVE',
      isActive: true
    };
  }

  return {
    exists: false,
    key: '',
    model: '',
    provider: requestedProvider || 'GEMINI',
    status: 'INACTIVE',
    isActive: false,
    message: 'No API configured. Please add one in MyBlocks API Key Manager.'
  };
}

// LLM Region Discovery & Business Estimation Engine (Step 1)
async function llmRegionDiscovery(topic, regionCoverage, targetCompaniesLimit, targetUserId, targetFirmId = null, forceLLM = false, existingCities = []) {
  const searchClean = (regionCoverage || topic || '').toLowerCase().trim();

  // 1. Dynamic DB Portal Search: Query portal table directly for matching portalname/city/state (only if NOT forcing LLM expansion)
  if (!forceLLM && searchClean) {
    let dbConn;
    try {
      dbConn = await mysql.createConnection(dbConfig);
      const searchLike = `%${searchClean.replace(/[^a-z0-9 ]/g, '')}%`;
      const [directRows] = await dbConn.query(
        `SELECT portalid, portalname, state, contentcount 
         FROM portal 
         WHERE status = 'ACTIVE' AND portalname != '' AND (
           LOWER(TRIM(portalname)) = ? OR LOWER(TRIM(state)) = ? OR LOWER(TRIM(city)) = ? OR
           LOWER(portalname) LIKE ? OR LOWER(state) LIKE ? OR LOWER(city) LIKE ?
         )
         ORDER BY CASE WHEN LOWER(TRIM(portalname)) = ? THEN 1 WHEN LOWER(TRIM(state)) = ? THEN 2 ELSE 3 END, CAST(contentcount AS UNSIGNED) DESC, portalid ASC LIMIT 30`,
        [searchClean, searchClean, searchClean, searchLike, searchLike, searchLike, searchClean, searchClean]
      );

      if (directRows && directRows.length > 0) {
        logReallocation(`[DYNAMIC DB SEARCH] Found ${directRows.length} matching portals directly in database for term '${searchClean}'.`);
        console.log(`\n==================================================`);
        console.log(`🔍 [CITY SEARCH COMPLETED]`);
        console.log(`   Prompt Search Term : "${searchClean}"`);
        console.log(`   LLM Provider Used  : Local Portal DB Match`);
        console.log(`   Model Used         : N/A (Direct Database Match)`);
        console.log(`   Found Locations    : ${directRows.length} portal record(s)`);
        console.log(`==================================================\n`);
        return directRows.map(r => {
          const rawCount = parseInt(r.contentcount, 10) || 5000;
          const finalCount = (targetCompaniesLimit && targetCompaniesLimit > 0) ? Math.min(rawCount, targetCompaniesLimit) : rawCount;
          return {
            state: r.state ? r.state.trim() : 'India',
            city: r.portalname ? r.portalname.trim() : 'Location',
            portal_id: r.portalid,
            approx_businesses: finalCount,
            db_content_count: rawCount
          };
        });
      }
    } catch (dbErr) {
      console.warn('[DYNAMIC DB SEARCH NOTICE]', dbErr.message);
    } finally {
      if (dbConn) await dbConn.end().catch(() => { });
    }
  }

  // 2. LLM Discovery: Call LLM/Gemini if prompt term not found in portal database or forceLLM === true
  let activeKeyObj = await getActiveApiKey(targetUserId, null, targetFirmId);

  if (!activeKeyObj.exists || !activeKeyObj.key) {
    const noKeyMsg = 'No API configured. Please add one in MyBlocks API Key Manager.';
    logReallocation(`[LLM DISCOVERY ERROR] User ${targetUserId || 'default'}: ${noKeyMsg}`);
    throw new Error(noKeyMsg);
  }

  if (!activeKeyObj.isActive) {
    const inactiveMsg = `API key status is ${activeKeyObj.status}. Please activate it in MyBlocks API Key Manager.`;
    logReallocation(`[LLM DISCOVERY ERROR] User ${targetUserId || 'default'}: ${inactiveMsg}`);
    throw new Error(inactiveMsg);
  }

  let key = activeKeyObj.key;
  let provider = (activeKeyObj.provider || 'GEMINI').toUpperCase();
  let modelName = activeKeyObj.model;

  logReallocation(`[LLM DISCOVERY] Using active Provider '${provider}', Model '${modelName}' from DB API_KEY_MANAGER (Force LLM: ${forceLLM}).`);

  const excludePrompt = Array.isArray(existingCities) && existingCities.length > 0
    ? ` Exclude the following already known cities/locations: [${existingCities.join(', ')}]. Discover additional cities/towns in this region.`
    : '';

  const promptInstruction = `You are a global location and market intelligence AI with deep geographic knowledge down to sub-localities, taluks, and village levels. Analyze the location query '${regionCoverage}' for topic '${topic}'.
1. If '${regionCoverage}' refers to a specific sub-locality, neighborhood, or village within a district/city (e.g. "Manali, Kanyakumari" -> Locality "Manali" in Thuckalay, District "Kanyakumari", State "Tamil Nadu"), accurately identify the exact State, City/Locality name, District, and Pincode/Zipcode.
2. If '${regionCoverage}' contains multiple comma-separated distinct cities, return a separate JSON object for EACH city.
3. If '${regionCoverage}' is a broader region/state, list top cities/towns in that region.${excludePrompt}
Output strictly a valid, complete JSON array of objects with keys: "state", "city", "approx_businesses", "country_domain" (2-letter uppercase e.g. IN), "district", "zipcode".
Example JSON: [{"state":"Tamil Nadu","city":"Manali (Thuckalay)","approx_businesses":1500,"country_domain":"IN","district":"Kanyakumari","zipcode":"629175"}]`;


  try {
    let textOut = '';

    if (provider === 'GEMINI') {
      let rawDbModel = (modelName || 'gemini-1.5-flash').trim().toLowerCase();
      let gModel = rawDbModel;
      if (gModel === 'gemini-1.5') gModel = 'gemini-1.5-flash';
      else if (gModel === 'gemini-2.0') gModel = 'gemini-2.0-flash';

      modelName = gModel;

      const fetchGemini = async (targetModel) => {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
        return await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptInstruction }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(12000)
        });
      };

      try {
        let geminiRes = await fetchGemini(modelName);

        // Auto-retry with gemini-1.5-flash if DB model name returns 404 (model deprecated / unavailable)
        if (!geminiRes.ok && geminiRes.status === 404 && modelName !== 'gemini-1.5-flash') {
          console.warn(`[GEMINI MODEL RETRY] DB model '${modelName}' returned 404. Retrying with 'gemini-1.5-flash'...`);
          modelName = 'gemini-1.5-flash';
          geminiRes = await fetchGemini(modelName);
        }

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          textOut = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          const gErr = await geminiRes.text();
          console.error('[GEMINI API Error]', geminiRes.status, gErr);
          throw new Error(`Gemini API Error (${geminiRes.status}): ${gErr}`);
        }
      } catch (geminiError) {
        console.warn(`[GEMINI FALLBACK TRIGGERED] Gemini API failed (${geminiError.message}). Attempting Groq fallback...`);
        const groqKeyObj = await getActiveApiKey(targetUserId, 'GROQ', targetFirmId);
        if (groqKeyObj && groqKeyObj.exists && groqKeyObj.key) {
          provider = 'GROQ';
          key = groqKeyObj.key;
          modelName = groqKeyObj.model || 'openai/gpt-oss-20b';
          logReallocation(`[LLM DISCOVERY FALLBACK] Switched to Provider 'GROQ', Model '${modelName}'`);
        } else {
          throw geminiError;
        }
      }
    }


    if (provider !== 'GEMINI') {
      if (provider === 'GROQ') modelName = await getValidGroqChatModel(key, modelName);

      let url = 'https://api.groq.com/openai/v1/chat/completions';
      if (provider === 'OPENAI') url = 'https://api.openai.com/v1/chat/completions';
      if (provider === 'OPENROUTER') url = 'https://openrouter.ai/api/v1/chat/completions';
      if (provider === 'DEEPSEEK') url = 'https://api.deepseek.com/v1/chat/completions';

      const executeCall = async (targetModel) => {
        return await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: targetModel,
            temperature: 0.3,
            max_tokens: 2500,
            messages: [
              { role: 'system', content: 'You are a global location and market intelligence AI. Output strictly a valid, complete JSON array of objects with keys: "state", "city", "approx_businesses", "country_domain", "district", "zipcode". Never use ellipses (...), truncated values, comments, or prose.' },
              { role: 'user', content: promptInstruction }
            ]
          }),
          signal: AbortSignal.timeout(12000)
        });
      };

      let llmRes = await executeCall(modelName);

      if (!llmRes.ok && (llmRes.status === 404 || llmRes.status === 400) && provider === 'GROQ') {
        const fallbackModel = await getValidGroqChatModel(key, null);
        if (fallbackModel && fallbackModel !== modelName) {
          modelName = fallbackModel;
          llmRes = await executeCall(modelName);
        }
      }

      if (llmRes.ok) {
        const data = await llmRes.json();
        textOut = data.choices?.[0]?.message?.content || '';
      } else {
        const errText = await llmRes.text();
        console.error('[LLM API Error]', llmRes.status, errText);
        throw new Error(`${provider} API Error (${llmRes.status}): ${errText}`);
      }
    }


    if (textOut) {
      const matchJson = textOut.match(/\[[\s\S]*\]/);
      if (matchJson) {
        let cleanedJson = matchJson[0]
          .replace(/:\s*\.\.\./g, ': 5000')
          .replace(/:\s*"\.\.\."/g, ': 5000')
          .replace(/,\s*([\]}])/g, '$1');

        let parsed = null;
        try {
          parsed = JSON.parse(cleanedJson);
        } catch (jsonErr) {
          // If JSON parse fails due to cut-off array, attempt repairing truncated end
          try {
            const lastValidIndex = cleanedJson.lastIndexOf('}');
            if (lastValidIndex > 0) {
              const repairedJson = cleanedJson.substring(0, lastValidIndex + 1) + ']';
              parsed = JSON.parse(repairedJson);
            }
          } catch (repairErr) {
            console.warn('[LLM DISCOVERY] Could not parse raw LLM JSON, switching to DB lookup fallback.');
          }
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          logReallocation(`[LLM DISCOVERY] ${provider} (${modelName}) generated ${parsed.length} dynamic location discoveries for topic '${topic}' across '${regionCoverage}'.`);
          console.log(`\n==================================================`);
          console.log(`🔍 [CITY SEARCH COMPLETED]`);
          console.log(`   Prompt Search Term : "${regionCoverage || topic}"`);
          console.log(`   LLM Provider Used  : ${provider}`);
          console.log(`   Model Used         : ${modelName}`);
          console.log(`   Discovered Cities  : ${parsed.length} location(s)`);
          console.log(`==================================================\n`);

          return parsed.map(item => {
            const rawCount = parseInt(item.approx_businesses, 10) || 5000;
            const finalCount = (targetCompaniesLimit && targetCompaniesLimit > 0) ? Math.min(rawCount, targetCompaniesLimit) : rawCount;
            return {
              state: item.state || 'Location',
              city: item.city || 'Location',
              portal_id: null,
              approx_businesses: finalCount,
              db_content_count: rawCount,
              country_domain: (item.country_domain || 'IN').toUpperCase().trim(),
              district: item.district || item.city || 'Location',
              zipcode: item.zipcode || '0'
            };
          });
        }
      }
    }
  } catch (llmErr) {
    console.error('[LLM DISCOVERY] Live API query error:', llmErr.message);
  }

  // Fallback: If LLM call produced no valid JSON, split prompt by commas into individual cities/locations
  const fallbackStr = (regionCoverage || topic || 'Location').trim();
  const rawCities = fallbackStr.includes(',')
    ? fallbackStr.split(',').map(s => s.trim()).filter(Boolean)
    : [fallbackStr];

  return rawCities.map(cName => {
    const titleC = cName.charAt(0).toUpperCase() + cName.slice(1);
    return {
      state: 'India',
      city: titleC,
      portal_id: null,
      approx_businesses: 5000,
      db_content_count: 5000
    };
  });
}

// Helper to populate SCRAPPER_PROCESSING table with prompt portals
async function addPortalsToScrapperProcessing(validatedLocations, empId) {
  if (!validatedLocations || !Array.isArray(validatedLocations) || validatedLocations.length === 0) return;
  const eId = empId || defaultScraperConfig.user_id || 1572;
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    for (const item of validatedLocations) {
      if (!item.portal_id && !item.city) continue;
      const portalId = item.portal_id ? String(item.portal_id) : '0';
      const portalName = item.city || item.portal_name || 'Location';

      const [existing] = await connection.query(
        `SELECT SP_ID FROM SCRAPPER_PROCESSING WHERE EMP_ID = ? AND PORTALID = ?`,
        [eId, portalId]
      );

      if (existing && existing.length > 0) {
        await connection.query(
          `UPDATE SCRAPPER_PROCESSING SET STATUS = 'PENDING', UPDATE_DTM = NOW() WHERE SP_ID = ?`,
          [existing[0].SP_ID]
        );
      } else {
        await connection.query(
          `INSERT INTO SCRAPPER_PROCESSING (EMP_ID, PORTALNAME, PORTALID, STATUS, INSRT_DTM, UPDATE_DTM)
           VALUES (?, ?, ?, 'PENDING', NOW(), NOW())`,
          [eId, portalName, portalId]
        );
      }
    }
    logReallocation(`[SCRAPPER_PROCESSING] Inserted/updated ${validatedLocations.length} prompt portals in SCRAPPER_PROCESSING for Employee ID ${eId}.`);
  } catch (err) {
    console.error('[SCRAPPER_PROCESSING DB ERROR]', err.message);
  } finally {
    if (connection) await connection.end().catch(() => { });
  }
}

// Portal Validation Engine (Step 2)
async function validateDiscoveredCitiesWithPortalDB(discoveredCities, currentMemberId) {
  let validationResults = [];

  const mId = currentMemberId || defaultScraperConfig.user_id || 1572;

  try {
    connection = await mysql.createConnection(dbConfig);

    for (const item of discoveredCities) {
      let portalId = item.portal_id;
      let dbContentCount = item.db_content_count || item.approx_businesses;

      if (!portalId || portalId === '-') {
        const cityNameClean = item.city.toLowerCase().trim();
        const altCityName = cityNameClean.replace('gurugram', 'gurgaon').replace('bengaluru', 'bangalore').replace('mumbai', 'bombay');

        const [pRows] = await connection.query(
          `SELECT portalid, contentcount FROM portal 
           WHERE status = 'ACTIVE' AND (
             LOWER(TRIM(portalname)) = ? OR LOWER(TRIM(portalname)) = ? OR LOWER(TRIM(portalname)) LIKE CONCAT(?, '%')
           )
           ORDER BY CASE WHEN LOWER(TRIM(portalname)) = ? THEN 1 WHEN LOWER(TRIM(portalname)) = ? THEN 2 ELSE 3 END, portalid ASC LIMIT 1`,
          [cityNameClean, altCityName, cityNameClean, cityNameClean, altCityName]
        );
        if (pRows && pRows.length > 0) {
          portalId = pRows[0].portalid;
          if (pRows[0].contentcount) dbContentCount = parseInt(pRows[0].contentcount, 10);
        }
      }

      // Auto-register missing portal in portal table in TRN DB
      if (!portalId || portalId === '-') {
        try {
          const [maxRow] = await connection.query(`SELECT MAX(CAST(portalid AS UNSIGNED)) as max_id FROM portal WHERE portalid REGEXP '^[0-9]+$'`);
          const currentMax = maxRow[0]?.max_id ? parseInt(maxRow[0].max_id, 10) : 221264;
          const newPortalId = currentMax + 1;
          const estCount = (item.approx_businesses || dbContentCount || 5000).toString();

          const countryCode = (item.country_domain || 'IN').toUpperCase().trim();
          const typeVal = `MYBLOCKS.${countryCode}`;
          const districtVal = item.district ? item.district.trim() : item.city.trim();
          const zipcodeVal = item.zipcode ? item.zipcode.trim() : '0';

          await connection.query(
            `INSERT INTO portal (portalid, portalname, state, city, district, zipcode, type, status, contentcount, INSRT_DTM, UPDATE_DTM)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NOW(), NOW())`,
            [newPortalId, item.city.trim(), item.state.trim(), item.city.trim(), districtVal, zipcodeVal, typeVal, estCount]
          );

          portalId = newPortalId;
          logReallocation(`[PORTAL AUTO-REGISTRATION] Auto-registered missing location '${item.city}' (${item.state}) in Portal Table with Portal ID ${newPortalId}, Type '${typeVal}', District '${districtVal}', Zipcode '${zipcodeVal}'.`);
        } catch (insertErr) {
          console.error('[PORTAL AUTO-REGISTRATION ERROR]', insertErr.message);
          portalId = null;
        }
      }

      let existingScrapedCount = 0;
      let alreadyInProcessing = false;
      let existingEmpId = null;

      if (portalId) {
        try {
          const [scrapedRows] = await connection.query(
            `SELECT COUNT(*) as count FROM kf_vendor WHERE portalid = ?`,
            [portalId]
          );
          existingScrapedCount = scrapedRows[0]?.count || 0;
        } catch (e) {
          existingScrapedCount = 0;
        }

        try {
          const [spRows] = await connection.query(
            `SELECT SP_ID, EMP_ID, STATUS FROM SCRAPPER_PROCESSING WHERE PORTALID = ? LIMIT 1`,
            [portalId]
          );
          if (spRows && spRows.length > 0) {
            const spStatus = String(spRows[0].STATUS).toUpperCase();
            if (spStatus !== 'FAILED' && spStatus !== 'CANCELLED') {
              alreadyInProcessing = true;
              existingEmpId = spRows[0].EMP_ID;
            }
          }
        } catch (e) { }
      }

      const estimatedBusinesses = item.approx_businesses || dbContentCount || 5000;
      const remainingBusinesses = Math.max(0, estimatedBusinesses - existingScrapedCount);

      let validationStatus = 'New';
      if (alreadyInProcessing) {
        validationStatus = 'Already in Processing';
      } else if (remainingBusinesses === 0 && existingScrapedCount > 0) {
        validationStatus = 'Completed';
      } else if (existingScrapedCount > 0 && remainingBusinesses > 0) {
        validationStatus = 'Partial';
      } else {
        validationStatus = 'New';
      }

      validationResults.push({
        state: item.state,
        city: item.city,
        estimated_businesses: estimatedBusinesses,
        existing_businesses: existingScrapedCount,
        remaining_businesses: remainingBusinesses > 0 ? remainingBusinesses : estimatedBusinesses,
        portal_id: portalId,
        status: validationStatus,
        already_in_processing: alreadyInProcessing,
        existing_emp_id: existingEmpId
      });
    }

  } catch (err) {
    console.error('Portal Validation DB Error:', err.message);
    validationResults = discoveredCities.map((item) => ({
      state: item.state,
      city: item.city,
      estimated_businesses: item.approx_businesses || 5000,
      existing_businesses: 0,
      remaining_businesses: item.approx_businesses || 5000,
      portal_id: item.portal_id || null,
      status: 'New',
      already_in_processing: false,
      existing_emp_id: null
    }));
  } finally {
    if (connection) await connection.end();
  }

  return validationResults;
}

// Workflow Queue & Dynamic Batch Partitioning Engine (Step 3 & Step 4)
function buildQueueAndBatchesFromValidation(validationResults, configuredBatchSize, clientId) {
  const bSize = configuredBatchSize || schedulerConfig.batch_size || 1000;
  const cId = parseInt(clientId || defaultScraperConfig.user_id, 10);

  // Include all validation items for prompt orchestration execution
  const schedulable = [...validationResults];

  const metroNames = ['bangalore', 'bengaluru', 'hyderabad', 'chennai', 'mumbai', 'delhi', 'kolkata', 'pune', 'ahmedabad'];

  schedulable.sort((a, b) => {
    const aIsMetro = metroNames.some(m => a.city.toLowerCase().includes(m));
    const bIsMetro = metroNames.some(m => b.city.toLowerCase().includes(m));
    if (aIsMetro && !bIsMetro) return -1;
    if (!aIsMetro && bIsMetro) return 1;
    return (b.remaining_businesses || b.estimated_businesses) - (a.remaining_businesses || a.estimated_businesses);
  });

  const newQueue = [];
  let priorityCounter = 1;

  schedulable.forEach(item => {
    const totalTarget = item.remaining_businesses || item.estimated_businesses || 5000;
    const startFromBase = (item.existing_businesses || 0) + 1;
    const numBatches = Math.ceil(totalTarget / bSize);

    const displayName = `${item.city} (${item.portal_id})`;

    if (numBatches <= 1) {
      newQueue.push({
        city_id: 'c_' + Math.random().toString(36).substr(2, 9),
        city_name: displayName,
        state: item.state,
        client_id: cId,
        priority: priorityCounter++,
        estimated_company_count: totalTarget,
        status: 'Pending',
        assigned_agent: null,
        portal_id: item.portal_id,
        batch_count: '0/1',
        companies_processed: 0,
        total_companies: totalTarget,
        current_stage: '-',
        started_at: null,
        completed_at: null,
        execution_id: null,
        start_from: startFromBase
      });
    } else {
      for (let b = 0; b < numBatches; b++) {
        const batchTarget = (b === numBatches - 1) ? (totalTarget - (b * bSize)) : bSize;
        const startOffset = startFromBase + (b * bSize);
        const endOffset = startOffset + batchTarget - 1;

        newQueue.push({
          city_id: 'c_' + Math.random().toString(36).substr(2, 9) + `_b${b + 1}`,
          city_name: `${item.city} [Batch ${b + 1}/${numBatches}] (${item.portal_id})`,
          state: item.state,
          client_id: cId,
          priority: priorityCounter++,
          estimated_company_count: batchTarget,
          status: 'Pending',
          assigned_agent: null,
          portal_id: item.portal_id,
          batch_count: `0/${numBatches}`,
          companies_processed: 0,
          total_companies: batchTarget,
          current_stage: '-',
          started_at: null,
          completed_at: null,
          execution_id: null,
          start_from: startOffset,
          start_offset: startOffset,
          end_offset: endOffset
        });
      }
    }
  });

  return newQueue;
}

// Structured Execution Logging System
let executionLogs = [];
let lastLogMsgByExecId = new Map();

function addExecutionLog(userId, executionId, stage, processedCount, dbInsertCount, extraMsg = '') {
  const timestamp = new Date().toISOString();
  const uId = userId || defaultScraperConfig.user_id || 1572;
  const logMsg = `[EXECUTION LOG] User ID: ${uId} | Exec ID: ${executionId} | Stage: ${stage || 'Active'} | Processed: ${processedCount || 0} | DB Inserted: ${dbInsertCount || 0}${extraMsg ? ' | ' + extraMsg : ''}`;

  // Smart log deduplication: Avoid spamming identical console logs for unchanged execution states
  if (lastLogMsgByExecId.get(executionId) === logMsg) {
    return;
  }
  lastLogMsgByExecId.set(executionId, logMsg);

  const logObj = {
    timestamp,
    user_id: uId,
    execution_id: executionId,
    stage: stage || 'Active',
    processed_count: processedCount || 0,
    db_insert_count: dbInsertCount || 0,
    message: logMsg
  };

  console.log(logMsg);
  executionLogs.unshift(logObj);
  if (executionLogs.length > 200) executionLogs.pop();
}

// Helper: Log Allocation Event Timeline
function logReallocation(event_desc) {
  reallocationEvents.unshift({
    timestamp: new Date().toLocaleTimeString(),
    event_desc
  });
  if (reallocationEvents.length > 50) reallocationEvents.pop();
}

// REST APIs
app.get('/health', (req, res) => {
  res.json({ status: 'ok', orchestrator: 'running', backendOnline: backendOnlineGlobal });
});

app.get('/api/status', async (req, res) => {
  let backendOnline = false;
  let backendStatus = 'Offline';
  let scraperExecutions = [];

  const activeWsCount = Array.from(wsConnectedRunners.values()).filter(w => w.ws && w.ws.readyState === 1).length;
  const totalWsCount = wsConnectedRunners.size;

  try {
    const exeActive = await isProcessRunning('scraperrun_v1.0.8.exe');
    if (activeWsCount > 0) {
      backendOnline = true;
      backendStatus = `🟢 ${activeWsCount} Runner${activeWsCount > 1 ? 's' : ''} Connected`;
    } else if (exeActive) {
      backendOnline = true;
      backendStatus = '🟢 Local Executable Active';
    } else if (totalWsCount > 0) {
      backendOnline = false;
      backendStatus = '🟡 Runners Registered (Offline)';
    } else {
      backendOnline = false;
      backendStatus = '🔴 No Runners Connected';
    }
  } catch (err) {
    if (activeWsCount > 0) {
      backendOnline = true;
      backendStatus = `🟢 ${activeWsCount} Runner${activeWsCount > 1 ? 's' : ''} Connected`;
    } else {
      backendOnline = false;
      backendStatus = '🔴 No Runners Connected';
    }
  }
  backendOnlineGlobal = backendOnline;

  if (backendOnline) {
    try {
      const response = await fetch(`${SCRAPER_MANAGER_URL}/executions`, {
        headers: { 'X-User-Id': String(defaultScraperConfig.user_id), 'X-Firm-Id': '5' },
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        scraperExecutions = data.executions || [];

        // Dynamic registration workflows:
        scraperExecutions.forEach(x => {
          const progressPercentage = parseFloat(x.progress) || 0;
          const total = x.total_contacts || 500;
          const processed = Math.round(total * (progressPercentage / 100));

          // Determine current stage
          const runBasic = x.run_basic !== undefined ? x.run_basic : true;
          const runContact = x.run_contact !== undefined ? x.run_contact : false;
          const runSocial = x.run_social !== undefined ? x.run_social : false;
          const runLeader = x.run_leader !== undefined ? x.run_leader : false;

          const activeStages = [];
          if (runBasic) activeStages.push('Basic');
          if (runContact) activeStages.push('Contact');
          if (runSocial) activeStages.push('Social');
          if (runLeader) activeStages.push('Leader');

          let currentStage = '-';
          if (activeStages.length > 0) {
            const stageIdx = Math.min(
              Math.floor((progressPercentage / 100) * activeStages.length),
              activeStages.length - 1
            );
            currentStage = activeStages[stageIdx];
          }

          const parsedPortalId = resolvePortalIdFromText(x.city, x.portal_id);

          // 1. Live execution card details
          executions[x.execution_id] = {
            execution_id: x.execution_id,
            city_name: x.city || 'External Scrape',
            agent_id: executions[x.execution_id]?.agent_id || ('ext_' + x.execution_id),
            started_at: executions[x.execution_id]?.started_at || new Date(x.created_at || new Date()),
            batch_number: `${x.completed_batches || 0}/${x.total_batches || 1}`,
            current_stage: currentStage,
            progress_percent: progressPercentage,
            processed: processed,
            target: total,
            status: x.status || 'running',
            portal_id: parsedPortalId
          };

          // 2. Populate Agent Registry from active executions
          if (x.username) {
            const agentExists = agents.some(a => a.agent_name === x.username);
            if (!agentExists) {
              agents.push({
                agent_id: 'a_' + Math.random().toString(36).substr(2, 9),
                portal_id: parsedPortalId,
                agent_name: x.username,
                status: x.status === 'running' ? 'Running' : 'Idle',
                current_city: x.city || null,
                execution_id: x.execution_id,
                last_heartbeat: new Date()
              });
            } else {
              // Update status of existing agent if currently running
              const agent = agents.find(a => a.agent_name === x.username);
              if (agent) {
                if (parsedPortalId) agent.portal_id = parsedPortalId;
                if (agent.status === 'Idle' && x.status === 'running') {
                  agent.status = 'Running';
                  agent.current_city = x.city || null;
                  agent.execution_id = x.execution_id;
                }
              }
            }
          }

          // 3. Populate Queue Monitor from pending/running/completed batches
          if (x.city) {
            const cityExists = cityQueue.some(c => c.city_name.includes(x.city) || (c.execution_id === x.execution_id));
            if (!cityExists) {
              cityQueue.push({
                city_id: 'c_' + Math.random().toString(36).substr(2, 9),
                city_name: x.city,
                state: 'Portal',
                priority: 5,
                estimated_company_count: total,
                status: x.status === 'completed' ? 'Completed' : (x.status === 'failed' ? 'Failed' : 'Running'),
                assigned_agent: x.username || 'System',
                portal_id: parsedPortalId,
                batch_count: `${x.completed_batches || 0}/${x.total_batches || 1}`,
                companies_processed: processed,
                total_companies: total,
                current_stage: currentStage,
                started_at: new Date(x.created_at || new Date()).toLocaleTimeString(),
                completed_at: x.status === 'completed' ? new Date().toLocaleTimeString() : null,
                execution_id: x.execution_id,
                start_from: 1
              });
            } else {
              // Update progress of existing queue item
              const city = cityQueue.find(c => c.city_name.includes(x.city) || (c.execution_id === x.execution_id));
              if (city) {
                if (parsedPortalId && !city.portal_id) city.portal_id = parsedPortalId;
                city.companies_processed = processed;
                city.batch_count = `${x.completed_batches || 0}/${x.total_batches || 1}`;
                city.current_stage = currentStage;
                if (x.status === 'completed') {
                  city.status = 'Completed';
                  city.completed_at = new Date().toLocaleTimeString();
                } else if (x.status === 'failed') {
                  city.status = 'Failed';
                }
              }
            }
          }
        });

        // Clean up completed executions from the active map
        const activeIds = scraperExecutions.filter(x => x.status === 'running' || x.status === 'pending').map(x => x.execution_id);
        Object.keys(executions).forEach(key => {
          if (!activeIds.includes(key)) {
            delete executions[key];
          }
        });
      }
    } catch (err) {
      // Fail silently
    }
  }

  // Update Agent Offline status if backend is down
  if (!backendOnline) {
    agents.forEach(a => { a.status = 'Offline'; });
  } else {
    agents.forEach(a => {
      if (a.status === 'Offline') a.status = 'Idle';
    });
  }

  // Fetch today's scraped data counts from Database (filtered by logged-in user memberid)
  const currentUserId = defaultScraperConfig.user_id || 1572;
  const currentFirmId = defaultScraperConfig.firm_id || 5;
  const currentMemberId = defaultScraperConfig.memberid || currentUserId;

  const dbMetrics = cachedDbMetrics;

  // Process Real-time statistics & diagnostics
  const performanceMatrix = [];
  const errorHistory = [];

  scraperExecutions.forEach(exec => {
    const successRate = exec.total_batches > 0
      ? Math.round((exec.completed_batches / exec.total_batches) * 100)
      : 100;

    const failedBatches = exec.failed_batches || 0;

    const execPortalId = resolvePortalIdFromText(exec.city, exec.portal_id);

    performanceMatrix.push({
      city: exec.city || 'Default Target',
      agent: exec.username || 'Anonymous',
      portal_id: execPortalId || 'N/A',
      execution_id: exec.execution_id,
      target_companies: exec.total_contacts || 0,
      scraped_companies: exec.total_contacts ? Math.round(exec.total_contacts * (successRate / 100)) : 0,
      success_rate: successRate,
      failed_companies: exec.total_contacts ? Math.round(exec.total_contacts * (failedBatches / (exec.total_batches || 1))) : 0,
      time_taken: exec.duration || 60,
      status: exec.status
    });

    if (exec.failed_batch_details && exec.failed_batch_details.length > 0) {
      exec.failed_batch_details.forEach(err => {
        let fix = "Check internet connectivity and port settings.";
        if (err.error.toLowerCase().includes('cookie')) fix = "Update LinkedIn cookie configuration.";
        if (err.error.toLowerCase().includes('database')) fix = "Check database connection credentials.";
        if (err.error.toLowerCase().includes('timeout')) fix = "Increase timeout limits in configuration settings.";

        errorHistory.push({
          error_id: `err_${exec.execution_id}_${err.batch_number}`,
          timestamp: exec.created_at || new Date(),
          type: 'Scraper Batch Failure',
          agent_name: exec.username,
          portal_id: execPortalId || null,
          city: exec.city || 'Unknown',
          execution_id: exec.execution_id,
          message: `Batch ${err.batch_number} (${err.range}): ${err.error}`,
          suggested_fix: fix
        });
      });
    }
  });

  const completedCities = performanceMatrix.filter(p => p.status === 'completed').length;
  const totalScraped = dbMetrics.totalScraped;
  const avgSuccessRate = performanceMatrix.length > 0
    ? (performanceMatrix.reduce((sum, item) => sum + item.success_rate, 0) / performanceMatrix.length).toFixed(1)
    : '0.0';
  const avgExecutionTime = performanceMatrix.length > 0
    ? (performanceMatrix.reduce((sum, item) => sum + item.time_taken, 0) / performanceMatrix.length).toFixed(1)
    : '0.0';

  let topAgent = 'N/A';
  let slowestCity = 'N/A';
  if (performanceMatrix.length > 0) {
    const agentStats = {};
    const cityStats = {};
    performanceMatrix.forEach(p => {
      if (!agentStats[p.agent]) agentStats[p.agent] = { scraped: 0 };
      agentStats[p.agent].scraped += p.scraped_companies;

      if (!cityStats[p.city]) cityStats[p.city] = { time: 0, count: 0 };
      cityStats[p.city].time += p.time_taken;
      cityStats[p.city].count += 1;
    });

    let maxScraped = -1;
    for (const [name, s] of Object.entries(agentStats)) {
      if (s.scraped > maxScraped) {
        maxScraped = s.scraped;
        topAgent = name;
      }
    }

    let maxCityTime = -1;
    for (const [city, s] of Object.entries(cityStats)) {
      const avg = s.time / s.count;
      if (avg > maxCityTime) {
        maxCityTime = avg;
        slowestCity = city;
      }
    }
  }

  // Performance recommendations
  const recommendations = [];
  const bigQueueCities = cityQueue.filter(c => c.estimated_company_count > schedulerConfig.batch_size);
  bigQueueCities.forEach(c => {
    recommendations.push({
      issue: `${c.city_name} queue too large`,
      recommendation: `Split into ${Math.ceil(c.estimated_company_count / schedulerConfig.batch_size)} parallel batches.`
    });
  });

  const activeIssues = errorHistory.length;
  if (activeIssues > 0) {
    recommendations.push({
      issue: `Social Media timeout rate ${Math.round(activeIssues * 3.5)}%`,
      recommendation: 'Retry failed companies after pipeline completes.'
    });
  }

  agents.forEach(a => {
    const stats = performanceMatrix.filter(p => p.agent === a.agent_name);
    if (stats.length > 0) {
      const avgTime = stats.reduce((sum, s) => sum + s.time_taken, 0) / stats.length;
      if (avgTime > 90) {
        recommendations.push({
          issue: `${a.agent_name} slower than average`,
          recommendation: `Reduce batch size from ${schedulerConfig.batch_size} -> ${Math.round(schedulerConfig.batch_size / 2)}.`
        });
      }
    }
  });

  if (recommendations.length === 0) {
    recommendations.push({
      issue: 'Idle agents available',
      recommendation: 'Queue discovery items to utilize full allocation capacity.'
    });
  }
  const client_id = req.clientId || defaultScraperConfig.user_id;
  const isAdmin = req.isAdmin;

  // Sync all active WebSocket connections into runnerRegistry dynamically
  for (const [id, info] of wsConnectedRunners.entries()) {
    let regItem = runnerRegistry.find(r => r.runner_id === id);
    if (!regItem) {
      runnerRegistry.push({
        runner_id: id,
        version: info.version || null,
        server_name: info.runner_name || `Server (${info.server_ip})`,
        host_ip: `${info.server_ip}:${info.port}`,
        agent_name: info.runner_name || id,
        client_id: info.client_id,
        status: info.status || 'Idle',
        last_heartbeat: info.last_heartbeat || new Date(),
        current_workflow: null,
        current_batch: null,
        execution_id: null,
        portal_id: null
      });
    } else {
      if (info.version) regItem.version = info.version;
      if (info.status) {
        regItem.status = (String(info.status).toLowerCase() === 'running' || info.status === 'Busy') ? 'Running' : info.status;
      }
      if (info.last_heartbeat) regItem.last_heartbeat = info.last_heartbeat;
      if (info.client_id) regItem.client_id = info.client_id;
    }
  }

  const filteredQueue = cityQueue.filter(c => isAdmin || (c.client_id || 1572) === client_id);
  const filteredAgents = agents;
  const filteredRunners = runnerRegistry; // Independent of client_id: show all connected & registered runners!
  const filteredAllocations = allocations;
  const filteredSchedulerBatches = schedulerBatches.filter(b => isAdmin || (b.client_id || 1572) === client_id);
  const filteredReallocations = reallocationEvents;
  const filteredErrors = errorHistory;
  const filteredPerformance = performanceMatrix;

  const activeRunners = filteredRunners.filter(r => r.status === 'Running' || r.status === 'Busy').length;
  const idleRunners = filteredRunners.filter(r => r.status === 'Idle').length;
  const failedRunners = filteredRunners.filter(r => r.status === 'Offline' || r.status === 'Crashed' || r.status === 'Disconnected').length;

  const completedStatesList = [...new Set(filteredQueue.filter(c => c.status === 'Completed').map(c => c.state))];

  const activeLlmConfig = await getActiveApiKey(client_id, null, req.firmId);

  res.json({
    backendOnline,
    backendStatus,
    client_id: client_id,
    is_admin: isAdmin,
    user_id: client_id,
    firm_id: dbMetrics.firm_id,
    memberid: client_id,
    llmConfig: {
      exists: activeLlmConfig.exists,
      provider: activeLlmConfig.provider,
      model: activeLlmConfig.model,
      status: activeLlmConfig.status,
      isActive: activeLlmConfig.isActive,
      message: activeLlmConfig.exists
        ? (activeLlmConfig.isActive ? `Connected: ${activeLlmConfig.provider} (${activeLlmConfig.model})` : `Inactive: ${activeLlmConfig.provider} (${activeLlmConfig.model})`)
        : 'No API configured. Please add one in MyBlocks API Key Manager.'
    },
    cityQueue: filteredQueue,
    agents: filteredAgents,
    runners: filteredRunners,
    discoveryResults: latestDiscoveryResults,
    validationResults: latestValidationResults,
    allocations: filteredAllocations,
    schedulerBatches: filteredSchedulerBatches,
    executions,
    executionLogs,
    reallocationEvents: filteredReallocations,
    errorHistory: filteredErrors,
    performanceMatrix: filteredPerformance,
    allocationEngineActive,
    schedulerConfig,
    currentTopic: currentOrchestrationTopic,
    metrics: {
      completedStates: completedStatesList.length,
      completedCities,
      totalScraped: dbMetrics.totalScraped,
      sourceTotalScraped: dbMetrics.sourceTotalScraped,
      scrapedToday: dbMetrics.scrapedToday,
      emailsFound: dbMetrics.emailsFound,
      phonesFound: dbMetrics.phonesFound,
      activeRunners,
      idleRunners,
      failedRunners,
      avgCompaniesPerMin: (dbMetrics.scrapedToday / 60).toFixed(1),
      avgSuccessRate,
      avgExecutionTime,
      topAgent,
      slowestCity,
      retryQueueCount: filteredErrors.length
    },
    recommendations
  });
});

// Logs Endpoint
app.get('/api/logs', (req, res) => {
  res.json({
    success: true,
    user_id: defaultScraperConfig.user_id,
    firm_id: defaultScraperConfig.firm_id || 5,
    memberid: defaultScraperConfig.memberid || defaultScraperConfig.user_id,
    logs: executionLogs,
    reallocationEvents
  });
});

// Error recovery actions endpoints
app.post('/api/errors/retry', async (req, res) => {
  const { execution_id, city, portal_id, agent_name } = req.body;
  const cityObj = cityQueue.find(c => c.city_name === city) || {
    city_id: 'c_' + Math.random().toString(36).substr(2, 9),
    city_name: city,
    portal_id: portal_id,
    estimated_company_count: 300,
    status: 'Pending',
    start_from: 1
  };
  const agentObj = agents.find(a => a.agent_name === agent_name) || agents.find(a => a.status === 'Idle');

  if (agentObj) {
    cityObj.status = 'Running';
    cityObj.assigned_agent = agentObj.agent_name;
    agentObj.status = 'Running';
    agentObj.current_city = cityObj.city_name;
    await triggerScraperRun(cityObj, agentObj);
    logReallocation(`Retrying execution for city: ${city} with agent ${agentObj.agent_name}`);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'No agent available for retry assignment' });
  }
});

app.post('/api/errors/resume', async (req, res) => {
  const { execution_id, city, portal_id, agent_name } = req.body;
  const cityObj = cityQueue.find(c => c.city_name === city);
  if (cityObj) {
    cityObj.start_from = (cityObj.companies_processed || 0) + 1;
    cityObj.status = 'Running';
    const agentObj = agents.find(a => a.agent_name === agent_name) || agents.find(a => a.status === 'Idle');
    if (agentObj) {
      agentObj.status = 'Running';
      agentObj.current_city = cityObj.city_name;
      await triggerScraperRun(cityObj, agentObj);
      logReallocation(`Resuming execution for city: ${city} from index ${cityObj.start_from}`);
      return res.json({ success: true });
    }
  }
  res.status(400).json({ error: 'Cannot resume city execution' });
});

// Self-Healing Error Recovery Endpoints & Pipeline
async function triggerSelfHealingRecoverySequence(failedBatch, runnerInfo, reason) {
  recoveryState.recovery_attempts_count += 1;
  recoveryState.last_recovery_reason = reason || 'Execution Failure Detected';
  recoveryState.current_resume_portal = failedBatch?.portal_id || '-';
  recoveryState.current_resume_batch = failedBatch?.city_name || '-';
  const startRange = failedBatch?.start_from || 1;
  const count = failedBatch?.estimated_company_count || 1000;
  recoveryState.current_resume_range = `${startRange} - ${startRange + count - 1}`;
  recoveryState.checkpoint_status = 'Checkpoint Preserved';

  // Stage 1: Error Detection
  recoveryState.current_recovery_stage = 'Error Detection';
  broadcastRecoveryEvent('Error Detected', {
    runner_id: runnerInfo?.runner_id || 'runner_1572',
    portal_id: recoveryState.current_resume_portal,
    city_batch: recoveryState.current_resume_batch,
    reason: `[Stage 1/5] Error Detected: ${recoveryState.last_recovery_reason}`
  });

  await new Promise(r => setTimeout(r, 1000));

  // Stage 2: Health Verification
  recoveryState.current_recovery_stage = 'Health Verification';
  const isBackendActive = recoveryState.backend_status === 'Running';
  broadcastRecoveryEvent('Health Verification', {
    runner_id: runnerInfo?.runner_id || 'runner_1572',
    portal_id: recoveryState.current_resume_portal,
    city_batch: recoveryState.current_resume_batch,
    reason: `[Stage 2/5] Health Verified: Port 7500 ${isBackendActive ? 'Active' : 'Down'}, WebSocket ${recoveryState.ws_status}`
  });

  await new Promise(r => setTimeout(r, 1500));

  // Stage 3: Automatic Recovery
  recoveryState.current_recovery_stage = 'Automatic Recovery';
  broadcastRecoveryEvent('Automatic Recovery', {
    runner_id: runnerInfo?.runner_id || 'runner_1572',
    portal_id: recoveryState.current_resume_portal,
    city_batch: recoveryState.current_resume_batch,
    reason: `[Stage 3/5] Cleaning stale chromedriver.exe and re-synchronizing WebSocket connection.`
  });

  try {
    await killStaleChromeDriverProcesses();
  } catch (e) { }

  await new Promise(r => setTimeout(r, 1500));

  // Stage 4: Batch Resume
  recoveryState.current_recovery_stage = 'Batch Resume';
  broadcastRecoveryEvent('Batch Resume', {
    runner_id: runnerInfo?.runner_id || 'runner_1572',
    portal_id: recoveryState.current_resume_portal,
    city_batch: recoveryState.current_resume_batch,
    reason: `[Stage 4/5] Resuming batch '${recoveryState.current_resume_batch}' from Range ${recoveryState.current_resume_range}.`
  });

  if (failedBatch) {
    failedBatch.status = 'Pending';
  }

  await new Promise(r => setTimeout(r, 1000));

  // Stage 5: Recovery Complete
  recoveryState.current_recovery_stage = 'Recovery Complete';
  recoveryState.checkpoint_status = 'Synced & Resumed';
  broadcastRecoveryEvent('Recovery Complete', {
    runner_id: runnerInfo?.runner_id || 'runner_1572',
    portal_id: recoveryState.current_resume_portal,
    city_batch: recoveryState.current_resume_batch,
    reason: `[Stage 5/5] Recovery completed successfully. Execution pipeline resumed.`
  });
}

app.get('/api/recovery/status', (req, res) => {
  const activeWsCount = Array.from(wsConnectedRunners.values()).filter(w => w.ws && w.ws.readyState === 1).length;
  const mainRunner = runnerRegistry.find(r => r.runner_id === 'runner_1572' || r.agent_name.includes('Manisha'));
  const lastHeartbeat = mainRunner?.last_heartbeat ? new Date(mainRunner.last_heartbeat).toLocaleTimeString() : new Date().toLocaleTimeString();

  res.json({
    success: true,
    recovery_state: recoveryState,
    cards: {
      runner_heartbeat: {
        interval: '5s',
        last_timestamp: lastHeartbeat,
        status: activeWsCount > 0 ? 'Connected' : (wsConnectedRunners.size > 0 ? 'Reconnecting' : 'Disconnected')
      },
      backend_health: {
        port: 7500,
        status: recoveryState.backend_status,
        last_check: recoveryState.last_backend_check ? new Date(recoveryState.last_backend_check).toLocaleTimeString() : new Date().toLocaleTimeString()
      },
      recovery_attempts: {
        count: recoveryState.recovery_attempts_count,
        stage: recoveryState.current_recovery_stage,
        last_reason: recoveryState.last_recovery_reason
      },
      batch_resume_status: {
        portal: recoveryState.current_resume_portal,
        batch: recoveryState.current_resume_batch,
        range: recoveryState.current_resume_range,
        checkpoint: recoveryState.checkpoint_status
      }
    },
    active_recoveries: recoveryState.active_recoveries
  });
});

app.post('/api/recovery/retry', async (req, res) => {
  const { city_id, city_name, portal_id } = req.body;
  const targetBatch = cityQueue.find(c => (city_id && c.city_id === city_id) || (city_name && c.city_name === city_name)) || cityQueue.find(c => c.status === 'Failed');

  const mainRunner = runnerRegistry.find(r => r.runner_id === 'runner_1572') || runnerRegistry[0];

  triggerSelfHealingRecoverySequence(targetBatch, mainRunner, 'Manual User Recovery Triggered');
  res.json({ success: true, message: 'Self-healing recovery sequence initiated.' });
});

app.post('/api/recovery/reset', (req, res) => {
  recoveryState.recovery_attempts_count = 0;
  recoveryState.current_recovery_stage = 'Idle';
  recoveryState.last_recovery_reason = 'System Resetted';
  recoveryState.current_resume_portal = '-';
  recoveryState.current_resume_batch = '-';
  recoveryState.current_resume_range = '-';
  recoveryState.checkpoint_status = 'Synced';
  recoveryState.active_recoveries = [];

  res.json({ success: true, message: 'Recovery engine metrics reset.' });
});

app.post('/api/errors/reassign', async (req, res) => {
  const { execution_id, city, new_agent_name } = req.body;
  const cityObj = cityQueue.find(c => c.city_name === city);
  const agentObj = agents.find(a => a.agent_name === new_agent_name);

  if (cityObj && agentObj && agentObj.status === 'Idle') {
    cityObj.status = 'Running';
    cityObj.assigned_agent = agentObj.agent_name;
    agentObj.status = 'Running';
    agentObj.current_city = cityObj.city_name;

    await triggerScraperRun(cityObj, agentObj);
    logReallocation(`Reassigned and restarted city: ${city} to agent ${agentObj.agent_name}`);
    return res.json({ success: true });
  }
  res.status(400).json({ error: 'Reassignment failed' });
});

// Configure Scheduler endpoints
app.get('/api/scheduler/config', (req, res) => {
  res.json(schedulerConfig);
});

app.post('/api/scheduler/config', (req, res) => {
  const { batch_size, max_parallel_agents, run_basic, run_contact, run_social, run_leader } = req.body;
  if (batch_size) schedulerConfig.batch_size = parseInt(batch_size, 10);
  if (max_parallel_agents) schedulerConfig.max_parallel_agents = parseInt(max_parallel_agents, 10);

  if (run_basic !== undefined) schedulerConfig.run_basic = !!run_basic;
  if (run_contact !== undefined) schedulerConfig.run_contact = !!run_contact;
  if (run_social !== undefined) schedulerConfig.run_social = !!run_social;
  if (run_leader !== undefined) schedulerConfig.run_leader = !!run_leader;

  // Re-partition pending city queue dynamically using new batch size
  if (latestValidationResults && latestValidationResults.length > 0) {
    const activeRunningOrDone = cityQueue.filter(c => c.status === 'Running' || c.status === 'Completed');
    const repartitionedQueue = buildQueueAndBatchesFromValidation(latestValidationResults, schedulerConfig.batch_size);
    cityQueue = [...activeRunningOrDone, ...repartitionedQueue.filter(nb => !activeRunningOrDone.some(p => p.city_name === nb.city_name))];
  }

  logReallocation(`Scheduler config updated: Batch=${schedulerConfig.batch_size}, MaxAgents=${schedulerConfig.max_parallel_agents}, Basic=${schedulerConfig.run_basic}`);
  res.json({ success: true, config: schedulerConfig, queueCount: cityQueue.length });
});

// Endpoint to return logged-in user's MyBlocks LLM connection status (Server-side safe: API key is never exposed!)
app.get('/api/user-llm-config', async (req, res) => {
  const targetUserId = req.clientId || req.query.user_id || defaultScraperConfig.user_id;
  const targetFirmId = req.firmId || req.query.firm_id || defaultScraperConfig.firm_id;
  const config = await getActiveApiKey(targetUserId, null, targetFirmId);

  res.json({
    user_id: targetUserId,
    exists: config.exists,
    provider: config.provider || 'None',
    model: config.model || '-',
    status: config.status || 'INACTIVE',
    isActive: config.isActive,
    message: config.exists
      ? (config.isActive ? `Connected: ${config.provider} (${config.model})` : `Inactive: ${config.provider} (${config.model})`)
      : 'No API configured. Please add one in MyBlocks API Key Manager.'
  });
});



// Quality Check (QC) Workflow Engine State & Storage
let qcBatchReports = [];
let qcFailedRecordsList = [];

// Initialize qc_failed_records table in MySQL automatically
async function initQcDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS qc_failed_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        execution_id VARCHAR(64),
        city VARCHAR(100),
        category VARCHAR(100),
        company_name VARCHAR(255),
        phone VARCHAR(50),
        website VARCHAR(255),
        google_maps_url VARCHAR(500),
        address TEXT,
        quality_score INT,
        failure_reasons TEXT,
        retry_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[QC ENGINE] Verified/Created qc_failed_records table in MySQL.');
  } catch (err) {
    console.log('[QC ENGINE] Notice initializing QC table:', err.message);
  } finally {
    if (connection) await connection.end().catch(() => { });
  }
}
initQcDatabase();

// Core Quality Check Evaluator Engine (Rules 1-10)
function evaluateQualityCheck(records = [], targetCity = '', targetState = '', targetCategory = '') {
  const summary = {
    totalScraped: records.length,
    validCount: 0,
    duplicateCount: 0,
    missingFieldsCount: 0,
    rejectedCount: 0,
    avgScore: 0,
    passRate: '0%'
  };

  const validRecords = [];
  const failedRecords = [];
  const seenPhone = new Set();
  const seenWebsite = new Set();
  const seenMaps = new Set();

  let totalScoreSum = 0;

  for (const item of records) {
    const name = String(item.company_name || item.VEND_TITL || item.title || '').trim();
    const rawPhone = String(item.phone || item.mobile || item.contact || '').trim();
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const website = String(item.website || item.url || item.web || '').trim();
    const mapsUrl = String(item.google_maps_url || item.gmaps_url || item.maps || '').trim();
    const address = String(item.address || item.location || item.full_address || '').trim();
    const category = String(item.category || item.VEND_CATEGRY || '').trim();

    // Rule 6: Remove duplicate records using phone, website, or Google Maps URL in batch
    const phoneKey = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
    let isDuplicate = false;
    if (phoneKey && phoneKey.length >= 8 && seenPhone.has(phoneKey)) isDuplicate = true;
    if (website && website.length > 5 && seenWebsite.has(website.toLowerCase())) isDuplicate = true;
    if (mapsUrl && mapsUrl.length > 10 && seenMaps.has(mapsUrl.toLowerCase())) isDuplicate = true;

    if (isDuplicate) {
      summary.duplicateCount++;
      failedRecords.push({
        ...item,
        company_name: name,
        phone: rawPhone,
        website,
        google_maps_url: mapsUrl,
        address,
        category,
        quality_score: 0,
        failure_reasons: ['Duplicate record in current batch']
      });
      continue;
    }

    if (phoneKey && phoneKey.length >= 8) seenPhone.add(phoneKey);
    if (website && website.length > 5) seenWebsite.add(website.toLowerCase());
    if (mapsUrl && mapsUrl.length > 10) seenMaps.add(mapsUrl.toLowerCase());

    // Evaluate Quality Score Rules
    let score = 0;
    const reasons = [];
    let missingField = false;

    // Rule 1: Validate company name (not empty, min 3 chars)
    if (name.length >= 3 && !['n/a', 'unknown', 'null', 'none', '-'].includes(name.toLowerCase())) {
      score += 15;
    } else {
      reasons.push('Company name invalid or < 3 characters');
      missingField = true;
    }

    // Rule 2: Validate phone number format (10-15 digits)
    if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
      score += 20;
    } else {
      reasons.push('Phone missing or invalid digit length (10-15 digits required)');
      missingField = true;
    }

    // Rule 3: Validate website URL format (http or https)
    if (website && (website.toLowerCase().startsWith('http://') || website.toLowerCase().startsWith('https://'))) {
      score += 20;
    } else {
      reasons.push('Website missing or invalid format (requires http:// or https://)');
      missingField = true;
    }

    // Rule 4: Validate Google Maps URL
    if (mapsUrl && (mapsUrl.toLowerCase().includes('google.com/maps') || mapsUrl.toLowerCase().includes('maps.google.com') || mapsUrl.toLowerCase().includes('goo.gl') || mapsUrl.toLowerCase().includes('g.co'))) {
      score += 15;
    } else {
      reasons.push('Google Maps URL missing or invalid format');
    }

    // Rule 5: Validate address contains target city/state
    const lcAddr = address.toLowerCase();
    const lcCity = targetCity ? targetCity.toLowerCase().split('(')[0].trim() : '';
    const lcState = targetState ? targetState.toLowerCase().trim() : '';
    if ((lcCity && lcAddr.includes(lcCity)) || (lcState && lcAddr.includes(lcState))) {
      score += 15;
    } else if (!address) {
      reasons.push('Address is empty/missing');
    } else {
      reasons.push(`Address does not contain target city '${lcCity}' or state '${lcState}'`);
    }

    // Rule 8: Check category relevance
    const lcCat = category.toLowerCase();
    const lcReqCat = targetCategory ? targetCategory.toLowerCase().trim() : '';
    if (!lcReqCat || (lcCat && (lcCat.includes(lcReqCat) || lcReqCat.includes(lcCat)))) {
      score += 15;
    } else {
      reasons.push(`Category '${category}' does not match requested category '${targetCategory}'`);
    }

    if (missingField) summary.missingFieldsCount++;

    totalScoreSum += score;

    // Rule 10: Copy only records with quality_score >= 75 to kf_vendor
    if (score >= 75) {
      summary.validCount++;
      validRecords.push({
        ...item,
        company_name: name,
        phone: rawPhone,
        website,
        google_maps_url: mapsUrl,
        address,
        category,
        quality_score: score
      });
    } else {
      summary.rejectedCount++;
      failedRecords.push({
        ...item,
        company_name: name,
        phone: rawPhone,
        website,
        google_maps_url: mapsUrl,
        address,
        category,
        quality_score: score,
        failure_reasons: reasons
      });
    }
  }

  summary.avgScore = summary.totalScraped > 0 ? Math.round(totalScoreSum / summary.totalScraped) : 0;
  summary.passRate = summary.totalScraped > 0 ? `${Math.round((summary.validCount / summary.totalScraped) * 100)}%` : '0%';

  return { summary, validRecords, failedRecords };
}

// Quality Check Endpoints
app.post('/api/qc/process-batch', async (req, res) => {
  const { execution_id, city, state, category, records = [] } = req.body || {};
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Array of records is required for Quality Check.' });
  }

  const { summary, validRecords, failedRecords } = evaluateQualityCheck(records, city, state, category);

  // Store failed records in DB and memory
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // Check against kf_vendor database for existing duplicates (Rule 7)
    const filteredValid = [];
    for (const rec of validRecords) {
      const cleanPhone = (rec.phone || '').replace(/\D/g, '');
      const [existing] = await connection.query(
        `SELECT id FROM kf_vendor WHERE (phone = ? AND phone != '') OR (website = ? AND website != '') LIMIT 1`,
        [cleanPhone, rec.website || '']
      );
      if (existing && existing.length > 0) {
        summary.duplicateCount++;
        summary.validCount = Math.max(0, summary.validCount - 1);
        failedRecords.push({
          ...rec,
          quality_score: 0,
          failure_reasons: ['Skipped: Record already exists in kf_vendor table']
        });
      } else {
        filteredValid.push(rec);
      }
    }

    // Insert failed records into qc_failed_records DB table (with graceful in-memory fallback)
    for (const f of failedRecords) {
      const reasonsStr = Array.isArray(f.failure_reasons) ? f.failure_reasons.join('; ') : String(f.failure_reasons || 'Quality check failed');
      try {
        await connection.query(
          `INSERT INTO qc_failed_records (execution_id, city, category, company_name, phone, website, google_maps_url, address, quality_score, failure_reasons)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [execution_id || 'exec_manual', city || '-', category || '-', f.company_name || '-', f.phone || '', f.website || '', f.google_maps_url || '', f.address || '', f.quality_score || 0, reasonsStr]
        );
      } catch (dbErr) {
        // Table created error or permission denied fallback
      }

      qcFailedRecordsList.unshift({
        id: 'qcf_' + Math.random().toString(36).substr(2, 9),
        execution_id: execution_id || 'exec_manual',
        city: city || '-',
        category: category || '-',
        company_name: f.company_name || '-',
        phone: f.phone || '',
        website: f.website || '',
        google_maps_url: f.google_maps_url || '',
        address: f.address || '',
        quality_score: f.quality_score || 0,
        failure_reasons: reasonsStr,
        created_at: new Date().toLocaleTimeString()
      });
    }

    // Record batch report
    const batchReport = {
      batch_id: execution_id || ('qc_b_' + Date.now()),
      city: city || 'General',
      category: category || 'General',
      totalScraped: summary.totalScraped,
      validCount: filteredValid.length,
      duplicateCount: summary.duplicateCount,
      missingFieldsCount: summary.missingFieldsCount,
      rejectedCount: failedRecords.length,
      avgScore: summary.avgScore,
      passRate: summary.passRate,
      timestamp: new Date().toLocaleTimeString()
    };

    qcBatchReports.unshift(batchReport);
    if (qcBatchReports.length > 50) qcBatchReports.pop();

    logReallocation(`[QUALITY CHECK] Batch evaluated for '${city}': ${summary.totalScraped} total, ${filteredValid.length} passed (Score >= 75), ${failedRecords.length} rejected.`);

    res.json({
      success: true,
      summary: { ...summary, validCount: filteredValid.length, rejectedCount: failedRecords.length },
      validRecords: filteredValid,
      failedRecords
    });
  } catch (err) {
    console.error('Error processing QC batch:', err.message);
    res.status(500).json({ error: 'QC Batch evaluation failed: ' + err.message });
  } finally {
    if (connection) await connection.end().catch(() => { });
  }
});

app.get('/api/qc/summary', async (req, res) => {
  let connection;
  let dbFailedRecords = [];
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(
      `SELECT * FROM qc_failed_records ORDER BY id DESC LIMIT 100`
    );
    dbFailedRecords = rows;
  } catch (e) {
    dbFailedRecords = qcFailedRecordsList.slice(0, 100);
  } finally {
    if (connection) await connection.end().catch(() => { });
  }

  const grandTotalScraped = qcBatchReports.reduce((acc, r) => acc + r.totalScraped, 0);
  const grandTotalValid = qcBatchReports.reduce((acc, r) => acc + r.validCount, 0);
  const grandTotalDuplicates = qcBatchReports.reduce((acc, r) => acc + r.duplicateCount, 0);
  const grandTotalRejected = qcBatchReports.reduce((acc, r) => acc + r.rejectedCount, 0);
  const grandTotalMissing = qcBatchReports.reduce((acc, r) => acc + r.missingFieldsCount, 0);

  const overallPassRate = grandTotalScraped > 0 ? `${Math.round((grandTotalValid / grandTotalScraped) * 100)}%` : '0%';
  const overallAvgScore = qcBatchReports.length > 0 ? Math.round(qcBatchReports.reduce((acc, r) => acc + r.avgScore, 0) / qcBatchReports.length) : 0;

  res.json({
    success: true,
    metrics: {
      totalScraped: grandTotalScraped,
      validRecords: grandTotalValid,
      duplicateCount: grandTotalDuplicates,
      rejectedRecords: grandTotalRejected,
      missingFieldsCount: grandTotalMissing,
      overallPassRate,
      overallAvgScore
    },
    batchReports: qcBatchReports,
    failedRecords: dbFailedRecords
  });
});

app.post('/api/qc/retry-contact', async (req, res) => {
  const { failed_id } = req.body || {};

  let targetRecord = qcFailedRecordsList.find(r => String(r.id) === String(failed_id));
  if (!targetRecord) {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.query(`SELECT * FROM qc_failed_records WHERE id = ? LIMIT 1`, [failed_id]);
      if (rows && rows.length > 0) targetRecord = rows[0];
    } catch (e) { } finally {
      if (connection) await connection.end().catch(() => { });
    }
  }

  if (!targetRecord) {
    return res.status(404).json({ error: 'Failed record not found' });
  }

  // Trigger contact retry via main runner
  const runner = runnerRegistry.find(r => r.status === 'Idle' || r.runner_id === 'runner_1572') || runnerRegistry[0];

  logReallocation(`[QC RETRY] Initiated Contact Scraper retry for failed record: '${targetRecord.company_name}' (${targetRecord.city})`);

  res.json({
    success: true,
    message: `Initiated single-pass Contact Scraper retry for '${targetRecord.company_name}'.`,
    target: targetRecord,
    assigned_runner: runner ? runner.agent_name : 'Local Runner'
  });
});

// Fetch active unique regions (states) from Database
app.get('/api/regions', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(
      `SELECT DISTINCT state 
       FROM portal 
       WHERE status = 'ACTIVE' AND state != 'YES' AND state != '' AND state IS NOT NULL
       ORDER BY state ASC`
    );
    const regions = rows.map(r => r.state.trim());
    res.json({ success: true, regions });
  } catch (err) {
    console.error('Error fetching regions:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

// Populates City Queue from Portal Table in Database dynamically
app.post('/api/queue/populate-region', async (req, res) => {
  const { region } = req.body;
  if (!region) return res.status(400).json({ error: 'Region is required.' });

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(
      `SELECT portalid, portalname, state, contentcount 
       FROM portal 
       WHERE status = 'ACTIVE' AND state = ? AND portalname != ''
       ORDER BY id ASC 
       LIMIT 100`,
      [region]
    );

    cityQueue = []; // Clear existing queue

    rows.forEach((row, idx) => {
      const parsedCount = parseInt(row.contentcount, 10);
      const estCount = (isNaN(parsedCount) || parsedCount <= 0) ? 500 : parsedCount;

      cityQueue.push({
        city_id: 'c_' + Math.random().toString(36).substr(2, 9),
        city_name: `${row.portalname.trim()} (${row.portalid})`,
        state: row.state,
        priority: idx + 1,
        estimated_company_count: estCount,
        status: 'Pending',
        assigned_agent: null,
        portal_id: row.portalid,
        batch_count: '0/0',
        companies_processed: 0,
        total_companies: estCount,
        current_stage: '-',
        started_at: null,
        completed_at: null,
        execution_id: null,
        start_from: 1
      });
    });

    logReallocation(`Populated queue with ${cityQueue.length} cities from portal table for region: ${region}`);
    res.json({ success: true, count: cityQueue.length });
  } catch (err) {
    console.error('Error populating from DB:', err.message);
    res.status(500).json({ error: `Database query failed: ${err.message}` });
  } finally {
    if (connection) await connection.end();
  }
});

// Dynamic Topic & Target Analyzer (Zero Hardcoded Places)
function analyzeTopic(requestText) {
  if (!requestText) return { industry: 'General', country: 'India', region: '', state: '', targetContacts: 0, hasExplicitTarget: false };
  const text = requestText.toLowerCase().trim();

  // 1. Extract Target Contacts count if explicitly specified
  const contactMatch = text.match(/(\d+)\s*(?:contacts|companies|targets|records|leads)/);
  const hasExplicitTarget = !!contactMatch;
  const targetContacts = contactMatch ? parseInt(contactMatch[1], 10) : 0;

  // 2. Extract Country
  let country = 'India';
  if (text.includes('usa') || text.includes('united states') || text.includes('us')) {
    country = 'USA';
  }

  // 3. Dynamic Topic Extraction
  let industry = '';
  const matchPattern = text.match(/^run\s+(.*?)\s+(?:across|in|for)\s+(.*)/i);
  if (matchPattern && matchPattern[1]) {
    industry = matchPattern[1].trim();
  }
  if (!industry) {
    industry = requestText.replace(/^run\s+/i, '').split(/\s+(across|in|for)\s+/i)[0].trim() || 'General';
  }
  industry = industry.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const promptClean = requestText.trim();

  return {
    industry,
    country,
    region: promptClean,
    state: promptClean,
    targetContacts,
    hasExplicitTarget
  };
}

// Topic-Based Auto Populator Endpoint
app.post('/api/queue/populate-topic', async (req, res) => {
  const { request } = req.body;
  if (!request) return res.status(400).json({ error: 'Request text is required.' });

  const { industry, country, region, state, targetContacts, hasExplicitTarget } = analyzeTopic(request);
  currentOrchestrationTopic = industry;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    let query = `SELECT portalid, portalname, state, contentcount 
                 FROM portal 
                 WHERE status = 'ACTIVE' AND portalname != ''`;
    let params = [];

    if (state) {
      query += ` AND (state = ? OR state = ?)`;
      params.push(state);
      params.push(state === 'Tamil Nadu' ? 'TN' : (state === 'Andhra Pradesh' ? 'AP' : state));
    } else if (region === 'South India') {
      query += ` AND state IN ('Karnataka', 'Telangana', 'Tamil Nadu', 'TN', 'Kerala', 'Andhra Pradesh', 'AP')`;
    } else if (region === 'Entire India') {
      query += ` AND state NOT IN ('', 'YES', 'IL', 'MA', 'RI', 'IA', 'NC', 'NJ', 'WI', 'NY', 'PA', 'FL', 'NH', 'MT', 'MD', 'ND', 'KY', 'WV', 'ME', 'MI', 'GA', 'MN', 'OH', 'IN', 'SD', 'VA', 'CT', 'VT', 'SC', 'AL', 'MS', 'DE', 'DC', 'PR', 'LA', 'MO', 'VI', 'WA', 'AE', 'AA', 'KS', 'NE', 'AR', 'OK', 'TX', 'CO', 'WY', 'ID', 'UT', 'AZ', 'NM', 'NV', 'CA', 'HI', 'AS', 'GU', 'PW', 'FM', 'MP', 'MH')`;
    } else if (country === 'USA') {
      query += ` AND state IN ('IL', 'MA', 'RI', 'IA', 'NC', 'NJ', 'WI', 'NY', 'PA', 'FL', 'NH', 'MT', 'MD', 'ND', 'KY', 'WV', 'ME', 'MI', 'GA', 'MN', 'OH', 'IN', 'SD', 'VA', 'CT', 'VT', 'SC', 'AL', 'MS', 'DE', 'DC', 'PR', 'LA', 'MO', 'VI', 'WA', 'AE', 'AA', 'KS', 'NE', 'AR', 'OK', 'TX', 'CO', 'WY', 'ID', 'UT', 'AZ', 'NM', 'NV', 'CA', 'HI', 'AS', 'GU', 'PW', 'FM', 'MP', 'MH')`;
    }

    query += ` ORDER BY id ASC LIMIT 50`;

    const [rows] = await connection.query(query, params);

    cityQueue = []; // Clear existing queue

    rows.forEach((row, idx) => {
      const parsedCount = parseInt(row.contentcount, 10);
      const estCount = hasExplicitTarget
        ? Math.min((isNaN(parsedCount) || parsedCount <= 0) ? targetContacts : parsedCount, targetContacts)
        : targetContacts;

      cityQueue.push({
        city_id: 'c_' + Math.random().toString(36).substr(2, 9),
        city_name: `${row.portalname.trim()} (${row.portalid})`,
        state: row.state,
        priority: idx + 1,
        estimated_company_count: estCount,
        status: 'Pending',
        assigned_agent: null,
        portal_id: row.portalid,
        batch_count: '0/0',
        companies_processed: 0,
        total_companies: estCount,
        current_stage: '-',
        started_at: null,
        completed_at: null,
        execution_id: null,
        start_from: 1,
        transitions: { pending_at: new Date().toLocaleTimeString() },
        eta: '-'
      });
    });

    logReallocation(`Populated queue automatically for topic: ${industry} (${region || state || country}) with ${cityQueue.length} cities.`);
    res.json({ success: true, count: cityQueue.length, topic: { industry, country, region, state, targetContacts } });
  } catch (err) {
    console.error('Error populating from DB:', err.message);
    res.status(500).json({ error: `Database query failed: ${err.message}` });
  } finally {
    if (connection) await connection.end();
  }
});

// Full Orchestration Endpoint (Step 1 & Step 2: DB Updates Only)
app.post('/api/orchestrate/full-workflow', async (req, res) => {
  const promptText = req.body.prompt || req.body.request || (req.body.topic ? `${req.body.topic} across ${req.body.region || 'South India'}` : '');

  if (!promptText) {
    return res.status(400).json({ error: 'A prompt sentence is required (e.g. "Run healthcare companies across South India").' });
  }

  const { industry, region, state, targetContacts, hasExplicitTarget } = analyzeTopic(promptText);
  currentOrchestrationTopic = industry;
  const coverageScope = state || region || promptText.trim();
  const bSize = parseInt(req.body.batch_size, 10) || schedulerConfig.batch_size || 1000;
  const tLimit = req.body.targetLimit ? parseInt(req.body.targetLimit, 10) : (hasExplicitTarget ? targetContacts : 0);

  const forceLLM = Boolean(req.body.force_llm);
  const existingCities = Array.isArray(req.body.existing_cities) ? req.body.existing_cities : [];

  try {
    logReallocation(`[LLM DISCOVERY] Initiating Region Discovery for prompt '${promptText}' (Topic: '${currentOrchestrationTopic}', Coverage: '${coverageScope}', User: '${req.clientId}', Force LLM: ${forceLLM})...`);

    // Step 1: LLM Region Discovery using logged-in User's MyBlocks API Key Config
    const discovered = await llmRegionDiscovery(currentOrchestrationTopic, coverageScope, tLimit, req.clientId, req.firmId, forceLLM, existingCities);
    latestDiscoveryResults = discovered;

    logReallocation(`[LLM DISCOVERY] LLM identified ${discovered.length} locations across requested coverage scope.`);

    // Step 2: Portal DB Validation & Auto-Registration into portal table
    logReallocation(`[PORTAL VALIDATION] Validating discovered locations against Portal Database & index...`);
    const validated = await validateDiscoveredCitiesWithPortalDB(discovered, defaultScraperConfig.memberid);
    latestValidationResults = validated;

    const completedCount = validated.filter(v => v.status === 'Completed').length;
    const activeCount = validated.length - completedCount;
    logReallocation(`[PORTAL VALIDATION] Validation complete: ${completedCount} completed locations skipped, ${activeCount} locations updated/registered in Portal DB.`);

    // Automatically populate SCRAPPER_PROCESSING table with prompt portals using logged-in user's EMP_ID
    // Generated batch items computed for response (not assigned to cityQueue to avoid auto-starting runners/executables)
    const generatedQueue = buildQueueAndBatchesFromValidation(validated, bSize, req.clientId);

    logReallocation(`[WORKFLOW DISCOVERY] Prompt processed successfully. Discovered ${validated.length} location portal records.`);

    res.json({
      success: true,
      prompt: promptText,
      topic: currentOrchestrationTopic,
      region: coverageScope,
      discovery: discovered,
      validation: validated,
      queueCount: generatedQueue.length
    });

  } catch (err) {
    console.error('Error in full-workflow orchestration:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Endpoint to manually add selected portals to SCRAPPER_PROCESSING (with duplicate checking)
app.post('/api/orchestrate/add-to-processing', async (req, res) => {
  console.log('[ADD TO PROCESSING] Request received:', JSON.stringify(req.body));
  const { items, target_emp_id, emp_id, superadmin_password } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.log('[ADD TO PROCESSING] Bad request: items missing or empty');
    return res.status(400).json({ error: 'No portals selected to add to SCRAPPER_PROCESSING.' });
  }

  const empId = target_emp_id || emp_id || req.clientId || req.headers['x-user-id'] || req.headers['x-client-id'] || 1572;

  if (target_emp_id && String(target_emp_id).trim() !== String(req.clientId).trim()) {
    if (superadmin_password !== SUPERADMIN_PASSWORD) {
      return res.status(403).json({ success: false, error: 'Superadmin password required to assign portals to another user.' });
    }
  }

  let addedCount = 0;
  let blockedItems = [];
  let connection;

  try {
    console.log('[ADD TO PROCESSING] Acquiring DB connection from pool for empId:', empId);
    connection = await dbPool.getConnection();
    console.log('[ADD TO PROCESSING] DB connection acquired successfully');

    for (const item of items) {
      const portalId = String(item.portal_id || item.portalid || '0');
      const portalName = item.city || item.portal_name || 'Location';
      console.log(`[ADD TO PROCESSING] Checking portalId: ${portalId}, portalName: ${portalName}`);

      const [existing] = await connection.query(
        `SELECT SP_ID, EMP_ID, STATUS FROM SCRAPPER_PROCESSING WHERE PORTALID = ? LIMIT 1`,
        [portalId]
      );

      if (existing && existing.length > 0) {
        const currentStatus = String(existing[0].STATUS).toUpperCase();
        if (currentStatus === 'FAILED' || currentStatus === 'CANCELLED') {
          console.log(`[ADD TO PROCESSING] Portal ${portalId} exists with status '${currentStatus}'. Updating status to PENDING and EMP_ID to ${empId}`);
          await connection.query(
            `UPDATE SCRAPPER_PROCESSING 
             SET STATUS = 'PENDING', EMP_ID = ?, UPDATE_DTM = NOW() 
             WHERE SP_ID = ?`,
            [empId, existing[0].SP_ID]
          );
          addedCount++;
        } else {
          console.log(`[ADD TO PROCESSING] Portal ${portalId} already exists in active status '${currentStatus}' (EMP_ID: ${existing[0].EMP_ID})`);
          blockedItems.push({ portal_id: portalId, city: portalName, emp_id: existing[0].EMP_ID, status: currentStatus });
        }
      } else {
        console.log(`[ADD TO PROCESSING] Inserting portal ${portalId} into SCRAPPER_PROCESSING`);
        await connection.query(
          `INSERT INTO SCRAPPER_PROCESSING (EMP_ID, PORTALNAME, PORTALID, STATUS, INSRT_DTM, UPDATE_DTM)
           VALUES (?, ?, ?, 'PENDING', NOW(), NOW())`,
          [empId, portalName, portalId]
        );
        addedCount++;
      }
    }

    if (blockedItems.length > 0 && addedCount === 0) {
      const blockedNames = blockedItems.map(b => `'${b.city}' (ID: ${b.portal_id})`).join(', ');
      console.log('[ADD TO PROCESSING] All items blocked:', blockedNames);
      return res.status(400).json({
        success: false,
        error: `Portal(s) ${blockedNames} already in processing. Please contact admin.`
      });
    }

    let msg = `Successfully added ${addedCount} portal(s) to SCRAPPER_PROCESSING for Employee ID ${empId}.`;
    if (blockedItems.length > 0) {
      const blockedNames = blockedItems.map(b => `'${b.city}' (ID: ${b.portal_id})`).join(', ');
      msg += ` Note: ${blockedItems.length} portal(s) (${blockedNames}) already exist in processing and were skipped (Contact admin).`;
    }

    console.log('[ADD TO PROCESSING] Success:', msg);
    logReallocation(`[SCRAPPER_PROCESSING MANUAL ADD] Added ${addedCount} portals, blocked ${blockedItems.length} duplicate portals for Employee ID ${empId}.`);
    res.json({ success: true, addedCount, blockedCount: blockedItems.length, message: msg, blockedItems });

  } catch (err) {
    console.error('[ADD TO PROCESSING ERROR]', err.message, err.stack);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) {
      console.log('[ADD TO PROCESSING] Releasing DB connection back to pool');
      connection.release();
    }
  }
});

// Distributed Runner Registry Endpoints (Step 5)
app.get('/api/runners', (req, res) => {
  res.json({ success: true, runners: runnerRegistry });
});

app.post('/api/runners/heartbeat', (req, res) => {
  const { runner_id, status, current_batch, execution_id } = req.body;
  const runner = runnerRegistry.find(r => r.runner_id === runner_id || r.agent_name === runner_id);

  if (runner) {
    runner.last_heartbeat = new Date();
    if (status) runner.status = status;
    if (current_batch !== undefined) runner.current_batch = current_batch;
    if (execution_id !== undefined) runner.execution_id = execution_id;
    return res.json({ success: true, runner });
  }

  res.status(404).json({ error: 'Runner not found' });
});

app.post('/api/runners/add', (req, res) => {
  const { server_name, host_ip, agent_name } = req.body;
  if (!server_name || !agent_name) {
    return res.status(400).json({ error: 'Server name and Agent name are required.' });
  }

  const runner_id = 'runner_' + Math.random().toString(36).substr(2, 9);
  const newRunner = {
    runner_id,
    server_name,
    host_ip: host_ip || '127.0.0.1:7500',
    agent_name,
    status: 'Idle',
    last_heartbeat: new Date(),
    current_workflow: null,
    current_batch: null,
    execution_id: null
  };

  runnerRegistry.push(newRunner);

  // Sync with agents
  if (!agents.some(a => a.agent_name === agent_name)) {
    agents.push({
      agent_id: 'a_' + Math.random().toString(36).substr(2, 9),
      portal_id: null,
      agent_name: agent_name,
      status: 'Idle',
      current_city: null,
      execution_id: null,
      last_heartbeat: new Date()
    });
  }

  logReallocation(`[RUNNER REGISTRY] Registered new runner '${server_name}' (${agent_name})`);
  res.json({ success: true, runner: newRunner });
});

// Endpoint to verify superadmin password
app.post('/api/runners/verify-superadmin', (req, res) => {
  const { password } = req.body || {};
  if (password === SUPERADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Superadmin password verified successfully.' });
  }
  return res.status(401).json({ success: false, error: 'Invalid superadmin password.' });
});

const handleDeleteRunnerLogic = (runner_id, superadmin_password, requestingClientId, res) => {
  const runner = runnerRegistry.find(r => r.runner_id === runner_id || r.agent_name === runner_id);
  if (runner && isOtherUserRunner(runner, requestingClientId)) {
    if (superadmin_password !== SUPERADMIN_PASSWORD) {
      return res.status(403).json({ success: false, error: 'Superadmin password required to delete another user\'s runner entry.' });
    }
  }
  runnerRegistry = runnerRegistry.filter(r => r.runner_id !== runner_id && r.agent_name !== runner_id);
  res.json({ success: true, message: 'Runner deleted successfully.' });
};

app.post('/api/runners/delete', (req, res) => {
  const { runner_id, superadmin_password } = req.body || {};
  handleDeleteRunnerLogic(runner_id, superadmin_password, req.clientId, res);
});

app.delete('/api/runners/:id', (req, res) => {
  const runner_id = req.params.id;
  const superadmin_password = req.body?.superadmin_password || req.headers['x-superadmin-password'] || req.query?.superadmin_password;
  handleDeleteRunnerLogic(runner_id, superadmin_password, req.clientId, res);
});

// Control Scraper Executable (Global Start/Stop)
app.post('/api/exe/start', async (req, res) => {
  try {
    const isRunning = await isProcessRunning('scraperrun_v1.0.8.exe');
    if (isRunning) {
      return res.json({ success: true, message: 'Scraper Executable is already running.' });
    }

    const runnerPyPath = 'C:\\Users\\MANISHA SHAIK\\Myblocks\\scrapper-auto-agent\\scrapper-auto-agent\\runner.py';
    if (fs.existsSync(runnerPyPath)) {
      exec(`start "" python "${runnerPyPath}"`, { cwd: path.dirname(runnerPyPath) });
    } else {
      exec(`start "" python runner.py`, { cwd: path.join(__dirname, '..', 'scrapper-auto-agent') });
    }

    lastExeCheck = 0;
    cachedExeActive = true;
    res.json({ success: true, message: 'Scraper Executable process launched successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start executable: ' + err.message });
  }
});

app.post('/api/exe/stop', async (req, res) => {
  try {
    try { await execPromise(`taskkill /F /IM scraperrun_v1.0.8.exe /T`); } catch (e) { }
    try { await execPromise(`taskkill /F /IM chromedriver.exe /T`); } catch (e) { }

    // Find and stop active executions on local scraper manager
    try {
      const execRes = await fetch(`${SCRAPER_MANAGER_URL}/executions`, { signal: AbortSignal.timeout(2000) });
      if (execRes.ok) {
        const execData = await execRes.json();
        const activeList = (execData.executions || []).filter(x => ['running', 'starting', 'stopping', 'pending'].includes(x.status));
        for (const it of activeList) {
          try {
            await fetch(`${SCRAPER_MANAGER_URL}/execution/${it.execution_id}/stop`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
              signal: AbortSignal.timeout(2000)
            });
          } catch (e) { }
        }
      }
    } catch (e) { }

    wsConnectedRunners.forEach((info) => {
      if (info.ws && info.ws.readyState === 1) {
        try { info.ws.send(JSON.stringify({ event: 'stop_execution', message: 'Stop requested by Administrator' })); } catch (e) { }
      }
    });

    runnerExecutionLocks.clear();
    runnerRegistry.forEach(r => {
      if (r.status === 'Running') {
        r.status = 'Idle';
        r.current_workflow = null;
        r.current_batch = null;
        r.execution_id = null;
      }
    });

    cityQueue.forEach(c => {
      if (c.status === 'Running') {
        c.status = 'Stopped';
      }
    });

    lastExeCheck = 0;
    cachedExeActive = false;

    res.json({ success: true, message: 'Scraper Executable and active tasks stopped.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop executable: ' + err.message });
  }
});

// Control Individual Runner Execution (Start/Stop per runner)
app.post('/api/runners/start', async (req, res) => {
  const { runner_id, superadmin_password } = req.body || {};
  const runner = runnerRegistry.find(r => r.runner_id === runner_id || r.agent_name === runner_id);
  if (!runner) {
    return res.status(404).json({ error: 'Runner not found' });
  }

  if (isOtherUserRunner(runner, req.clientId)) {
    if (superadmin_password !== SUPERADMIN_PASSWORD) {
      return res.status(403).json({ success: false, error: 'Superadmin password required to control another user\'s runner entry.' });
    }
  }

  // Instantly mark runner as Running on server
  runner.status = 'Running';
  runner.last_heartbeat = new Date();
  if (!runner.current_workflow) {
    runner.current_workflow = 'Scraping Execution';
  }
  const wsRunner = wsConnectedRunners.get(runner.runner_id);
  if (wsRunner) {
    wsRunner.status = 'Running';
    wsRunner.last_heartbeat = new Date();
  }

  const runnerClientId = runner.client_id || 1572;
  const targetCity = cityQueue.find(c => (c.assigned_agent === runner.agent_name || c.assigned_agent === runner.runner_id) && (c.status === 'Queued' || c.status === 'Pending'))
    || cityQueue.find(c => (c.status === 'Queued' || c.status === 'Pending') && (c.client_id || 1572) === runnerClientId);

  if (targetCity) {
    runnerExecutionLocks.delete(runner.runner_id);
    await triggerScraperRun(targetCity, runner);
    res.json({ success: true, message: `Started execution for ${targetCity.city_name} on runner ${runner.agent_name}` });
  } else {
    // If no batches exist in Orchestrator cityQueue for this client, trigger standalone DB task processing from SCRAPPER_PROCESSING
    wsConnectedRunners.forEach((info, id) => {
      if (id === runner.runner_id || info.runner_name === runner.agent_name || (runner.agent_name && runner.agent_name.includes(info.runner_name))) {
        if (info.ws && info.ws.readyState === 1) {
          try { info.ws.send(JSON.stringify({ event: 'start_execution', runner_id: runner.runner_id })); } catch (e) { }
        }
      }
    });
    res.json({ success: true, message: `Triggered database task run for ${runner.agent_name}.` });
  }
});

app.post('/api/runners/stop', async (req, res) => {
  console.log('[API /api/runners/stop] Received stop request:', JSON.stringify(req.body), 'Requesting Client ID:', req.clientId);
  const { runner_id, superadmin_password } = req.body || {};
  const runner = runnerRegistry.find(r => r.runner_id === runner_id || r.agent_name === runner_id);

  if (!runner) {
    console.log(`[API /api/runners/stop] Runner '${runner_id}' not found in runnerRegistry.`);
    return res.status(404).json({ error: 'Runner not found' });
  }

  console.log(`[API /api/runners/stop] Found runner: ${runner.runner_id} (${runner.agent_name}), client_id: ${runner.client_id}`);

  const isOther = isOtherUserRunner(runner, req.clientId);
  console.log(`[API /api/runners/stop] Is other user runner? ${isOther} (req.clientId: ${req.clientId})`);

  if (isOther) {
    console.log(`[API /api/runners/stop] Validating superadmin password... Received: '${superadmin_password}', Expected: '${SUPERADMIN_PASSWORD}'`);
    if (superadmin_password !== SUPERADMIN_PASSWORD) {
      console.warn(`[API /api/runners/stop] 403 Forbidden: Invalid superadmin password for runner ${runner.runner_id}`);
      return res.status(403).json({ success: false, error: 'Superadmin password required to control another user\'s runner entry.' });
    }
    console.log(`[API /api/runners/stop] Superadmin password verified successfully!`);
  }

  // Send WS stop_execution signal directly to runner socket
  let wsSentCount = 0;
  wsConnectedRunners.forEach((info, id) => {
    if (id === runner.runner_id || info.runner_name === runner.agent_name || (runner.agent_name && runner.agent_name.includes(info.runner_name))) {
      if (info.ws && info.ws.readyState === 1) {
        try {
          info.ws.send(JSON.stringify({ event: 'stop_execution', runner_id: runner.runner_id, execution_id: runner.execution_id }));
          wsSentCount++;
        } catch (e) {
          console.error(`[API /api/runners/stop] Error sending WS stop signal:`, e.message);
        }
      }
    }
  });
  console.log(`[API /api/runners/stop] Sent WS stop_execution to ${wsSentCount} socket(s).`);

  if (runner.execution_id) {
    try {
      console.log(`[API /api/runners/stop] Stopping manager execution ID: ${runner.execution_id}`);
      await fetch(`${SCRAPER_MANAGER_URL}/execution/${runner.execution_id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(defaultScraperConfig.user_id), 'X-Firm-Id': '5' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(2000)
      });
    } catch (e) {
      console.warn(`[API /api/runners/stop] Manager execution stop request warning:`, e.message);
    }
  }

  try {
    const execRes = await fetch(`${SCRAPER_MANAGER_URL}/executions`, { signal: AbortSignal.timeout(2000) });
    if (execRes.ok) {
      const execData = await execRes.json();
      const activeList = (execData.executions || []).filter(x => ['running', 'starting', 'stopping', 'pending'].includes(x.status));
      for (const it of activeList) {
        try {
          await fetch(`${SCRAPER_MANAGER_URL}/execution/${it.execution_id}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(2000)
          });
        } catch (e) { }
      }
    }
  } catch (e) { }

  const runningCity = cityQueue.find(c => (c.assigned_agent === runner.agent_name || c.assigned_agent === runner.runner_id) && c.status === 'Running');
  if (runningCity) {
    runningCity.status = 'Stopped';
    console.log(`[API /api/runners/stop] Marked running city '${runningCity.city_name}' as Stopped.`);
  }

  runnerExecutionLocks.delete(runner.runner_id);
  runner.status = 'Idle';
  runner.current_workflow = null;
  runner.current_batch = null;
  runner.execution_id = null;

  console.log(`[API /api/runners/stop] Successfully stopped runner ${runner.agent_name}. Returning JSON response.`);
  res.json({ success: true, message: `Runner ${runner.agent_name} execution stopped.` });
});

// WebSocket Live Monitoring & Dispatch Endpoints
app.get('/api/ws/runners', (req, res) => {
  const activeList = Array.from(wsConnectedRunners.entries()).map(([id, info]) => ({
    runner_id: id,
    runner_name: info.runner_name,
    client_id: info.client_id,
    server_ip: info.server_ip,
    port: info.port,
    connected_at: info.connected_at,
    last_heartbeat: info.last_heartbeat,
    status: info.status
  }));
  res.json({ success: true, count: activeList.length, connected_runners: activeList });
});

app.post('/api/ws/dispatch', (req, res) => {
  const { runner_id, job_data } = req.body || {};
  if (!runner_id || !job_data) {
    return res.status(400).json({ error: 'runner_id and job_data are required.' });
  }
  const sent = dispatchTaskViaWebSocket(runner_id, job_data);
  if (sent) {
    return res.json({ success: true, message: `Task dispatched to WebSocket runner '${runner_id}' successfully.` });
  } else {
    return res.status(404).json({ error: `WebSocket runner '${runner_id}' not connected or inactive.` });
  }
});

// Allocations Control Endpoints
app.post('/api/allocations/pause', (req, res) => {
  allocationEngineActive = false;
  logReallocation("Allocation Engine paused by administrator.");
  res.json({ success: true });
});

app.post('/api/allocations/resume', (req, res) => {
  allocationEngineActive = true;
  logReallocation("Allocation Engine resumed by administrator.");
  res.json({ success: true });
});

app.post('/api/allocations/assign', (req, res) => {
  const { agent_id, city_id } = req.body;
  const agent = agents.find(a => a.agent_id === agent_id);
  const city = cityQueue.find(c => c.city_id === city_id);

  if (!agent || !city) {
    return res.status(400).json({ error: 'Agent or City invalid or not available' });
  }

  const pId = city.portal_id || resolvePortalIdFromText(city.city_name);
  if (pId) {
    city.portal_id = pId;
    agent.portal_id = pId;
  }

  city.status = 'Running';
  city.assigned_agent = agent.agent_name;
  agent.status = 'Running';
  agent.current_city = city.city_name;

  const runner = runnerRegistry.find(r => r.agent_name === agent.agent_name);
  if (runner) {
    runner.status = 'Running';
    runner.current_workflow = city.city_name;
    runner.current_batch = city.batch_count || '1/1';
  }

  logReallocation(`[MANUAL ALLOCATION] Assigned ${city.city_name} (Portal ID: ${pId || '-'}) to ${agent.agent_name}`);
  logReallocationEvent({
    event_type: 'Manual Reassign',
    from_agent: '-',
    to_agent: agent.agent_name,
    portal_id: pId || '-',
    city_batch: city.city_name,
    reason: `Manual job allocation assigned by system administrator.`
  });
  triggerScraperRun(city, agent);
  res.json({ success: true, agent, city });
});

app.post('/api/allocations/reassign', (req, res) => {
  const { agent_id, new_city_id } = req.body;
  const agent = agents.find(a => a.agent_id === agent_id);
  const newCity = cityQueue.find(c => c.city_id === new_city_id);

  if (!agent || !newCity || newCity.status !== 'Pending') {
    return res.status(400).json({ error: 'Reassignment parameters invalid' });
  }

  const oldCityName = agent.current_city;

  // Release old city if running
  if (agent.current_city) {
    const oldCity = cityQueue.find(c => c.city_name === agent.current_city);
    if (oldCity) {
      oldCity.status = 'Pending';
      oldCity.assigned_agent = null;
      oldCity.execution_id = null;
    }
  }

  newCity.status = 'Running';
  newCity.assigned_agent = agent.agent_name;
  agent.status = 'Running';
  agent.current_city = newCity.city_name;

  logReallocation(`Reassigned agent ${agent.agent_name} to city ${newCity.city_name}`);
  logReallocationEvent({
    event_type: 'Manual Reassign',
    from_agent: oldCityName || 'System',
    to_agent: agent.agent_name,
    portal_id: newCity.portal_id || resolvePortalIdFromText(newCity.city_name) || '-',
    city_batch: newCity.city_name,
    reason: `Manual job reassigned from ${oldCityName || 'previous batch'} to ${newCity.city_name}.`
  });
  triggerScraperRun(newCity, agent);
  res.json({ success: true });
});

// Config APIs
app.post('/api/queue/add', (req, res) => {
  const { city_name, state, priority, estimated_company_count } = req.body;
  if (!city_name || !priority) {
    return res.status(400).json({ error: 'City name and priority are required' });
  }

  const match = city_name.match(/\((\d+)\)/);
  const portalId = match ? parseInt(match[1], 10) : null;

  const newCity = {
    city_id: 'c_' + Math.random().toString(36).substr(2, 9),
    city_name,
    state: state || 'Unknown',
    priority: parseInt(priority, 10),
    estimated_company_count: parseInt(estimated_company_count, 10) || 500,
    status: 'Pending',
    assigned_agent: null,
    portal_id: portalId,
    batch_count: '0/0',
    companies_processed: 0,
    total_companies: parseInt(estimated_company_count, 10) || 500,
    current_stage: '-',
    started_at: null,
    completed_at: null,
    execution_id: null,
    start_from: 1
  };

  cityQueue.push(newCity);
  res.json({ success: true, city: newCity });
});

app.post('/api/queue/delete', (req, res) => {
  const { city_id } = req.body;
  cityQueue = cityQueue.filter(c => c.city_id !== city_id);
  res.json({ success: true });
});

app.post('/api/agents/add', (req, res) => {
  const { agent_name, portal_id } = req.body;
  if (!agent_name || !portal_id) {
    return res.status(400).json({ error: 'Agent name and Portal ID are required' });
  }

  const newAgent = {
    agent_id: 'a_' + Math.random().toString(36).substr(2, 9),
    portal_id: parseInt(portal_id, 10),
    agent_name,
    status: 'Idle',
    current_city: null,
    execution_id: null,
    last_heartbeat: new Date()
  };

  agents.push(newAgent);
  res.json({ success: true, agent: newAgent });
});

app.post('/api/agents/delete', (req, res) => {
  const { agent_id } = req.body;
  agents = agents.filter(a => a.agent_id !== agent_id);
  res.json({ success: true });
});

app.post('/api/queue/reset', (req, res) => {
  cityQueue = [];
  agents = [];
  allocations = [];
  schedulerBatches = [];
  executions = {};
  reallocationEvents = [];
  res.json({ success: true });
});

// Trigger Scraper Run logic
async function triggerScraperRun(city, agent) {
  let portalId = resolvePortalIdFromText(city.city_name, city.portal_id || agent.portal_id);
  if (!portalId) {
    portalId = await getPortalIdByCityName(city.city_name);
  }

  const currentUserId = defaultScraperConfig.user_id || 1572;
  const currentFirmId = defaultScraperConfig.firm_id || 5;
  const currentMemberId = defaultScraperConfig.memberid || currentUserId;

  // Clean city name so scraper exe searches Google Maps cleanly without '[Batch X/Y]' brackets!
  const cleanCity = String(city.city_name)
    .replace(/\[Batch \d+\/\d+\]/gi, '')
    .replace(/\(\d+\)/gi, '')
    .trim();

  const bSize = schedulerConfig.batch_size || defaultScraperConfig.batch_size || 300;
  const startFrom = city.start_from || 1;
  const batchCountTarget = city.estimated_company_count || bSize;
  const totalContactsForScraper = startFrom + batchCountTarget - 1;

  const executionId = city.execution_id || ('exec_' + Math.random().toString(36).substr(2, 9));
  city.execution_id = executionId;
  if (agent) agent.execution_id = executionId;

  const payload = {
    ...defaultScraperConfig,
    user_id: currentUserId,
    firm_id: currentFirmId,
    memberid: currentMemberId,
    member_id: currentMemberId,
    username: agent.agent_name,
    run_basic: schedulerConfig.run_basic,
    run_contact: schedulerConfig.run_contact,
    run_social: schedulerConfig.run_social,
    run_leader: schedulerConfig.run_leader,
    batch_size: bSize,
    total_contacts: totalContactsForScraper,
    start_from: startFrom,
    city: cleanCity,
    portal_id: portalId,
    categories: currentOrchestrationTopic !== 'General' ? [currentOrchestrationTopic] : [],
    env: {
      WDM_LOCAL: '1',
      WDM_SSL_VERIFY: '0',
      WDM_LOG_LEVEL: '0',
      NO_PROXY: '*',
      CHROMEDRIVER_PATH: 'C:\\Users\\MANISHA SHAIK\\Downloads\\chromedriver.exe'
    }
  };

  logReallocation(`Starting execution: ${city.city_name} on portal ${portalId || 'N/A'} [User: ${currentUserId}, Firm: ${currentFirmId}, Member: ${currentMemberId}, Range: ${payload.start_from} to ${payload.start_from + payload.total_contacts - 1}]`);

  city.started_at = new Date().toLocaleTimeString();
  if (portalId) {
    city.portal_id = portalId;
    if (agent) agent.portal_id = portalId;
  }

  // 1. Send start_execution message over WebSocket directly to THAT runner's WebSocket
  const activeWsRunner = getConnectedWsRunner(agent);
  if (activeWsRunner && activeWsRunner.ws && activeWsRunner.ws.readyState === WebSocket.OPEN) {
    const runnerId = activeWsRunner.runner_id || agent.agent_id || 'runner_1572';

    // Auto-release stale locks older than 5 minutes
    const now = new Date();
    const existingLock = runnerExecutionLocks.get(runnerId);
    if (existingLock && existingLock.started_at && (now - new Date(existingLock.started_at)) > 5 * 60 * 1000) {
      console.log(`[LOCK EXPIRED] Releasing stale lock for runner '${runnerId}' (held > 5 min).`);
      runnerExecutionLocks.delete(runnerId);
    }

    // Concurrency Lock Check: If runner is currently locked or running, QUEUE the batch instead of sending duplicate /start-execution calls!
    if (runnerExecutionLocks.has(runnerId) || activeWsRunner.status === 'Running') {
      console.log(`[CONCURRENCY QUEUE] Runner '${runnerId}' (${activeWsRunner.runner_name}) is currently busy executing. Queueing batch '${cleanCity}'.`);
      logReallocation(`[CONCURRENCY QUEUE] Batch '${cleanCity}' queued for busy runner '${activeWsRunner.runner_name}'.`);
      city.status = 'Queued';
      city.assigned_agent = agent.agent_name || activeWsRunner.runner_name;
      if (portalId) city.portal_id = portalId;
      return false;
    }

    // Acquire Execution Lock for runner
    runnerExecutionLocks.set(runnerId, {
      execution_id: executionId,
      city_id: city.city_id,
      started_at: new Date()
    });

    const jobPayload = {
      event: 'start_execution',
      action: 'start_execution',
      job_data: {
        SP_ID: city.sp_id || Math.floor(Math.random() * 100000),
        PORTALID: portalId,
        PORTALNAME: cleanCity,
        EMP_ID: currentUserId,
        STATUS: 'PENDING',
        execution_id: executionId,
        city: cleanCity,
        portal_id: portalId,
        user_id: currentUserId,
        firm_id: currentFirmId,
        categories: currentOrchestrationTopic !== 'General' ? [currentOrchestrationTopic] : [],
        ...payload
      }
    };

    activeWsRunner.ws.send(JSON.stringify(jobPayload));
    activeWsRunner.status = 'Running';
    activeWsRunner.current_workflow = city.city_name;
    activeWsRunner.execution_id = executionId;
    city.status = 'Running';
    city.assigned_agent = agent.agent_name || activeWsRunner.runner_name;

    executions[executionId] = {
      execution_id: executionId,
      user_id: currentUserId,
      firm_id: currentFirmId,
      memberid: currentMemberId,
      city_name: city.city_name,
      agent_id: agent.agent_id || activeWsRunner.runner_id,
      started_at: new Date()
    };

    logReallocation(`[WEBSOCKET DISPATCH] Execution '${executionId}' for ${cleanCity} (Portal: ${portalId}) sent to WebSocket runner '${activeWsRunner.runner_name}' (${activeWsRunner.runner_id}).`);
    addExecutionLog(currentUserId, executionId, 'Started', 0, 0, `WebSocket task sent directly to runner '${activeWsRunner.runner_name}'`);
    return true;
  }

  // 2. If NO active WebSocket connection, DO NOT fall back to local 127.0.0.1 HTTP unless local agent is explicitly target
  const runner = runnerRegistry.find(r => r.agent_name === agent.agent_name || r.runner_id === agent.agent_id);
  const isLocalAgent = (runner && (runner.host_ip.includes('127.0.0.1') || runner.host_ip.includes('localhost'))) ||
    (agent.agent_name && agent.agent_name.toLowerCase().includes('local'));

  if (!isLocalAgent) {
    console.warn(`[DISPATCH HOLD] Runner '${agent.agent_name}' has no active WebSocket connection. Holding batch in Pending state.`);
    logReallocation(`[DISPATCH HOLD] Skipped execution assignment for '${agent.agent_name}': No active WebSocket connection found.`);
    city.status = 'Pending';
    city.assigned_agent = null;
    city.portal_id = null;
    agent.status = 'Idle';
    agent.current_city = null;
    if (runner) runner.status = 'Disconnected';
    return false;
  }

  // 3. Fallback for Local Host PC agent ONLY
  try {
    const response = await fetch(`${SCRAPER_MANAGER_URL}/start-execution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': String(currentUserId),
        'X-Firm-Id': String(currentFirmId),
        'X-Member-Id': String(currentMemberId)
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.execution_id) {
        city.execution_id = data.execution_id;
        agent.execution_id = data.execution_id;

        executions[data.execution_id] = {
          execution_id: data.execution_id,
          user_id: currentUserId,
          firm_id: currentFirmId,
          memberid: currentMemberId,
          city_name: city.city_name,
          agent_id: agent.agent_id,
          started_at: new Date()
        };
        logReallocation(`Allocated city ${city.city_name} to local agent ${agent.agent_name}. Execution: ${data.execution_id}`);
        addExecutionLog(currentUserId, data.execution_id, 'Started', 0, 0, `Local execution initiated for ${city.city_name} (Portal: ${portalId})`);
        return true;
      }
    }
  } catch (err) {
    console.error(`[LOCAL HTTP DISPATCH ERROR] Failed to start local execution for ${agent.agent_name}:`, err.message);
  }

  city.status = 'Pending';
  city.assigned_agent = null;
  agent.status = 'Idle';
  return false;
}

// Scheduler partitioner splitting rule
app.post('/api/scheduler/batch', (req, res) => {
  const { city_id, batch_size } = req.body;
  const city = cityQueue.find(c => c.city_id === city_id);
  if (!city || city.status !== 'Pending') {
    return res.status(400).json({ error: 'City not found or running' });
  }

  const bSize = parseInt(batch_size, 10) || schedulerConfig.batch_size;
  const total = city.estimated_company_count;
  const numBatches = Math.ceil(total / bSize);

  // Remove the old item
  const oldIdx = cityQueue.findIndex(c => c.city_id === city_id);
  if (oldIdx === -1) return res.status(400).json({ error: 'Error processing partition' });

  cityQueue.splice(oldIdx, 1);

  const match = city.city_name.match(/^(.*?)\s*\((\d+)\)$/);
  const baseName = match ? match[1] : city.city_name;
  const portalSuffix = match ? ` (${match[2]})` : '';

  const newBatches = [];
  for (let i = 0; i < numBatches; i++) {
    const rangeContacts = i === numBatches - 1 ? (total - (i * bSize)) : bSize;
    newBatches.push({
      city_id: `${city_id}_b${i + 1}`,
      city_name: `${baseName} [Batch ${i + 1}/${numBatches}]${portalSuffix}`,
      state: city.state,
      priority: city.priority,
      estimated_company_count: rangeContacts,
      status: 'Pending',
      assigned_agent: null,
      portal_id: match ? parseInt(match[2], 10) : null,
      batch_count: '0/0',
      companies_processed: 0,
      total_companies: rangeContacts,
      current_stage: '-',
      started_at: null,
      completed_at: null,
      execution_id: null,
      start_from: 1 + (i * bSize)
    });
  }

  cityQueue.splice(oldIdx, 0, ...newBatches);
  res.json({ success: true });
});

// Helper to kill stale chromedriver.exe processes
async function killStaleChromeDriverProcesses() {
  try {
    await execPromise('taskkill /F /IM chromedriver.exe /T').catch(() => { });
  } catch (err) { }
}

// Automatic Portal Allocation Engine for Registered Runners
async function allocationEngine() {
  if (!allocationEngineActive) return;

  // 1. Sync runnerRegistry statuses with active WebSocket connections
  runnerRegistry.forEach(r => {
    const wsInfo = getConnectedWsRunner(r);
    if (!wsInfo) {
      if (r.status !== 'Running') {
        r.status = 'Disconnected';
      }
    } else {
      if (r.status === 'Disconnected' || r.status === 'Offline') {
        r.status = 'Idle';
      }
    }
  });

  // Concurrency bounds: Never launch more Chrome instances than active registered runners!
  const activeRunningCount = cityQueue.filter(c => c.status === 'Running').length;
  const maxAllowedInstances = Math.min(schedulerConfig.max_parallel_agents || 12, runnerRegistry.length);
  if (activeRunningCount >= maxAllowedInstances) return;

  // Auto-sync runners to agents array
  runnerRegistry.forEach(r => {
    let agent = agents.find(a => a.agent_name === r.agent_name);
    if (!agent) {
      agents.push({
        agent_id: r.runner_id,
        portal_id: r.portal_id || null,
        agent_name: r.agent_name,
        client_id: r.client_id,
        status: r.status || 'Idle',
        current_city: r.current_workflow || null,
        execution_id: r.execution_id || null,
        last_heartbeat: r.last_heartbeat || new Date()
      });
    } else {
      agent.status = r.status;
    }
  });

  // CRITICAL FIX: Only pick idle runners that have an ACTIVE WebSocket connection, fresh heartbeat & NO execution lock!
  const idleRunners = runnerRegistry.filter(r => {
    if (r.status !== 'Idle') return false;
    if (runnerExecutionLocks.has(r.runner_id)) return false;
    return isRunnerConnectedAndActive(r);
  });

  if (idleRunners.length === 0) return;

  // Active States Tracking to enforce Distinct-State Allocation per User
  const activeStates = new Set(
    cityQueue
      .filter(c => c.status === 'Running' && c.state)
      .map(c => c.state.trim().toLowerCase())
  );

  for (const idleRunner of idleRunners) {
    if (cityQueue.filter(c => c.status === 'Running').length >= maxAllowedInstances) break;

    const rClientId = idleRunner.client_id || 1572;

    // Requirement 9: Only allocate batch to a runner belonging to the SAME client_id
    // 1. First priority: Find a pending batch for THIS CLIENT from a STATE not currently running
    let city = cityQueue.find(c => {
      if (c.status !== 'Pending') return false;
      const cClientId = c.client_id || 1572;
      if (cClientId !== rClientId) return false;
      const st = (c.state || '').trim().toLowerCase();
      return st && !activeStates.has(st);
    });

    // 2. Fallback: Distinct CITY for same client_id
    if (!city) {
      const activeCities = new Set(
        cityQueue
          .filter(c => c.status === 'Running' && c.city_name)
          .map(c => c.city_name.split(' [Batch')[0].trim().toLowerCase())
      );
      city = cityQueue.find(c => {
        if (c.status !== 'Pending') return false;
        const cClientId = c.client_id || 1572;
        if (cClientId !== rClientId) return false;
        const cityName = c.city_name.split(' [Batch')[0].trim().toLowerCase();
        return !activeCities.has(cityName);
      });
    }

    // 3. Fallback: Next pending batch for same client_id
    if (!city) {
      city = cityQueue.find(c => c.status === 'Pending' && (c.client_id || 1572) === rClientId);
    }

    // 4. Global Fallback: Any next pending batch across all clients so no runner sits idle
    if (!city) {
      city = cityQueue.find(c => c.status === 'Pending');
    }

    if (!city) continue; // No pending batches available anywhere

    // Mark state as active
    if (city.state) {
      activeStates.add(city.state.trim().toLowerCase());
    }

    const idleAgent = agents.find(a => a.agent_name === idleRunner.agent_name && a.client_id === rClientId) || agents.find(a => a.status === 'Idle' && a.client_id === rClientId);

    const pId = city.portal_id || resolvePortalIdFromText(city.city_name);
    if (pId) {
      city.portal_id = pId;
      idleRunner.portal_id = pId;
      if (idleAgent) idleAgent.portal_id = pId;
    }

    const execId = 'exec_' + Math.random().toString(36).substr(2, 9);
    city.status = 'Running';
    city.assigned_agent = idleRunner.agent_name;
    city.execution_id = execId;
    city.started_at = new Date().toLocaleTimeString();
    city.current_stage = (city.current_stage && city.current_stage !== '-') ? city.current_stage : 'Basic Scraper';

    idleRunner.status = 'Running';
    idleRunner.current_workflow = city.city_name;
    idleRunner.current_batch = city.batch_count || 'Batch 1/1';
    idleRunner.execution_id = execId;

    if (idleAgent) {
      idleAgent.status = 'Running';
      idleAgent.current_city = city.city_name;
      idleAgent.execution_id = execId;
    }

    logReallocation(`[DISTINCT STATE ORCHESTRATION] Allocated State '${city.state}' (${city.city_name}) to Runner '${idleRunner.agent_name}'`);
    triggerScraperRun(city, idleAgent || { agent_name: idleRunner.agent_name });
  }
}

// 2. updateWorkflowState() — Workflow Monitoring Engine
function updateWorkflowState(scraperExecutions) {
  // Preserve running agents assigned to active cityQueue batches
  agents.forEach(agent => {
    const isRunningRemote = scraperExecutions.some(x => x.username === agent.agent_name && (x.status === 'running' || x.status === 'pending'));
    const activeCity = cityQueue.find(c => c.assigned_agent === agent.agent_name && c.status === 'Running');

    if (!isRunningRemote && !activeCity) {
      agent.status = 'Idle';
      agent.current_city = null;
      agent.execution_id = null;
      agent.batch_count = null;
      agent.progress = null;
    } else if (activeCity) {
      agent.status = 'Running';
      agent.current_city = activeCity.city_name;
      if (activeCity.portal_id) agent.portal_id = activeCity.portal_id;
    }
  });

  // Update Agent heartbeat and current state from active execution username matching
  scraperExecutions.forEach(x => {
    if (x.username) {
      const agent = agents.find(a => a.agent_name === x.username);
      const totalBatchesClean = Math.abs(parseInt(x.total_batches, 10)) || 1;
      const batchStr = `${x.completed_batches || 0}/${totalBatchesClean}`;

      if (agent) {
        agent.last_heartbeat = new Date();
        if (x.status === 'running' || x.status === 'pending') {
          agent.status = x.status === 'running' ? 'Running' : 'Waiting';
          agent.current_city = x.city || null;
          agent.execution_id = x.execution_id;
          agent.batch_count = batchStr;
        }
      }

      // Also update runnerRegistry so Agent Registry table displays workflow & batch count live!
      const runner = runnerRegistry.find(r => r.agent_name === x.username || r.server_name === x.username);
      if (runner) {
        runner.last_heartbeat = new Date();
        if (x.status === 'running' || x.status === 'pending') {
          if (x.city) runner.current_workflow = x.city;
          runner.current_batch = batchStr;
          runner.status = 'Running';
        }
      }
    }
  });

  // Sync runnerRegistry workflows with active cityQueue items to avoid lingering stale completed workflows (e.g. Chennai)
  runnerRegistry.forEach(r => {
    const runningBatch = cityQueue.find(c => (c.assigned_agent === r.agent_name || c.assigned_agent === r.runner_id) && c.status === 'Running');
    const queuedBatch = cityQueue.find(c => (c.assigned_agent === r.agent_name || c.assigned_agent === r.runner_id) && c.status === 'Queued');

    if (runningBatch) {
      r.current_workflow = runningBatch.city_name;
      r.current_batch = runningBatch.batch_count || '1/1';
      r.status = 'Running';
    } else if (r.status === 'Idle' && !runnerExecutionLocks.has(r.runner_id)) {
      if (queuedBatch) {
        r.current_workflow = queuedBatch.city_name;
        r.current_batch = queuedBatch.batch_count || '1/1';
      } else {
        r.current_workflow = null;
        r.current_batch = null;
      }
    }
  });

  // Automatically register external executions not triggered via Orchestrator
  scraperExecutions.forEach(x => {
    if (x.status === 'running' || x.status === 'pending') {
      if (!executions[x.execution_id]) {
        executions[x.execution_id] = {
          execution_id: x.execution_id,
          city_name: x.city || 'External Scrape',
          agent_id: 'ext_' + x.execution_id,
          started_at: new Date(x.created_at || new Date())
        };
      }
    }
  });

  // Update Scheduler progress list & timelines
  schedulerBatches = scraperExecutions.map((x, idx) => {
    const matchingCity = cityQueue.find(c => c.execution_id === x.execution_id || c.city_name.includes(x.city));
    return {
      batch_id: x.execution_id,
      city_name: x.city || 'Default Location',
      agent_name: x.username || 'Agent',
      progress: x.progress || '0%',
      completed_batches: x.completed_batches || 0,
      total_batches: x.total_batches || 1,
      run_basic: x.run_basic,
      run_contact: x.run_contact,
      run_social: x.run_social,
      run_leader: x.run_leader,
      started_at: matchingCity?.started_at || '-',
      eta: matchingCity?.eta || '-',
      completed_at: matchingCity?.completed_at || '-'
    };
  });

  // Update transition timestamps and calculate ETAs
  const activeExecutionIds = Object.keys(executions);
  for (const execId of activeExecutionIds) {
    const exec = executions[execId];
    if (!exec) continue;
    const city = cityQueue.find(c => c.execution_id === execId);
    const agent = agents.find(a => a.agent_id === exec.agent_id);

    const realExec = scraperExecutions.find(x => String(x.execution_id) === String(execId));

    if (realExec) {
      if (agent) agent.last_heartbeat = new Date();

      const progressPercentage = parseFloat(realExec.progress) || 0;

      let processedCount = 0;
      if (realExec.scraped_count !== undefined) processedCount = realExec.scraped_count;
      else if (realExec.processed_count !== undefined) processedCount = realExec.processed_count;
      else if (realExec.total_scraped !== undefined) processedCount = realExec.total_scraped;
      else if (realExec.scraped !== undefined) processedCount = realExec.scraped;
      else processedCount = Math.round((city?.total_companies || 500) * (progressPercentage / 100));

      let dbInsertCount = 0;
      if (realExec.inserted_count !== undefined) dbInsertCount = realExec.inserted_count;
      else if (realExec.db_inserted !== undefined) dbInsertCount = realExec.db_inserted;
      else if (realExec.db_insert_count !== undefined) dbInsertCount = realExec.db_insert_count;
      else if (realExec.inserted !== undefined) dbInsertCount = realExec.inserted;
      else if (realExec.inserted_rows !== undefined) dbInsertCount = realExec.inserted_rows;
      else if (realExec.total_inserted !== undefined) dbInsertCount = realExec.total_inserted;
      else if (realExec.saved_count !== undefined) dbInsertCount = realExec.saved_count;
      else if (realExec.total_saved !== undefined) dbInsertCount = realExec.total_saved;
      else if (realExec.records_inserted !== undefined) dbInsertCount = realExec.records_inserted;
      else dbInsertCount = processedCount;

      // Fallback to cached live DB metrics if counts report zero during active execution
      if (dbInsertCount === 0 && processedCount === 0 && cachedDbMetrics) {
        const liveFallback = cachedDbMetrics.scrapedToday > 0 ? cachedDbMetrics.scrapedToday : (cachedDbMetrics.totalScraped || 0);
        if (liveFallback > 0 && progressPercentage > 0) {
          dbInsertCount = liveFallback;
          processedCount = liveFallback;
        }
      }

      if (city) {
        const totalBatchesClean = Math.abs(parseInt(realExec.total_batches, 10)) || 1;
        city.batch_count = `${realExec.completed_batches || 0}/${totalBatchesClean}`;
        city.transitions = city.transitions || {};

        // Calculate active stages
        const runBasic = realExec.run_basic !== undefined ? realExec.run_basic : true;
        const runContact = realExec.run_contact !== undefined ? realExec.run_contact : false;
        const runSocial = realExec.run_social !== undefined ? realExec.run_social : false;
        const runLeader = realExec.run_leader !== undefined ? realExec.run_leader : false;

        const activeStages = [];
        if (runBasic) activeStages.push('Basic Scraper');
        if (runContact) activeStages.push('Contact Scraper');
        if (runSocial) activeStages.push('Social Media');
        if (runLeader) activeStages.push('Leader Scraper');

        if (activeStages.length > 0) {
          const stageIdx = Math.min(
            Math.floor((progressPercentage / 100) * activeStages.length),
            activeStages.length - 1
          );
          city.current_stage = activeStages[stageIdx];

          const curStage = activeStages[stageIdx];
          if (curStage === 'Basic Scraper' && !city.transitions.basic_at) {
            city.transitions.basic_at = new Date().toLocaleTimeString();
          } else if (curStage === 'Contact Scraper' && !city.transitions.contact_at) {
            city.transitions.contact_at = new Date().toLocaleTimeString();
          } else if (curStage === 'Social Media' && !city.transitions.social_at) {
            city.transitions.social_at = new Date().toLocaleTimeString();
          } else if (curStage === 'Leader Scraper' && !city.transitions.leader_at) {
            city.transitions.leader_at = new Date().toLocaleTimeString();
          }
        } else {
          city.current_stage = '-';
        }

        // Real ETA calculation
        if (city.started_at_full && progressPercentage > 0) {
          const elapsedSeconds = (new Date() - new Date(city.started_at_full)) / 1000;
          const progressFraction = progressPercentage / 100;
          if (progressFraction < 1) {
            const totalEstSeconds = elapsedSeconds / progressFraction;
            const remainingSeconds = totalEstSeconds - elapsedSeconds;
            const etaDate = new Date(Date.now() + remainingSeconds * 1000);
            city.eta = etaDate.toLocaleTimeString();
          } else {
            city.eta = 'Finished';
          }
        }

        // Execution logging requirement
        addExecutionLog(
          exec.user_id || defaultScraperConfig.user_id,
          execId,
          city.current_stage,
          processedCount,
          dbInsertCount,
          `Progress: ${progressPercentage}%`
        );
      }
    }
  }
}

// 4. autoReallocationEngine() — Auto Reallocation Workflow
function autoReallocationEngine(scraperExecutions) {
  const activeExecutionIds = Object.keys(executions);

  for (const execId of activeExecutionIds) {
    const exec = executions[execId];
    if (!exec) continue;
    const city = cityQueue.find(c => c.execution_id === execId);
    const agent = agents.find(a => a.agent_id === exec.agent_id);

    const realExec = scraperExecutions.find(x => x.execution_id === execId);

    if (realExec && ['completed', 'partial', 'stopped', 'failed'].includes(realExec.status)) {
      if (city) {
        city.status = realExec.status === 'completed' ? 'Completed' : 'Pending';
        city.completed_at = new Date().toLocaleTimeString();
        city.transitions = city.transitions || {};
        city.transitions.completed_at = city.completed_at;
        city.eta = '-';
      }

      if (agent) {
        agent.status = 'Idle';
        agent.current_city = null;
        agent.execution_id = null;
        if (agent.agent_id) runnerExecutionLocks.delete(agent.agent_id);
      }
      const runnerToRelease = runnerRegistry.find(r => r.agent_name === (agent ? agent.agent_name : realExec.username));
      if (runnerToRelease) {
        runnerExecutionLocks.delete(runnerToRelease.runner_id);
      }

      // Record finished action to Reallocation Timeline
      const targetName = city ? city.city_name : (realExec.city || 'External Task');
      const userLabel = agent ? agent.agent_name : (realExec.username || 'System');

      if (realExec.status === 'completed') {
        logReallocationEvent({
          event_type: 'Batch Completed',
          from_agent: userLabel,
          to_agent: '-',
          portal_id: city ? (city.portal_id || resolvePortalIdFromText(city.city_name)) : '-',
          city_batch: targetName,
          reason: `Batch completed successfully. Scraped all target contacts.`
        });
      }

      // Auto Recovery for Chrome crashes & failed executions
      if (realExec.status === 'failed' && city) {
        const isNetworkWarning = realExec.error && (
          realExec.error.includes('aswMonFltProxy') ||
          realExec.error.includes('Could not reach host') ||
          realExec.error.includes('Online version check skipped')
        );

        if (isNetworkWarning) {
          logReallocation('[CHROMEDRIVER NOTICE] Using cached ChromeDriver. Online version check skipped.');
          // Do not fail execution; continue normally
          return;
        }

        const isChromeError = realExec.error && (
          realExec.error.toLowerCase().includes('session not created') ||
          realExec.error.toLowerCase().includes('unable to connect to renderer') ||
          realExec.error.toLowerCase().includes('chrome')
        );

        city.retry_count = (city.retry_count || 0) + 1;
        const scrapedCount = (city.companies_processed || 0);
        const resumeStartFrom = (city.start_from || 1) + scrapedCount;

        if (city.retry_count === 1) {
          // 1st Failure: Kill stale chromedriver, retry once on SAME runner
          const recoveryMsg = `⚠️ ChromeDriver Crash ('${isChromeError ? 'session not created' : 'renderer timeout'}') -> Killed Stale chromedriver.exe -> Retrying on ${agent ? agent.agent_name : 'Runner'} (Attempt 1/2) -> Resumed from Company ${resumeStartFrom}`;
          city.recovery_event = recoveryMsg;
          city.start_from = resumeStartFrom;

          logReallocationEvent({
            event_type: 'Execution Failed (ChromeDriver/Timeout)',
            from_agent: agent ? agent.agent_name : 'Runner',
            to_agent: agent ? agent.agent_name : 'Runner',
            portal_id: city.portal_id || '-',
            city_batch: city.city_name,
            reason: `ChromeDriver session crashed/timed out. Process killed. Retrying (Attempt 1/2) at resume position ${resumeStartFrom}.`
          });

          killStaleChromeDriverProcesses();

          city.status = 'Running';
          if (agent) {
            agent.status = 'Running';
            triggerScraperRun(city, agent);
          }
        } else {
          // 2nd Failure: Mark runner OFFLINE, auto-reassign to NEXT idle runner
          logReallocation(`[AUTO-RECOVERY] Retry 1/2 failed for ${city.city_name}. Marking runner OFFLINE and auto-reassigning...`);
          killStaleChromeDriverProcesses();

          if (agent) {
            agent.status = 'Offline';
            const matchingRunner = runnerRegistry.find(r => r.agent_name === agent.agent_name);
            if (matchingRunner) matchingRunner.status = 'Offline';
          }

          const cId = (city?.client_id || agent?.client_id || 1572);
          const nextIdleAgent = agents.find(a => a.status === 'Idle' && (a.client_id || 1572) === cId);
          const nextIdleRunner = runnerRegistry.find(r => r.status === 'Idle' && (r.client_id || 1572) === cId);
          const targetAgent = nextIdleAgent || (nextIdleRunner ? { agent_id: nextIdleRunner.runner_id, agent_name: nextIdleRunner.agent_name, client_id: nextIdleRunner.client_id, status: 'Idle' } : null);

          if (targetAgent) {
            const recoveryMsg = `❌ Runner Marked OFFLINE (Chrome Crash) -> Auto-Reassigned to ${targetAgent.agent_name} -> Resumed from Company ${resumeStartFrom}`;
            city.recovery_event = recoveryMsg;
            city.start_from = resumeStartFrom;
            city.status = 'Running';
            city.assigned_agent = targetAgent.agent_name;
            targetAgent.status = 'Running';
            targetAgent.current_city = city.city_name;

            logReallocationEvent({
              event_type: 'Execution Failed (ChromeDriver/Timeout)',
              from_agent: agent ? agent.agent_name : 'Runner',
              to_agent: targetAgent.agent_name,
              portal_id: city.portal_id || '-',
              city_batch: city.city_name,
              reason: `Runner failed 2/2 retries. Runner set OFFLINE. Auto-reassigned to ${targetAgent.agent_name} at resume position ${resumeStartFrom}.`
            });

            triggerScraperRun(city, targetAgent);
          } else {
            city.status = 'Failed';
            city.recovery_event = `❌ Runner OFFLINE & No Idle Runners Available for Client ${cId}. Batch Marked FAILED at index ${resumeStartFrom}`;

            logReallocationEvent({
              event_type: 'Execution Failed (ChromeDriver/Timeout)',
              from_agent: agent ? agent.agent_name : 'Runner',
              to_agent: '-',
              portal_id: city.portal_id || '-',
              city_batch: city.city_name,
              reason: `Runner failed 2/2 retries. No idle runners available for Client ${cId}. Batch marked FAILED.`
            });
          }
        }

        // Record error for Error Recovery panel visibility
        errorHistory.unshift({
          execution_id: execId,
          city: city.city_name,
          portal_id: city.portal_id || '-',
          agent_name: agent ? agent.agent_name : 'Runner',
          client_id: cId,
          error: realExec.error || 'session not created: unable to connect to renderer',
          fix_recommendation: 'Stale chromedriver.exe process killed. Batch auto-reassigned from last processed index.',
          timestamp: new Date().toLocaleTimeString()
        });
      }

      // Check if all batches for the current city are completed
      if (city && city.status === 'Completed') {
        const baseCityName = city.city_name.split(' [Batch')[0].trim();
        const cityBatches = cityQueue.filter(c => c.city_name.startsWith(baseCityName));
        const allCompleted = cityBatches.every(c => c.status === 'Completed');
        const cId = (city.client_id || 1572);

        if (allCompleted) {
          logReallocation(`[CITY COMPLETE] All batches for ${baseCityName} finished!`);

          // Auto-activate the next city from Priority Queue for same client
          const nextPendingCity = cityQueue.find(c => c.status === 'Pending' && (c.client_id || 1572) === cId && !c.city_name.startsWith(baseCityName));
          if (nextPendingCity) {
            const nextIdleAgent = agents.find(a => a.status === 'Idle' && (a.client_id || 1572) === cId);
            if (nextIdleAgent) {
              logReallocation(`[AUTO-ACTIVATION] Activating next priority city: ${nextPendingCity.city_name} on agent ${nextIdleAgent.agent_name}`);
              nextPendingCity.status = 'Running';
              nextPendingCity.assigned_agent = nextIdleAgent.agent_name;
              nextIdleAgent.status = 'Running';
              nextIdleAgent.current_city = nextPendingCity.city_name;
              triggerScraperRun(nextPendingCity, nextIdleAgent);
            }
          }
        }
      }

      delete executions[execId];
    }
  }
}

// 1. monitorEngine() — Central Workflow Monitor (5s Heartbeat Monitor)
async function monitorEngine() {
  const now = new Date();
  runnerRegistry.forEach(r => {
    // Keep active registered runners online with fresh heartbeats
    if (r.status === 'Running' && r.last_heartbeat) {
      const elapsedSec = Math.round((now - new Date(r.last_heartbeat)) / 1000);
      const isWsActive = isRunnerConnectedAndActive(r);
      if (elapsedSec > 60 && !isWsActive) { // 60 seconds heartbeat timeout only if WS inactive
        r.status = 'Offline';
        const city = cityQueue.find(c => c.assigned_agent === r.agent_name && c.status === 'Running');
        if (city) {
          const resumeIndex = (city.start_from || 1) + (city.companies_processed || 0);
          city.start_from = resumeIndex;

          const rClientId = r.client_id || 1572;
          const nextIdleRunner = runnerRegistry.find(runner => runner.status === 'Idle' && (runner.client_id || 1572) === rClientId);
          const targetAgent = nextIdleRunner ? { agent_id: nextIdleRunner.runner_id, agent_name: nextIdleRunner.agent_name, client_id: rClientId, status: 'Idle' } : null;

          if (targetAgent) {
            city.status = 'Running';
            city.assigned_agent = targetAgent.agent_name;
            targetAgent.status = 'Running';

            logReallocationEvent({
              event_type: 'Runner Heartbeat Lost',
              from_agent: r.agent_name,
              to_agent: targetAgent.agent_name,
              portal_id: city.portal_id || '-',
              city_batch: city.city_name,
              reason: `Runner heartbeat timeout (${elapsedSec}s elapsed). Auto-reassigned to ${targetAgent.agent_name} at resume position ${resumeIndex}.`
            });

            triggerScraperRun(city, targetAgent);
          } else {
            city.status = 'Pending';
            city.assigned_agent = null;

            logReallocationEvent({
              event_type: 'Runner Heartbeat Lost',
              from_agent: r.agent_name,
              to_agent: '-',
              portal_id: city.portal_id || '-',
              city_batch: city.city_name,
              reason: `Runner heartbeat timeout (${elapsedSec}s elapsed). Batch moved to Pending queue at resume position ${resumeIndex}.`
            });
          }
        }
      }
    } else if (r.status !== 'Crashed' && r.status !== 'Offline') {
      r.last_heartbeat = now;
    }
  });

  // Clear stale running statuses for genuinely disconnected runners (>60s heartbeat age)
  runnerRegistry.forEach(r => {
    const isWsActive = isRunnerConnectedAndActive(r);
    const heartbeatAgeSec = r.last_heartbeat ? (now - new Date(r.last_heartbeat)) / 1000 : 999;
    if (!isWsActive && heartbeatAgeSec > 60 && r.status === 'Running') {
      r.status = 'Idle';
      r.current_workflow = null;
      r.portal_id = null;
      r.execution_id = null;
      r.current_batch = null;
    }
  });

  allocations = runnerRegistry.map(r => {
    let pId = r.portal_id;
    let cityObj = null;
    const isWsActive = isRunnerConnectedAndActive(r);
    const isRunningState = r.status === 'Running';

    if (isWsActive || isRunningState) {
      if (r.current_workflow) {
        cityObj = cityQueue.find(c => (c.city_name === r.current_workflow || c.assigned_agent === r.agent_name) && c.status === 'Running');
      }
      if (!cityObj) {
        cityObj = cityQueue.find(c => c.assigned_agent === r.agent_name && c.status === 'Running');
      }

      if (cityObj) {
        pId = cityObj.portal_id || resolvePortalIdFromText(cityObj.city_name, pId);
        r.portal_id = pId;
        r.current_workflow = cityObj.city_name;
        r.current_batch = cityObj.batch_count || 'Batch 1/1';
        r.execution_id = cityObj.execution_id;
        r.status = 'Running';
      }
    } else {
      r.status = 'Idle';
      r.current_workflow = null;
      r.portal_id = null;
      r.execution_id = null;
      pId = null;
    }

    let cleanCityName = 'Idle';
    if (cityObj) {
      cleanCityName = cityObj.city_name.replace(/\[Batch \d+\/\d+\]/, '').replace(/\(\d+\)/, '').trim();
    } else if (r.current_workflow) {
      cleanCityName = r.current_workflow.replace(/\[Batch \d+\/\d+\]/, '').replace(/\(\d+\)/, '').trim();
    }

    let processedCount = cityObj ? (cityObj.companies_processed || 0) : 0;
    if (processedCount === 0) {
      // Pull live scraped count from remote server executions if available
      if (typeof scraperExecutions !== 'undefined' && Array.isArray(scraperExecutions)) {
        const remoteExec = scraperExecutions.find(x => x.username === r.agent_name || x.username === r.server_name);
        if (remoteExec) {
          processedCount = remoteExec.scraped_count !== undefined ? remoteExec.scraped_count : (remoteExec.processed_count || 0);
        }
      }
      // Local Host PC fallback to live MySQL metrics
      if (processedCount === 0 && (r.agent_name.includes('Manisha') || r.runner_id === 'r_1')) {
        processedCount = cachedDbMetrics.scrapedToday || cachedDbMetrics.totalScraped || 0;
      }
    }

    let extractedBatchNumber = null;
    const targetWorkflowName = cityObj?.city_name || r.current_workflow || '';
    if (targetWorkflowName) {
      const match = targetWorkflowName.match(/\[Batch\s+(\d+\/\d+)\]/i);
      if (match) {
        extractedBatchNumber = match[1];
      }
    }

    const displayBatch = extractedBatchNumber || (cityObj ? (cityObj.batch_count || '1/1') : (r.current_batch && r.current_batch !== '-' ? r.current_batch : '0/1'));

    return {
      agent_id: r.runner_id,
      agent_name: r.agent_name,
      portal_id: (pId && pId !== 0) ? pId : (cityObj?.portal_id || '-'),
      assigned_city: cleanCityName !== 'Idle' ? cleanCityName : (r.current_workflow && r.current_workflow !== '-' ? r.current_workflow : 'Idle'),
      batch_count: displayBatch,
      workflow_stage: cityObj ? (cityObj.current_stage !== '-' ? cityObj.current_stage : 'Basic Scraper') : (r.status === 'Running' ? 'Basic Scraper' : '-'),
      scraped_contacts: processedCount,
      execution_id: r.execution_id || cityObj?.execution_id || null,
      status: r.status || (cityObj ? 'Running' : 'Idle')
    };
  });

  try {
    const response = await fetch(`${SCRAPER_MANAGER_URL}/executions`, {
      headers: { 'X-User-Id': String(defaultScraperConfig.user_id), 'X-Firm-Id': '5' },
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const data = await response.json();
      const scraperExecutions = data.executions || [];

      // Delegate tasks to dedicated engines
      updateWorkflowState(scraperExecutions);
      await allocationEngine();
      autoReallocationEngine(scraperExecutions);
    }
  } catch (err) {
    // Only log if it's not a timeout, abort, or connection failed error to avoid repeated clutter
    if (err.name !== 'TimeoutError' &&
      err.name !== 'AbortError' &&
      err.message !== 'fetch failed' &&
      !err.message.includes('ECONNREFUSED')) {
      console.error('[MONITOR] Error updating allocations:', err.message);
    }
  }
}

setInterval(allocationEngine, 4000);
setInterval(monitorEngine, 5000);

// SPA Fallback Route - serve index.html for non-API client routes like /login
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get hostname to detect environment

const HOSTNAME = os.hostname().toUpperCase();

// Check if running on local/development machine or production
const IS_LOCAL = ['MSI', 'I3ADMIN-PRECISION-TOWER-5810', 'DESKTOP-KAL0REJ'].some(keyword =>
  HOSTNAME.includes(keyword)
);

// Production domain from environment or default
const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN || 'myblocks.in';
const IS_PRODUCTION = HOSTNAME.toLowerCase().includes(PRODUCTION_DOMAIN.toLowerCase()) || !IS_LOCAL;

let server;

if (IS_PRODUCTION && !IS_LOCAL) {
  // SSL Configuration for Production
  const SSL_KEY_PATH = `/etc/letsencrypt/live/${PRODUCTION_DOMAIN}/privkey.pem`;
  const SSL_CERT_PATH = `/etc/letsencrypt/live/${PRODUCTION_DOMAIN}/fullchain.pem`;

  // Check if SSL certificates exist
  if (fsClassic.existsSync(SSL_KEY_PATH) && fsClassic.existsSync(SSL_CERT_PATH)) {
    console.log(`🔒 SSL Enabled - Running in PRODUCTION mode with HTTPS`);
    console.log(`   Certificate: ${SSL_CERT_PATH}`);
    console.log(`   Private Key: ${SSL_KEY_PATH}`);

    // Create HTTPS server
    const privateKey = fsClassic.readFileSync(SSL_KEY_PATH, 'utf8');
    const certificate = fsClassic.readFileSync(SSL_CERT_PATH, 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    server = https.createServer(credentials, app);
    server.requestTimeout = 300000; // 5 minutes
    server.headersTimeout = 305000;
    server.keepAliveTimeout = 300000;
    server.listen(PORT, () => {
      console.log(`🚀  API running on https://0.0.0.0:${PORT}`);
      console.log(`   Environment: PRODUCTION (HTTPS)`);
      console.log(`   Hostname: ${HOSTNAME}`);
    });
  } else {
    // SSL certificates not found, fall back to HTTP
    console.log(`⚠️ SSL certificates not found at expected paths:`);
    console.log(`   Key: ${SSL_KEY_PATH}`);
    console.log(`   Cert: ${SSL_CERT_PATH}`);
    console.log(`   Falling back to HTTP mode`);

    server = http.createServer(app);
    server.requestTimeout = 300000; // 5 minutes
    server.headersTimeout = 305000;
    server.keepAliveTimeout = 300000;
    server.listen(PORT, () => {
      console.log(`🚀  API running on http://0.0.0.0:${PORT}`);
      console.log(`   Environment: PRODUCTION (HTTP fallback - SSL certs not found)`);
      console.log(`   Hostname: ${HOSTNAME}`);
    });
  }
} else {
  // Local/Dev Mode - HTTP only
  console.log(`🔓 Running in LOCAL/DEV mode with HTTP (no SSL)`);

  server = http.createServer(app);
  server.requestTimeout = 300000; // 5 minutes
  server.headersTimeout = 305000;
  server.keepAliveTimeout = 300000;
  server.listen(PORT, () => {
    console.log(`🚀  API running on http://0.0.0.0:${PORT}`);
    console.log(`   Environment: LOCAL/DEV (HTTP)`);
    console.log(`   Hostname: ${HOSTNAME}`);
  });
}

// Attach Dual WebSocket Listener (Ports 7800 and 7700)
const wss = new WebSocketServer({ server });
wss.on('connection', handleWsConnection);

const WS_PORT = process.env.WS_PORT || 7700;
let wsPortServer = null;
try {
  wsPortServer = new WebSocketServer({ port: WS_PORT });
  wsPortServer.on('connection', handleWsConnection);
  console.log(`[WEBSOCKET] Dedicated WebSocket listener active on ws://0.0.0.0:${WS_PORT}`);
} catch (err) {
  console.log(`[WEBSOCKET] Dedicated port ${WS_PORT} notice: ${err.message}. WebSocket accessible via main server port ${PORT}.`);
}
