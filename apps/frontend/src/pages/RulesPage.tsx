import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Sliders,
  ArrowRight,
  Workflow,
  Layers,
  ShieldAlert,
  Clock,
  Code2,
} from "lucide-react";
import { api } from "../lib/api.js";

export const RulesPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");

  // New Rule Form State
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<string>("RATE_LIMIT");
  const [newRuleEnforcement, setNewRuleEnforcement] = useState<string>("BLOCK");
  const [newRuleTargetTool, setNewRuleTargetTool] = useState("");
  const [newRulePriority, setNewRulePriority] = useState(1);

  // Type-specific config fields
  const [rlMaxCalls, setRlMaxCalls] = useState(5);
  const [rlWindowSeconds, setRlWindowSeconds] = useState(60);
  const [rlScope, setRlScope] = useState("agent");

  const [blParamPath, setBlParamPath] = useState("sqlLike");
  const [blPatterns, setBlPatterns] = useState(
    "DROP\\s+TABLE, UNION\\s+SELECT",
  );

  const [slParamPath, setSlParamPath] = useState("body");
  const [slMaxLength, setSlMaxLength] = useState(100);

  const [dsScopeParam, setDsScopeParam] = useState("customerId");

  const [seqRequiredTool, setSeqRequiredTool] = useState("get_customer_record");

  // Edit Rule Form State
  const [editName, setEditName] = useState("");
  const [editTargetTool, setEditTargetTool] = useState("");
  const [editPriority, setEditPriority] = useState(1);
  const [editEnforcement, setEditEnforcement] = useState("BLOCK");
  const [editConfigJson, setEditConfigJson] = useState("");
  const [editConfigError, setEditConfigError] = useState("");

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await api.getRules();
      setRules(data);
    } catch (err) {
      console.error("Failed to load rules", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggleEnabled = async (rule: any) => {
    try {
      const updated = await api.updateRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      console.error("Failed to toggle rule status", err);
    }
  };

  const handleToggleEnforcement = async (rule: any) => {
    const nextMode = rule.enforcementMode === "BLOCK" ? "SHADOW" : "BLOCK";
    try {
      const updated = await api.updateRule(rule.id, {
        enforcementMode: nextMode,
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      console.error("Failed to toggle enforcement mode", err);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    try {
      await api.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete rule", err);
    }
  };

  const openEditModal = (rule: any) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditTargetTool(rule.targetTool || "");
    setEditPriority(rule.priority);
    setEditEnforcement(rule.enforcementMode || "BLOCK");
    setEditConfigJson(JSON.stringify(rule.config || {}, null, 2));
    setEditConfigError("");
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    let parsedConfig: any = {};
    try {
      parsedConfig = JSON.parse(editConfigJson);
      setEditConfigError("");
    } catch (err: any) {
      setEditConfigError("Invalid JSON configuration: " + err.message);
      return;
    }

    try {
      const updated = await api.updateRule(editingRule.id, {
        name: editName,
        targetTool: editTargetTool.trim() || null,
        priority: Number(editPriority),
        enforcementMode: editEnforcement,
        config: parsedConfig,
      });

      setRules((prev) =>
        prev.map((r) => (r.id === editingRule.id ? updated : r)),
      );
      setEditingRule(null);
    } catch (err: any) {
      alert(`Failed to update rule: ${err.message}`);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();

    let config: any = {};
    if (newRuleType === "RATE_LIMIT") {
      config = {
        maxCalls: Number(rlMaxCalls),
        windowSeconds: Number(rlWindowSeconds),
        scope: rlScope,
      };
    } else if (newRuleType === "PARAM_BLOCKLIST") {
      config = {
        paramPath: blParamPath,
        patterns: blPatterns
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        matchType: "regex",
      };
    } else if (newRuleType === "PARAM_SIZE_LIMIT") {
      config = { paramPath: slParamPath, maxLength: Number(slMaxLength) };
    } else if (newRuleType === "DATA_SCOPE") {
      config = { scopeParam: dsScopeParam };
    } else if (newRuleType === "SEQUENCE") {
      config = { requiresToolBefore: seqRequiredTool };
    }

    try {
      const created = await api.createRule({
        name: newRuleName,
        type: newRuleType,
        enforcementMode: newRuleEnforcement,
        targetTool: newRuleTargetTool.trim() || null,
        config,
        priority: Number(newRulePriority),
        enabled: true,
      });

      setRules((prev) => [...prev, created]);
      setShowCreateModal(false);
      // Reset form
      setNewRuleName("");
    } catch (err: any) {
      alert(`Failed to create rule: ${err.message}`);
    }
  };

  // Grouped sequence rules & connected chain builder
  const sequenceRules = rules.filter((r) => r.type === "SEQUENCE");
  const [inspectingChain, setInspectingChain] = useState<SequenceChain | null>(
    null,
  );

  // Build connected multi-step sequence chains (e.g. A → B → C)
  // A "chain" is a linear path: each step's output is the next step's input.
  // Branching rules (1→2, 1→3) produce separate chains, not one merged group.
  interface SequenceChain {
    id: string;
    name: string;
    tools: string[];
    rules: any[];
  }

  const sequenceChains: SequenceChain[] = React.useMemo(() => {
    if (sequenceRules.length === 0) return [];

    // Build adjacency: fromTool → [rules that require fromTool]
    const edgeMap = new Map<string, any[]>();
    sequenceRules.forEach((rule) => {
      const from = rule.config?.requiresToolBefore || "unknown";
      if (!edgeMap.has(from)) edgeMap.set(from, []);
      edgeMap.get(from)!.push(rule);
    });

    // Find all "root" tools: tools that are never a targetTool of any rule
    // (i.e., nothing points TO them — they are chain starters)
    const allTargets = new Set(sequenceRules.map((r) => r.targetTool));
    const rootTools = new Set(
      sequenceRules
        .map((r) => r.config?.requiresToolBefore)
        .filter((t) => t && !allTargets.has(t)),
    );

    // DFS from each root, following edges; each path = one chain
    const chains: SequenceChain[] = [];

    const buildPaths = (
      currentTool: string,
      currentPath: string[],
      currentRules: any[],
    ) => {
      const nextRules = edgeMap.get(currentTool) || [];

      if (nextRules.length === 0) {
        // Leaf node — emit the completed chain
        if (currentRules.length > 0) {
          const firstName =
            currentRules[0].config?.requiresToolBefore || currentPath[0];
          const lastName =
            currentRules[currentRules.length - 1].targetTool ||
            currentPath[currentPath.length - 1];
          chains.push({
            id: `chain_${currentPath.join("_")}`,
            name: `${firstName} → ${lastName} Workflow`,
            tools: [...currentPath],
            rules: [...currentRules],
          });
        }
        return;
      }

      // Branch: each next rule creates its own path
      nextRules.forEach((rule) => {
        const nextTool = rule.targetTool || "unknown";
        buildPaths(
          nextTool,
          [...currentPath, nextTool],
          [...currentRules, rule],
        );
      });
    };

    rootTools.forEach((root) => {
      buildPaths(root, [root], []);
    });

    // Fallback: any rules not covered by root traversal (orphan edges)
    const coveredRuleIds = new Set(
      chains.flatMap((c) => c.rules.map((r) => r.id)),
    );
    sequenceRules
      .filter((r) => !coveredRuleIds.has(r.id))
      .forEach((rule) => {
        const from = rule.config?.requiresToolBefore || "unknown";
        const to = rule.targetTool || "unknown";
        chains.push({
          id: `chain_orphan_${rule.id}`,
          name: `${from} → ${to} Workflow`,
          tools: [from, to],
          rules: [rule],
        });
      });

    return chains;
  }, [sequenceRules]);

  const filteredRules = rules.filter((r) => {
    if (selectedTypeFilter === "ALL") return true;
    return r.type === selectedTypeFilter;
  });

  const renderConfigPreview = (rule: any) => {
    if (rule.type === "SEQUENCE") {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-[11px] font-mono">
          <span className="text-zinc-700 font-semibold">
            {rule.config?.requiresToolBefore || "prior_tool"}
          </span>
          <ArrowRight className="h-3 w-3 text-zinc-400" />
          <span className="text-zinc-900 font-semibold">
            {rule.targetTool || "target_tool"}
          </span>
          <span className="text-[10px] text-zinc-400 font-sans ml-1">
            (Prerequisite Chain)
          </span>
        </div>
      );
    }
    if (rule.type === "RATE_LIMIT") {
      return (
        <div className="text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-zinc-400" />
          <span>
            Max{" "}
            <strong className="text-zinc-800">{rule.config?.maxCalls}</strong>{" "}
            calls /{" "}
            <strong className="text-zinc-800">
              {rule.config?.windowSeconds}s
            </strong>{" "}
            ({rule.config?.scope || "agent"})
          </span>
        </div>
      );
    }
    if (rule.type === "PARAM_BLOCKLIST") {
      return (
        <div className="text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3 text-rose-500" />
          <span>
            Param:{" "}
            <strong className="text-zinc-800">{rule.config?.paramPath}</strong>{" "}
            (regex blocklist)
          </span>
        </div>
      );
    }
    if (rule.type === "PARAM_SIZE_LIMIT") {
      return (
        <div className="text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
          <Code2 className="h-3 w-3 text-zinc-400" />
          <span>
            Param:{" "}
            <strong className="text-zinc-800">{rule.config?.paramPath}</strong>{" "}
            (max {rule.config?.maxLength} chars)
          </span>
        </div>
      );
    }
    if (rule.type === "DATA_SCOPE") {
      return (
        <div className="text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-emerald-600" />
          <span>
            Scope param:{" "}
            <strong className="text-zinc-800">{rule.config?.scopeParam}</strong>{" "}
            (validated against agent regex)
          </span>
        </div>
      );
    }
    return (
      <div className="text-[11px] text-zinc-400 font-mono truncate max-w-md">
        {JSON.stringify(rule.config)}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            Policy Engine Rules
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5">
            Configure real-time inspection, rate limiting, and execution
            sequence rules
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-[#1a73e8] hover:bg-[#1765cc] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create Policy Rule
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs font-sans">
          {[
            { label: "All Rules", type: "ALL" },
            { label: "Sequences", type: "SEQUENCE" },
            { label: "Rate Limits", type: "RATE_LIMIT" },
            { label: "Param Blocklists", type: "PARAM_BLOCKLIST" },
            { label: "Size Limits", type: "PARAM_SIZE_LIMIT" },
            { label: "Data Scope", type: "DATA_SCOPE" },
          ].map((tab) => (
            <button
              key={tab.type}
              onClick={() => setSelectedTypeFilter(tab.type)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                selectedTypeFilter === tab.type
                  ? "bg-white text-[#1a73e8] shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {tab.label} (
              {tab.type === "ALL"
                ? rules.length
                : rules.filter((r) => r.type === tab.type).length}
              )
            </button>
          ))}
        </div>
      </div>

      {/* Visual Sequence Chains (Rendered under SEQUENCES tab) */}
      {selectedTypeFilter === "SEQUENCE" && sequenceChains.length > 0 && (
        <div className="glass-panel rounded-xl p-5 shadow-subtle space-y-3.5 bg-white border border-zinc-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                <Workflow className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-zinc-900 font-sans tracking-tight">
                  Chained Sequence Workflows ({sequenceChains.length} Groups)
                </h3>
                <p className="text-[11px] text-zinc-500 font-sans">
                  Click any workflow group below to open the Enforced Execution
                  Steps inspector modal
                </p>
              </div>
            </div>
          </div>

          {/* Chain Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {sequenceChains.map((chain) => (
              <div
                key={chain.id}
                onClick={() => setInspectingChain(chain)}
                className="p-3.5 rounded-lg border transition-all cursor-pointer space-y-2 bg-white border-zinc-200 hover:border-[#1a73e8] hover:shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-900 font-sans group-hover:text-[#1a73e8]">
                    {chain.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-mono">
                    {chain.rules.length} rule{chain.rules.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Step Chain Pills */}
                <div className="flex items-center gap-1.5 font-mono text-[11px] flex-wrap">
                  {chain.tools.map((tool, idx) => (
                    <React.Fragment key={idx}>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          idx === 0
                            ? "bg-zinc-50 text-zinc-700 border-zinc-200"
                            : "bg-[#1a73e8] text-white border-[#1a73e8]"
                        }`}
                      >
                        {idx + 1}. {tool}
                      </span>
                      {idx < chain.tools.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enforced Execution Steps Modal */}
      {inspectingChain && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
                  <Workflow className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-zinc-900 font-sans tracking-tight">
                    Enforced Execution Steps: {inspectingChain.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                    Tool calls in this workflow are governed sequentially in
                    this session
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingChain(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            {/* Sequence Chain Pipeline Pills */}
            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center gap-2 font-mono text-[11px] flex-wrap">
              <span className="text-zinc-500 font-sans text-xs font-medium mr-1">
                Pipeline Order:
              </span>
              {inspectingChain.tools.map((tool, idx) => (
                <React.Fragment key={idx}>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      idx === 0
                        ? "bg-white text-zinc-700 border-zinc-200"
                        : "bg-[#1a73e8] text-white border-[#1a73e8]"
                    }`}
                  >
                    {idx + 1}. {tool}
                  </span>
                  {idx < inspectingChain.tools.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Ordered rules in sequence */}
            <div className="space-y-2.5">
              {inspectingChain.rules.map((rule, sIdx) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-[#1a73e8] text-white font-mono text-xs flex items-center justify-center font-bold shrink-0">
                      {sIdx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-900 font-sans">
                          {rule.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            rule.enforcementMode === "BLOCK"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {rule.enforcementMode}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>
                          Prerequisite:{" "}
                          <strong className="text-zinc-800">
                            {rule.config?.requiresToolBefore}
                          </strong>
                        </span>
                        <span>→</span>
                        <span>
                          Unlocks:{" "}
                          <strong className="text-zinc-800">
                            {rule.targetTool}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleEnforcement(rule)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all border ${
                        rule.enforcementMode === "BLOCK"
                          ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      {rule.enforcementMode}
                    </button>

                    <button
                      onClick={() => handleToggleEnabled(rule)}
                      className="inline-flex items-center gap-1.5 font-sans"
                      title={
                        rule.enabled
                          ? "Click to disable rule"
                          : "Click to enable rule"
                      }
                    >
                      <span
                        className={`relative inline-flex items-center rounded-full transition-colors ${
                          rule.enabled ? "bg-[#1a73e8]" : "bg-zinc-200"
                        }`}
                        style={{ height: "16px", width: "28px" }}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            rule.enabled
                              ? "translate-x-[13px]"
                              : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setInspectingChain(null);
                        openEditModal(rule);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50 transition-colors"
                      title="Edit Rule"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end border-t border-zinc-100">
              <button
                onClick={() => setInspectingChain(null)}
                className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold shadow-sm font-sans"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="glass-panel rounded-xl overflow-hidden shadow-subtle bg-white border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold font-sans">
                  Priority
                </th>
                <th className="py-3.5 px-4 font-semibold font-sans">
                  Rule Name & Details
                </th>
                <th className="py-3.5 px-4 font-semibold font-sans">Type</th>
                <th className="py-3.5 px-4 font-semibold font-sans">
                  Target Tool
                </th>
                <th className="py-3.5 px-4 font-semibold font-sans">Mode</th>
                <th className="py-3.5 px-4 font-semibold font-sans">Status</th>
                <th className="py-3.5 px-4 font-semibold font-sans text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredRules.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-zinc-400 font-sans"
                  >
                    No rules matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="hover:bg-zinc-50 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-zinc-500 font-semibold">
                      #{rule.priority}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-sans font-semibold text-zinc-900 text-sm mb-1">
                        {rule.name}
                      </div>
                      {renderConfigPreview(rule)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-medium border border-zinc-200 text-[11px]">
                        {rule.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600">
                      {rule.targetTool || (
                        <span className="text-zinc-400 italic">ALL TOOLS</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleEnforcement(rule)}
                        className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all border ${
                          rule.enforcementMode === "BLOCK"
                            ? "bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100"
                            : "bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100"
                        }`}
                      >
                        {rule.enforcementMode}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleEnabled(rule)}
                        className="inline-flex items-center gap-1.5 font-sans"
                        title={
                          rule.enabled
                            ? "Click to disable rule"
                            : "Click to enable rule"
                        }
                      >
                        <span
                          className={`relative inline-flex items-center rounded-full transition-colors ${
                            rule.enabled ? "bg-[#1a73e8]" : "bg-zinc-200"
                          }`}
                          style={{ height: "18px", width: "32px" }}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              rule.enabled
                                ? "translate-x-[15px]"
                                : "translate-x-0.5"
                            }`}
                          />
                        </span>
                        <span
                          className={`text-xs font-medium ${rule.enabled ? "text-zinc-800" : "text-zinc-400"}`}
                        >
                          {rule.enabled ? "Active" : "Disabled"}
                        </span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                          title="Edit Rule"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <h3 className="font-semibold text-base text-zinc-900 font-sans tracking-tight">
                Create New WAF Policy Rule
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-600 mb-1 font-sans">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="e.g. Export Rate Limit (3 per min)"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-600 mb-1 font-sans">
                    Rule Type
                  </label>
                  <select
                    value={newRuleType}
                    onChange={(e) => setNewRuleType(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                  >
                    <option value="RATE_LIMIT">RATE_LIMIT</option>
                    <option value="PARAM_BLOCKLIST">PARAM_BLOCKLIST</option>
                    <option value="PARAM_SIZE_LIMIT">PARAM_SIZE_LIMIT</option>
                    <option value="DATA_SCOPE">DATA_SCOPE</option>
                    <option value="SEQUENCE">SEQUENCE</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-600 mb-1 font-sans">
                    Enforcement Mode
                  </label>
                  <select
                    value={newRuleEnforcement}
                    onChange={(e) => setNewRuleEnforcement(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                  >
                    <option value="BLOCK">BLOCK (Active Enforcement)</option>
                    <option value="SHADOW">SHADOW (Audit Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-600 mb-1 font-sans">
                    Target Tool (Optional)
                  </label>
                  <input
                    type="text"
                    value={newRuleTargetTool}
                    onChange={(e) => setNewRuleTargetTool(e.target.value)}
                    placeholder="e.g. export_report (leave empty for ALL)"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-600 mb-1 font-sans">
                    Priority (Lower runs first)
                  </label>
                  <input
                    type="number"
                    value={newRulePriority}
                    onChange={(e) => setNewRulePriority(Number(e.target.value))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                  />
                </div>
              </div>

              {/* Dynamic Type Config */}
              <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-3">
                <span className="font-semibold text-zinc-700 block font-sans">
                  Type Specific Configuration:
                </span>

                {newRuleType === "RATE_LIMIT" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Max Calls
                      </label>
                      <input
                        type="number"
                        value={rlMaxCalls}
                        onChange={(e) => setRlMaxCalls(Number(e.target.value))}
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Window (Sec)
                      </label>
                      <input
                        type="number"
                        value={rlWindowSeconds}
                        onChange={(e) =>
                          setRlWindowSeconds(Number(e.target.value))
                        }
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Scope
                      </label>
                      <select
                        value={rlScope}
                        onChange={(e) => setRlScope(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900"
                      >
                        <option value="agent">agent</option>
                        <option value="session">session</option>
                      </select>
                    </div>
                  </div>
                )}

                {newRuleType === "PARAM_BLOCKLIST" && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Parameter Path
                      </label>
                      <input
                        type="text"
                        value={blParamPath}
                        onChange={(e) => setBlParamPath(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900 font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Patterns (Comma-separated Regex)
                      </label>
                      <input
                        type="text"
                        value={blPatterns}
                        onChange={(e) => setBlPatterns(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                )}

                {newRuleType === "PARAM_SIZE_LIMIT" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Parameter Path
                      </label>
                      <input
                        type="text"
                        value={slParamPath}
                        onChange={(e) => setSlParamPath(e.target.value)}
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900 font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1 font-sans">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={slMaxLength}
                        onChange={(e) => setSlMaxLength(Number(e.target.value))}
                        className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900"
                      />
                    </div>
                  </div>
                )}

                {newRuleType === "DATA_SCOPE" && (
                  <div>
                    <label className="block text-zinc-500 mb-1 font-sans">
                      Scope Parameter Name
                    </label>
                    <input
                      type="text"
                      value={dsScopeParam}
                      onChange={(e) => setDsScopeParam(e.target.value)}
                      placeholder="e.g. customerId"
                      className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900 font-mono text-[11px]"
                    />
                  </div>
                )}

                {newRuleType === "SEQUENCE" && (
                  <div>
                    <label className="block text-zinc-500 mb-1 font-sans">
                      Requires Tool Before in Session
                    </label>
                    <input
                      type="text"
                      value={seqRequiredTool}
                      onChange={(e) => setSeqRequiredTool(e.target.value)}
                      placeholder="e.g. get_customer_record"
                      className="w-full bg-white border border-zinc-200 rounded-md p-2 text-zinc-900 font-mono text-[11px]"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold shadow-sm font-sans"
                >
                  Save Policy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-zinc-500" />
                <h3 className="font-semibold text-base text-zinc-900 font-sans tracking-tight">
                  Edit Policy Rule
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-mono text-[10px] border border-zinc-200">
                  {editingRule.type}
                </span>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-600 mb-1 font-sans">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-600 mb-1 font-sans">
                    Enforcement Mode
                  </label>
                  <select
                    value={editEnforcement}
                    onChange={(e) => setEditEnforcement(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                  >
                    <option value="BLOCK">BLOCK (Active Enforcement)</option>
                    <option value="SHADOW">SHADOW (Audit Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-600 mb-1 font-sans">
                    Priority (Lower runs first)
                  </label>
                  <input
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value))}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-600 mb-1 font-sans">
                  Target Tool (Optional)
                </label>
                <input
                  type="text"
                  value={editTargetTool}
                  onChange={(e) => setEditTargetTool(e.target.value)}
                  placeholder="e.g. export_report (leave empty for ALL)"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-mono text-[11px]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-zinc-600 font-sans">
                    Rule Configuration (JSON)
                  </label>
                  <span className="text-[10px] text-zinc-400 font-sans">
                    Edit parameters, limits & patterns
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={editConfigJson}
                  onChange={(e) => setEditConfigJson(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-zinc-800 font-mono text-[11px] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                />
                {editConfigError && (
                  <p className="text-rose-600 text-[11px] mt-1 font-sans">
                    {editConfigError}
                  </p>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold shadow-sm font-sans"
                >
                  Update Policy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
