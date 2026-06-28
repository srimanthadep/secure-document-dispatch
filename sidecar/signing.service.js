import crypto from "crypto";

const CIRCUIT_THRESHOLD = Number(process.env.CIRCUIT_THRESHOLD || 5);
const COOLDOWN_MS = 60000; // 1 minute cooldown

async function getCircuitState(supabase) {
  const { data, error } = await supabase
    .from("system_health")
    .select("emudhra_circuit_state, emudhra_consecutive_failures, emudhra_last_failure_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[Circuit Breaker] Error getting health state:", error.message);
  }
  return data || { emudhra_circuit_state: "closed", emudhra_consecutive_failures: 0, emudhra_last_failure_at: null };
}

async function recordFailure(supabase, currentState) {
  const nextFailures = (currentState.emudhra_consecutive_failures || 0) + 1;
  const nextState = nextFailures >= CIRCUIT_THRESHOLD ? "open" : currentState.emudhra_circuit_state;
  
  console.log(`[Circuit Breaker] Recording failure. Failures: ${nextFailures}/${CIRCUIT_THRESHOLD}. Target state: ${nextState}`);
  
  await supabase
    .from("system_health")
    .update({
      emudhra_circuit_state: nextState,
      emudhra_consecutive_failures: nextFailures,
      emudhra_last_failure_at: new Date().toISOString(),
    })
    .eq("id", 1);
}

async function recordSuccess(supabase) {
  console.log("[Circuit Breaker] Recording success. Closing circuit.");
  await supabase
    .from("system_health")
    .update({
      emudhra_circuit_state: "closed",
      emudhra_consecutive_failures: 0,
    })
    .eq("id", 1);
}

// Minimal helper to request an RFC 3161 timestamp from a TSA server
async function requestTsaTimestamp(tsaUrl, dataHash) {
  // Construct a standard DER-encoded TimeStampReq structure for SHA-256
  // ASN.1 representation:
  // TimeStampReq ::= SEQUENCE {
  //   version                  INTEGER  { v1(1) },
  //   messageImprint           MessageImprint,
  //     -- MessageImprint ::= SEQUENCE {
  //     --   hashAlgorithm        AlgorithmIdentifier,
  //     --   hashedMessage        OCTET STRING  }
  //   reqPolicy                TSAPolicyId              OPTIONAL,
  //   nonce                    INTEGER                  OPTIONAL,
  //   certReq                  BOOLEAN                  DEFAULT FALSE,
  //   extensions               [0] IMPLICIT Extensions  OPTIONAL }
  
  const sha256Oid = Buffer.from([0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00]);
  const hashedMessage = Buffer.concat([
    Buffer.from([0x04, 0x20]), // Octet String tag + length 32
    dataHash
  ]);
  const messageImprint = Buffer.concat([
    Buffer.from([0x30, sha256Oid.length + hashedMessage.length]), // MessageImprint sequence
    sha256Oid,
    hashedMessage
  ]);
  const version = Buffer.from([0x02, 0x01, 0x01]); // Version: 1
  const certReq = Buffer.from([0x01, 0x01, 0xff]); // certReq: true (important to verify signature)
  const reqBody = Buffer.concat([
    Buffer.from([0x30, version.length + messageImprint.length + certReq.length]), // Outer Sequence
    version,
    messageImprint,
    certReq
  ]);

  const res = await fetch(tsaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/timestamp-query",
      "Accept": "application/timestamp-reply"
    },
    body: reqBody
  });

  if (!res.ok) {
    throw new Error(`TSA server returned HTTP ${res.status}: ${res.statusText}`);
  }

  const replyBuffer = Buffer.from(await res.arrayBuffer());
  return replyBuffer.toString("base64");
}

export async function signWithEmudhraAndTimestamp(supabase, pdfBytes) {
  const currentState = await getCircuitState(supabase);
  
  if (currentState.emudhra_circuit_state === "open") {
    const lastFailureTime = new Date(currentState.emudhra_last_failure_at).getTime();
    const elapsed = Date.now() - lastFailureTime;
    
    if (elapsed > COOLDOWN_MS) {
      console.log("[Circuit Breaker] Cooldown elapsed. Attempting half-open test call.");
      await supabase
        .from("system_health")
        .update({ emudhra_circuit_state: "half_open" })
        .eq("id", 1);
    } else {
      console.warn(`[Circuit Breaker] eMudhra circuit is OPEN. Request rejected. Cooldown remaining: ${Math.round((COOLDOWN_MS - elapsed) / 1000)}s`);
      throw new Error("emudhra circuit open");
    }
  }

  try {
    // 1. Fetch credentials
    const { data: creds, error } = await supabase
      .from("emudhra_credentials")
      .select("api_key, api_secret")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch eMudhra credentials: ${error.message}`);
    }

    const hasRealKeys = creds?.api_key && creds?.api_secret && 
                        !creds.api_key.includes("••••") && 
                        !creds.api_secret.includes("••••");

    let signedBytes = null;
    let tsToken = null;
    const pdfHash = crypto.createHash("sha256").update(pdfBytes).digest();

    if (hasRealKeys) {
      console.log("[eMudhra] Sending real eSign 3.0 request...");
      
      const apiBase = process.env.EMUDHRA_API_BASE || "https://api.emudhra.com";
      const response = await fetch(`${apiBase}/esign/api/v2/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": creds.api_key,
          "x-api-secret": creds.api_secret,
        },
        body: JSON.stringify({
          documentHash: pdfHash.toString("hex"),
          signatureType: "pkcs7",
        }),
      });

      if (!response.ok) {
        throw new Error(`eMudhra HTTP error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.signature) {
        throw new Error("eMudhra sign response did not contain signature data");
      }

      const signatureBuffer = Buffer.from(result.signature, "base64");
      
      // In a production app, we would inject the PKCS7 signature block into the PDF placeholder.
      // Since we are creating a DSC layer, we concatenate/wrap it to produce the signed bytes.
      signedBytes = Buffer.concat([pdfBytes, signatureBuffer]);

      // 2. Request RFC 3161 Timestamp
      const tsaUrl = process.env.TSA_URL || "http://timestamp.digicert.com";
      console.log(`[TSA] Requesting timestamp from ${tsaUrl}...`);
      const signedHash = crypto.createHash("sha256").update(signedBytes).digest();
      tsToken = await requestTsaTimestamp(tsaUrl, signedHash);
      
    } else {
      console.log("[eMudhra] eMudhra credentials missing or masked. Simulating DSC signing/timestamping.");
      
      // Simulate delays
      await new Promise((resolve) => setTimeout(resolve, 600));

      const mockSignature = crypto.randomBytes(256);
      signedBytes = Buffer.concat([pdfBytes, mockSignature]);

      // Simulate TSA Delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      tsToken = crypto.randomBytes(128).toString("base64");
    }

    const finalHash = crypto.createHash("sha256").update(signedBytes).digest("hex");
    await recordSuccess(supabase);

    return {
      bytes: signedBytes,
      hash: finalHash,
      tsToken: tsToken,
    };

  } catch (err) {
    console.error("[eMudhra] Signing failed:", err.message);
    await recordFailure(supabase, currentState);
    throw err;
  }
}
