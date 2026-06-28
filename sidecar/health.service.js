// TODO:
// - Expose GET /health returning { ok: true, ts: Date.now() }.
// - Every HEARTBEAT_INTERVAL_MS (default 30s), update
//   connection_status.sidecar_last_heartbeat_at = now().
//
// import http from 'node:http';
// export function startHealthService(supabase, port = 8787) {
//   const server = http.createServer((req, res) => {
//     if (req.url === '/health') {
//       res.writeHead(200, { 'content-type': 'application/json' });
//       res.end(JSON.stringify({ ok: true, ts: Date.now() }));
//     } else { res.writeHead(404).end(); }
//   });
//   server.listen(port);
//   setInterval(async () => {
//     await supabase.from('connection_status')
//       .update({ sidecar_last_heartbeat_at: new Date().toISOString() }).eq('id', 1);
//   }, Number(process.env.HEARTBEAT_INTERVAL_MS ?? 30000));
// }
