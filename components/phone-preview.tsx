"use client";

import { useState } from "react";
import { extractUrls, ensureHttpUrl } from "@/lib/sms-text";
import { Smartphone, Signal, Wifi, Battery, ExternalLink } from "lucide-react";

interface PhonePreviewProps {
  messageText: string;
  recipientPhone?: string;
  senderName?: string;
  operatorName?: string;
}

export function PhonePreview({
  messageText,
  recipientPhone = "+92 300 1234567",
  senderName = "Brand / SMSGate",
  operatorName = "Jazz PK",
}: PhonePreviewProps) {
  const [deviceType, setDeviceType] = useState<"android" | "iphone">("android");
  const urls = extractUrls(messageText);

  const renderMessageContent = () => {
    if (!messageText) {
      return <span className="text-[#484f58] italic">Type a message to see a live preview…</span>;
    }
    if (urls.length === 0) {
      return <span className="whitespace-pre-wrap">{messageText}</span>;
    }
    const parts: React.ReactNode[] = [];
    let remaining = messageText;
    urls.forEach((url, i) => {
      const idx = remaining.indexOf(url);
      if (idx !== -1) {
        if (idx > 0) parts.push(remaining.substring(0, idx));
        parts.push(
          <a key={i} href={ensureHttpUrl(url)} target="_blank" rel="noopener noreferrer"
            className="text-emerald-400 underline font-medium hover:text-emerald-300 break-all inline-flex items-center gap-0.5">
            {url}<ExternalLink className="h-2.5 w-2.5 inline" />
          </a>
        );
        remaining = remaining.substring(idx + url.length);
      }
    });
    if (remaining.length > 0) parts.push(remaining);
    return <span className="whitespace-pre-wrap">{parts}</span>;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Device switcher */}
      <div className="flex items-center gap-1 bg-[#161b22] border border-[#21262d] p-1 rounded-lg mb-3">
        {(["android", "iphone"] as const).map((dt) => (
          <button key={dt} type="button" onClick={() => setDeviceType(dt)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              deviceType === dt
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-[#7d8590] hover:text-white"
            }`}>
            {dt === "android" ? "Android" : "Apple iOS"}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="relative w-[300px] h-[520px] bg-[#050810] rounded-[40px] border-[5px] border-[#21262d] shadow-2xl shadow-black/60 overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className="pt-2 px-6 flex items-center justify-between text-[11px] text-[#484f58] select-none">
          <span className="font-semibold text-white">12:45</span>
          <div className="w-14 h-3 bg-[#161b22] rounded-full" />
          <div className="flex items-center gap-1">
            <Signal className="h-3 w-3" /><Wifi className="h-3 w-3" /><Battery className="h-3 w-3" />
          </div>
        </div>

        {/* App top bar */}
        <div className="px-4 py-2.5 border-b border-[#21262d] bg-[#0d1117] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-700/60 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {senderName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{senderName}</h4>
            <p className="text-[10px] text-[#7d8590] truncate">{operatorName} · {recipientPhone}</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#050810]">
          <div className="text-center">
            <span className="text-[10px] text-[#484f58] bg-[#161b22] px-2 py-0.5 rounded-full">
              Today · SMS via SIM 1
            </span>
          </div>
          <div className="flex flex-col items-start max-w-[88%]">
            <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-md ${
              deviceType === "iphone"
                ? "bg-[#21262d] rounded-tl-sm text-white"
                : "bg-emerald-950/60 border border-emerald-500/20 text-emerald-100 rounded-tl-sm"
            }`}>
              {renderMessageContent()}
            </div>
            <span className="text-[9px] text-[#484f58] mt-1 pl-1">12:45 PM · Delivered</span>
          </div>
        </div>

        {/* Input bar */}
        <div className="p-2.5 border-t border-[#21262d] bg-[#0d1117] flex items-center gap-2">
          <div className="flex-1 bg-[#161b22] border border-[#21262d] px-3 py-1.5 rounded-full text-[11px] text-[#484f58]">
            Text message (SMS)
          </div>
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">↑</div>
        </div>

        {/* Home indicator */}
        <div className="pb-1.5 flex justify-center bg-[#050810]">
          <div className="w-20 h-1 bg-[#21262d] rounded-full" />
        </div>
      </div>
    </div>
  );
}
