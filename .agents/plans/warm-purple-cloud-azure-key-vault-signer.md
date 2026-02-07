---
date: 2026-02-07
title: Azure Key Vault Signer
---

## Problem Statement

Users with keys stored in Azure Key Vault (including HSM-backed keys) need to digitally sign PDFs without extracting private keys. We already have a `GoogleKmsSigner` for GCP; we need an equivalent `AzureKeyVaultSigner` for the Azure ecosystem.

## Goals

- Provide an `AzureKeyVaultSigner` that implements the `Signer` interface
- Support RSA (PKCS#1 v1.5, PSS) and ECDSA signing via Azure Key Vault
- Follow the same patterns established by `GoogleKmsSigner` (optional peer dependency, async factory, local hashing, remote signing)
- Support both Azure Key Vault (software-protected keys) and Azure Key Vault Managed HSM (HSM-protected keys)
- No PKCS#11 — use Azure's REST API via their official TypeScript SDK

## Research Findings

### Azure Key Vault supports what we need

Azure Key Vault provides a `CryptographyClient` (from `@azure/keyvault-keys`) with a `sign(algorithm, digest)` method that:

1. **Takes a pre-computed digest** and returns a signature — same pattern as Google KMS
2. **Supports all algorithms we need:**
   - `RS256`, `RS384`, `RS512` — RSASSA-PKCS1-v1_5 with SHA-256/384/512
   - `PS256`, `PS384`, `PS512` — RSASSA-PSS with SHA-256/384/512
   - `ES256`, `ES384`, `ES512` — ECDSA with P-256/P-384/P-521
3. **Private key never leaves the vault** — signing happens server-side
4. **Works with both Key Vault and Managed HSM** — same API, different vault URL
5. **Uses `@azure/identity` for authentication** — supports DefaultAzureCredential, managed identities, service principals, etc.

### Certificate management

Azure Key Vault has two separate services relevant here:

- **`@azure/keyvault-keys`** — For key operations (create, sign, verify). The `CryptographyClient` lives here.
- **`@azure/keyvault-certificates`** — For certificate management. Can retrieve the X.509 certificate (DER) associated with a key via `CertificateClient.getCertificate()`.

The certificate's `.cer` property contains the DER-encoded public certificate. This is the equivalent of Google's Secret Manager approach — we can offer a helper method `getCertificateFromKeyVault()` to load the certificate directly from the vault.

**Important distinction from GCP:** In Azure, a "certificate" in Key Vault is actually a bundle — it contains the certificate, the private key, and optionally the chain. The key and certificate share the same name. So if a user has a certificate named `"my-signing-cert"` in Key Vault, they can:

1. Use `CertificateClient` to get the certificate bytes
2. Use `CryptographyClient` with the same key name to sign

This is actually _simpler_ than GCP where the key and certificate live in separate services.

### Key identification

Azure Key Vault keys are identified by URL:

```
https://{vault-name}.vault.azure.net/keys/{key-name}/{key-version}
```

Or for Managed HSM:

```
https://{hsm-name}.managedhsm.azure.net/keys/{key-name}/{key-version}
```

The `CryptographyClient` accepts either a key URL string or a `KeyVaultKey` object.

### Authentication

Azure uses `TokenCredential` from `@azure/identity`. The recommended approach is `DefaultAzureCredential` which tries multiple auth methods in order (env vars, managed identity, Azure CLI, etc.). This is the equivalent of GCP's Application Default Credentials (ADC).

### Error handling

Azure SDK throws `RestError` with HTTP status codes. We'll need to map common ones:

- 401/403 — Authentication/authorization failures
- 404 — Key or vault not found
- 409 — Conflict (key disabled, etc.)

## Scope

### In scope

- `AzureKeyVaultSigner` class implementing `Signer`
- Algorithm mapping from Azure's algorithm names to our types
- `getCertificateFromKeyVault()` static helper method
- Public key validation (certificate matches key in vault)
- Unit tests (algorithm mapping, error handling)
- Integration tests (skipped without Azure credentials)
- Error hierarchy (`AzureKeyVaultSignerError extends KmsSignerError`)

### Out of scope

- Azure Managed Identity setup/configuration guidance
- PKCS#11 / native HSM communication
- Certificate issuance or renewal
- Azure Key Vault key creation

## Desired Usage

```typescript
import { AzureKeyVaultSigner } from "@libpdf/core";
import { DefaultAzureCredential } from "@azure/identity";

// Option 1: Provide certificate explicitly
const signer = await AzureKeyVaultSigner.create({
  keyId: "https://my-vault.vault.azure.net/keys/my-signing-key/abc123",
  certificate: certificateDer,
  credential: new DefaultAzureCredential(),
});

// Option 2: Shorthand with vault name + key name
const signer = await AzureKeyVaultSigner.create({
  vaultName: "my-vault",
  keyName: "my-signing-key",
  keyVersion: "abc123", // optional, defaults to latest
  certificate: certificateDer,
  credential: new DefaultAzureCredential(),
});

// Sign a PDF
const pdf = await PDF.load(pdfBytes);
const { bytes } = await pdf.sign({ signer });
```

```typescript
// Load certificate from Azure Key Vault directly
const { cert, chain } = await AzureKeyVaultSigner.getCertificateFromKeyVault({
  vaultUrl: "https://my-vault.vault.azure.net",
  certificateName: "my-signing-cert",
  credential: new DefaultAzureCredential(),
});

const signer = await AzureKeyVaultSigner.create({
  vaultName: "my-vault",
  keyName: "my-signing-cert", // same name as certificate
  certificate: cert,
  certificateChain: chain,
  credential: new DefaultAzureCredential(),
});
```

## High-Level Architecture

The implementation mirrors `GoogleKmsSigner` with Azure-specific adaptations:

```
AzureKeyVaultSigner implements Signer
├── create() — async factory
│   ├── Dynamic import of @azure/keyvault-keys
│   ├── Resolve key ID (full URL or vaultName+keyName)
│   ├── Fetch key metadata via KeyClient.getKey()
│   ├── Validate key is enabled and supports signing
│   ├── Map Azure algorithm → our types (KeyType, SignatureAlgorithm, DigestAlgorithm)
│   ├── Validate certificate public key matches vault key
│   └── Optional AIA chain building
├── sign() — hash locally, send digest to Azure
│   ├── Hash with @noble/hashes (same as GCP signer)
│   └── Call CryptographyClient.sign(algorithm, digest)
└── getCertificateFromKeyVault() — static helper
    ├── Dynamic import of @azure/keyvault-certificates
    └── Fetch certificate + parse chain
```

### Azure Algorithm Mapping

| Azure Algorithm | KeyType | SignatureAlgorithm | DigestAlgorithm |
| --------------- | ------- | ------------------ | --------------- |
| RS256           | RSA     | RSASSA-PKCS1-v1_5  | SHA-256         |
| RS384           | RSA     | RSASSA-PKCS1-v1_5  | SHA-384         |
| RS512           | RSA     | RSASSA-PKCS1-v1_5  | SHA-512         |
| PS256           | RSA     | RSA-PSS            | SHA-256         |
| PS384           | RSA     | RSA-PSS            | SHA-384         |
| PS512           | RSA     | RSA-PSS            | SHA-512         |
| ES256           | EC      | ECDSA              | SHA-256         |
| ES384           | EC      | ECDSA              | SHA-384         |
| ES512           | EC      | ECDSA              | SHA-512         |

### Dependencies

- `@azure/keyvault-keys` — Optional peer dependency (dynamically imported)
- `@azure/keyvault-certificates` — Optional peer dependency (dynamically imported, only for `getCertificateFromKeyVault`)
- `@azure/identity` — Required by user (provides `TokenCredential`), not our dependency

### Key Differences from GCP Signer

1. **Authentication**: Azure uses `TokenCredential` (passed explicitly) vs GCP's ADC (implicit)
2. **Algorithm detection**: Azure keys expose `keyOps` and key type, but the specific signing algorithm must be inferred from the key type + user's digest choice (unlike GCP where the algorithm is fixed at key creation)
3. **Certificate retrieval**: Azure has a dedicated certificate service in the same vault (vs GCP needing Secret Manager)
4. **Error format**: REST errors with HTTP status codes (vs gRPC status codes)
5. **Key URL format**: `https://{vault}.vault.azure.net/keys/{name}/{version}` (vs GCP resource path)

## Test Plan

### Unit tests

- Algorithm mapping: all 9 Azure algorithms → our types
- Key URL building from shorthand (vaultName + keyName + keyVersion)
- Key URL parsing (extract vault name, key name, version)
- Error class hierarchy
- Rejection of unsupported key types (oct/symmetric keys)
- Validation of key operations (must include "sign")

### Integration tests (skip without Azure credentials)

- RSA PKCS#1 v1.5 signing + PDF signing
- RSA-PSS signing
- ECDSA signing (P-256, P-384)
- Certificate retrieval from Key Vault
- Full PDF signing flow with Azure HSM key
- Error cases: key not found, permission denied, key disabled

## Open Questions

1. **Algorithm detection strategy**: Azure keys don't lock to a single algorithm like GCP. An RSA key in Azure can be used with RS256, RS384, RS512, PS256, PS384, PS512. Should we:
   - (a) Require the user to specify the algorithm? (more flexible)
   - (b) Infer from key type + key size? (more automatic, but less control)
   - (c) Let the signing flow pick based on the digest algorithm? (matches how our CMS builder calls `sign(data, digestAlgorithm)`)

   **Recommendation**: Option (c) — derive the Azure algorithm at `sign()` time from the key type + requested digest algorithm. This matches how our `Signer.sign(data, algorithm)` interface works. Store the key type (RSA vs EC) and optionally a preferred signature scheme (PKCS1 vs PSS) at creation time.

2. **RSA scheme preference**: Since Azure RSA keys support both PKCS#1 v1.5 and PSS, should we default to PKCS#1 v1.5 (maximum compatibility) or PSS (more secure)?

   **Recommendation**: Default to PKCS#1 v1.5 for compatibility (matching the GCP signer's warning about PSS), with an option to prefer PSS.

3. **Managed HSM vs Key Vault**: The API is identical, but the vault URL differs (`.vault.azure.net` vs `.managedhsm.azure.net`). Should we handle both transparently or have separate options?

   **Recommendation**: Handle transparently — accept any vault URL. The `KeyClient` and `CryptographyClient` work with both.
