"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSms } from "@/lib/context/sms-context";
import { TemplateRecord, TemplateCategory } from "@/lib/types";
import { calculateSMSAttributes } from "@/lib/sms-text";
import {
  FileText,
  Plus,
  Copy,
  Check,
  Send,
  Trash2,
  Sparkles,
  Zap,
  Search,
  Database,
  RefreshCw,
} from "lucide-react";

interface CategoryMeta {
  id: string;
  label: string;
  aliases: string[];
  color: string;
  badgeBg: string;
}

const CATEGORIES: CategoryMeta[] = [
  { id: "all", label: "All Templates", aliases: [], color: "purple", badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { id: "promo", label: "Promotions & Sales", aliases: ["promo", "promotional"], color: "emerald", badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { id: "txn", label: "Orders & Invoices", aliases: ["txn", "transactional"], color: "blue", badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: "alert", label: "OTPs & Security", aliases: ["alert", "alerts"], color: "amber", badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: "support", label: "Support & WhatsApp", aliases: ["support"], color: "teal", badgeBg: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  { id: "reminder", label: "Reminders & Follow-ups", aliases: ["reminder", "reminders"], color: "indigo", badgeBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { id: "feedback", label: "Feedback & Reviews", aliases: ["feedback"], color: "rose", badgeBg: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  { id: "hr", label: "HR & Recruitment", aliases: ["hr"], color: "violet", badgeBg: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { id: "event", label: "Events & Invites", aliases: ["event", "events"], color: "fuchsia", badgeBg: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" },
  { id: "realestate", label: "Real Estate", aliases: ["realestate"], color: "cyan", badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  { id: "bank", label: "Banking & Finance", aliases: ["bank", "banking"], color: "amber", badgeBg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { id: "custom", label: "Custom", aliases: ["custom"], color: "slate", badgeBg: "bg-slate-700/50 text-slate-300 border-slate-600" },
];

function getCategoryBadge(category: string): { label: string; badgeClass: string } {
  const norm = category?.toLowerCase() || "";
  const match = CATEGORIES.find((c) => c.aliases.includes(norm));
  if (match) {
    return { label: match.label, badgeClass: match.badgeBg };
  }
  return { label: category, badgeClass: "bg-slate-800 text-slate-400 border-slate-700" };
}

export default function TemplatesPage() {
  const {
    templates,
    addTemplate,
    deleteTemplate,
    refreshTemplates,
    reseedTemplates,
    isMongoConnected,
    mongoStats,
    showToast,
  } = useSms();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // New Template Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("promotional");
  const [text, setText] = useState("");

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    templates.forEach((t) => {
      const norm = (t.category || "").toLowerCase();
      CATEGORIES.forEach((cat) => {
        if (cat.id !== "all" && cat.aliases.includes(norm)) {
          counts[cat.id] = (counts[cat.id] || 0) + 1;
        }
      });
    });
    return counts;
  }, [templates]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeCat = CATEGORIES.find((c) => c.id === categoryFilter);

    return templates.filter((t) => {
      // Category check
      if (categoryFilter !== "all" && activeCat) {
        const norm = (t.category || "").toLowerCase();
        if (!activeCat.aliases.includes(norm)) {
          return false;
        }
      }

      // Search query check
      if (query) {
        const nameMatch = t.name.toLowerCase().includes(query);
        const textMatch = t.text.toLowerCase().includes(query);
        const varMatch = (t.variables || []).some((v) => v.toLowerCase().includes(query));
        const catMatch = t.category.toLowerCase().includes(query);
        if (!nameMatch && !textMatch && !varMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [templates, categoryFilter, searchQuery]);

  const handleCopyText = (t: TemplateRecord) => {
    navigator.clipboard.writeText(t.text);
    setCopiedId(t.id);
    showToast("info", `Template "${t.name}" copied to clipboard.`, "Copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSyncToMongo = async () => {
    setIsSyncing(true);
    try {
      await reseedTemplates();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) {
      showToast("warning", "Please provide template name and text.", "Incomplete");
      return;
    }

    // Extract variables {var}
    const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
    const vars = matches.map((m) => m.replace(/[{}]/g, ""));

    const newTpl: TemplateRecord = {
      id: `tpl_custom_${Date.now()}`,
      name: name.trim(),
      category,
      text: text.trim(),
      variables: Array.from(new Set(vars)),
      isPreset: false,
    };

    await addTemplate(newTpl);
    showToast("success", `Template "${newTpl.name}" created and saved!`, "Template Saved");
    setShowCreateModal(false);
    setName("");
    setText("");
  };

  const handleInsertToken = (token: string) => {
    setText((prev) => `${prev} {${token}}`);
  };

  const currentAttrs = calculateSMSAttributes(text);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <FileText className="h-3 w-3" />
                Templates & Variable Tokens
              </span>

              {isMongoConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Database className="h-2.5 w-2.5" />
                  MongoDB Synced ({mongoStats?.templates ?? templates.length})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  <Database className="h-2.5 w-2.5" />
                  Local Memory Mode
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Pakistani SMS Templates Library
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              120+ high-converting ready-to-use templates: Flash Sales, Order Confirmations, WhatsApp Support, OTPs, Reminders, and Urdu Alerts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncToMongo}
              disabled={isSyncing}
              title="Reseed / sync all preset templates into MongoDB"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync to DB"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-400 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Template</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by keyword, title, or {variable}..."
              className="w-full rounded-xl bg-slate-900/80 border border-slate-800 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                &times;
              </button>
            )}
          </div>

          {/* Result counter */}
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Showing <strong className="text-white">{filteredTemplates.length}</strong> of {templates.length} templates</span>
          </div>
        </div>

        {/* Category Filters Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            const isActive = categoryFilter === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                  isActive
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
                }`}
              >
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? "bg-purple-500/30 text-purple-200" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty Search Results */}
        {filteredTemplates.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
            <FileText className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No templates found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No templates match your search query &ldquo;{searchQuery}&rdquo;. Try another keyword or switch category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => {
            const attrs = calculateSMSAttributes(tpl.text);
            const badge = getCategoryBadge(tpl.category);

            return (
              <div
                key={tpl.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between hover:border-slate-700 hover:shadow-lg hover:shadow-purple-950/10 transition group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${badge.badgeClass}`}
                    >
                      {badge.label}
                    </span>
                    {tpl.isPreset ? (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="h-2.5 w-2.5" /> Preset
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition"
                        title="Delete custom template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white mb-2 group-hover:text-purple-300 transition">
                    {tpl.name}
                  </h3>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed min-h-[90px] whitespace-pre-wrap select-text font-sans">
                    {tpl.text}
                  </div>

                  {/* Variables Tokens */}
                  {tpl.variables && tpl.variables.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {tpl.variables.map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[10px] font-mono text-emerald-400 border border-slate-700/60"
                        >
                          {`{${v}}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Segment and character badge */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
                    <span>{attrs.charCount} characters</span>
                    <span className="text-emerald-400 font-medium">{attrs.segments} segment(s)</span>
                  </div>
                </div>

                {/* Actions: Copy, Test, Use Bulk */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(tpl)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition"
                  >
                    {copiedId === tpl.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedId === tpl.id ? "Copied" : "Copy"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* TEST BUTTON WITH EXACT TEMPLATE ID */}
                    <Link
                      href={`/test-sms?templateId=${encodeURIComponent(tpl.id)}`}
                      className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                      title="Test this template with a single phone number"
                    >
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span>Test</span>
                    </Link>

                    {/* USE BULK BUTTON WITH EXACT TEMPLATE ID */}
                    <Link
                      href={`/bulk-sms?templateId=${encodeURIComponent(tpl.id)}`}
                      className="flex items-center gap-1 text-xs text-white font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition"
                      title="Use this template in bulk SMS campaign"
                    >
                      <Send className="h-3 w-3" />
                      <span>Use Bulk</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Create Custom SMS Template
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid Mega Sale Offer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-purple-500"
                >
                  <option value="promo">Promotions & Sales (promo)</option>
                  <option value="txn">Orders & Transactional (txn)</option>
                  <option value="alert">OTPs & Alerts (alert)</option>
                  <option value="support">Customer Support (support)</option>
                  <option value="reminder">Reminders (reminder)</option>
                  <option value="feedback">Feedback & Reviews (feedback)</option>
                  <option value="hr">HR & Recruitment (hr)</option>
                  <option value="event">Events & Invites (event)</option>
                  <option value="realestate">Real Estate (realestate)</option>
                  <option value="bank">Banking & Finance (bank)</option>
                  <option value="custom">General Custom (custom)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">Template Text</label>
                  <div className="flex flex-wrap gap-1">
                    {["name", "link", "order_id", "amount", "code", "discount"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertToken(tag)}
                        className="px-1.5 py-0.5 bg-slate-800 text-purple-300 rounded text-[10px] font-mono hover:bg-slate-700"
                      >
                        +{`{${tag}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={5}
                  required
                  placeholder="Salam {name}! Exclusive offer on our store: {link}..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white outline-none focus:border-purple-500 leading-relaxed font-sans"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>{currentAttrs.charCount} chars &bull; {currentAttrs.segments} segment(s)</span>
                  <span>{currentAttrs.encoding}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition"
                >
                  Save to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
