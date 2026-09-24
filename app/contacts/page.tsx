"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";

export default function ContactsPage() {
  const { contacts, contactGroups, addContacts, deleteContact, showToast } = useSms();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");

  // Single Contact Modal / Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [group, setGroup] = useState("Customers");
  const [customGroup, setCustomGroup] = useState("");
  const [notes, setNotes] = useState("");

  // Bulk Import Modal
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkGroup, setBulkGroup] = useState("Leads");

  // Phone validation for modal
  const phoneValidation = useMemo(() => {
    return validatePakistanPhone(phone);
  }, [phone]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedGroupFilter !== "all" && c.group !== selectedGroupFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesNat = c.nationalPhone?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesNat) return false;
      }
      return true;
    });
  }, [contacts, selectedGroupFilter, searchQuery]);

  // Handle Add Single Contact
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValidation.isValid || !phoneValidation.e164) {
      showToast("danger", phoneValidation.reason || "Please enter a valid Pakistani mobile number.", "Invalid Number");
      return;
    }

    const finalGroup = customGroup.trim() || group || "General";

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
    setShowAddModal(false);
    setName("");
    setPhone("");
    setNotes("");
    setCustomGroup("");
  };

  // Handle Bulk Import
  const handleBulkImport = async () => {
    const lines = bulkImportText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      showToast("warning", "No data to import.", "Empty Input");
      return;
    }

    const newRecords: ContactRecord[] = [];
    lines.forEach((line, i) => {
      // Check if CSV format: name, phone or just phone
      const parts = line.split(",").map((p) => p.trim());
      let contactName = "Customer";
      let phoneInput = line;

      if (parts.length >= 2) {
        contactName = parts[0];
        phoneInput = parts[1];
      }

      const val = validatePakistanPhone(phoneInput);
      if (val.isValid && val.e164) {
        newRecords.push({
          id: `cnt_${Date.now()}_${i}`,
          name: contactName,
          phone: val.e164,
          nationalPhone: val.national || val.e164,
          operator: val.operator || "Unknown",
          group: bulkGroup || "General",
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (newRecords.length === 0) {
      showToast("danger", "No valid Pakistani mobile numbers found in import text.", "Import Failed");
      return;
    }

    await addContacts(newRecords);
    showToast("success", `Imported ${newRecords.length} contacts into group "${bulkGroup}"!`, "Import Successful");
    setShowBulkImportModal(false);
    setBulkImportText("");
  };

  // Export CSV
  const handleExportContacts = () => {
    if (contacts.length === 0) return;
    const header = "Name,Phone,NationalPhone,Network,Group,Notes,CreatedAt\n";
    const body = contacts
      .map(
        (c) =>
          `"${c.name}","${c.phone}","${c.nationalPhone}","${c.operator}","${c.group}","${(c.notes || "").replace(/"/g, '""')}","${c.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `contacts_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Pakistani Contacts Directory
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage client numbers, segment into targeted groups (VIP, Leads, Orders), and launch direct bulk campaigns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
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
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Group Filter Chips & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Groups Tabs */}
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

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or number..."
              className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur-md">
          {filteredContacts.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No contacts found</p>
              <p className="text-xs text-slate-500 mt-1">
                {contacts.length === 0
                  ? "Build your customer phonebook by adding single contacts or importing a CSV."
                  : "No contacts match the current search or group filter."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  Add First Contact
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                    <th className="py-3 px-4 font-semibold">Name</th>
                    <th className="py-3 px-4 font-semibold">Pakistani Number</th>
                    <th className="py-3 px-4 font-semibold">Network</th>
                    <th className="py-3 px-4 font-semibold">Group</th>
                    <th className="py-3 px-4 font-semibold">Notes</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-xs">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{contact.name}</span>
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/test-sms`}
                            className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 transition"
                            title="Send Test SMS"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Link>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Single Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-400" />
                Add New Contact
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4 text-xs">
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
                  >
                  </input>
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
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!phoneValidation.isValid}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  Save Contact
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
                &times;
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

              <div>
                <label className="text-slate-400 block mb-1">
                  Paste Numbers (One per line or Name,Phone format)
                </label>
                <textarea
                  rows={6}
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder="03001234567&#10;Ahmed Khan, 03121234567&#10;+923331234567"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-white outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  All numbers are automatically validated and normalized for Pakistani networks.
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
