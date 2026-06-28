// TODO: poll outbox WHERE status='queued' (or use Realtime), move each row through
//   queued -> signing -> encrypting -> sending -> sent
// with retry backoff 5s / 30s / 2min and stale-job recovery (rows stuck in non-terminal
// states for > 5 minutes get reset to 'queued' with attempts++).
//
// Pseudocode:
//   for (;;) {
//     const { data: rows } = await supabase.from('outbox')
//       .select('*').eq('status','queued').order('created_at').limit(10);
//     for (const row of rows ?? []) await process(row);
//     await sleep(2000);
//   }
//
// async function process(row) {
//   await update(row.id, { status: 'signing' });
//   const pdf = await fetchPdf(row);
//   const signed = await signing.signWithEmudhraAndTimestamp(pdf);
//   await audit(row.id, 'signed', { hash: signed.hash });
//
//   await update(row.id, { status: 'encrypting' });
//   const finalPdf = row.password_protected
//     ? await encryptPdf(signed.bytes, resolvePassword(row))
//     : signed.bytes;
//
//   await update(row.id, { status: 'sending' });
//   await sock.sendMessage(`${row.customer_phone}@s.whatsapp.net`, {
//     document: finalPdf, mimetype: 'application/pdf', fileName: 'document.pdf',
//   });
//   await update(row.id, { status: 'sent', sent_at: new Date().toISOString(),
//     signed_pdf_hash: signed.hash, timestamp_token: signed.tsToken });
// }
//
// Also subscribe to Baileys `messages.update` and write delivered_at / read_at back
// onto the matching outbox row by message id.
