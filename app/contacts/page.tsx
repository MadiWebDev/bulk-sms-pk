"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useSms } from "@/lib/context/sms-context";
import { validatePakistanPhone } from "@/lib/pakistan-phone";
import { OperatorBadge } from "@/components/operator-badge";
import { ContactRecord } from "@/lib/types";
import {
  Users,
  UserPlus,
  Search,
  Send,
  Trash2,
  Download,
  Upload,
  Plus,
  Phone,
  Tag,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  X,
  ArrowUp,
  ArrowDown,
  ShieldOff,
  ShieldCheck,
  FileUp,
  MessageSquare,
  ChevronDown,
} from "lucide-react";

type SortField = "name" | "group" | "createdAt";
type SortDir = "asc" | "desc";

const OPTOUT_STORAGE_KEY = "bulk_sms_optout_v1"; // shared with the Bulk SMS page
const PAGE_SIZE = 50;

export default function ContactsPage() {
  const {
    contacts,
    contactGroups,
    addContacts,
    deleteContact,
    showToast,
    activeGatewayUsername,
    savedGateways,
  } = useSms();

  const activeGw = savedGateways.find((g) => g.username === activeGatewayUsername) || {
    username: activeGatewayUsername || "Default",
    name: activeGatewayUsername ? `Android (${activeGatewayUsername})` : "Default",
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");
  const [optOutFilter, setOptOutFilter] = useState<"all" | "optedOut" | "active">("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedGroupFilter, optOutFilter, sortField, sortDir]);

  // Row selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetGroup, setBulkTargetGroup] = useState("");

  // Opt-out list — shared storage key with the Bulk SMS campaign page
  const [optOutRaw, setOptOutRaw] = useState("");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(OPTOUT_STORAGE_KEY);
      if (saved) setOptOutRaw(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const persistOptOut = (raw: string) => {
    setOptOutRaw(raw);
    try {
      window.localStorage.setItem(OPTOUT_STORAGE_KEY, raw);
    } catch {
      /* ignore */
    }
  };
  const optedOutSet = useMemo(() => {
    const set = new Set<string>();
    optOutRaw
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((l) => {
        const v = validatePakistanPhone(l);
        if (v.isValid && v.e164) set.add(v.e164);
        else set.add(l);
      });
    return set;
  }, [optOutRaw]);

  const addNumbersToOptOut = (phones: string[]) => {
    const merged = new Set(optedOutSet);
    phones.forEach((p) => merged.add(p));
    persistOptOut(Array.from(merged).join("\n"));
  };
  const removeNumbersFromOptOut = (phones: string[]) => {
    const toRemove = new Set(phones);
    const remaining = Array.from(optedOutSet).filter((p) => !toRemove.has(p));
    persistOptOut(remaining.join("\n"));
  };

  // Add / Edit Contact form (shared modal)
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [group, setGroup] = useState("Customers");
  const [customGroup, setCustomGroup] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setPhone("");
    setGroup("Customers");
    setCustomGroup("");
    setNotes("");
    setEditingContactId(null);
  };

  const openAddModal = () => {
    if (!activeGatewayUsername) {
      showToast("warning", "Select an active Android Gateway before adding contacts.", "No Gateway Selected");
      return;
    }
    resetForm();
    setFormMode("add");
  };

  const openEditModal = (c: ContactRecord) => {
    if (!activeGatewayUsername) {
      showToast("warning", "Select an active Android Gateway before editing contacts.", "No Gateway Selected");
      return;
    }
    setEditingContactId(c.id);
    setName(c.name);
    setPhone(c.nationalPhone || c.phone);
    if (contactGroups.includes(c.group)) {
      setGroup(c.group);
      setCustomGroup("");
    } else {
      setGroup("");
      setCustomGroup(c.group);
    }
    setNotes(c.notes || "");
    setFormMode("edit");
  };

  const closeModal = () => {
    setFormMode(null);
    resetForm();
  };

  // Bulk Import Modal
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkGroup, setBulkGroup] = useState("Leads");
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  // Phone validation for modal
  const phoneValidation = useMemo(() => {
    return validatePakistanPhone(phone);
  }, [phone]);

  // Filtered + sorted contacts
  const filteredContacts = useMemo(() => {
    let list = contacts.filter((c) => {
      if (selectedGroupFilter !== "all" && c.group !== selectedGroupFilter) return false;
      if (optOutFilter === "optedOut" && !optedOutSet.has(c.phone)) return false;
      if (optOutFilter === "active" && optedOutSet.has(c.phone)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesNat = c.nationalPhone?.toLowerCase().includes(q);
        const matchesNotes = c.notes?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesNat && !matchesNotes) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "group") cmp = a.group.localeCompare(b.group);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [contacts, selectedGroupFilter, optOutFilter, optedOutSet, searchQuery, sortField, sortDir]);

  const visibleContacts = filteredContacts.slice(0, visibleCount);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === visibleContacts.length && visibleContacts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleContacts.map((c) => c.id)));
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedIds.has(c.id)),
    [contacts, selectedIds]
  );

  // Handle Add / Edit submit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValidation.isValid || !phoneValidation.e164) {
      showToast("danger", phoneValidation.reason || "Please enter a valid Pakistani mobile number.", "Invalid Number");
      return;
    }

    const finalGroup = customGroup.trim() || group || "General";

    if (formMode === "edit" && editingContactId) {
      const existing = contacts.find((c) => c.id === editingContactId);
      const updated: ContactRecord = {
        id: editingContactId,
        name: name.trim() || "Customer",
        phone: phoneValidation.e164,
        nationalPhone: phoneValidation.national || phoneValidation.e164,
        operator: phoneValidation.operator || "Unknown",
        group: finalGroup,
        notes: notes.trim(),
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      await deleteContact(editingContactId);
      await addContacts([updated]);
      showToast("success", `Contact ${updated.name} updated!`, "Contact Updated");
    } else {
      const newContact: ContactRecord = {
        id: `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim() || "Customer",
        phone: phoneValidation.e164,
        nationalPhone: phoneValidation.national || phoneValidation.e164,
        operator: phoneValidation.operator || "Unknown",
        group: finalGroup,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };
      await addContacts([newContact]);
      showToast("success", `Contact ${newContact.name} saved!`, "Contact Added");
    }

    closeModal();
  };

  // Parses either a headered CSV (phone/name columns) or plain "name,phone" / phone-only lines
  const parseImportLines = (text: string): { name: string; phoneInput: string }[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    const firstCols = lines[0].split(",").map((c) => c.trim().toLowerCase());
    const looksLikeHeader = firstCols.some((c) => c.includes("phone") || c.includes("mobile"));

    const rows: { name: string; phoneInput: string }[] = [];

    if (looksLikeHeader) {
      const phoneIdx = firstCols.findIndex((c) => c.includes("phone") || c.includes("mobile") || c.includes("num"));
      const nameIdx = firstCols.findIndex((c) => c.includes("name"));
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        rows.push({
          name: nameIdx !== -1 ? parts[nameIdx] || "Customer" : "Customer",
          phoneInput: parts[phoneIdx !== -1 ? phoneIdx : 0] || "",
        });
      }
    } else {
      lines.forEach((line) => {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          rows.push({ name: parts[0], phoneInput: parts[1] });
        } else {
          rows.push({ name: "Customer", phoneInput: line });
        }
      });
    }

    return rows;
  };

  // Handle Bulk Import (with duplicate + invalid detection)
  const handleBulkImport = async () => {
    const rows = parseImportLines(bulkImportText);
    if (rows.length === 0) {
      showToast("warning", "No data to import.", "Empty Input");
      return;
    }

    const existingPhones = new Set(contacts.map((c) => c.phone));
    const seenInBatch = new Set<string>();
    const newRecords: ContactRecord[] = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    rows.forEach((row, i) => {
      const val = validatePakistanPhone(row.phoneInput);
      if (!val.isValid || !val.e164) {
        invalidCount++;
        return;
      }
      if (existingPhones.has(val.e164) || seenInBatch.has(val.e164)) {
        duplicateCount++;
        return;
      }
      seenInBatch.add(val.e164);
      newRecords.push({
        id: `cnt_${Date.now()}_${i}`,
        name: row.name || "Customer",
        phone: val.e164,
        nationalPhone: val.national || val.e164,
        operator: val.operator || "Unknown",
        group: bulkGroup || "General",
        createdAt: new Date().toISOString(),
      });
    });

    if (newRecords.length === 0) {
      showToast(
        "danger",
        `No new contacts imported (${invalidCount} invalid, ${duplicateCount} already exist).`,
        "Import Failed"
      );
      return;
    }

    await addContacts(newRecords);
    showToast(
      "success",
      `Imported ${newRecords.length} into "${bulkGroup}". Skipped ${duplicateCount} duplicate(s) and ${invalidCount} invalid number(s).`,
      "Import Successful"
    );
    setShowBulkImportModal(false);
    setBulkImportText("");
  };

  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setBulkImportText(String(reader.result || "").trim());
      showToast("success", `Loaded ${file.name}.`, "File Loaded");
    };
    reader.onerror = () => showToast("error", "Could not read that file.", "Upload Failed");
    reader.readAsText(file);
  };
  const handleCsvFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readCsvFile(file);
    e.target.value = "";
  };
  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCsv(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readCsvFile(file);
  };

  // Export helpers
  const exportContactsToCsv = (list: ContactRecord[], filenamePrefix: string) => {
    if (list.length === 0) return;
    const header = "Name,Phone,NationalPhone,Network,Group,OptedOut,Notes,CreatedAt\n";
    const body = list
      .map(
        (c) =>
          `"${c.name}","${c.phone}","${c.nationalPhone}","${c.operator}","${c.group}","${optedOutSet.has(c.phone) ? "Yes" : "No"}","${(c.notes || "").replace(/"/g, '""')}","${c.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filenamePrefix}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const handleExportContacts = () => exportContactsToCsv(contacts, "contacts_export");
  const handleExportSelected = () => exportContactsToCsv(selectedContacts, "contacts_selected");

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} contact(s)? This cannot be undone.`)) return;
    for (const id of selectedIds) {
      await deleteContact(id);
    }
    showToast("warning", `Deleted ${selectedIds.size} contact(s).`, "Contacts Deleted");
    setSelectedIds(new Set());
  };

  const handleBulkGroupChange = async () => {
    const target = bulkTargetGroup.trim();
    if (!target || selectedIds.size === 0) return;
    for (const c of selectedContacts) {
      await deleteContact(c.id);
      await addContacts([{ ...c, group: target }]);
    }
    showToast("success", `Moved ${selectedIds.size} contact(s) to "${target}".`, "Group Updated");
    setSelectedIds(new Set());
    setBulkTargetGroup("");
  };

  const handleBulkOptOut = () => {
    addNumbersToOptOut(selectedContacts.map((c) => c.phone));
    showToast("warning", `${selectedIds.size} contact(s) added to the opt-out list.`, "Opted Out");
  };
  const handleBulkOptIn = () => {
    removeNumbersFromOptOut(selectedContacts.map((c) => c.phone));
    showToast("success", `${selectedIds.size} contact(s) removed from the opt-out list.`, "Opted Back In");
  };

  const toggleContactOptOut = (c: ContactRecord) => {
    if (optedOutSet.has(c.phone)) {
      removeNumbersFromOptOut([c.phone]);
      showToast("info", `${c.name} can receive campaigns again.`, "Opted In");
    } else {
      addNumbersToOptOut([c.phone]);
      showToast("warning", `${c.name} will be skipped in future campaigns.`, "Opted Out");
    }
  };

  // Quick stats
  const stats = useMemo(() => {
    const operatorCounts: Record<string, number> = {};
    contacts.forEach((c) => {
      operatorCounts[c.operator] = (operatorCounts[c.operator] || 0) + 1;
    });
    return {
      total: contacts.length,
      optedOut: contacts.filter((c) => optedOutSet.has(c.phone)).length,
      operatorCounts,
    };
  }, [contacts, optedOutSet]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 font-semibold hover:text-white transition"
    >
      {label}
      {sortField === field &&
        (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Header */}
      <div className="border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="h-3 w-3" />
                Customer Phonebook & Segmentation
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                📱 Gateway: {activeGw.username}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Pakistani Contacts Directory
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage client numbers, segment into targeted groups (VIP, Leads, Orders), track opt-outs, and launch direct bulk campaigns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-400 transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add Contact</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkImportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Bulk Import</span>
            </button>

            <button
              type="button"
              onClick={handleExportContacts}
              disabled={contacts.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <Link
              href="/bulk-sms"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 transition"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Open Bulk SMS</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Quick stats bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            {stats.total} Total Contacts
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
              stats.optedOut > 0
                ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                : "bg-slate-900 border-slate-800 text-slate-400"
            }`}
          >
            <ShieldOff className="h-3.5 w-3.5" />
            {stats.optedOut} Opted-Out
          </span>
          {Object.entries(stats.operatorCounts).map(([op, count]) => (
            <span
              key={op}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400"
            >
              <OperatorBadge operator={op} size="sm" /> {count}
            </span>
          ))}
        </div>

        {/* Group Filter Chips & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedGroupFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedGroupFilter === "all"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              All ({contacts.length})
            </button>

            {contactGroups.map((grp) => {
              const count = contacts.filter((c) => c.group === grp).length;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroupFilter(grp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                    selectedGroupFilter === grp
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                  }`}
                >
                  {grp} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={optOutFilter}
              onChange={(e) => setOptOutFilter(e.target.value as typeof optOutFilter)}
              className="rounded-xl bg-slate-900 border border-slate-800 px-2.5 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500"
            >
              <option value="all">All Contacts</option>
              <option value="active">Active Only</option>
              <option value="optedOut">Opted-Out Only</option>
            </select>

            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, number, or notes..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-xs">
            <span className="font-bold text-emerald-300">{selectedIds.size} selected</span>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={bulkTargetGroup}
                onChange={(e) => setBulkTargetGroup(e.target.value)}
                placeholder="Move to group..."
                className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1.5 text-white placeholder-slate-500 outline-none focus:border-emerald-500 w-36"
              />
              <button
                type="button"
                onClick={handleBulkGroupChange}
                disabled={!bulkTargetGroup.trim()}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white disabled:opacity-40 font-semibold"
              >
                Apply
              </button>
            </div>

            <button
              type="button"
              onClick={handleBulkOptOut}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 font-semibold"
            >
              <ShieldOff className="h-3.5 w-3.5" /> Opt Out
            </button>
            <button
              type="button"
              onClick={handleBulkOptIn}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Opt Back In
            </button>
            <button
              type="button"
              onClick={handleExportSelected}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-slate-400 hover:text-white"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Contacts Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-md">
          {filteredContacts.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No contacts found</p>
              <p className="text-xs text-slate-500 mt-1">
                {contacts.length === 0
                  ? "Build your customer phonebook by adding single contacts or importing a CSV."
                  : "No contacts match the current search or filters."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={openAddModal}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  Add First Contact
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                      <th className="py-3 px-4 w-8">
                        <input
                          type="checkbox"
                          checked={visibleContacts.length > 0 && selectedIds.size === visibleContacts.length}
                          onChange={toggleSelectAll}
                          className="rounded accent-emerald-500"
                        />
                      </th>
                      <th className="py-3 px-4">
                        <SortHeader field="name" label="Name" />
                      </th>
                      <th className="py-3 px-4 font-semibold">Pakistani Number</th>
                      <th className="py-3 px-4 font-semibold">Network</th>
                      <th className="py-3 px-4">
                        <SortHeader field="group" label="Group" />
                      </th>
                      <th className="py-3 px-4 font-semibold">Notes</th>
                      <th className="py-3 px-4">
                        <SortHeader field="createdAt" label="Added" />
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {visibleContacts.map((contact) => {
                      const isOptedOut = optedOutSet.has(contact.phone);
                      return (
                        <tr key={contact.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(contact.id)}
                              onChange={() => toggleSelectOne(contact.id)}
                              className="rounded accent-emerald-500"
                            />
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                                {contact.name.charAt(0).toUpperCase()}
                              </div>
                              <span>{contact.name}</span>
                              {isOptedOut && (
                                <span
                                  title="Opted out of campaigns"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-950/50 text-rose-300 border border-rose-500/30 text-[9px] font-bold uppercase"
                                >
                                  <ShieldOff className="h-2.5 w-2.5" /> Opt-out
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-emerald-300 font-semibold">
                              {contact.nationalPhone}
                            </span>
                            <span className="text-[10px] text-slate-500 block">{contact.phone}</span>
                          </td>
                          <td className="py-3 px-4">
                            <OperatorBadge operator={contact.operator} size="sm" />
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium text-[11px]">
                              <Tag className="h-2.5 w-2.5 text-slate-400" />
                              <span>{contact.group}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                            {contact.notes || "--"}
                          </td>
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(contact.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href="/test-sms"
                                className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 transition"
                                title="Send Test SMS"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => openEditModal(contact)}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
                                title="Edit Contact"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleContactOptOut(contact)}
                                className={`p-1.5 rounded-lg border transition ${
                                  isOptedOut
                                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                                    : "bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/40"
                                }`}
                                title={isOptedOut ? "Opt back in" : "Opt out of campaigns"}
                              >
                                {isOptedOut ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteContact(contact.id)}
                                className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/40 transition"
                                title="Delete Contact"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {visibleCount < filteredContacts.length && (
                <div className="flex justify-center py-4 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:text-white transition"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Load {Math.min(PAGE_SIZE, filteredContacts.length - visibleCount)} More
                    <span className="text-slate-500">
                      ({visibleCount}/{filteredContacts.length})
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add / Edit Contact Modal */}
      {formMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {formMode === "edit" ? (
                  <Pencil className="h-4 w-4 text-emerald-400" />
                ) : (
                  <UserPlus className="h-4 w-4 text-emerald-400" />
                )}
                {formMode === "edit" ? "Edit Contact" : "Add New Contact"}
              </h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Usman Ali"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">Pakistani Mobile Number</label>
                  {phoneValidation.isValid && (
                    <OperatorBadge operator={phoneValidation.operator} size="sm" />
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="03001234567 or +923001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 font-mono text-white outline-none ${
                    phoneValidation.isValid
                      ? "border-emerald-500/40 bg-slate-950"
                      : "border-slate-800 bg-slate-950 focus:border-rose-500"
                  }`}
                />
                {phone && !phoneValidation.isValid && (
                  <span className="text-[10px] text-rose-400 mt-1 block">
                    {phoneValidation.reason}
                  </span>
                )}
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Contact Group</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none"
                  >
                    <option value="">-- choose --</option>
                    <option value="Customers">Customers</option>
                    <option value="VIP">VIP</option>
                    <option value="Leads">Leads</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Karachi">Karachi</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Or new group name..."
                    value={customGroup}
                    onChange={(e) => setCustomGroup(e.target.value)}
                    className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Inquired about wholesale catalog"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!phoneValidation.isValid}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {formMode === "edit" ? "Save Changes" : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-400" />
                Bulk Import Contacts
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Target Group</label>
                <input
                  type="text"
                  value={bulkGroup}
                  onChange={(e) => setBulkGroup(e.target.value)}
                  placeholder="e.g. Ramadan Promotion Leads"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* CSV drag & drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingCsv(true);
                }}
                onDragLeave={() => setIsDraggingCsv(false)}
                onDrop={handleCsvDrop}
                onClick={() => csvFileInputRef.current?.click()}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-[11px] cursor-pointer transition ${
                  isDraggingCsv
                    ? "border-emerald-500 bg-emerald-950/20 text-emerald-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>Drag & drop a .csv file, or click to browse</span>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvFileInput}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Paste Numbers (one per line, "Name,Phone", or a headered CSV)
                </label>
                <textarea
                  rows={6}
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder="03001234567&#10;Ahmed Khan, 03121234567&#10;+923331234567"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-white outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Numbers are validated, normalized, and de-duplicated against your existing phonebook automatically.
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkImportModal(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={!bulkImportText.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                Import Contacts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}