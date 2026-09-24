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

  // Function to render text with highlighted clickable URLs
  const renderMessageContent = () => {
    if (!messageText) {
      return <span className="text-slate-500 italic">Type a message to see a live preview...</span>;
    }

    if (urls.length === 0) {
      return <span className="whitespace-pre-wrap">{messageText}</span>;
    }

    // Split text by URLs and render links
    const parts: React.ReactNode[] = [];
    let remaining = messageText;

    urls.forEach((url, i) => {
      const idx = remaining.indexOf(url);
      if (idx !== -1) {
        if (idx > 0) {
          parts.push(remaining.substring(0, idx));
        }
        parts.push(
          <a
            key={i}
            href={ensureHttpUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 underline font-medium hover:text-emerald-300 break-all inline-flex items-center gap-0.5"
          >
            {url}
            <ExternalLink className="h-2.5 w-2.5 inline" />
          </a>
        );
        remaining = remaining.substring(idx + url.length);
      }
    });

    if (remaining.length > 0) {
      parts.push(remaining);
    }

    return <span className="whitespace-pre-wrap">{parts}</span>;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Device Switcher */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg mb-3">
        <button
          type="button"
          onClick={() => setDeviceType("android")}
          className={`px-3 py-1 text-xs font-medium rounded-md transition ${
            deviceType === "android"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Android Device
        </button>
        <button
          type="button"
          onClick={() => setDeviceType("iphone")}
          className={`px-3 py-1 text-xs font-medium rounded-md transition ${
            deviceType === "iphone"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Apple iOS
        </button>
      </div>

      {/* Realistic Smartphone Frame */}
      <div className="relative w-[300px] h-[520px] bg-slate-950 rounded-[40px] border-[5px] border-slate-800 shadow-2xl shadow-emerald-950/20 overflow-hidden flex flex-col">
        {/* Top Notch / Dynamic Island */}
        <div className="pt-2 px-6 flex items-center justify-between text-[11px] text-slate-400 select-none">
          <span className="font-semibold text-white">12:45</span>
          <div className="w-16 h-3 bg-slate-900 rounded-full" />
          <div className="flex items-center gap-1">
            <Signal className="h-3 w-3 text-slate-400" />
            <Wifi className="h-3 w-3 text-slate-400" />
            <Battery className="h-3 w-3 text-slate-400" />
          </div>
        </div>

        {/* Messaging App Top Bar */}
        <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-700/60 text-white flex items-center justify-center font-bold text-xs">
            {senderName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{senderName}</h4>
            <p className="text-[10px] text-slate-400 truncate">{operatorName} &bull; {recipientPhone}</p>
          </div>
        </div>

        {/* SMS Chat Feed */}
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950">
          <div className="text-center">
            <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
              Today &bull; SMS / MMS via SIM 1
            </span>
          </div>

          {/* Incoming Bubble */}
          <div className="flex flex-col items-start max-w-[88%]">
            <div
              className={`p-3 rounded-2xl text-xs leading-relaxed text-slate-100 shadow-md ${
                deviceType === "iphone"
                  ? "bg-slate-800 rounded-tl-sm text-white"
                  : "bg-emerald-950/60 border border-emerald-500/20 text-emerald-100 rounded-tl-sm"
              }`}
            >
              {renderMessageContent()}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 pl-1">12:45 PM &bull; Delivered</span>
          </div>
        </div>

        {/* Fake Input Bottom Bar */}
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-900/80 flex items-center gap-2">
          <div className="flex-1 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-full text-[11px] text-slate-500">
            Text message (SMS)
          </div>
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
            &uarr;
          </div>
        </div>

        {/* Bottom device indicator */}
        <div className="pb-1 flex justify-center">
          <div className="w-24 h-1 bg-slate-700 rounded-full" />
        </div>
      </div>
    </div>
  );
}
