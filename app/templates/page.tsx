"use client";

import { useState } from "react";
import Link from "next/link";
import { useSms } from "@/lib/context/sms-context";
import { TemplateRecord } from "@/lib/types";
import { calculateSMSAttributes } from "@/lib/sms-text";
import {
  FileText,
  Plus,
  Copy,
  Check,
  Send,
  Trash2,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";

export default function TemplatesPage() {
  const { templates, addTemplate, deleteTemplate, showToast } = useSms();

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Template Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateRecord["category"]>("promotional");
  const [text, setText] = useState("");

  const filteredTemplates = templates.filter((t) => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  const handleCopyText = (t: TemplateRecord) => {
    navigator.clipboard.writeText(t.text);
    setCopiedId(t.id);
    showToast("info", "Template copied to clipboard.", "Copied");
    setTimeout(() => setCopiedId(null), 2000);
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
    showToast("success", `Template "${newTpl.name}" created!`, "Template Saved");
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
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Pakistani SMS Templates Library
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              High-converting promotions, OTP verifications, courier tracking, and bilingual Urdu templates.
            </p>
          </div>

          <div>
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
        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Templates" },
            { id: "promotional", label: "Promotions & Sales" },
            { id: "transactional", label: "Orders & Invoices" },
            { id: "alerts", label: "OTPs & Alerts" },
            { id: "support", label: "WhatsApp & Care" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                categoryFilter === cat.id
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tpl) => {
            const attrs = calculateSMSAttributes(tpl.text);

            return (
              <div
                key={tpl.id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                      {tpl.category}
                    </span>
                    {tpl.isPreset ? (
                      <span className="text-[10px] text-emerald-400 font-semibold">Preset</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-white mb-2">{tpl.name}</h3>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed min-h-[90px] whitespace-pre-wrap">
                    {tpl.text}
                  </div>

                  {/* Variables */}
                  {tpl.variables && tpl.variables.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {tpl.variables.map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 text-[10px] font-mono text-emerald-400"
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

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(tpl)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/60 transition"
                  >
                    {copiedId === tpl.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedId === tpl.id ? "Copied" : "Copy"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <Link
                      href="/test-sms"
                      className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 transition"
                    >
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span>Test</span>
                    </Link>

                    <Link
                      href="/bulk-sms"
                      className="flex items-center gap-1 text-xs text-white font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition"
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
                className="text-slate-400 hover:text-white"
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
                  <option value="promotional">Promotional</option>
                  <option value="transactional">Transactional</option>
                  <option value="alerts">Alerts / Security</option>
                  <option value="support">Customer Support</option>
                  <option value="custom">General Custom</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">Template Text</label>
                  <div className="flex gap-1">
                    {["name", "link", "order_id", "amount", "code"].map((tag) => (
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
                  placeholder="Salam {name}! Check out our catalog at {link}..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white outline-none focus:border-purple-500 leading-relaxed"
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
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
