import React, { useState, useEffect } from "react";
import {
  Bot,
  Plus,
  Key,
  Copy,
  Check,
  Trash2,
  Calendar,
  Activity,
  Edit3,
  Code2,
  BookOpen,
} from "lucide-react";
import { api } from "../lib/api.js";

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentScopePattern, setNewAgentScopePattern] = useState("^CUST-1");

  // Edit Agent Form State
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [editAgentName, setEditAgentName] = useState("");
  const [editAgentScopePattern, setEditAgentScopePattern] = useState("");

  // Show Key Once modal state
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPrefixId, setCopiedPrefixId] = useState<string | null>(null);
  const [selectedSdkTab, setSelectedSdkTab] = useState<
    "curl" | "python" | "node"
  >("curl");

  // Inline delete confirmation
  const [agentToDelete, setAgentToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (err) {
      console.error("Failed to load agents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createAgent({
        name: newAgentName,
        declaredScope: {
          allowedCustomerIdPattern: newAgentScopePattern,
          allowedTools: [
            "get_customer_record",
            "update_customer_record",
            "delete_customer_record",
            "send_email",
            "execute_report_query",
            "export_report",
          ],
        },
      });

      setAgents((prev) => [res.agent, ...prev]);
      setGeneratedKey(res.rawApiKey);
      setShowCreateModal(false);
      setNewAgentName("");
    } catch (err: any) {
      alert(`Failed to create agent: ${err.message}`);
    }
  };

  const openEditModal = (agent: any) => {
    setEditingAgent(agent);
    setEditAgentName(agent.name);
    setEditAgentScopePattern(
      agent.declaredScope?.allowedCustomerIdPattern || "^CUST-1",
    );
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    try {
      const updated = await api.updateAgent(editingAgent.id, {
        name: editAgentName,
        declaredScope: {
          ...(editingAgent.declaredScope || {}),
          allowedCustomerIdPattern: editAgentScopePattern,
        },
      });

      setAgents((prev) =>
        prev.map((a) => (a.id === editingAgent.id ? { ...a, ...updated } : a)),
      );
      setEditingAgent(null);
    } catch (err: any) {
      alert(`Failed to update agent: ${err.message}`);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    setDeleting(true);
    try {
      await api.deleteAgent(agentToDelete.id);
      setAgents((prev) => prev.filter((a) => a.id !== agentToDelete.id));
      setAgentToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete agent", err);
      alert(`Failed to delete agent: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  const handleCopyPrefix = (prefix: string, id: string) => {
    navigator.clipboard.writeText(prefix);
    setCopiedPrefixId(id);
    setTimeout(() => setCopiedPrefixId(null), 2500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            Authorized AI Agents
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5">
            Manage agent identities, API authentication keys, and declared data
            scopes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuideModal(true)}
            className="px-3.5 py-2.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-lg border border-zinc-200 shadow-xs transition-all flex items-center gap-1.5 shrink-0"
          >
            <BookOpen className="h-4 w-4 text-zinc-500" />
            <span>SDK Integration Guide</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#1a73e8] hover:bg-[#1765cc] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Register New Agent</span>
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="glass-panel rounded-xl p-5 flex flex-col justify-between space-y-4 relative group shadow-subtle bg-white border border-zinc-200"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-900 tracking-tight">
                      {agent.name}
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      ID: {agent.id.substring(0, 16)}...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(agent)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                    title="Edit Agent"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setAgentToDelete(agent)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Agent"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Key className="h-3.5 w-3.5 text-zinc-400" /> Key Prefix:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-800 font-semibold">
                      {agent.apiKeyPrefix}••••••••
                    </span>
                    <button
                      onClick={() =>
                        handleCopyPrefix(agent.apiKeyPrefix, agent.id)
                      }
                      className="p-1 rounded hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-900 transition-colors"
                      title="Copy Key Prefix"
                    >
                      {copiedPrefixId === agent.id ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="text-zinc-500 text-[11px] block font-sans">
                    Declared Scope:
                  </span>
                  <pre className="text-[11px] text-zinc-700 whitespace-pre-wrap">
                    {JSON.stringify(agent.declaredScope, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-600" />
                {agent.totalCalls ?? 0} total calls
              </span>
              <span className="flex items-center gap-1 text-zinc-400">
                <Calendar className="h-3 w-3" />
                {new Date(agent.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-zinc-600" />
                <h3 className="font-semibold text-base text-zinc-900 font-sans tracking-tight">
                  Edit AI Agent Identity
                </h3>
              </div>
              <button
                onClick={() => setEditingAgent(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAgent} className="space-y-4">
              <div>
                <label className="block font-medium text-zinc-600 mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  required
                  value={editAgentName}
                  onChange={(e) => setEditAgentName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-600 mb-1">
                  Allowed Customer ID Scope (Regex)
                </label>
                <input
                  type="text"
                  required
                  value={editAgentScopePattern}
                  onChange={(e) => setEditAgentScopePattern(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 font-mono text-xs focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Example:{" "}
                  <code className="text-zinc-700 font-mono">^CUST-1</code>{" "}
                  restricts to CUST-1xxx, while{" "}
                  <code className="text-zinc-700 font-mono">^CUST-2</code>{" "}
                  restricts to CUST-2xxx.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Update Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="font-semibold text-base text-zinc-900 font-sans tracking-tight">
                Register New AI Agent
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label className="block font-medium text-zinc-600 mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Finance Analytics Bot"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-600 mb-1">
                  Allowed Customer ID Scope (Regex)
                </label>
                <input
                  type="text"
                  required
                  value={newAgentScopePattern}
                  onChange={(e) => setNewAgentScopePattern(e.target.value)}
                  placeholder="e.g. ^CUST-1"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 font-mono text-xs focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Example:{" "}
                  <code className="text-zinc-700 font-mono">^CUST-1</code>{" "}
                  restricts this agent only to customer IDs starting with
                  CUST-1.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Generate Key & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show Key ONCE Modal */}
      {generatedKey && (
        <div className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 border border-emerald-200/80 shadow-panel space-y-4 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-700 font-sans">
              <Key className="h-5 w-5" />
              <h3 className="font-semibold text-base text-zinc-900 tracking-tight">
                Agent API Key Generated
              </h3>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-700 font-sans text-xs">
              <span className="font-semibold">Important:</span> Copy this API
              key now. For security, this raw key is shown only once and cannot
              be retrieved again (only the cryptographic hash is stored).
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-2">
              <span className="text-zinc-800 font-mono text-xs break-all select-all">
                {generatedKey}
              </span>
              <button
                onClick={handleCopyKey}
                className="p-2 rounded-lg bg-[#1a73e8] hover:bg-[#1765cc] text-white shrink-0 transition-colors"
                title="Copy API Key"
              >
                {copiedKey ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setGeneratedKey(null)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-sans font-semibold text-xs shadow-sm"
              >
                I have safely saved this key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SDK Integration & Agent Connection Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl p-6 border border-zinc-200 shadow-panel space-y-5 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <Code2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-zinc-900 font-sans tracking-tight">
                    How to Connect & Integrate AI Agents
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                    Step-by-step instructions for routing autonomous agent tool
                    calls through the WAF
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            {/* Workflow Steps Overview */}
            <div className="grid grid-cols-3 gap-3 font-sans">
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="h-5 w-5 rounded-full bg-[#1a73e8] text-white font-mono text-[10px] flex items-center justify-center font-bold">
                  1
                </div>
                <h4 className="font-semibold text-zinc-900 text-xs mt-1">
                  Register Identity
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Define agent name and customer ID regex scope (e.g.{" "}
                  <code className="font-mono text-zinc-700">^CUST-1</code>).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="h-5 w-5 rounded-full bg-[#1a73e8] text-white font-mono text-[10px] flex items-center justify-center font-bold">
                  2
                </div>
                <h4 className="font-semibold text-zinc-900 text-xs mt-1">
                  Save API Key
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Copy the secret key{" "}
                  <code className="font-mono text-zinc-700">agnt_live_...</code>{" "}
                  generated upon registration.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="h-5 w-5 rounded-full bg-[#1a73e8] text-white font-mono text-[10px] flex items-center justify-center font-bold">
                  3
                </div>
                <h4 className="font-semibold text-zinc-900 text-xs mt-1">
                  Pass in Header
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Attach{" "}
                  <code className="font-mono text-zinc-700">x-agent-key</code>{" "}
                  on all tool calls to{" "}
                  <code className="font-mono text-zinc-700">
                    /api/v1/tool-call
                  </code>
                  .
                </p>
              </div>
            </div>

            {/* Code Examples Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-800 font-sans text-xs">
                  Code Examples:
                </span>
                <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 font-sans text-xs">
                  <button
                    onClick={() => setSelectedSdkTab("curl")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedSdkTab === "curl"
                        ? "bg-white text-[#1a73e8] shadow-xs font-semibold"
                        : "text-zinc-500"
                    }`}
                  >
                    cURL / CLI
                  </button>
                  <button
                    onClick={() => setSelectedSdkTab("python")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedSdkTab === "python"
                        ? "bg-white text-[#1a73e8] shadow-xs font-semibold"
                        : "text-zinc-500"
                    }`}
                  >
                    Python (Requests / LangChain)
                  </button>
                  <button
                    onClick={() => setSelectedSdkTab("node")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedSdkTab === "node"
                        ? "bg-white text-[#1a73e8] shadow-xs font-semibold"
                        : "text-zinc-500"
                    }`}
                  >
                    Node.js / TypeScript
                  </button>
                </div>
              </div>

              {selectedSdkTab === "curl" && (
                <div className="p-3.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[11px] space-y-2 border border-zinc-800 overflow-x-auto">
                  <div className="text-zinc-400">
                    # Send tool call through WAF Interceptor
                  </div>
                  <pre className="text-emerald-400 whitespace-pre-wrap">{`curl -X POST http://localhost:4000/api/v1/tool-call \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: agnt_live_your_copied_secret_key" \\
  -d '{
    "tool": "get_customer_record",
    "params": {
      "customerId": "CUST-1001"
    }
  }'`}</pre>
                </div>
              )}

              {selectedSdkTab === "python" && (
                <div className="p-3.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[11px] space-y-2 border border-zinc-800 overflow-x-auto">
                  <div className="text-zinc-400">
                    # Python Tool Wrapper Example
                  </div>
                  <pre className="text-emerald-400 whitespace-pre-wrap">{`import requests

def call_waf_tool(tool_name: str, params: dict, api_key: str):
    url = "http://localhost:4000/api/v1/tool-call"
    headers = {
        "Content-Type": "application/json",
        "x-agent-key": api_key
    }
    payload = {"tool": tool_name, "params": params}
    
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json()["result"]
    elif response.status_code == 403:
        raise PermissionError(f"WAF Blocked: {response.json().get('reason')}")
    else:
        raise RuntimeError(f"Error {response.status_code}: {response.text}")`}</pre>
                </div>
              )}

              {selectedSdkTab === "node" && (
                <div className="p-3.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[11px] space-y-2 border border-zinc-800 overflow-x-auto">
                  <div className="text-zinc-400">
                    // Node.js / TypeScript Agent Function Callback
                  </div>
                  <pre className="text-emerald-400 whitespace-pre-wrap">{`async function executeGuardedTool(tool: string, params: Record<string, any>, apiKey: string) {
  const res = await fetch("http://localhost:4000/api/v1/tool-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-key": apiKey,
    },
    body: JSON.stringify({ tool, params }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(\`WAF Violation [\${data.code}]: \${data.reason}\`);
  }
  return data.result;
}`}</pre>
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end border-t border-zinc-100">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold shadow-sm font-sans"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {agentToDelete && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 font-sans">
                  Delete Agent?
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  This will permanently delete{" "}
                  <span className="font-semibold text-zinc-800">
                    {agentToDelete.name}
                  </span>{" "}
                  and all associated audit logs and sessions. This action cannot
                  be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setAgentToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAgent}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm"
              >
                {deleting ? "Deleting…" : "Delete Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
