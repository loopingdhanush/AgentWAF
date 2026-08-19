const API_BASE = "";

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-demo-admin": "true",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      errorBody.error ||
        errorBody.message ||
        `Request failed with status ${res.status}`,
    );
  }

  return res.json();
}

export const api = {
  // Stats
  getStats: () => request<any>("/api/admin/stats/summary"),

  // Rules
  getRules: () => request<any[]>("/api/admin/rules"),
  createRule: (rule: any) =>
    request<any>("/api/admin/rules", {
      method: "POST",
      body: JSON.stringify(rule),
    }),
  updateRule: (id: string, updates: any) =>
    request<any>(`/api/admin/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  deleteRule: (id: string) =>
    request<any>(`/api/admin/rules/${id}`, { method: "DELETE" }),

  // Agents
  getAgents: () => request<any[]>("/api/admin/agents"),
  createAgent: (agent: any) =>
    request<any>("/api/admin/agents", {
      method: "POST",
      body: JSON.stringify(agent),
    }),
  updateAgent: (id: string, updates: any) =>
    request<any>(`/api/admin/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
  deleteAgent: (id: string) =>
    request<any>(`/api/admin/agents/${id}`, { method: "DELETE" }),

  // Logs
  getLogs: (
    params: {
      agentId?: string;
      tool?: string;
      disposition?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.agentId) query.set("agentId", params.agentId);
    if (params.tool) query.set("tool", params.tool);
    if (params.disposition) query.set("disposition", params.disposition);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    return request<{ logs: any[]; nextCursor: string | null }>(
      `/api/admin/logs?${query.toString()}`,
    );
  },

  // Trigger Gemini Agent Run
  runAgentGoal: (goal: string, sessionId?: string) =>
    request<any>("/api/v1/agent-run", {
      method: "POST",
      body: JSON.stringify({ goal, sessionId }),
    }),

  // Health & System Diagnostics
  getHealth: () => request<any>("/healthz"),
  getDiagnostics: () => request<any>("/api/admin/diagnostics"),
};
