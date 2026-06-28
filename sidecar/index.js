// TODO: entrypoint
//
// import { createClient } from '@supabase/supabase-js';
// import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
// import { usePostgresAuthState } from './whatsapp.auth.js';
// import { startWorker } from './whatsapp.worker.js';
// import { startHealthService } from './health.service.js';
//
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
//   auth: { persistSession: false, autoRefreshToken: false },
// });
//
// async function main() {
//   const { state, saveCreds } = await usePostgresAuthState(supabase);
//   const sock = makeWASocket({ auth: state, printQRInTerminal: false });
//   sock.ev.on('creds.update', saveCreds);
//   sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
//     if (qr) {
//       await supabase.from('connection_status').update({
//         status: 'awaiting_qr', qr_code: qr,
//       }).eq('id', 1);
//     }
//     if (connection === 'open') {
//       await supabase.from('connection_status').update({
//         status: 'connected', qr_code: null, last_connected_at: new Date().toISOString(),
//       }).eq('id', 1);
//     }
//     if (connection === 'close') {
//       const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
//       await supabase.from('connection_status').update({
//         status: 'disconnected', qr_code: null,
//       }).eq('id', 1);
//       if (shouldReconnect) setTimeout(main, 3000);
//     }
//   });
//
//   startWorker(supabase, sock);
//   startHealthService(supabase);
// }
//
// main().catch((e) => { console.error(e); process.exit(1); });
