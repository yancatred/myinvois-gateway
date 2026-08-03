// Diagnostic (Lapis 2): verify a REAL, already-submitted document pulled from
// production DB (kgb_lhdn_invoices.payload) against LHDN's own recomputation logic.
//
// Unlike verify-signature.mjs (which signs a dummy in-memory document and proves
// the *generator* is internally consistent), this script re-derives both digests
// from the ACTUAL bytes that were sent to LHDN, with zero dependency on the
// private key or certificate — pure digest recomputation, exactly what LHDN
// itself does on Step08.
//
// Usage:
//   bun scripts/verify-stored-payload.mjs path/to/payload.json
//   mysql ... | bun scripts/verify-stored-payload.mjs -   (reads JSON from stdin)
//
// Exit 0 = both digests match (bug is NOT in this document's bytes — look
//          elsewhere, e.g. LHDN-side unicode/canonicalization quirk, or the
//          bytes LHDN received differ from what's stored in DB).
// Exit 1 = mismatch found — prints exactly which reference is wrong and why.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: bun scripts/verify-stored-payload.mjs <payload.json | ->");
  process.exit(1);
}

const raw = arg === "-"
  ? readFileSync(0, "utf8")
  : readFileSync(arg, "utf8");

let doc;
try {
  doc = JSON.parse(raw);
} catch (e) {
  console.error(`[verify] FAIL: input is not valid JSON: ${e.message}`);
  process.exit(1);
}

// Stored payload may be the raw Invoice document itself, or wrapped as
// { Invoice: [...] } / { _D, _A, _B, Invoice: [...] } (UBL envelope). Normalize.
const invoice = Array.isArray(doc?.Invoice) ? doc.Invoice[0] : doc;

const sig =
  invoice?.UBLExtensions?.[0]?.UBLExtension?.[0]?.ExtensionContent?.[0]
    ?.UBLDocumentSignatures?.[0]?.SignatureInformation?.[0]?.Signature?.[0];

if (!sig) {
  console.error("[verify] FAIL: could not locate Signature block at Invoice[0].UBLExtensions[0].UBLExtension[0].ExtensionContent[0].UBLDocumentSignatures[0].SignatureInformation[0].Signature[0]");
  process.exit(1);
}

const references = sig?.SignedInfo?.[0]?.Reference;
if (!Array.isArray(references)) {
  console.error("[verify] FAIL: SignedInfo[0].Reference is not an array");
  process.exit(1);
}

let failed = false;

// ---- Check 1: SignedProperties digest (this is what DS320 complains about) ----
const qp = sig?.Object?.[0]?.QualifyingProperties?.[0];
if (!qp) {
  console.error("[verify] FAIL: Object[0].QualifyingProperties[0] not found");
  failed = true;
} else {
  const propsRef = references.find(
    (r) => r?.URI === "#id-xades-signed-props" || r?.Type === "http://uri.etsi.org/01903/v1.3.2#SignedProperties"
  );
  if (!propsRef) {
    console.error('[verify] FAIL: no Reference with URI "#id-xades-signed-props" / Type SignedProperties');
    failed = true;
  } else {
    const embedded = propsRef?.DigestValue?.[0]?._;
    const recomputed = createHash("sha256").update(Buffer.from(JSON.stringify(qp), "utf8")).digest("base64");
    console.log(`[verify] SignedProperties  embedded: ${embedded}`);
    console.log(`[verify] SignedProperties recomputed: ${recomputed}`);
    if (embedded !== recomputed) {
      console.error("[verify] FAIL: SignedProperties (DS320) digest MISMATCH");
      console.error(`[verify]   qp.Target = ${JSON.stringify(qp.Target)}`);
      console.error(`[verify]   qp keys (order matters for JSON.stringify) = ${JSON.stringify(Object.keys(qp))}`);
      failed = true;
    } else {
      console.log("[verify] PASS: SignedProperties digest matches — DS320 root cause is NOT in this document's stored bytes.");
    }
  }
}

// ---- Check 2: document digest (would surface as DS322 if broken) ----
const docRef = references.find((r) => r?.Type === "" || r?.URI === "");
if (!docRef) {
  console.error("[verify] WARN: no document Reference (Type/URI \"\") found — skipping doc digest check");
} else {
  const docCopy = JSON.parse(JSON.stringify(invoice));
  delete docCopy.UBLExtensions;
  delete docCopy.Signature;
  const recomputedDoc = createHash("sha256").update(Buffer.from(JSON.stringify(docCopy), "utf8")).digest("base64");
  const embeddedDoc = docRef?.DigestValue?.[0]?._;
  console.log(`[verify] Document  embedded: ${embeddedDoc}`);
  console.log(`[verify] Document recomputed: ${recomputedDoc}`);
  if (embeddedDoc !== recomputedDoc) {
    console.error("[verify] FAIL: Document (DS322-style) digest MISMATCH");
    failed = true;
  } else {
    console.log("[verify] PASS: Document digest matches.");
  }
}

// ---- Structural sanity (matches official LHDN template) ----
const structChecks = [
  ["Signature.Id === 'signature'", sig.Id === "signature"],
  ["QualifyingProperties[0].Target === 'signature'", qp?.Target === "signature"],
  ["SignedProperties[0].Id === 'id-xades-signed-props'", qp?.SignedProperties?.[0]?.Id === "id-xades-signed-props"],
  ["SignatureValue[0] has key '_'", "_" in (sig?.SignatureValue?.[0] ?? {})],
];
for (const [label, pass] of structChecks) {
  console.log(`[verify] ${pass ? "PASS" : "FAIL"}: ${label}`);
  if (!pass) failed = true;
}

if (failed) {
  console.error("\n[verify] RESULT: FAIL — see mismatches above.");
  process.exit(1);
}
console.log("\n[verify] RESULT: ALL CHECKS PASSED against the real stored payload.");
