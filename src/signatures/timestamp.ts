/**
 * RFC 3161 Timestamp Authority client.
 *
 * Provides timestamp tokens that prove a document existed at a specific point
 * in time. Used for PAdES B-T level and above.
 *
 * RFC 3161: Internet X.509 Public Key Infrastructure Time-Stamp Protocol (TSP)
 */

import { bytesToHex, toArrayBuffer } from "#src/helpers/buffer.ts";
import {
  Boolean as AsnBoolean,
  fromBER,
  Integer,
  ObjectIdentifier,
  OctetString,
  Sequence,
} from "asn1js";

import { OID_SHA256, OID_SHA384, OID_SHA512 } from "./oids";
import type { DigestAlgorithm, TimestampAuthority } from "./types";
import { TimestampError } from "./types";

/**
 * Get the OID for a digest algorithm.
 */
function getDigestAlgorithmOid(algorithm: DigestAlgorithm): string {
  switch (algorithm) {
    case "SHA-256":
      return OID_SHA256;
    case "SHA-384":
      return OID_SHA384;
    case "SHA-512":
      return OID_SHA512;
  }
}

/**
 * Options for HttpTimestampAuthority.
 */
export interface HttpTimestampAuthorityOptions {
  /**
   * Custom HTTP headers to send with requests.
   * Use for authentication (e.g., "Authorization": "Bearer token").
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Custom fetch implementation for advanced auth/middleware.
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * HTTP-based RFC 3161 Timestamp Authority client.
 *
 * Sends timestamp requests to a TSA server and returns the timestamp token.
 *
 * @example
 * ```typescript
 * const tsa = new HttpTimestampAuthority("http://timestamp.digicert.com");
 * const token = await tsa.timestamp(signatureDigest, "SHA-256");
 * ```
 *
 * @example
 * ```typescript
 * // With authentication
 * const tsa = new HttpTimestampAuthority("https://tsa.example.com", {
 *   headers: { "Authorization": "Bearer token123" },
 *   timeout: 60000,
 * });
 * ```
 */
export class HttpTimestampAuthority implements TimestampAuthority {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(url: string, options: HttpTimestampAuthorityOptions = {}) {
    this.url = url;
    this.headers = options.headers ?? {};
    this.timeout = options.timeout ?? 30000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  /**
   * Request a timestamp token for the given digest.
   *
   * @param digest - The hash to timestamp (typically the signature value)
   * @param algorithm - The digest algorithm used
   * @returns DER-encoded TimeStampToken
   * @throws {TimestampError} if the request fails or the response is invalid
   */
  async timestamp(digest: Uint8Array, algorithm: DigestAlgorithm): Promise<Uint8Array> {
    // Build the timestamp request
    const request = this.buildTimestampRequest(digest, algorithm);

    try {
      // Send request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await this.fetchFn(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/timestamp-query",
          Accept: "application/timestamp-reply",
          ...this.headers,
        },
        body: request,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new TimestampError(
          `TSA request failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const responseData = await response.arrayBuffer();
      return this.parseTimestampResponse(new Uint8Array(responseData));
    } catch (error) {
      if (error instanceof TimestampError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new TimestampError(`TSA request timed out after ${this.timeout}ms`);
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new TimestampError(`TSA request failed: ${message}`);
    }
  }

  /**
   * Build an RFC 3161 TimeStampReq.
   *
   * TimeStampReq ::= SEQUENCE {
   *   version         INTEGER { v1(1) },
   *   messageImprint  MessageImprint,
   *   reqPolicy       TSAPolicyId OPTIONAL,
   *   nonce           INTEGER OPTIONAL,
   *   certReq         BOOLEAN DEFAULT FALSE,
   *   extensions      [0] IMPLICIT Extensions OPTIONAL
   * }
   *
   * MessageImprint ::= SEQUENCE {
   *   hashAlgorithm   AlgorithmIdentifier,
   *   hashedMessage   OCTET STRING
   * }
   */
  private buildTimestampRequest(digest: Uint8Array, algorithm: DigestAlgorithm): Uint8Array {
    // Generate a random nonce for replay protection
    const nonce = new Uint8Array(8);
    crypto.getRandomValues(nonce);

    const nonceValue = BigInt(`0x${bytesToHex(nonce)}`);

    // Build MessageImprint
    const messageImprint = new Sequence({
      value: [
        // AlgorithmIdentifier
        new Sequence({
          value: [
            new ObjectIdentifier({ value: getDigestAlgorithmOid(algorithm) }),
            // NULL parameters (required for SHA algorithms)
          ],
        }),
        // hashedMessage
        new OctetString({ valueHex: toArrayBuffer(digest) }),
      ],
    });

    // Build TimeStampReq with certReq = TRUE to request TSA certificate in response
    const timeStampReqWithCertReq = new Sequence({
      value: [
        new Integer({ value: 1 }), // version
        messageImprint, // messageImprint
        // reqPolicy omitted - skip
        new Integer({ value: Number(nonceValue & BigInt(0x7fffffff)) }), // nonce
        new AsnBoolean({ value: true }), // certReq = TRUE (request TSA cert in response)
      ],
    });

    return new Uint8Array(timeStampReqWithCertReq.toBER(false));
  }

  /**
   * Parse an RFC 3161 TimeStampResp and extract the TimeStampToken.
   *
   * TimeStampResp ::= SEQUENCE {
   *   status          PKIStatusInfo,
   *   timeStampToken  TimeStampToken OPTIONAL
   * }
   *
   * PKIStatusInfo ::= SEQUENCE {
   *   status        PKIStatus,
   *   statusString  PKIFreeText OPTIONAL,
   *   failInfo      PKIFailureInfo OPTIONAL
   * }
   *
   * PKIStatus ::= INTEGER {
   *   granted                (0),
   *   grantedWithMods        (1),
   *   rejection              (2),
   *   waiting                (3),
   *   revocationWarning      (4),
   *   revocationNotification (5)
   * }
   */
  private parseTimestampResponse(data: Uint8Array): Uint8Array {
    const asn1 = fromBER(toArrayBuffer(data));

    if (asn1.offset === -1) {
      throw new TimestampError("Failed to parse timestamp response: invalid ASN.1");
    }

    const response = asn1.result;

    if (!(response instanceof Sequence) || response.valueBlock.value.length < 1) {
      throw new TimestampError("Invalid timestamp response structure");
    }

    // Get status from PKIStatusInfo
    const statusInfo = response.valueBlock.value[0];
    if (!(statusInfo instanceof Sequence) || statusInfo.valueBlock.value.length < 1) {
      throw new TimestampError("Invalid PKIStatusInfo structure");
    }

    const status = statusInfo.valueBlock.value[0];
    if (!(status instanceof Integer)) {
      throw new TimestampError("Invalid PKIStatus");
    }

    const statusValue = status.valueBlock.valueDec;

    // Check status: 0 = granted, 1 = grantedWithMods
    if (statusValue !== 0 && statusValue !== 1) {
      // Try to extract error message
      let errorMessage = `TSA rejected request with status ${statusValue}`;

      if (statusInfo.valueBlock.value.length > 1) {
        // statusString might be present
        const statusString = statusInfo.valueBlock.value[1];
        if (statusString instanceof Sequence && statusString.valueBlock.value.length > 0) {
          // PKIFreeText is SEQUENCE OF UTF8String
          const firstString = statusString.valueBlock.value[0];

          if (
            firstString &&
            "valueBlock" in firstString &&
            "value" in (firstString as any).valueBlock
          ) {
            errorMessage += `: ${(firstString as any).valueBlock.value}`;
          }
        }
      }

      throw new TimestampError(errorMessage);
    }

    // Extract TimeStampToken (second element in response)
    if (response.valueBlock.value.length < 2) {
      throw new TimestampError("Timestamp response missing TimeStampToken");
    }

    const timeStampToken = response.valueBlock.value[1];

    // The TimeStampToken is a ContentInfo containing SignedData
    // Return it as-is (DER encoded)
    return new Uint8Array(timeStampToken.toBER(false));
  }
}
