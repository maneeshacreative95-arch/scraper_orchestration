# MyBlocks API Key Manager — MCP Server

An MCP (Model Context Protocol) server that exposes your MyBlocks API Key Manager as tools for AI clients like Claude Desktop, Cursor, VS Code Copilot, or any custom MCP-compatible application.

## Architecture

```
┌──────────────────────┐         REST API          ┌────────────────────────┐
│   React Frontend     │ ───────────────────────►  │  Express Backend       │
│   (ApiKeyManager)    │  /api/apikey-manager/*     │  (localhost:8500)      │
└──────────────────────┘                           └────────────┬───────────┘
                                                                │
                                                    Same REST API│
                                                                │
                                                   ┌────────────▼───────────┐
                                                   │  MCP Server (this)     │
                                                   │  (stdio or SSE)        │
                                                   │                        │
                                                   │  7 Tools + 1 Resource  │
                                                   └────────────┬───────────┘
                                                                │
                                                    MCP Protocol│
                                                                │
                                                   ┌────────────▼───────────┐
                                                   │  MCP Client            │
                                                   │  (Claude Desktop,      │
                                                   │   Cursor, Custom App)  │
                                                   └────────────────────────┘
```

## Setup

```bash
cd mcp-server
npm install
```

## Available Tools

| Tool | Description |
|---|---|
| `list_api_keys` | List all API keys (masked) for a user/firm |
| `get_active_key` | Get the active, unmasked key for a specific provider |
| `list_providers` | List all configured LLM providers |
| `list_models` | List models available for a provider |
| `add_api_key` | Add a new API key |
| `toggle_key_status` | Enable/disable an API key |
| `delete_api_key` | Soft-delete an API key |

## Available Resources

| Resource URI | Description |
|---|---|
| `apikeys://providers` | Read-only list of all configured providers |

---

## Usage

### Option 1: stdio Transport (Claude Desktop / Cursor)

**Start the server:**
```bash
npm start
```

**Claude Desktop config** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "myblocks-apikeys": {
      "command": "node",
      "args": ["D:/myblocks/react trainee/Myblocks-Full/mcp-server/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:8500"
      }
    }
  }
}
```

**Cursor config** (`.cursor/mcp.json` in your project root):
```json
{
  "mcpServers": {
    "myblocks-apikeys": {
      "command": "node",
      "args": ["D:/myblocks/react trainee/Myblocks-Full/mcp-server/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:8500"
      }
    }
  }
}
```

### Option 2: SSE Transport (Remote / Network Clients)

**Start the server with SSE:**
```bash
npm run start:sse
```

This starts an HTTP server (default port 3100) with:
- `GET  /sse`      — SSE connection endpoint
- `POST /messages`  — Message endpoint
- `GET  /health`    — Health check

**Connect from another Node.js app:**
```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("http://localhost:3100/sse")
);

const client = new Client({
  name: "my-app",
  version: "1.0.0",
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Call a tool
const result = await client.callTool("list_providers", {});
console.log(result);

// Get active key for a provider
const key = await client.callTool("get_active_key", {
  userid: "user123",
  firmid: "firm456",
  provider: "OPENAI",
});
console.log(key);
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8500` | URL of the Express backend |
| `MCP_SSE_PORT` | `3100` | Port for SSE transport HTTP server |

## Prerequisites

- Your Express backend (`backend_mongo_local`) must be running on port 8500
- Node.js 18+ (for ES module support)
