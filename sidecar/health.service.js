import http from "http";

let heartbeatInterval = null;
let server = null;
const HEARTBEAT_INTERVAL_MS = 30000;
let lastHeartbeat = null;

export function startHealthService(supabase, port = 3001) {
  if (heartbeatInterval) return;

  const updateHeartbeat = async () => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("connection_status")
        .update({ sidecar_last_heartbeat_at: now })
        .eq("id", 1);

      if (error) {
        console.error("[Health] Failed to write sidecar heartbeat:", error.message);
      } else {
        lastHeartbeat = now;
        console.log("[Health] Sidecar heartbeat updated.");
      }
    } catch (err) {
      console.error("[Health] Error updating heartbeat:", err.message);
    }
  };

  // Run immediately
  updateHeartbeat();
  heartbeatInterval = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL_MS);

  // Start HTTP health server
  server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          heartbeat: lastHeartbeat,
          uptime: process.uptime(),
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  });

  server.listen(port, () => {
    console.log(`[Health] Health check server listening on port ${port}`);
  });
}

export function stopHealthService() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (server) {
    server.close();
    server = null;
  }
  console.log("[Health] Health check service stopped.");
}
