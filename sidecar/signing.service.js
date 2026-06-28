// TODO: call the real eMudhra signing API, then an RFC 3161 Time Stamping Authority,
// storing the resulting timestamp_token. Wrap both calls in a circuit breaker driven
// by system_health.emudhra_consecutive_failures: flip emudhra_circuit_state to 'open'
// after CIRCUIT_THRESHOLD consecutive failures, then to 'half_open' after a cooldown,
// then back to 'closed' on the next success.
//
// export async function signWithEmudhraAndTimestamp(pdfBytes) {
//   if (await circuitOpen()) throw new Error('emudhra circuit open');
//   try {
//     const signed = await emudhraSign(pdfBytes);   // plain HTTPS POST
//     const tsToken = await rfc3161Timestamp(signed); // POST to TSA_URL
//     await recordSuccess();
//     return { bytes: signed, hash: sha256(signed), tsToken };
//   } catch (err) {
//     await recordFailure(err);
//     throw err;
//   }
// }
