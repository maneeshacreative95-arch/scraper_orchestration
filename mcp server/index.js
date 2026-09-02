/**
 * MyBlocks API Key Manager — MCP Server
 * 
 * Exposes API key management capabilities as MCP tools so that any
 * MCP-compatible client (Claude Desktop, Cursor, custom apps, etc.)
 * can discover, read, and manage LLM API keys stored in MyBlocks.
 * 
 * Transport:
 *   - Default: stdio  (for local AI tools — Claude Desktop, Cursor)
 *   - Flag --sse:      SSE over HTTP (for remote / network clients)
 * 
 * The server does NOT touch the database directly.  Instead it calls
 * the existing Express REST API running on BACKEND_URL (default
 * http://localhost:8500).
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";               // bundled with the MCP SDK
import axios from "axios";
import fs from "fs";
import http from "http";
import https from "https";

// ─── Configuration ───────────────────────────────────────────────
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8500";

// Create an axios instance that tolerates self-signed / mismatched certs
// (e.g. cert is for myblocks.in but we connect via localhost)
const backendAxios = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 10000,   // 10-second timeout for backend calls
});
const MCP_SSE_PORT = parseInt(process.env.MCP_SSE_PORT || "3100", 10);
const isProd = process.env.NODE_ENV === "production";

// ─── SSL (production only) ───────────────────────────────────────
let sslOptions = null;
if (isProd) {
    const privateKey = fs.readFileSync(
        "/etc/letsencrypt/live/myblocks.in/privkey.pem",
        "utf8"
    );
    const certificate = fs.readFileSync(
        "/etc/letsencrypt/live/myblocks.in/fullchain.pem",
        "utf8"
    );
    sslOptions = { key: privateKey, cert: certificate };
    console.log("🔒 SSL certificates loaded (production mode)");
} else {
    console.log("🔓 Running without SSL (development mode)");
}

// Helper — call the existing backend
async function api(method, path, paramsOrData = {}) {
    const url = `${BACKEND_URL}${path}`;
    try {
        const config = method === "get" || method === "delete"
            ? { params: paramsOrData }
            : paramsOrData;

        const response = method === "get"
            ? await backendAxios.get(url, config)
            : method === "delete"
                ? await backendAxios.delete(url, config)
                : method === "put"
                    ? await backendAxios.put(url, config)
                    : await backendAxios.post(url, config);

        return response.data;
    } catch (err) {
        const msg = err.response?.data?.message
            || err.response?.data?.error
            || err.message;
        throw new Error(`Backend API error: ${msg}`);
    }
}

// ─── Backend Connectivity Check ─────────────────────────────────
async function checkBackendConnection() {
    const url = `${BACKEND_URL}/api/apikey-manager/providers`;
    try {
        const res = await backendAxios.get(url, { timeout: 5000 });
        console.log(`✅ Backend connected successfully at ${BACKEND_URL}`);
        console.log(`   Response status: ${res.status}`);
        return true;
    } catch (err) {
        if (err.code === "ECONNREFUSED") {
            console.error(`❌ Backend connection REFUSED at ${BACKEND_URL}`);
            console.error(`   Make sure the backend server is running.`);
        } else if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
            console.error(`❌ Backend connection TIMED OUT at ${BACKEND_URL}`);
            console.error(`   The server might be unreachable or too slow.`);
        } else if (err.code === "ENOTFOUND") {
            console.error(`❌ Backend hostname NOT FOUND: ${BACKEND_URL}`);
            console.error(`   Check if the hostname/domain is correct.`);
        } else if (err.response) {
            // Server responded but with an error status
            console.warn(`⚠️  Backend reachable at ${BACKEND_URL} but returned status ${err.response.status}`);
            console.warn(`   This may be normal if the endpoint requires auth/params.`);
            return true; // Server is reachable, just returned an error
        } else {
            console.error(`❌ Backend connection FAILED at ${BACKEND_URL}`);
            console.error(`   Error: ${err.message}`);
        }
        return false;
    }
}

// Mask an API key for safe display  (show first 4 + last 4 chars)
function maskKey(key) {
    if (!key || key.length <= 8) return "****";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// ─── MCP Server Factory ──────────────────────────────────────────
// A NEW server instance is created for each SSE connection because the
// MCP SDK does NOT allow the same server object to connect to more than
// one transport at a time.
function createMcpServer() {
    const server = new McpServer({
        name: "myblocks-apikey-manager",
        version: "1.0.0",
        description:
            "Manage LLM API keys stored in the MyBlocks platform. " +
            "List, add, toggle, and query provider/model information.",
    });


    // ══════════════════════════════════════════════════════════════════
    //  TOOLS
    // ══════════════════════════════════════════════════════════════════

    // ─── 1. list_api_keys ────────────────────────────────────────────
    server.tool(
        "list_api_keys",
        "List all API keys for a given user and firm, with optional provider filtering. Returns provider, model, status, and masked key.",
        {
            userid: z.string().describe("The user ID (from cookie/session)"),
            firmid: z.string().describe("The firm ID (from cookie/session)"),
            provider: z.string().optional().describe("Optional LLM provider name to filter results by"),
            unmasked: z.boolean().optional().describe("If true, returns the actual unmasked API keys (security sensitive)"),
        },
        async ({ userid, firmid, provider, unmasked }) => {
            let data = await api("get", "/api/apikey-manager/list", { userid, firmid });

            if (!Array.isArray(data) || data.length === 0) {
                return { content: [{ type: "text", text: "No API keys found for this user/firm." }] };
            }

            if (provider) {
                data = data.filter((row) => row.LLM_PROVIDER === provider);
                if (data.length === 0) {
                    return { content: [{ type: "text", text: `No API keys found for provider "${provider}".` }] };
                }
            }

            const rows = data.map((row) => ({
                id: row.ID,
                provider: row.LLM_PROVIDER,
                providerType: row.LLM_PROVIDER_TYPE,
                model: row.MODEL_NAME,
                modelUrl: row.MODEL_URL,
                apiKey: unmasked ? row.API_KEY : maskKey(row.API_KEY),
                status: row.STATUS,
                blocked: row.BLOCKED,
                insertDate: row.INSRT_DTM,
                updateDate: row.UPD_DTM,
            }));

            return {
                content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
            };
        }
    );

    // ─── 2. get_active_key ───────────────────────────────────────────
    server.tool(
        "get_active_key",
        "Get the active (non-blocked) API key for a specific LLM provider and optional model. " +
        "Returns the FULL (unmasked) key so it can be used for LLM calls.",
        {
            userid: z.string().describe("The user ID"),
            firmid: z.string().describe("The firm ID"),
            provider: z.string().describe("LLM provider name, e.g. OPENAI, GEMINI, GROQ"),
            model: z.string().optional().describe("Optional model name, e.g. llama-3.1-8b-instant"),
        },
        async ({ userid, firmid, provider, model }) => {
            const data = await api("get", "/api/apikey-manager/list", { userid, firmid });

            const active = (data || []).filter(
                (row) =>
                    row.LLM_PROVIDER === provider &&
                    row.STATUS === "ACTIVE" &&
                    row.BLOCKED !== "YES" &&
                    (!model || row.MODEL_NAME === model)
            );

            if (active.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No active key found for provider "${provider}"${model ? ` and model "${model}"` : ''}.`,
                        },
                    ],
                };
            }

            // Return the first active key with full details
            const key = active[0];
            const result = {
                id: key.ID,
                provider: key.LLM_PROVIDER,
                providerType: key.LLM_PROVIDER_TYPE,
                model: key.MODEL_NAME,
                modelUrl: key.MODEL_URL,
                responseVariable: key.MODEL_RESPONSE_VARIABLE,
                apiKey: key.API_KEY,   // Full key — needed by downstream LLM calls
                status: key.STATUS,
            };

            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    // ─── 3. list_providers ───────────────────────────────────────────
    server.tool(
        "list_providers",
        "List all available LLM providers (e.g. OPENAI, GEMINI, GROQ, MYBLOCKS_SERVERS).",
        {},
        async () => {
            const data = await api("get", "/api/apikey-manager/providers");

            if (!Array.isArray(data) || data.length === 0) {
                return { content: [{ type: "text", text: "No providers configured." }] };
            }

            const providers = data.map((p) => ({
                value: p.PROVIDER_VALUE,
                label: p.PROVIDER_LABEL,
                type: p.PROVIDER_TYPE,
            }));

            return {
                content: [{ type: "text", text: JSON.stringify(providers, null, 2) }],
            };
        }
    );

    // ─── 4. list_models ──────────────────────────────────────────────
    server.tool(
        "list_models",
        "List all available models for a given LLM provider.",
        {
            provider: z.string().describe("Provider value, e.g. OPENAI"),
        },
        async ({ provider }) => {
            const data = await api("get", "/api/apikey-manager/models", { provider });

            if (!Array.isArray(data) || data.length === 0) {
                return {
                    content: [
                        { type: "text", text: `No models found for provider "${provider}".` },
                    ],
                };
            }

            return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
        }
    );

    // ─── 5. add_api_key ──────────────────────────────────────────────
    server.tool(
        "add_api_key",
        "Add a new API key for an LLM provider.",
        {
            userid: z.string().describe("The user ID"),
            firmid: z.string().describe("The firm ID"),
            provider: z.string().describe("LLM provider, e.g. OPENAI"),
            model: z.string().describe("Model name, e.g. gpt-4o"),
            apiKey: z.string().optional().describe(
                "The API key string. Optional for MYBLOCKS_SERVERS provider."
            ),
        },
        async ({ userid, firmid, provider, model, apiKey }) => {
            const result = await api("post", "/api/apikey-manager/add", {
                USERID: userid,
                FIRMID: firmid,
                LLM_PROVIDER: provider,
                MODEL_NAME: model,
                API_KEY: apiKey || "",
            });

            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    // ─── 6. toggle_key_status ────────────────────────────────────────
    server.tool(
        "toggle_key_status",
        "Enable or disable an API key by toggling its ACTIVE/INACTIVE status.",
        {
            id: z.number().describe("The API key row ID"),
            userid: z.string().describe("The user ID"),
            firmid: z.string().describe("The firm ID"),
        },
        async ({ id, userid, firmid }) => {
            const result = await api("post", "/api/apikey-manager/toggle-status", {
                id,
                userid,
                firmid,
            });

            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    // ─── 7. delete_api_key ───────────────────────────────────────────
    server.tool(
        "delete_api_key",
        "Soft-delete an API key (hides from UI, sets INACTIVE).",
        {
            id: z.number().describe("The API key row ID"),
            userid: z.string().describe("The user ID"),
            firmid: z.string().describe("The firm ID"),
        },
        async ({ id, userid, firmid }) => {
            const result = await api("delete", `/api/apikey-manager/delete/${id}`, {
                userid,
                firmid,
            });

            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
    );


    // ══════════════════════════════════════════════════════════════════
    //  RESOURCES  (read-only data endpoints)
    // ══════════════════════════════════════════════════════════════════

    server.resource(
        "providers-list",
        "apikeys://providers",
        { description: "All configured LLM providers" },
        async (uri) => {
            const data = await api("get", "/api/apikey-manager/providers");
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: "application/json",
                        text: JSON.stringify(data, null, 2),
                    },
                ],
            };
        }
    );

    return server;
}


// ══════════════════════════════════════════════════════════════════
//  TRANSPORT & STARTUP
// ══════════════════════════════════════════════════════════════════

const useSSE = process.argv.includes("--sse");

if (useSSE) {
    // ─── SSE Transport (for remote/network clients) ───────────────
    // Each connection gets its own McpServer instance to avoid the
    // "Already connected to a transport" error from the MCP SDK.
    const activeTransports = new Map(); // sessionId -> { server, transport }

    const requestHandler = async (req, res) => {
        // CORS headers for cross-origin access
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.url === "/sse" && req.method === "GET") {
            // Create a FRESH server instance for every new SSE client
            const sessionServer = createMcpServer();
            const sseTransport = new SSEServerTransport("/messages", res);

            // The SSEServerTransport assigns a sessionId after start; we
            // capture it once the connection closes so we can clean up.
            res.on("close", () => {
                const sid = sseTransport.sessionId;
                if (sid && activeTransports.has(sid)) {
                    activeTransports.delete(sid);
                    console.log(`🔌 SSE client disconnected (session ${sid}). Active: ${activeTransports.size}`);
                }
            });
            // sessionId is available immediately after SSEServerTransport
            // construction (it's generated in the constructor and already
            // sent to the client via the SSE endpoint event).
            const sid = sseTransport.sessionId;
            if (sid) activeTransports.set(sid, { server: sessionServer, transport: sseTransport });

            console.log(`✅ MCP Client connected via SSE (session ${sid}). Active: ${activeTransports.size}`);

            // connect() returns a Promise that resolves when the transport
            // DISCONNECTS, so we must NOT await it here — otherwise the
            // lines above (activeTransports.set) would never execute while
            // the session is alive.
            sessionServer.connect(sseTransport).then(() => {
                console.log(`🔌 MCP session ${sid} transport closed.`);
            });
            return;
        }

        if (req.url.startsWith("/messages") && req.method === "POST") {
            // Route POST message to the correct session's transport
            const sessionId = req.headers["x-session-id"] ||
                new URL(req.url, `http://localhost:${MCP_SSE_PORT}`).searchParams.get("sessionId");

            if (sessionId && activeTransports.has(sessionId)) {
                await activeTransports.get(sessionId).transport.handlePostMessage(req, res);
            } else if (activeTransports.size === 1) {
                // Fallback: only one client connected — use it
                const [{ transport }] = activeTransports.values();
                await transport.handlePostMessage(req, res);
            } else {
                const requestedSid = sessionId || "(none)";
                console.warn(`⚠️  POST /messages rejected — session "${requestedSid}" not found. Active sessions: ${activeTransports.size} [${[...activeTransports.keys()].join(", ")}]`);
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    error: "No SSE connection established or session not found",
                    requestedSessionId: requestedSid,
                    activeSessions: activeTransports.size,
                    hint: "Connect to /sse first and keep the connection open while sending POST requests. Use header 'x-session-id' or query param 'sessionId'."
                }));
            }
            return;
        }

        // Health check
        if (req.url === "/" || req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    status: "ok",
                    server: "myblocks-apikey-mcp-server",
                    transport: "sse",
                    activeSessions: activeTransports.size,
                    instructions: {
                        connect: `GET http://localhost:${MCP_SSE_PORT}/sse`,
                        messages: `POST http://localhost:${MCP_SSE_PORT}/messages`,
                    },
                })
            );
            return;
        }

        res.writeHead(404);
        res.end("Not found");
    };

    const httpServer = isProd
        ? https.createServer(sslOptions, requestHandler)
        : http.createServer(requestHandler);

    httpServer.listen(MCP_SSE_PORT, () => {
        const protocol = isProd ? "https" : "http";
        console.log(`🚀 MCP Server (SSE) running at ${protocol}://localhost:${MCP_SSE_PORT}`);
        console.log(`   Connect:  GET  ${protocol}://localhost:${MCP_SSE_PORT}/sse`);
        console.log(`   Messages: POST ${protocol}://localhost:${MCP_SSE_PORT}/messages`);
        console.log(`   Health:   GET  ${protocol}://localhost:${MCP_SSE_PORT}/health`);
        console.log(`   Backend:  ${BACKEND_URL}`);
    });
} else {
    // ─── stdio Transport (for Claude Desktop, Cursor, etc.) ───────
    const transport = new StdioServerTransport();
    const server = createMcpServer();
    await server.connect(transport);
    console.error("🚀 MCP Server (stdio) started — waiting for client connection...");
    console.error(`   Backend: ${BACKEND_URL}`);
}

// ─── Verify backend connectivity on startup ─────────────────────
await checkBackendConnection();
