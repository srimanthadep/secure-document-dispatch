// TODO: usePostgresAuthState-style function reading/writing Baileys creds + signal keys
// to whatsapp_sessions via the Supabase service-role client, with row-count pruning
// (keep the most recent SESSION_KEY_RETENTION signal-key rows, delete oldest first).
//
// Shape Baileys expects:
//   { state: AuthenticationState, saveCreds: () => Promise<void> }
//
// Storage layout in whatsapp_sessions:
//   id 'creds'                -> full creds blob
//   id 'app-state-sync-key-*' -> sync keys
//   id 'pre-key-*'            -> pre-keys
//   id 'session-*'            -> session records
//   id 'sender-key-*'         -> sender keys
//
// After every write, run:
//   DELETE FROM whatsapp_sessions
//   WHERE id LIKE 'pre-key-%' AND id NOT IN (
//     SELECT id FROM whatsapp_sessions WHERE id LIKE 'pre-key-%'
//     ORDER BY created_at DESC LIMIT SESSION_KEY_RETENTION
//   );
//
// export async function usePostgresAuthState(supabase) { ... }
