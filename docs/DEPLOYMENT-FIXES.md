# MyInvois Gateway — Deployment Fixes

Dokumen ini merekodkan semua bug yang dijumpai dan cara fix semasa deployment production untuk **Cosmo Goodness Malaysia Sdn. Bhd.** (2026-06-29).

---

## Infrastruktur

| Perkara | Nilai |
|---|---|
| VPS | Vultr, `45.76.154.228` |
| Panel | aaPanel |
| Gateway URL | `https://gateway.cosmomalaysia.com` |
| Nginx | Reverse proxy ke `127.0.0.1:3000` |
| Cert dir (server) | `/www/wwwroot/cosmomalaysia/gateway/certs/` |
| Gateway source (server) | `/tmp/myinvois-gateway-fix/` |

---

## Environment Variables (Container)

```
ENVIRONMENT=PROD
CLIENT_ID=a2c0c6c1-c737-4b5a-8f7a-4361bea0b84d
CLIENT_SECRET=7592d842-06ba-473d-98ac-750cd4363e8b
GATEWAY_API_KEY=32374145b9e1cf060985d89af1cf6ad0f0ae69b1e47ca84327272b462821bd72
SIGNING_CERTIFICATE_PATH=/app/certs/certificate_base64.txt
SIGNING_PRIVATE_KEY_PATH=/app/certs/private_key.pem
```

> **Penting:** Nama variable ialah `ENVIRONMENT` (bukan `MYINVOISENV`). Nilai `PROD` (bukan `PRODUCTION`). Dikonfirmasi dari `src/config/index.ts`: `process.env.ENVIRONMENT ?? "SANDBOX"`. MyInvoisEnvironment hanya terima `"PROD" | "SANDBOX"`.

---

## Sijil Digital (POS Digicert)

| Perkara | Nilai |
|---|---|
| Serial (decimal) | `20646121` |
| Serial (hex) | `013b08e9` |
| Issuer | `CN=LHDNM Sub CA G3,OU=Terms of use at http://www.posdigicert.com.my,O=LHDNM,C=MY` |
| Subject | `CN=COSMO GOODNESS MALAYSIA SDN. BHD.` |
| TIN | `C21594795090` |
| Tempoh sah | 26/06/2026 – 26/06/2027 |
| Provider | POS Digicert |

Fail cert di server:
- `certificate_base64.txt` — raw base64 DER (tanpa PEM headers)
- `private_key.pem` — PKCS#8 (`-----BEGIN PRIVATE KEY-----`)

---

## Bugs & Fixes

### Bug 1 — Invoice tidak di-sign ✅ FIXED

**Simptom:** LHDN reject dengan error:
```
TooFewItems: #/Invoice[0].UBLExtensions
```

**Punca:** `src/routes/documents/documents.service.ts` — fungsi `submitInvoices()` missing assignment `doc.signature = signature` untuk invoice. Credit note, debit note etc. ada, tapi invoice tidak.

**Fix** (`src/routes/documents/documents.service.ts`):
```typescript
for await (const doc of _documents) {
  if (signature) {
    (doc as CreateInvoiceDocumentParams).signature = signature;  // ← TAMBAH INI
  }
  let _doc = await createDocumentSubmissionItemFromInvoice(
    doc as CreateInvoiceDocumentParams,
    signature ? "1.1" : "1.0"
  );
  documents.push(_doc);
}
```

---

### Bug 2 — Serial number format hex (sepatutnya decimal) ✅ FIXED

**Simptom:** Step08-Document Signature Validator: Invalid

**Punca:** `src/utils/signature.ts` — `nodeCert.serialNumber` return hex (contoh: `"013b08e9"`) tapi LHDN expect decimal (`"20646121"`).

**Fix** (`src/utils/signature.ts`):
```typescript
// SEBELUM (salah):
const serialNumber = nodeCert.serialNumber; // hex "013b08e9"

// SELEPAS (betul):
const serialNumber = BigInt('0x' + nodeCert.serialNumber).toString(); // decimal "20646121"
```

---

### Bug 3 — Issuer name format multi-line (sepatutnya RFC 2253) ✅ FIXED

**Simptom:** Step08-Document Signature Validator: Invalid

**Punca:** `src/utils/signature.ts` — `nodeCert.issuer` return format multi-line:
```
C=MY
O=LHDNM
OU=Terms of use at http://www.posdigicert.com.my
CN=LHDNM Sub CA G3
```

