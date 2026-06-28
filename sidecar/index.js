import { createClient } from "@supabase/supabase-js";
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import { usePostgresAuthState } from "./whatsapp.auth.js";
import { startWorker, handleWhatsAppEvents } from "./whatsapp.worker.js";
import { startHealthService } from "./health.service.js";
import pino from "pino";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Global exception handling to prevent Baileys network drops from crashing the Node process
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Anti-Crash] Unhandled Rejection at:", promise, "reason:", reason?.stack || reason);
});

process.on("uncaughtException", (err, origin) => {
  console.error("[Anti-Crash] Uncaught Exception:", err?.stack || err, "origin:", origin);
});

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Configure simple logger for Baileys
const logger = pino({ level: "info" });

let activeSock = null;

export function getWASocket() {
  return activeSock;
}

async function main() {
  console.log("🚀 Starting Baileys WhatsApp Connection...");
  const { state, saveCreds } = await usePostgresAuthState(supabase, "default-session");

  // Fetch latest WhatsApp Web version dynamically to prevent handshake failures
  const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1035194821],
    isLatest: false
  }));
  console.log(`[WhatsApp] Using WA version v${version.join(".")}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: true,
    logger,
    browser: ["Siara Dental", "Chrome", "1.0.0"],
  });

  activeSock = sock;
  handleWhatsAppEvents(sock, supabase);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      console.log("[WhatsApp] New QR code generated. Updating database...");
      const { error } = await supabase
        .from("connection_status")
        .update({
          status: "awaiting_qr",
          qr_code: qr,
        })
        .eq("id", 1);

      if (error) {
        console.error("[WhatsApp] Failed to update QR code in connection_status:", error.message);
      }
    }

    if (connection === "connecting") {
      console.log("[WhatsApp] Connecting...");
      await supabase
        .from("connection_status")
        .update({ status: "connecting" })
        .eq("id", 1);
    }

    if (connection === "open") {
      console.log("[WhatsApp] Connected successfully! Session open.");
      await supabase
        .from("connection_status")
        .update({
          status: "connected",
          qr_code: null,
          last_connected_at: new Date().toISOString(),
        })
        .eq("id", 1);
    }

    if (connection === "close") {
      activeSock = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`[WhatsApp] Connection closed. Status Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      
      await supabase
        .from("connection_status")
        .update({
          status: "disconnected",
          qr_code: null,
        })
        .eq("id", 1);

      if (shouldReconnect) {
        setTimeout(main, 5000);
      } else {
        console.log("[WhatsApp] Logged out. Clearing credentials from database.");
        const sessionId = "default-session";
        const { error } = await supabase
          .from("whatsapp_sessions")
          .delete()
          .like("id", `${sessionId}:%`);
        if (error) {
          console.error("[WhatsApp] Failed to clear sessions on logout:", error.message);
        }
      }
    }
  });
}

// Start background worker and health service once
startWorker(supabase);
startHealthService(supabase, 3001);

main().catch((e) => {
  console.error("Fatal error in sidecar main:", e);
  process.exit(1);
});
