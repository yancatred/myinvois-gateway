// Patch myinvois-client@1.2.4 digital-signature generation to match the official
// LHDN signature template (docs/signature-generation-guide.md).
//
// Root cause of the "stuck at Submitted" bug: the library computed the SignedProperties
// digest (PropsDigest) over the bare signedPropertiesObject instead of over the
// QualifyingProperties object { Target, SignedProperties: [...] }. This makes the
// Reference[#id-xades-signed-props] DigestValue inconsistent with what LHDN recomputes.
//
// This script performs LITERAL string replacements (split/join, never regex) on BOTH
// the ESM (index.mjs, bundled by Bun) and CJS (index.js) builds. Every anchor is asserted
// to occur exactly once; every result is guard-checked. Any mismatch throws and exits 1 so
// the Docker build fails loudly instead of shipping a half-patched library.
//
// Runs after `bun install`, before `bun run build:linux`. CWD is the project root (/app in Docker).

import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "node_modules/myinvois-client/dist/index.mjs",
  "node_modules/myinvois-client/dist/index.js",
];

// Each edit: { anchor, replacement, count, global }
// - literal strings only (single-quoted so backticks and ${...} are literal, not interpolated)
// - count = expected occurrences (asserted before replacing)
// - global = true means replace all occurrences (still asserted against count)
const EDITS = [
  {
    // D5 — Signature.Id must be the literal "signature"
    anchor: 'const signatureId = `DocSig-${Date.now()}`;',
    replacement: 'const signatureId = "signature";',
    count: 1,
  },
  {
    // D6 — SignedProperties.Id must be the static "id-xades-signed-props"
    anchor: 'const signedPropertiesId = `id-xades-signed-props-${Date.now()}`;',
    replacement: 'const signedPropertiesId = "id-xades-signed-props";',
    count: 1,
  },
  {
    // D1 (root cause) — hash the QualifyingProperties object, not the bare SignedProperties object
    anchor: 'const signedPropertiesBytes = jsonMinifyAndEncode(signedPropertiesObject);',
    replacement:
      'const signedPropertiesBytes = jsonMinifyAndEncode({ Target: "signature", SignedProperties: [signedPropertiesObject] });',
    count: 1,
  },
  {
    // D3 — SignatureValue must be [{ "_": <sig> }] (key "_", no Id)
    anchor: "        Id: signatureValueId,\n        Value: signatureValueBase64",
    replacement: "        _: signatureValueBase64",
    count: 1,
  },
  {
    // Bug 4 — LHDN expects "QualifyingProperties", library emits "XadesQualifyingProperties"
    anchor: "XadesQualifyingProperties",
    replacement: "QualifyingProperties",
    count: 1,
    global: true,
  },
  {
    // D2 — embedded Target must be "signature" (no "#"), matching the D1 hash input
    anchor: 'Target: `#${signatureId}`,',
    replacement: 'Target: "signature",',
    count: 1,
  },
];

// Guard assertions run per file after all edits.
const MUST_CONTAIN = [
  'const signatureId = "signature";',
  'const signedPropertiesId = "id-xades-signed-props";',
  'jsonMinifyAndEncode({ Target: "signature", SignedProperties: [signedPropertiesObject] })',
  "        _: signatureValueBase64",
  'Target: "signature",',
  "QualifyingProperties: [",
];

const MUST_NOT_CONTAIN = [
  "DocSig-${Date.now()}",
  "id-xades-signed-props-${Date.now()}",
  "jsonMinifyAndEncode(signedPropertiesObject)",
  "Id: signatureValueId,",
  "Target: `#${signatureId}`",
  "XadesQualifyingProperties",
];

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

let failed = false;

for (const file of FILES) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`[patch] FAIL: cannot read ${file}: ${e.message}`);
    process.exit(1);
  }

  for (const edit of EDITS) {
    const found = occurrences(content, edit.anchor);
    if (found !== edit.count) {
      console.error(
        `[patch] FAIL in ${file}: anchor expected ${edit.count}x but found ${found}x:\n        ${JSON.stringify(edit.anchor)}`
      );
      failed = true;
      continue;
    }
    content = content.split(edit.anchor).join(edit.replacement);
  }

  for (const needle of MUST_CONTAIN) {
    if (!content.includes(needle)) {
      console.error(`[patch] FAIL in ${file}: expected patched content missing: ${JSON.stringify(needle)}`);
      failed = true;
    }
  }
  for (const needle of MUST_NOT_CONTAIN) {
    if (content.includes(needle)) {
      console.error(`[patch] FAIL in ${file}: forbidden (pre-patch) content still present: ${JSON.stringify(needle)}`);
      failed = true;
    }
  }

  if (failed) continue;

  writeFileSync(file, content, "utf8");
  console.log(`[patch] OK: ${file} patched (6 edits applied, guards passed)`);
}

if (failed) {
  console.error("[patch] One or more patches failed. Aborting build (library version may have changed).");
  process.exit(1);
}

console.log("[patch] All files patched successfully.");