LHDN/XAdES expect RFC 2253 format (reverse order, comma-joined):
```
CN=LHDNM Sub CA G3,OU=Terms of use at http://www.posdigicert.com.my,O=LHDNM,C=MY
```

**Fix** (`src/utils/signature.ts`):
```typescript
// SEBELUM (salah):
const issuerName = nodeCert.issuer; // multi-line

// SELEPAS (betul):
const issuerName = nodeCert.issuer
  .split('\n')
  .map(s => s.trim())
  .filter(s => s.length > 0)
  .reverse()
  .join(',');
```

---

### Bug 4 — XadesQualifyingProperties (sepatutnya QualifyingProperties) ✅ FIXED + DEPLOYED

**Simptom:** Step08 inner error:
```json
{
  "errorCode": "DS300",
  "error": "Failed to parse input document."
}
```

**Punca:** Library `myinvois-client` v1.2.4 menghasilkan property `XadesQualifyingProperties` dalam signature JSON. LHDN expect `QualifyingProperties` (per [official SDK sample](https://sdk.myinvois.hasil.gov.my/files/sample-ul-invoice-2.1-signed.min.json)).

**Kenapa selamat rename:** Hash dalam `Reference[1].DigestValue` dicompute dari content `SignedProperties` object (bukan parent key name). Rename parent key tidak affect signature validity.

**⚠️ PENTING — Mesti patch DUA fail, bukan satu:**

Library `myinvois-client` ada dua versi dist:
- `dist/index.js` — CommonJS (untuk `require()`)
- `dist/index.mjs` — ESM (untuk `import`)

Bun menggunakan ESM (`dist/index.mjs`) semasa compile. Kalau patch `index.js` sahaja, patch **tidak berkesan** kerana Bun tidak bundle fail itu.

**Fix — tambah dalam Dockerfile** (selepas `RUN bun install`, sebelum `RUN bun run build:linux`):
```dockerfile
# Patch: rename XadesQualifyingProperties -> QualifyingProperties (myinvois-client library bug)
# MESTI patch KEDUA-DUA fail: index.js (CommonJS) DAN index.mjs (ESM)
# Bun bundle index.mjs, bukan index.js
RUN sed -i 's/XadesQualifyingProperties/QualifyingProperties/g' node_modules/myinvois-client/dist/index.js node_modules/myinvois-client/dist/index.mjs
```

**Verify patch berjaya (selepas docker build):**
```bash
docker exec <container> cat -v /app/myinvois-gateway | grep -o 'XadesQualifyingProperties\|QualifyingProperties' | sort | uniq -c
# Output yang betul: hanya "QualifyingProperties" (tiada "XadesQualifyingProperties")
```

**Dockerfile terkini di repo ini sudah mengandungi patch yang betul (kedua-dua fail).**

---

### Bug 5 — Issuer name separator tiada space (sepatutnya ada space) ✅ FIXED + DEPLOYED

**Simptom (dijangka selepas Bug 4 fix):** DS326 — Certificate X509IssuerName doesn't match.

**Punca:** `src/utils/signature.ts` — `.join(',')` menghasilkan format tanpa space:
```
CN=LHDNM Sub CA G3,OU=Terms of use at http://www.posdigicert.com.my,O=LHDNM,C=MY
```

LHDN expect format dengan space selepas koma (confirmed dari [official SDK sample JSON](https://sdk.myinvois.hasil.gov.my/files/sample-ul-invoice-2.1-signed.min.json)):
```
CN=LHDNM Sub CA G3, OU=Terms of use at http://www.posdigicert.com.my, O=LHDNM, C=MY
```

**Fix** (`src/utils/signature.ts`, line 106):
```typescript
// SEBELUM (salah):
.join(',');

// SELEPAS (betul):
.join(', ');
```

**Fix sudah diaplikasi dalam `src/utils/signature.ts`.**

---

## Status Deployment — Cosmo Goodness Malaysia (2026-06-29)

Semua 5 bugs telah di-fix dan di-deploy. Step08 VALID ✅

| Bug | Status |
|-----|--------|
| Bug 1 — Invoice tidak di-sign | ✅ Deployed |
| Bug 2 — Serial number format hex→decimal | ✅ Deployed |
| Bug 3 — Issuer name format (reverse order) | ✅ Deployed |
| Bug 4 — XadesQualifyingProperties (.mjs patch) | ✅ Deployed 2026-06-29 |
| Bug 5 — Issuer separator tiada space | ✅ Deployed 2026-06-29 |

Container: `myinvois` — image `myinvois-gateway-new:latest` — port `3001:3000`

---

## Deploy Untuk Projek Lain (e.g. KabGold)

Semua fixes sudah ada dalam repo ini. Langkah deploy:

```bash
# 1. Upload source ke server
# (tar source tanpa node_modules, upload via pscp/scp)

# 2. Extract dan build
mkdir -p /tmp/myinvois-rebuild
tar -xzf gateway-src.tar.gz -C /tmp/myinvois-rebuild
docker build -t myinvois-gateway:latest /tmp/myinvois-rebuild/

# 1. Sync kod terkini dari local (pastikan src/utils/signature.ts sudah updated)
# Upload fail signature.ts yang baru ke server dulu

# 2. Semak Dockerfile ada patch belum
grep "XadesQualifyingProperties" Dockerfile && echo "PATCH ADA" || echo "PATCH BELUM ADA"

# 3. Rebuild image
docker build -t myinvois-gateway:latest .

# 4. Restart container
docker stop myinvois-gateway && docker rm myinvois-gateway

docker run -d \
  --name myinvois-gateway \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v /www/wwwroot/cosmomalaysia/gateway/certs:/app/certs:ro \
  -e ENVIRONMENT=PROD \
  -e CLIENT_ID=a2c0c6c1-c737-4b5a-8f7a-4361bea0b84d \
  -e CLIENT_SECRET=7592d842-06ba-473d-98ac-750cd4363e8b \
  -e GATEWAY_API_KEY=32374145b9e1cf060985d89af1cf6ad0f0ae69b1e47ca84327272b462821bd72 \
  -e SIGNING_CERTIFICATE_PATH=/app/certs/certificate_base64.txt \
  -e SIGNING_PRIVATE_KEY_PATH=/app/certs/private_key.pem \
  myinvois-gateway:latest
```

---

## Bug Laravel — log_einv enum ✅ FIXED

**Simptom:** `SQLSTATE[01000]: Data truncated for column 'request_type'` bila buat resubmit.

**Punca:** `log_einv.request_type` adalah `ENUM('submit','document','qr','cancel')` — tiada nilai `'resubmit'`.

**Fix** (sudah dijalankan):
```sql
ALTER TABLE log_einv MODIFY COLUMN request_type ENUM('submit','document','qr','cancel','resubmit');
```

---

## Dockerfile — Semua Perubahan dari Original

1. `bun run build` → `bun run build:linux` (script nama berbeza)
2. `adduser --disabled-password` → `useradd -r -s /bin/false appuser` (Debian slim tak ada `adduser`)
3. Buang `COPY --from=builder /app/src/static ./src/static` (direktori tak wujud)
4. Tambah patch `sed` untuk `XadesQualifyingProperties` (**Bug 4**)
5. Base image final tukar ke `debian:bookworm-slim` (lebih ringan)

---

## Rujukan

- LHDN SDK Docs: `https://sdk.myinvois.hasil.gov.my/signature/`
- LHDN SDK Sample JSON Signed: `https://sdk.myinvois.hasil.gov.my/files/sample-ul-invoice-2.1-signed.min.json`
- LHDN SDK e-Invoice API: `https://sdk.myinvois.hasil.gov.my/einvoicingapi/`
- LHDN SDK FAQ (longId, status flow, versi dokumen): `https://sdk.myinvois.hasil.gov.my/faq/`
- Library: `myinvois-client` v1.2.4 (ada beberapa bugs dalam signature generation)

### Nota dari FAQ LHDN

**longId & Status Flow:**
- Status `Submitted` = lepas initial structure check, masih pending full async validation
- Status `Valid` = validation lengkap, `longId` baru di-generate
- URL QR: `{baseurl}/{uuid}/share/{longId}`
- Tiada SLA/timing tetap dari LHDN untuk proses Submitted → Valid

**typeVersionName (Version 1 vs Version 2):**
- `Version 1` = document v1.0, signature tidak wajib, tiada Step08 validator
- `Version 2` = document v1.1, signature wajib, ada Step08 validator
- v1.0 masih boleh guna sehingga LHDN keluarkan notis rasmi untuk retire (tiada tarikh tetap)
