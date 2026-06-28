import { proto, BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";

export async function usePostgresAuthState(supabase, sessionId = "default-session") {
  const SESSION_KEY_RETENTION = Number(process.env.SESSION_KEY_RETENTION || 200);

  const readData = async (key) => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_sessions")
        .select("data")
        .eq("id", `${sessionId}:${key}`)
        .maybeSingle();

      if (error) {
        console.error(`[WA Auth] Error reading key ${key}:`, error.message);
        return null;
      }
      if (data) {
        return JSON.parse(data.data, BufferJSON.reviver);
      }
    } catch (err) {
      console.error(`[WA Auth] Failed to parse key ${key}:`, err.message);
    }
    return null;
  };

  const writeData = async (key, value) => {
    try {
      const serialized = JSON.stringify(value, BufferJSON.replacer);
      const { error } = await supabase
        .from("whatsapp_sessions")
        .upsert({
          id: `${sessionId}:${key}`,
          data: serialized,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error(`[WA Auth] Error writing key ${key}:`, error.message);
      }
    } catch (err) {
      console.error(`[WA Auth] Failed to serialize key ${key}:`, err.message);
    }
  };

  const removeData = async (key) => {
    try {
      const { error } = await supabase
        .from("whatsapp_sessions")
        .delete()
        .eq("id", `${sessionId}:${key}`);

      if (error) {
        console.error(`[WA Auth] Error deleting key ${key}:`, error.message);
      }
    } catch (err) {
      console.error(`[WA Auth] Failed to delete key ${key}:`, err.message);
    }
  };

  const pruneKeys = async () => {
    try {
      const prefix = `${sessionId}:`;
      const { data: keys, error } = await supabase
        .from("whatsapp_sessions")
        .select("id")
        .like("id", `${prefix}%`)
        .not("id", "eq", `${prefix}creds`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[WA Auth] Error fetching keys for pruning:", error.message);
        return;
      }

      if (keys && keys.length > SESSION_KEY_RETENTION) {
        const idsToDelete = keys.slice(SESSION_KEY_RETENTION).map((k) => k.id);
        const { error: deleteError } = await supabase
          .from("whatsapp_sessions")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) {
          console.error("[WA Auth] Error pruning signal keys:", deleteError.message);
        } else {
          console.log(`[WA Auth] Pruned ${idsToDelete.length} stale signal keys.`);
        }
      }
    } catch (err) {
      console.error("[WA Auth] Key pruning error:", err.message);
    }
  };

  // Load credentials
  let creds = await readData("creds");
  if (!creds) {
    creds = initAuthCreds();
    await writeData("creds", creds);
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
          // Async trigger pruning
          pruneKeys().catch((e) => console.error(e));
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
  };
}
