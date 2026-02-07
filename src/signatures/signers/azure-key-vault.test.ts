/**
 * Tests for AzureKeyVaultSigner.
 *
 * Unit tests: Pure logic (algorithm mapping, key URL building, key type detection, error handling)
 * Integration tests: Real Azure Key Vault (skipped without Azure credentials)
 */

import { beforeAll, describe, expect, it } from "vitest";

import { AzureKeyVaultSignerError, KmsSignerError, SignerError } from "../types";
import {
  buildKeyId,
  buildVaultUrl,
  detectKeyType,
  ecCurveToDigestAlgorithm,
  mapAzureAlgorithm,
  parseVaultUrl,
  resolveAzureAlgorithm,
} from "./azure-key-vault";

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Algorithm Mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("mapAzureAlgorithm", () => {
  describe("RSA PKCS#1 v1.5 algorithms", () => {
    it("maps RS256", () => {
      const result = mapAzureAlgorithm("RS256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-256",
        azureAlgorithm: "RS256",
      });
    });

    it("maps RS384", () => {
      const result = mapAzureAlgorithm("RS384");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-384",
        azureAlgorithm: "RS384",
      });
    });

    it("maps RS512", () => {
      const result = mapAzureAlgorithm("RS512");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSASSA-PKCS1-v1_5",
        digestAlgorithm: "SHA-512",
        azureAlgorithm: "RS512",
      });
    });
  });

  describe("RSA-PSS algorithms", () => {
    it("maps PS256", () => {
      const result = mapAzureAlgorithm("PS256");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-256",
        azureAlgorithm: "PS256",
      });
    });

    it("maps PS384", () => {
      const result = mapAzureAlgorithm("PS384");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-384",
        azureAlgorithm: "PS384",
      });
    });

    it("maps PS512", () => {
      const result = mapAzureAlgorithm("PS512");

      expect(result).toEqual({
        keyType: "RSA",
        signatureAlgorithm: "RSA-PSS",
        digestAlgorithm: "SHA-512",
        azureAlgorithm: "PS512",
      });
    });
  });

  describe("ECDSA algorithms", () => {
    it("maps ES256", () => {
      const result = mapAzureAlgorithm("ES256");

      expect(result).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-256",
        azureAlgorithm: "ES256",
      });
    });

    it("maps ES384", () => {
      const result = mapAzureAlgorithm("ES384");

      expect(result).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-384",
        azureAlgorithm: "ES384",
      });
    });

    it("maps ES512", () => {
      const result = mapAzureAlgorithm("ES512");

      expect(result).toEqual({
        keyType: "EC",
        signatureAlgorithm: "ECDSA",
        digestAlgorithm: "SHA-512",
        azureAlgorithm: "ES512",
      });
    });
  });

  describe("unsupported algorithms", () => {
    it("throws for unknown algorithm", () => {
      expect(() => mapAzureAlgorithm("UNKNOWN")).toThrow(AzureKeyVaultSignerError);
      expect(() => mapAzureAlgorithm("UNKNOWN")).toThrow(/Unsupported Azure Key Vault algorithm/);
    });

    it("includes algorithm name in error message", () => {
      expect(() => mapAzureAlgorithm("HS256")).toThrow("HS256");
    });

    it("throws for HMAC algorithms", () => {
      expect(() => mapAzureAlgorithm("HS256")).toThrow(AzureKeyVaultSignerError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Algorithm Resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveAzureAlgorithm", () => {
  describe("RSA with PKCS1 scheme", () => {
    it("resolves SHA-256 to RS256", () => {
      expect(resolveAzureAlgorithm("RSA", "SHA-256", "PKCS1")).toBe("RS256");
    });

    it("resolves SHA-384 to RS384", () => {
      expect(resolveAzureAlgorithm("RSA", "SHA-384", "PKCS1")).toBe("RS384");
    });

    it("resolves SHA-512 to RS512", () => {
      expect(resolveAzureAlgorithm("RSA", "SHA-512", "PKCS1")).toBe("RS512");
    });
  });

  describe("RSA with PSS scheme", () => {
    it("resolves SHA-256 to PS256", () => {
      expect(resolveAzureAlgorithm("RSA", "SHA-256", "PSS")).toBe("PS256");
    });

    it("resolves SHA-384 to PS384", () => {
      expect(resolveAzureAlgorithm("RSA", "SHA-384", "PSS")).toBe("PS384");
    });

    it("resolves SHA-512 to PS512", () => {
      expect(resolveAzureAlgorithm("RSA", "SHA-512", "PSS")).toBe("PS512");
    });
  });

  describe("EC (ignores RSA scheme)", () => {
    it("resolves SHA-256 to ES256", () => {
      expect(resolveAzureAlgorithm("EC", "SHA-256", "PKCS1")).toBe("ES256");
    });

    it("resolves SHA-384 to ES384", () => {
      expect(resolveAzureAlgorithm("EC", "SHA-384", "PKCS1")).toBe("ES384");
    });

    it("resolves SHA-512 to ES512", () => {
      expect(resolveAzureAlgorithm("EC", "SHA-512", "PKCS1")).toBe("ES512");
    });

    it("ignores PSS scheme for EC keys", () => {
      expect(resolveAzureAlgorithm("EC", "SHA-256", "PSS")).toBe("ES256");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Key URL Building
// ─────────────────────────────────────────────────────────────────────────────

describe("buildKeyId", () => {
  it("builds URL from vault name, key name, and version", () => {
    const result = buildKeyId({
      vaultName: "my-vault",
      keyName: "my-key",
      keyVersion: "abc123",
      certificate: new Uint8Array(),
      credential: {} as any,
    });

    expect(result).toBe("https://my-vault.vault.azure.net/keys/my-key/abc123");
  });

  it("omits version when not specified (latest)", () => {
    const result = buildKeyId({
      vaultName: "my-vault",
      keyName: "my-key",
      certificate: new Uint8Array(),
      credential: {} as any,
    });

    expect(result).toBe("https://my-vault.vault.azure.net/keys/my-key");
  });

  it("uses custom vault suffix for Managed HSM", () => {
    const result = buildKeyId({
      vaultName: "my-hsm",
      keyName: "my-key",
      keyVersion: "v1",
      vaultSuffix: "managedhsm.azure.net",
      certificate: new Uint8Array(),
      credential: {} as any,
    });

    expect(result).toBe("https://my-hsm.managedhsm.azure.net/keys/my-key/v1");
  });

  it("handles vault names with special characters", () => {
    const result = buildKeyId({
      vaultName: "my-vault-123",
      keyName: "signing-key",
      certificate: new Uint8Array(),
      credential: {} as any,
    });

    expect(result).toBe("https://my-vault-123.vault.azure.net/keys/signing-key");
  });
});

describe("buildVaultUrl", () => {
  it("builds vault URL from vault name", () => {
    const result = buildVaultUrl({
      vaultName: "my-vault",
      keyName: "my-key",
      certificate: new Uint8Array(),
      credential: {} as any,
    });

    expect(result).toBe("https://my-vault.vault.azure.net");
  });

  it("uses custom suffix", () => {
    const result = buildVaultUrl({
      vaultName: "my-hsm",
      keyName: "my-key",
      vaultSuffix: "managedhsm.azure.net",
      certificate: new Uint8Array(),
      credential: {} as any,
    });

    expect(result).toBe("https://my-hsm.managedhsm.azure.net");
  });
});

describe("parseVaultUrl", () => {
  it("extracts vault URL from key ID", () => {
    const result = parseVaultUrl("https://my-vault.vault.azure.net/keys/my-key/abc123");

    expect(result).toBe("https://my-vault.vault.azure.net");
  });

  it("handles Managed HSM URLs", () => {
    const result = parseVaultUrl("https://my-hsm.managedhsm.azure.net/keys/my-key/v1");

    expect(result).toBe("https://my-hsm.managedhsm.azure.net");
  });

  it("handles key ID without version", () => {
    const result = parseVaultUrl("https://my-vault.vault.azure.net/keys/my-key");

    expect(result).toBe("https://my-vault.vault.azure.net");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Key Type Detection
// ─────────────────────────────────────────────────────────────────────────────

describe("detectKeyType", () => {
  it("detects RSA key type", () => {
    expect(detectKeyType("RSA")).toBe("RSA");
  });

  it("detects RSA-HSM key type as RSA", () => {
    expect(detectKeyType("RSA-HSM")).toBe("RSA");
  });

  it("detects EC key type", () => {
    expect(detectKeyType("EC")).toBe("EC");
  });

  it("detects EC-HSM key type as EC", () => {
    expect(detectKeyType("EC-HSM")).toBe("EC");
  });

  it("rejects symmetric (oct) key type", () => {
    expect(() => detectKeyType("oct")).toThrow(AzureKeyVaultSignerError);
    expect(() => detectKeyType("oct")).toThrow(/Unsupported key type.*oct/);
  });

  it("rejects oct-HSM key type", () => {
    expect(() => detectKeyType("oct-HSM")).toThrow(AzureKeyVaultSignerError);
    expect(() => detectKeyType("oct-HSM")).toThrow(/Only RSA and EC/);
  });

  it("rejects unknown key types", () => {
    expect(() => detectKeyType("unknown")).toThrow(AzureKeyVaultSignerError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: EC Curve → Digest Algorithm
// ─────────────────────────────────────────────────────────────────────────────

describe("ecCurveToDigestAlgorithm", () => {
  it("maps P-256 to SHA-256", () => {
    expect(ecCurveToDigestAlgorithm("P-256")).toBe("SHA-256");
  });

  it("maps P-384 to SHA-384", () => {
    expect(ecCurveToDigestAlgorithm("P-384")).toBe("SHA-384");
  });

  it("maps P-521 to SHA-512", () => {
    expect(ecCurveToDigestAlgorithm("P-521")).toBe("SHA-512");
  });

  it("rejects unsupported curves", () => {
    expect(() => ecCurveToDigestAlgorithm("secp256k1")).toThrow(AzureKeyVaultSignerError);
    expect(() => ecCurveToDigestAlgorithm("secp256k1")).toThrow(
      /Unsupported EC curve.*P-256.*P-384.*P-521/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: AzureKeyVaultSignerError
// ─────────────────────────────────────────────────────────────────────────────

describe("AzureKeyVaultSignerError", () => {
  it("prefixes message with KMS: Azure Key Vault:", () => {
    const error = new AzureKeyVaultSignerError("Something went wrong");

    expect(error.message).toBe("KMS: Azure Key Vault: Something went wrong");
  });

  it("has correct name", () => {
    const error = new AzureKeyVaultSignerError("test");

    expect(error.name).toBe("AzureKeyVaultSignerError");
  });

  it("stores cause when provided", () => {
    const cause = new Error("Original error");
    const error = new AzureKeyVaultSignerError("Wrapped error", cause);

    expect(error.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const error = new AzureKeyVaultSignerError("test");

    expect(error).toBeInstanceOf(Error);
  });

  it("is an instance of KmsSignerError", () => {
    const error = new AzureKeyVaultSignerError("test");

    expect(error).toBeInstanceOf(KmsSignerError);
  });

  it("is an instance of SignerError", () => {
    const error = new AzureKeyVaultSignerError("test");

    expect(error).toBeInstanceOf(SignerError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests (Skipped without Azure credentials)
// ─────────────────────────────────────────────────────────────────────────────

// Integration tests require:
// - Azure credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET or az login)
// - TEST_AZURE_KEY_VAULT_URL env var with vault URL (e.g., https://my-vault.vault.azure.net)
// - TEST_AZURE_RSA_KEY_NAME env var with name of test RSA key
// - TEST_AZURE_EC_KEY_NAME env var with name of test EC key
// - TEST_AZURE_RSA_CERT_PATH env var with path to DER certificate for RSA key
// - TEST_AZURE_EC_CERT_PATH env var with path to DER certificate for EC key

import { PDF } from "#src/api/pdf.ts";
import { loadFixture, saveTestOutput } from "#src/test-utils.ts";
import * as fs from "fs";

import { AzureKeyVaultSigner } from "./azure-key-vault";

const vaultUrl = process.env.TEST_AZURE_KEY_VAULT_URL;
const rsaKeyName = process.env.TEST_AZURE_RSA_KEY_NAME;
const ecKeyName = process.env.TEST_AZURE_EC_KEY_NAME;
const rsaCertPath = process.env.TEST_AZURE_RSA_CERT_PATH;
const ecCertPath = process.env.TEST_AZURE_EC_CERT_PATH;
const certName = process.env.TEST_AZURE_CERT_NAME;

// Check for Azure credentials
const hasAzureCredentials =
  (!!process.env.AZURE_TENANT_ID && !!process.env.AZURE_CLIENT_ID) ||
  !!process.env.AZURE_CLI_TENANT_ID;

const canRunIntegrationTests = hasAzureCredentials && vaultUrl && (rsaKeyName || ecKeyName);

describe.skipIf(!canRunIntegrationTests)("AzureKeyVaultSigner integration", () => {
  let rsaCertificate: Uint8Array;
  let ecCertificate: Uint8Array;

  beforeAll(async () => {
    if (rsaCertPath) {
      const fsPromises = await import("fs/promises");
      rsaCertificate = new Uint8Array(await fsPromises.readFile(rsaCertPath));
    }

    if (ecCertPath) {
      const fsPromises = await import("fs/promises");
      ecCertificate = new Uint8Array(await fsPromises.readFile(ecCertPath));
    }
  });

  describe.skipIf(!rsaKeyName || !rsaCertPath)("RSA signing", () => {
    it("creates signer with RSA key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const signer = await AzureKeyVaultSigner.create({
        vaultName: new URL(vaultUrl!).hostname.split(".")[0],
        keyName: rsaKeyName!,
        certificate: rsaCertificate,
        credential: new DefaultAzureCredential(),
      });

      expect(signer.keyType).toBe("RSA");
      expect(signer.signatureAlgorithm).toBe("RSASSA-PKCS1-v1_5");
    });

    it("signs data with RSA key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const signer = await AzureKeyVaultSigner.create({
        vaultName: new URL(vaultUrl!).hostname.split(".")[0],
        keyName: rsaKeyName!,
        certificate: rsaCertificate,
        credential: new DefaultAzureCredential(),
      });

      const testData = new TextEncoder().encode("Hello, World!");
      const signature = await signer.sign(testData, "SHA-256");

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
    });

    it("signs a PDF document with Azure Key Vault RSA key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const signer = await AzureKeyVaultSigner.create({
        vaultName: new URL(vaultUrl!).hostname.split(".")[0],
        keyName: rsaKeyName!,
        certificate: rsaCertificate,
        credential: new DefaultAzureCredential(),
      });

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Signed with Azure Key Vault (RSA key)",
        location: "Integration Test",
      });

      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(warnings).toHaveLength(0);

      const pdfStr = new TextDecoder().decode(bytes);

      expect(pdfStr).toContain("/Type /Sig");
      expect(pdfStr).toContain("/Filter /Adobe.PPKLite");

      await saveTestOutput("signatures/azure-kv-signed-rsa.pdf", bytes);
    });
  });

  describe.skipIf(!ecKeyName || !ecCertPath)("ECDSA signing", () => {
    it("creates signer with ECDSA key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const signer = await AzureKeyVaultSigner.create({
        vaultName: new URL(vaultUrl!).hostname.split(".")[0],
        keyName: ecKeyName!,
        certificate: ecCertificate,
        credential: new DefaultAzureCredential(),
      });

      expect(signer.keyType).toBe("EC");
      expect(signer.signatureAlgorithm).toBe("ECDSA");
    });

    it("signs data with ECDSA key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const signer = await AzureKeyVaultSigner.create({
        vaultName: new URL(vaultUrl!).hostname.split(".")[0],
        keyName: ecKeyName!,
        certificate: ecCertificate,
        credential: new DefaultAzureCredential(),
      });

      const testData = new TextEncoder().encode("Hello, World!");
      const signature = await signer.sign(testData, "SHA-256");

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
    });

    it("signs a PDF document with Azure Key Vault ECDSA key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const pdfBytes = await loadFixture("basic", "rot0.pdf");
      const pdf = await PDF.load(pdfBytes);

      const signer = await AzureKeyVaultSigner.create({
        vaultName: new URL(vaultUrl!).hostname.split(".")[0],
        keyName: ecKeyName!,
        certificate: ecCertificate,
        credential: new DefaultAzureCredential(),
      });

      const { bytes, warnings } = await pdf.sign({
        signer,
        reason: "Signed with Azure Key Vault (ECDSA key)",
        location: "Integration Test",
      });

      expect(bytes.length).toBeGreaterThan(pdfBytes.length);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(warnings).toHaveLength(0);

      await saveTestOutput("signatures/azure-kv-signed-ecdsa.pdf", bytes);
    });
  });

  describe.skipIf(!certName)("getCertificateFromKeyVault", () => {
    it("loads certificate from Key Vault", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      const { cert } = await AzureKeyVaultSigner.getCertificateFromKeyVault({
        vaultUrl: vaultUrl!,
        certificateName: certName!,
        credential: new DefaultAzureCredential(),
      });

      expect(cert).toBeInstanceOf(Uint8Array);
      expect(cert.length).toBeGreaterThan(0);
    });
  });

  describe.skipIf(!rsaKeyName)("error handling", () => {
    it("rejects non-existent key", async () => {
      const { DefaultAzureCredential } = await import("@azure/identity");

      await expect(
        AzureKeyVaultSigner.create({
          keyId: `${vaultUrl}/keys/nonexistent-key-12345/v1`,
          certificate: new Uint8Array([0x30, 0x82]),
          credential: new DefaultAzureCredential(),
        }),
      ).rejects.toThrow(AzureKeyVaultSignerError);
    });
  });
});
