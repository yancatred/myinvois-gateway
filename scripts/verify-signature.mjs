// Offline verification (Lapis 1) for the myinvois-client signature patch.
//
// Imports the PATCHED ESM build directly (the exact file Bun bundles) and calls the real
// signature generator with an ephemeral RSA key + dummy cert values. Then it proves the fix:
//   1. PropsDigest consistency: base64(SHA256(JSON.stringify(QualifyingProperties[0])))
//      MUST equal the embedded Reference[#id-xades-signed-props].DigestValue[0]._
//   2. Structure matches the official LHDN template (Id "signature", Target "signature",
//      SignedProperties.Id "id-xades-signed-props", SignatureValue [{ _ }] with no Id).
//
// Run AFTER applying the patch:  bun scripts/patch-myinvois.mjs && bun scripts/verify-signature.mjs
// Exit 0 = pass, 1 = fail. Needs no server, no real certificate, no sample invoice.

import { generateDigitalSignatureJSON } from "../node_modules/myinvois-client/dist/index.mjs";
import { createHash } from "node:crypto";

function fail(msg) {
  console.error(`[verify] FAIL: ${msg}`);
  process.exit(1);
}

// 1. Ephemeral signing key (validity irrelevant — we only check digest consistency + structure)
const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

// 2. Minimal document (any shape works; UBLExtensions/Signature are stripped before hashing)
const sampleDocument = { Invoice: [{ ID: [{ _: "TEST-INV-0001" }] }] };

const sig = await generateDigitalSignatureJSON(
  sampleDocument,
  keyPair.privateKey,
  "DUMMY_CERT_BASE64",
  "DUMMY_CERT_DIGEST_BASE64",
  "CN=Test Issuer, O=Test, C=MY",
  "1234567890"
);

// 3. Extract the embedded QualifyingProperties object and the props Reference digest
const qp = sig?.Object?.[0]?.QualifyingProperties?.[0];
if (!qp) fail("QualifyingProperties[0] not found (is the XadesQualifyingProperties rename applied?)");

const references = sig?.SignedInfo?.[0]?.Reference;
if (!Array.isArray(references)) fail("SignedInfo[0].Reference is not an array");

const propsRef = references.find((r) => r?.URI === "#id-xades-signed-props");
if (!propsRef) fail('No Reference with URI "#id-xades-signed-props" (SignedProperties.Id / URI mismatch)');

const embeddedDigest = propsRef?.DigestValue?.[0]?._;
if (!embeddedDigest) fail("Embedded props DigestValue is empty");

// 4. THE CORE CHECK — recompute PropsDigest over the embedded QualifyingProperties object
const recomputed = createHash("sha256").update(Buffer.from(JSON.stringify(qp), "utf8")).digest("base64");

console.log(`[verify] embedded  PropsDigest: ${embeddedDigest}`);
console.log(`[verify] recomputed PropsDigest: ${recomputed}`);
if (recomputed !== embeddedDigest) {
  fail("PropsDigest MISMATCH — the D1 fix is not consistent with the embedded object.");
}

// 5. Structural checks vs the official LHDN template
const checks = [
  ["Signature.Id === 'signature'", sig.Id === "signature"],
  ["QualifyingProperties[0].Target === 'signature'", qp.Target === "signature"],
  ["SignedProperties[0].Id === 'id-xades-signed-props'", qp?.SignedProperties?.[0]?.Id === "id-xades-signed-props"],
  ["SignatureValue[0] has key '_'", "_" in (sig?.SignatureValue?.[0] ?? {})],
  ["SignatureValue[0] has NO key 'Id'", !("Id" in (sig?.SignatureValue?.[0] ?? {}))],
  ["SignatureValue[0] has NO key 'Value'", !("Value" in (sig?.SignatureValue?.[0] ?? {}))],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(`[verify] ${pass ? "PASS" : "FAIL"}: ${label}`);
  if (!pass) ok = false;
}
if (!ok) fail("One or more structural checks failed.");

console.log("[verify] ALL CHECKS PASSED — PropsDigest consistent and structure matches the LHDN template.");
