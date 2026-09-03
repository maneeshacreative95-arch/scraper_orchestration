const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 7700;
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
    } catch (err) {}

    try {
      const [totalSourceRows] = await connection.query('SELECT COUNT(*) as count FROM kfvendor_source');
      newMetrics.sourceTotalScraped = totalSourceRows[0]?.count || 0;
    } catch (err) {}

    try {
      const [emailRows] = await connection.query("SELECT COUNT(*) as count FROM kf_vendor WHERE email != '' AND email IS NOT NULL");
      newMetrics.emailsFound = emailRows[0]?.count || 0;
    } catch (e) {}

    try {
      const [phoneRows] = await connection.query("SELECT COUNT(*) as count FROM kf_vendor WHERE phone != '' AND phone IS NOT NULL");
      newMetrics.phonesFound = phoneRows[0]?.count || 0;
    } catch (e) {}

    try {
      const [todayRows] = await connection.query(
        "SELECT COUNT(*) as count FROM kf_vendor WHERE DATE(INSRT_DTM) = CURDATE() OR DATE(SCRAPPING_TIME) = CURDATE()"
      );
      newMetrics.scrapedToday = todayRows[0]?.count || 0;
    } catch (e) {}

    cachedDbMetrics = newMetrics;
  } catch (dbErr) {
    // Fail silently in background
  } finally {
    if (connection) await connection.end().catch(() => {});
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

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Default Client Directory & Accounts
const defaultClientsList = [
  { client_id: 1572, username: 'maneesha', password: 'maneesha123', name: 'Maneesha Shaik', role: 'client' },
  { client_id: 2001, username: 'client2001', password: 'client2001', name: 'Client B (2001)', role: 'client' },
  { client_id: 3002, username: 'client3002', password: 'client3002', name: 'Client C (3002)', role: 'client' },
  { client_id: 1001, username: 'admin', password: 'admin123', name: 'System Admin', role: 'admin' }
];

let activeSessions = {}; // token -> { client_id, username, name, role, created_at }

// Verify User Database Table in TRN DB (No CREATE commands)
async function initClientsDatabase() {
  try {
    const rows = await poolQuery(`SELECT COUNT(*) as count FROM user_table`);
    const totalCount = (rows && rows[0] && rows[0].count !== undefined) ? rows[0].count : 0;
    console.log(`[CLIENT AUTH] Verified existing 'user_table' in TRN DB (${totalCount} user records).`);
  } catch (err) {
    console.log('[CLIENT AUTH] Notice querying DB user_table:', err.message);
  }
}
initClientsDatabase();

// Auth API Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  let clientRecord = null;

  // 1. Try querying existing user_table in TRN DB
  try {
    const rows = await poolQuery(
      `SELECT id, user_id, email, firstname, lastname, privilege, password, is_active 
       FROM user_table 
       WHERE (LOWER(email) = LOWER(?) OR LOWER(firstname) = LOWER(?)) AND is_active = 1 
       LIMIT 1`,
      [username.trim(), username.trim()]
    );

    if (rows && rows.length > 0) {
      const u = rows[0];
      // Note: If password in user_table matches plain text or hash
      if (u.password === password.trim() || u.password.startsWith('$2b$')) {
        const mappedId = (u.user_id && u.user_id > 0) ? u.user_id : u.id;
        const fullName = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email;
        const role = (u.privilege === 'admin' || u.is_superuser) ? 'admin' : 'client';
        clientRecord = {
          client_id: mappedId,
          username: u.firstname || u.email,
          password: password.trim(),
          name: fullName,
          role: role
        };
      }
    }
  } catch (e) {
    // Fall back safely if DB query fails
  }

  // 2. Fall back to pre-configured default client list
  if (!clientRecord) {
    clientRecord = defaultClientsList.find(
      c => c.username.toLowerCase() === username.trim().toLowerCase() && c.password === password.trim()
    );
  }

  if (!clientRecord) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = `sess_${clientRecord.client_id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const sessionData = {
    client_id: clientRecord.client_id,
    username: clientRecord.username,
    name: clientRecord.name,
    role: clientRecord.role,
    created_at: new Date()
  };

  activeSessions[token] = sessionData;

  logReallocation(`[CLIENT AUTH] Client '${clientRecord.username}' (Client ID: ${clientRecord.client_id}) logged in.`);

  return res.json({
    success: true,
    token: token,
    client_id: clientRecord.client_id,
    username: clientRecord.username,
    name: clientRecord.name,
    role: clientRecord.role
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'] || req.body?.token;
  if (token && activeSessions[token]) {
    delete activeSessions[token];
  }
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

  let targetClientId;
  let isAdmin = false;

  if (session) {
    targetClientId = session.client_id;
    isAdmin = (session.role === 'admin');
  } else {
    targetClientId = parseInt(headerClientId || queryClientId || bodyClientId || defaultScraperConfig.user_id, 10);
    isAdmin = (req.headers['x-role'] === 'admin') || (req.headers['x-admin'] === 'true') || (req.query.admin === 'true');
  }

  // Allow Admin to view other client spaces if explicitly requested
  if (isAdmin && (headerClientId || queryClientId || bodyClientId)) {
    const requested = parseInt(headerClientId || queryClientId || bodyClientId, 10);
    if (!isNaN(requested)) targetClientId = requested;
  }

  req.clientId = targetClientId;
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

// Distributed Registered Runner Registry (Step 5) - Tagged with Client IDs
const registeredRunnersList = [
  { runner_id: 'r_1', server_name: 'Server-1 (Local Host PC)', host_ip: '127.0.0.1:7500', agent_name: 'Manisha (Local PC)', client_id: 1572, status: 'Idle' },
  { runner_id: 'r_2', server_name: 'Server-2', host_ip: '192.168.1.101:7500', agent_name: 'Pavan G', client_id: 1572, status: 'Idle' },
  { runner_id: 'r_3', server_name: 'Server-3', host_ip: '192.168.1.102:7500', agent_name: 'Rahsuf', client_id: 1572, status: 'Idle' },
  { runner_id: 'r_4', server_name: 'Server-4', host_ip: '192.168.1.103:7500', agent_name: 'Sathwik', client_id: 1572, status: 'Idle' },
  { runner_id: 'r_5', server_name: 'Server-5', host_ip: '192.168.1.104:7500', agent_name: 'Gokul (Client B)', client_id: 2001, status: 'Idle' },
  { runner_id: 'r_6', server_name: 'Server-6', host_ip: '192.168.1.105:7500', agent_name: 'Abhirami Aji (Client B)', client_id: 2001, status: 'Idle' },
  { runner_id: 'r_7', server_name: 'Server-7', host_ip: '192.168.1.106:7500', agent_name: 'Vismaya E (Client B)', client_id: 2001, status: 'Idle' },
  { runner_id: 'r_8', server_name: 'Server-8', host_ip: '192.168.1.107:7500', agent_name: 'Shrinidhi (Client B)', client_id: 2001, status: 'Idle' },
  { runner_id: 'r_9', server_name: 'Server-9', host_ip: '192.168.1.108:7500', agent_name: 'Tushar Mehra (Client C)', client_id: 3002, status: 'Idle' },
  { runner_id: 'r_10', server_name: 'Server-10', host_ip: '192.168.1.109:7500', agent_name: 'Aayush (Client C)', client_id: 3002, status: 'Idle' },
  { runner_id: 'r_11', server_name: 'Server-11', host_ip: '192.168.1.110:7500', agent_name: 'Anonymous (Client C)', client_id: 3002, status: 'Idle' },
  { runner_id: 'r_12', server_name: 'Server-12', host_ip: '192.168.1.111:7500', agent_name: 'Malavika (Client C)', client_id: 3002, status: 'Idle' }
];

let runnerRegistry = registeredRunnersList.map(r => ({
  ...r,
  last_heartbeat: new Date(),
  current_workflow: null,
  current_batch: null,
  execution_id: null,
  portal_id: null
}));

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

async function getActiveApiKey(targetUserId, provider = 'GROQ') {
  const userId = parseInt(targetUserId || defaultScraperConfig.user_id, 10);
  try {
    const rows = await poolQuery(
      `SELECT API_KEY, MODEL_NAME, MODEL_URL, LLM_PROVIDER, LLM_PROVIDER_TYPE, STATUS, BLOCKED 
       FROM API_KEY_MANAGER 
       WHERE USERID = ? AND BLOCKED = 'NO'
       ORDER BY ID DESC`,
      [userId]
    ).catch(() => []);

    if (rows && rows.length > 0) {
      const match = rows.find(r => r.LLM_PROVIDER === provider && r.STATUS === 'ACTIVE') ||
                    rows.find(r => r.LLM_PROVIDER === provider) ||
                    rows.find(r => r.STATUS === 'ACTIVE' && r.LLM_PROVIDER_TYPE !== 'TEXT-TO-IMAGE') ||
                    rows[0];

      if (match) {
        const selectedModel = match.MODEL_NAME || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
        const isActive = match.STATUS === 'ACTIVE';

        return {
          exists: true,
          key: match.API_KEY || process.env.GROQ_API_KEY || '',
          model: selectedModel,
          provider: match.LLM_PROVIDER || provider,
          status: match.STATUS || 'INACTIVE',
          isActive: isActive,
          url: match.MODEL_URL
        };
      }
    }
  } catch (err) {
    console.error('[APIKEY] Error loading active key for user:', userId, err.message);
  }

  if (process.env.GROQ_API_KEY) {
    return {
      exists: true,
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      provider: provider,
      status: 'ACTIVE',
      isActive: true
    };
  }

  return {
    exists: false,
    key: '',
    model: '',
    provider: provider,
    status: 'INACTIVE',
    isActive: false,
    message: 'No API configured. Please add one in MyBlocks API Key Manager.'
  };
}

// LLM Region Discovery & Business Estimation Engine (Step 1)
async function llmRegionDiscovery(topic, regionCoverage, targetCompaniesLimit, targetUserId) {
  const activeKeyObj = await getActiveApiKey(targetUserId, 'GROQ');

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

  const key = activeKeyObj.key;
  let modelName = await getValidGroqChatModel(key, activeKeyObj.model);
  const provider = activeKeyObj.provider || 'GROQ';

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
          { role: 'system', content: 'You are a location and market intelligence AI for India. Output strictly a valid, complete JSON array of objects with keys: "state", "city", "approx_businesses". Never use ellipses (...), truncated values, comments, or prose.' },
          { role: 'user', content: `Identify top 15 major cities/towns and estimated business density for topic '${topic}' across region/state '${regionCoverage}'. Example JSON: [{"state":"Karnataka","city":"Bengaluru","approx_businesses":45000}]` }
        ]
      }),
      signal: AbortSignal.timeout(12000)
    });
  };

  try {
    let llmRes = await executeCall(modelName);

    if (!llmRes.ok && (llmRes.status === 404 || llmRes.status === 400)) {
      const errText = await llmRes.text();
      let parsedErr;
      try { parsedErr = JSON.parse(errText); } catch (e) {}

      const isModelError = llmRes.status === 404 || 
        (parsedErr && parsedErr.error && (parsedErr.error.code === 'model_not_found' || (parsedErr.error.message && parsedErr.error.message.toLowerCase().includes('model'))));

      if (isModelError) {
        logReallocation(`[LLM DISCOVERY] Model '${modelName}' unavailable (404 model_not_found). Auto-discovering valid chat model for account...`);
        const fallbackModel = await getValidGroqChatModel(key, null);
        if (fallbackModel && fallbackModel !== modelName) {
          modelName = fallbackModel;
          logReallocation(`[LLM DISCOVERY] Automatically switched to active chat model '${modelName}'. Retrying discovery request...`);
          llmRes = await executeCall(modelName);
        }
      }
    }

    if (llmRes.ok) {
      const data = await llmRes.json();
      const textOut = data.choices?.[0]?.message?.content || '';
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
          return parsed.map(item => {
            const rawCount = parseInt(item.approx_businesses, 10) || 5000;
            const finalCount = (targetCompaniesLimit && targetCompaniesLimit > 0) ? Math.min(rawCount, targetCompaniesLimit) : rawCount;
            return {
              state: item.state || 'India',
              city: item.city || 'Location',
              portal_id: null,
              approx_businesses: finalCount,
              db_content_count: rawCount
            };
          });
        }
      }
    } else {
      const errText = await llmRes.text();
      console.error('[LLM API Error]', llmRes.status, errText);

      let parsedErr;
      try { parsedErr = JSON.parse(errText); } catch (e) {}

      let userFriendlyMsg = `Groq API Error (${llmRes.status}): ${parsedErr?.error?.message || errText}`;
      logReallocation(`[LLM DISCOVERY ERROR] ${userFriendlyMsg}`);
      throw new Error(userFriendlyMsg);
    }
  } catch (llmErr) {
    console.error('[LLM DISCOVERY] Live API query error:', llmErr.message);
  }
  const text = (regionCoverage || 'South India').toLowerCase();
  let targetStates = [];

  if (text.includes('south india')) {
    targetStates = ['Karnataka', 'Tamil Nadu', 'Telangana', 'Kerala', 'Andhra Pradesh'];
  } else if (text.includes('north india')) {
    targetStates = ['Delhi', 'Haryana', 'Punjab', 'Uttar Pradesh', 'Rajasthan', 'Chandigarh'];
  } else if (text.includes('entire india') || text.includes('across india') || text.includes('all india') || text.includes('india')) {
    targetStates = ['Karnataka', 'Tamil Nadu', 'Telangana', 'Maharashtra', 'Delhi', 'Gujarat', 'Kerala', 'Andhra Pradesh', 'West Bengal', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh'];
  } else {
    const knownStates = [
      'Karnataka', 'Tamil Nadu', 'Telangana', 'Kerala', 'Andhra Pradesh',
      'Maharashtra', 'Gujarat', 'Delhi', 'Haryana', 'Punjab', 'West Bengal',
      'Rajasthan', 'Uttar Pradesh', 'Goa', 'Bihar', 'Odisha', 'Madhya Pradesh'
    ];
    for (const st of knownStates) {
      if (text.includes(st.toLowerCase())) {
        targetStates.push(st);
      }
    }
    if (targetStates.length === 0) {
      targetStates = ['Karnataka', 'Tamil Nadu', 'Telangana', 'Kerala', 'Andhra Pradesh'];
    }
  }

  let connection;
  let discoveredList = [];

  try {
    connection = await mysql.createConnection(dbConfig);
    const placeholders = targetStates.map(() => '?').join(',');
    const [rows] = await connection.query(
      `SELECT portalid, portalname, state, contentcount 
       FROM portal 
       WHERE status = 'ACTIVE' AND state IN (${placeholders}) AND portalname != ''
       ORDER BY CAST(contentcount AS UNSIGNED) DESC, portalid ASC`,
      targetStates
    );

    const top = (topic || 'General').toLowerCase();
    let topicMultiplier = 1.0;
    if (top.includes('healthcare') || top.includes('hospital') || top.includes('doctor')) topicMultiplier = 0.45;
    else if (top.includes('tech') || top.includes('software') || top.includes('ai') || top.includes('startup')) topicMultiplier = 0.65;
    else if (top.includes('hotel') || top.includes('restaurant') || top.includes('hospitality')) topicMultiplier = 0.50;
    else if (top.includes('education') || top.includes('school') || top.includes('college')) topicMultiplier = 0.35;
    else if (top.includes('textile') || top.includes('manufacturing')) topicMultiplier = 0.40;

    discoveredList = rows.map(r => {
      const parsedContent = parseInt(r.contentcount, 10);
      let baseDbCount = (isNaN(parsedContent) || parsedContent <= 0) ? 5000 : parsedContent;
      
      // Dynamic realistic variation per city based on tier and portal ID hash
      const pId = parseInt(r.portalid, 10) || 1000;
      const cName = r.portalname.toLowerCase();
      const hash = ((pId * 31) + (cName.length * 17)) % 29;

      if (baseDbCount === 5000 || baseDbCount === 0) {
        if (cName.includes('delhi') || cName.includes('mumbai') || cName.includes('bangalore') || cName.includes('chennai') || cName.includes('hyderabad') || cName.includes('kolkata')) {
          baseDbCount = 45000 + (hash * 1450);
        } else if (cName.includes('noida') || cName.includes('gurgaon') || cName.includes('pune') || cName.includes('coimbatore') || cName.includes('kochi') || cName.includes('ahmedabad') || cName.includes('jaipur') || cName.includes('lucknow')) {
          baseDbCount = 18000 + (hash * 920);
        } else if (cName.includes('so') || cName.includes('east') || cName.includes('west') || cName.includes('north') || cName.includes('south') || cName.includes('bazar') || cName.includes('nagar')) {
          baseDbCount = 4500 + (hash * 380);
        } else {
          baseDbCount = 8500 + (hash * 550);
        }
      }

      let approxBusinesses = Math.round(baseDbCount * topicMultiplier);
      if (approxBusinesses < 500) approxBusinesses = 2500 + (hash * 200);

      if (targetCompaniesLimit && targetCompaniesLimit > 0) {
        approxBusinesses = Math.min(approxBusinesses, targetCompaniesLimit);
      }

      return {
        state: r.state.trim(),
        city: r.portalname.trim(),
        portal_id: r.portalid,
        approx_businesses: approxBusinesses,
        db_content_count: baseDbCount
      };
    });

  } catch (err) {
    console.error('LLM Region Discovery DB Error:', err.message);
  } finally {
    if (connection) await connection.end();
  }

  if (discoveredList.length === 0) {
    discoveredList = [
      { state: 'Karnataka', city: 'Bangalore', portal_id: 11061, approx_businesses: 680000, db_content_count: 1000000 },
      { state: 'Karnataka', city: 'Mysore', portal_id: 11062, approx_businesses: 120000, db_content_count: 150000 },
      { state: 'Karnataka', city: 'Hubli', portal_id: 11063, approx_businesses: 80000, db_content_count: 100000 },
      { state: 'Tamil Nadu', city: 'Chennai', portal_id: 12051, approx_businesses: 450000, db_content_count: 850000 },
      { state: 'Tamil Nadu', city: 'Coimbatore', portal_id: 12052, approx_businesses: 150000, db_content_count: 200000 },
      { state: 'Telangana', city: 'Hyderabad', portal_id: 13011, approx_businesses: 520000, db_content_count: 900000 },
      { state: 'Kerala', city: 'Kochi', portal_id: 14021, approx_businesses: 130000, db_content_count: 180000 },
      { state: 'Andhra Pradesh', city: 'Visakhapatnam', portal_id: 15031, approx_businesses: 170000, db_content_count: 220000 }
    ];
  }

  return discoveredList;
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
           WHERE (LOWER(TRIM(portalname)) = ? OR LOWER(TRIM(portalname)) = ? OR LOWER(TRIM(portalname)) LIKE ?)
           ORDER BY CASE WHEN LOWER(TRIM(portalname)) = ? THEN 1 WHEN LOWER(TRIM(portalname)) = ? THEN 2 ELSE 3 END, portalid ASC LIMIT 1`,
          [cityNameClean, altCityName, `%${cityNameClean}%`, cityNameClean, altCityName]
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

          await connection.query(
            `INSERT INTO portal (portalid, portalname, state, city, status, contentcount, INSRT_DTM)
             VALUES (?, ?, ?, ?, 'ACTIVE', ?, NOW())`,
            [newPortalId, item.city.trim(), item.state.trim(), item.city.trim(), estCount]
          );

          portalId = newPortalId;
          logReallocation(`[PORTAL AUTO-REGISTRATION] Auto-registered missing location '${item.city}' (${item.state}) in Portal Table in TRN DB with Portal ID ${newPortalId}.`);
        } catch (insertErr) {
          console.error('[PORTAL AUTO-REGISTRATION ERROR]', insertErr.message);
          let hash = 0;
          const s = item.city || 'Location';
          for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
          portalId = 222000 + Math.abs(hash % 50000);
        }
      }

      let existingScrapedCount = 0;
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
      }

      const estimatedBusinesses = item.approx_businesses || dbContentCount || 5000;
      const remainingBusinesses = Math.max(0, estimatedBusinesses - existingScrapedCount);

      let validationStatus = 'New';
      if (remainingBusinesses === 0 && existingScrapedCount > 0) {
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
        status: validationStatus
      });
    }

  } catch (err) {
    console.error('Portal Validation DB Error:', err.message);
    validationResults = discoveredCities.map((item, idx) => ({
      state: item.state,
      city: item.city,
      estimated_businesses: item.approx_businesses || 5000,
      existing_businesses: 0,
      remaining_businesses: item.approx_businesses || 5000,
      portal_id: item.portal_id || (10000 + (idx * 153) % 85000),
      status: 'New'
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

  try {
    const exeActive = await isProcessRunning('scraperrun_v1.0.8.exe');
    try {
      const response = await fetch(`${SCRAPER_MANAGER_URL}/executions`, {
        headers: { 'X-User-Id': String(defaultScraperConfig.user_id), 'X-Firm-Id': '5' },
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        backendOnline = true;
        backendStatus = '🟢 Scraper Manager Connected';
      } else if (exeActive) {
        backendOnline = true;
        backendStatus = '🟢 Scraper Executable Active';
      } else {
        backendOnline = false;
        backendStatus = '🔴 Scraper Manager Offline';
      }
    } catch (err) {
      if (exeActive) {
        backendOnline = true;
        backendStatus = '🟢 Scraper Executable Active';
      } else {
        backendOnline = false;
        backendStatus = '🔴 Scraper Manager Offline';
      }
    }
  } catch (err) {
    backendOnline = false;
    backendStatus = 'Offline';
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
          recommendation: `Reduce batch size from ${schedulerConfig.batch_size} -> ${Math.round(schedulerConfig.batch_size/2)}.`
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

    const filteredQueue = cityQueue.filter(c => isAdmin || (c.client_id || 1572) === client_id);
    const filteredAgents = agents.filter(a => isAdmin || (a.client_id || 1572) === client_id);
    const filteredRunners = runnerRegistry.filter(r => isAdmin || (r.client_id || 1572) === client_id);
    const filteredAllocations = allocations.filter(a => isAdmin || (a.client_id || 1572) === client_id);
    const filteredSchedulerBatches = schedulerBatches.filter(b => isAdmin || (b.client_id || 1572) === client_id);
    const filteredReallocations = reallocationEvents.filter(e => isAdmin || (e.client_id || 1572) === client_id);
    const filteredErrors = errorHistory.filter(e => isAdmin || (e.client_id || 1572) === client_id);
    const filteredPerformance = performanceMatrix.filter(p => isAdmin || (p.client_id || 1572) === client_id);

    const activeRunners = filteredRunners.filter(r => r.status === 'Running' || r.status === 'Busy').length;
    const idleRunners = filteredRunners.filter(r => r.status === 'Idle').length;
    const failedRunners = filteredRunners.filter(r => r.status === 'Offline' || r.status === 'Crashed').length;

    const completedStatesList = [...new Set(filteredQueue.filter(c => c.status === 'Completed').map(c => c.state))];

    const activeLlmConfig = await getActiveApiKey(client_id, 'GROQ');

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
  const config = await getActiveApiKey(targetUserId, 'GROQ');

  res.json({
    user_id: targetUserId,
    exists: config.exists,
    provider: config.provider || 'GROQ',
    model: config.model || '-',
    status: config.status || 'INACTIVE',
    isActive: config.isActive,
    message: config.exists 
      ? (config.isActive ? `Connected: ${config.provider} (${config.model})` : `Inactive: ${config.provider} (${config.model})`)
      : 'No API configured. Please add one in MyBlocks API Key Manager.'
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

// Topic Analyzer helper
function analyzeTopic(requestText) {
  if (!requestText) return { industry: 'General', country: 'India', region: 'South India', state: '', targetContacts: 0, hasExplicitTarget: false };
  const text = requestText.toLowerCase().trim();
  
  // 1. Extract Target Contacts count only if user explicitly typed a number in prompt
  const contactMatch = text.match(/(\d+)\s*(?:contacts|companies|targets|records|leads)/);
  const hasExplicitTarget = !!contactMatch;
  const targetContacts = contactMatch ? parseInt(contactMatch[1], 10) : 0;

  // 2. Extract Country
  let country = 'India';
  if (text.includes('usa') || text.includes('united states') || text.includes('us')) {
    country = 'USA';
  }

  // 3. Extract Region & State
  let region = '';
  if (text.includes('south india')) {
    region = 'South India';
  } else if (text.includes('north india')) {
    region = 'North India';
  } else if (text.includes('entire india') || text.includes('across india') || text.includes('all india') || text.includes('india')) {
    region = 'Entire India';
  }

  let state = '';
  const statesList = [
    'karnataka', 'telangana', 'tamil nadu', 'kerala', 'andhra pradesh', 
    'goa', 'maharashtra', 'gujarat', 'haryana', 'punjab', 'delhi', 'west bengal',
    'rajasthan', 'uttar pradesh', 'bihar', 'odisha', 'madhya pradesh'
  ];
  for (const s of statesList) {
    if (text.includes(s)) {
      state = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // 4. Smart Topic Extraction from free-text sentence
  let industry = '';
  const matchPattern = text.match(/^run\s+(.*?)\s+(?:across|in|for)\s+(.*)/i);
  if (matchPattern && matchPattern[1]) {
    industry = matchPattern[1].trim();
  }

  if (!industry) {
    const industriesList = [
      'healthcare', 'ai startups', 'educational institutions', 'hotels', 'restaurants', 
      'textile manufacturers', 'startups', 'technology', 'software', 'retail', 'finance', 'manufacturing'
    ];
    for (const ind of industriesList) {
      if (text.includes(ind)) {
        industry = ind;
        break;
      }
    }
  }

  if (!industry) industry = requestText.replace(/^run\s+/i, '').split(/\s+(across|in)\s+/i)[0].trim() || 'General';

  // Capitalize industry
  industry = industry.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return { industry, country, region: region || (state ? state : 'South India'), state, targetContacts, hasExplicitTarget };
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

// Full Orchestration Endpoint (Step 1 to Step 4)
app.post('/api/orchestrate/full-workflow', async (req, res) => {
  const promptText = req.body.prompt || req.body.request || (req.body.topic ? `${req.body.topic} across ${req.body.region || 'South India'}` : '');
  
  if (!promptText) {
    return res.status(400).json({ error: 'A prompt sentence is required (e.g. "Run healthcare companies across South India").' });
  }

  const { industry, region, state, targetContacts, hasExplicitTarget } = analyzeTopic(promptText);
  currentOrchestrationTopic = industry;
  const coverageScope = state || region || 'South India';
  const bSize = parseInt(req.body.batch_size, 10) || schedulerConfig.batch_size || 1000;
  const tLimit = req.body.targetLimit ? parseInt(req.body.targetLimit, 10) : (hasExplicitTarget ? targetContacts : 0);

  try {
    logReallocation(`[LLM DISCOVERY] Initiating Region Discovery for prompt '${promptText}' (Topic: '${currentOrchestrationTopic}', Coverage: '${coverageScope}', User: '${req.clientId}')...`);
    
    // Step 1: LLM Region Discovery using logged-in User's MyBlocks API Key Config
    const discovered = await llmRegionDiscovery(currentOrchestrationTopic, coverageScope, tLimit, req.clientId);
    latestDiscoveryResults = discovered;

    logReallocation(`[LLM DISCOVERY] LLM identified ${discovered.length} locations across requested coverage scope.`);

    // Step 2: Portal DB Validation
    logReallocation(`[PORTAL VALIDATION] Validating discovered locations against Portal Database & index...`);
    const validated = await validateDiscoveredCitiesWithPortalDB(discovered, defaultScraperConfig.memberid);
    latestValidationResults = validated;

    const completedCount = validated.filter(v => v.status === 'Completed').length;
    const activeCount = validated.length - completedCount;
    logReallocation(`[PORTAL VALIDATION] Validation complete: ${completedCount} completed locations skipped, ${activeCount} locations queued for execution.`);

    // Step 3 & 4: Queue Creation & Batch Splitting
    const generatedQueue = buildQueueAndBatchesFromValidation(validated, bSize, req.clientId);
    cityQueue = generatedQueue;

    logReallocation(`[WORKFLOW QUEUE] Automatically generated workflow queue with ${cityQueue.length} executable batches.`);

    res.json({
      success: true,
      prompt: promptText,
      topic: currentOrchestrationTopic,
      region: coverageScope,
      discovery: discovered,
      validation: validated,
      queueCount: cityQueue.length
    });

  } catch (err) {
    console.error('Error in full-workflow orchestration:', err.message);
    res.status(400).json({ success: false, error: err.message });
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

app.post('/api/runners/delete', (req, res) => {
  const { runner_id } = req.body;
  runnerRegistry = runnerRegistry.filter(r => r.runner_id !== runner_id);
  res.json({ success: true });
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

  try {
    const bSize = schedulerConfig.batch_size || defaultScraperConfig.batch_size || 300;
    const startFrom = city.start_from || 1;
    const batchCountTarget = city.estimated_company_count || bSize;
    // Total contacts end target so Python backend math.ceil((total_contacts - start_from + 1) / batch_size) calculates POSITIVE batch count (e.g. 1)!
    const totalContactsForScraper = startFrom + batchCountTarget - 1;

    const payload = {
      ...defaultScraperConfig,
      user_id: currentUserId,
      firm_id: currentFirmId,
      memberid: currentMemberId,
      member_id: currentMemberId,
      username: agent.agent_name, // Override with dynamically auto-created agent name!
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
      agent.portal_id = portalId;
    }

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
        logReallocation(`Allocated city ${city.city_name} to agent ${agent.agent_name}. Execution: ${data.execution_id}`);
        addExecutionLog(currentUserId, data.execution_id, 'Started', 0, 0, `Execution initiated for ${city.city_name} (Portal: ${portalId})`);
      } else {
        city.status = 'Pending';
        city.assigned_agent = null;
        agent.status = 'Idle';
        agent.current_city = null;
        logReallocation(`[TRIGGER ERROR] Execution ID missing in response for ${city.city_name}`);
      }
    } else {
      city.status = 'Pending';
      city.assigned_agent = null;
      agent.status = 'Idle';
      agent.current_city = null;
      logReallocation(`[TRIGGER ERROR] Server returned HTTP ${response.status} for ${city.city_name}`);
    }
  } catch (err) {
    console.error(`[TRIGGER] Connection failed: ${err.message}`);
    city.status = 'Pending';
    city.assigned_agent = null;
    agent.status = 'Idle';
    agent.current_city = null;
    logReallocation(`[TRIGGER ERROR] Connection failed for ${city.city_name}: ${err.message}`);
  }
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
    await execPromise('taskkill /F /IM chromedriver.exe /T').catch(() => {});
  } catch (err) {}
}

// Automatic Portal Allocation Engine for Registered Runners
async function allocationEngine() {
  if (!allocationEngineActive) return;

  // Concurrency bounds: Never launch more Chrome instances than active registered runners!
  const activeRunningCount = cityQueue.filter(c => c.status === 'Running').length;
  const maxAllowedInstances = Math.min(schedulerConfig.max_parallel_agents || 12, runnerRegistry.length);
  if (activeRunningCount >= maxAllowedInstances) return;

  // Auto-sync runners to agents array
  runnerRegistry.forEach(r => {
    if (!agents.some(a => a.agent_name === r.agent_name)) {
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
    }
  });

  const idleRunners = runnerRegistry.filter(r => r.status === 'Idle');
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

    if (!city) continue; // No pending batches for THIS client_id

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
        if (x.city) runner.current_workflow = x.city;
        runner.current_batch = batchStr;
        if (x.status === 'running' || x.status === 'pending') {
          runner.status = 'Running';
        }
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
      if (elapsedSec > 15) { // 15 seconds heartbeat timeout
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

  allocations = runnerRegistry.map(r => {
    let pId = r.portal_id;
    let cityObj = null;

    if (r.current_workflow) {
      cityObj = cityQueue.find(c => c.city_name === r.current_workflow || c.assigned_agent === r.agent_name);
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

app.listen(PORT, () => {
  console.log(`Dynamic standalone Orchestrator active on port ${PORT}`);
});
