import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in environment.");
  process.exit(1);
}

console.log("Initializing Mock Sidecar with Supabase URL:", url);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: true },
});

async function authenticate() {
  const email = "mock-sidecar@example.com";
  const password = "MockSidecarPassword123!";

  console.log("Trying anonymous sign-in...");
  let { data, error } = await supabase.auth.signInAnonymously();
  if (!error) {
    console.log("Authenticated anonymously as:", data.user?.id);
    return;
  }
  
  console.log("Anonymous sign-in failed:", error.message, ". Falling back to email/password...");
  let signinResult = await supabase.auth.signInWithPassword({ email, password });
  if (signinResult.error) {
    console.log("Sign-in failed, trying to sign up...");
    const signUpResult = await supabase.auth.signUp({ email, password });
    if (signUpResult.error) {
      console.error("Authentication failed:", signUpResult.error.message);
      throw signUpResult.error;
    }
    data = signUpResult.data;
  } else {
    data = signinResult.data;
  }
  
  console.log("Authenticated as:", data.user?.email);
}

async function startHeartbeat() {
  console.log("Starting sidecar heartbeat service...");
  // Initialize status to connected
  const { error: initError } = await supabase
    .from("connection_status")
    .update({
      status: "connected",
      qr_code: null,
      last_connected_at: new Date().toISOString(),
      sidecar_last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (initError) {
    console.error("Failed to initialize connection status:", initError.message);
  } else {
    console.log("Connection status initialized to 'connected'.");
  }

  // Heartbeat loop
  setInterval(async () => {
    const { error } = await supabase
      .from("connection_status")
      .update({ sidecar_last_heartbeat_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      console.error("Failed to send heartbeat:", error.message);
    } else {
      console.log("Heartbeat sent successfully.");
    }
  }, 15000); // Send heartbeat every 15s to keep it fresh
}

async function startWorker() {
  console.log("Starting mock outbox worker...");
  
  while (true) {
    try {
      const { data: rows, error } = await supabase
        .from("outbox")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching queued jobs:", error.message);
      } else if (rows && rows.length > 0) {
        for (const row of rows) {
          await processJob(row);
        }
      }
    } catch (err) {
      console.error("Worker error:", err);
    }
    
    // Sleep for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function processJob(row) {
  console.log(`[Job ${row.id}] Starting processing...`);
  const mockHash = "mock-sha256-" + Math.random().toString(36).substring(2, 10);
  const mockTsToken = "mock-ts-token-" + Math.random().toString(36).substring(2, 10);

  // 1. Move to 'signing'
  console.log(`[Job ${row.id}] State: signing`);
  await supabase.from("outbox").update({ status: "signing", attempts: row.attempts + 1 }).eq("id", row.id);
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Audit Log: signed
  await supabase.from("audit_log").insert({
    outbox_id: row.id,
    event: "signed",
    detail: { hash: mockHash, method: "mock-emudhra" },
  });

  // 2. Move to 'encrypting'
  console.log(`[Job ${row.id}] State: encrypting`);
  await supabase.from("outbox").update({ status: "encrypting" }).eq("id", row.id);
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 3. Move to 'sending'
  console.log(`[Job ${row.id}] State: sending`);
  await supabase.from("outbox").update({ status: "sending" }).eq("id", row.id);
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 4. Move to 'sent'
  console.log(`[Job ${row.id}] State: sent`);
  await supabase.from("outbox").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    signed_pdf_hash: mockHash,
    timestamp_token: mockTsToken,
  }).eq("id", row.id);

  // Audit Log: sent
  await supabase.from("audit_log").insert({
    outbox_id: row.id,
    event: "sent",
    detail: { recipient: row.customer_phone },
  });

  // Simulate delivery and read after some delay (asynchronous)
  setTimeout(async () => {
    console.log(`[Job ${row.id}] State: delivered`);
    await supabase.from("outbox").update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
    }).eq("id", row.id);

    setTimeout(async () => {
      console.log(`[Job ${row.id}] State: read`);
      await supabase.from("outbox").update({
        status: "read",
        read_at: new Date().toISOString(),
      }).eq("id", row.id);
    }, 3000);
  }, 4000);
}

async function main() {
  await authenticate();
  await startHeartbeat();
  await startWorker();
}

main().catch((e) => {
  console.error("Fatal error in main:", e);
  process.exit(1);
});
