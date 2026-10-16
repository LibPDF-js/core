/**
 * CAdES Detached signature format (ETSI.CAdES.detached).
 *
 * This is the modern PAdES-compliant signature format. It extends PKCS#7 with
 * the ESS signing-certificate-v2 attribute (binds certificate to signature).
 *
 * ETSI EN 319 122-1: CAdES digital signatures
 * ETSI EN 319 142-1: PAdES digital signatures
 */

import { fromBER, ObjectIdentifier, OctetString, Sequence } from "asn1js";
import * as pkijs from "pkijs";

import { toArrayBuffer } from "../../helpers/buffer";
import {
  OID_CONTENT_TYPE,
  OID_DATA,
  OID_MESSAGE_DIGEST,
  OID_SHA256,
  OID_SHA384,
  OID_SHA512,
  OID_SIGNED_DATA,
  OID_SIGNING_CERTIFICATE_V2,
  OID_TIMESTAMP_TOKEN,
} from "../oids";
import type { DigestAlgorithm } from "../types";
import { hashData } from "../utils";
import {
  encodeSignedAttributesForSigning,
  getDigestAlgorithmOid,
  getSignatureAlgorithmOid,
  parseCertificate,
} from "./common";
import type { CMSCreateOptions, CMSFormatBuilder, CMSSignedData } from "./types";

/**
 * CAdES Detached signature format builder.
 *
 * Creates CMS signatures compatible with PAdES (PDF Advanced Electronic Signatures).
 * Includes ESS signing-certificate-v2 attribute as required by ETSI EN 319 122-1.
 */
export class CAdESDetachedBuilder implements CMSFormatBuilder, CMSSignedData {
  private signedData!: pkijs.SignedData;
  private signerInfo!: pkijs.SignerInfo;
  private signatureValue!: Uint8Array;

  /**
   * Create a CMS SignedData structure in CAdES detached format.
   *
   * Returns this builder which can have a timestamp added before
   * being serialized to DER.
   */
  async create(options: CMSCreateOptions): Promise<CMSSignedData> {
    const { signer, documentHash, digestAlgorithm } = options;

    // Parse certificates
    const signerCert = parseCertificate(signer.certificate);
    const chainCerts = (signer.certificateChain ?? []).map(parseCertificate);
    const allCerts = [signerCert, ...chainCerts];

    // Build signed attributes
    const signedAttrs = await this.buildSignedAttributes(documentHash, digestAlgorithm, signerCert);

    // Encode and sign
    const signedAttrsForSigning = encodeSignedAttributesForSigning(signedAttrs);

    this.signatureValue = await signer.sign(new Uint8Array(signedAttrsForSigning), digestAlgorithm);

    // Build SignerInfo
    this.signerInfo = new pkijs.SignerInfo({
      version: 1,
      sid: new pkijs.IssuerAndSerialNumber({
        issuer: signerCert.issuer,
        serialNumber: signerCert.serialNumber,
      }),
      digestAlgorithm: new pkijs.AlgorithmIdentifier({
        algorithmId: getDigestAlgorithmOid(digestAlgorithm),
      }),
      signedAttrs: new pkijs.SignedAndUnsignedAttributes({
        type: 0,
        attributes: signedAttrs,
      }),
      signatureAlgorithm: new pkijs.AlgorithmIdentifier({
        algorithmId: getSignatureAlgorithmOid(signer, digestAlgorithm),
      }),
      signature: new OctetString({ valueHex: toArrayBuffer(this.signatureValue) }),
    });

    // Build SignedData
    this.signedData = new pkijs.SignedData({
      version: 1,
      encapContentInfo: new pkijs.EncapsulatedContentInfo({
        eContentType: OID_DATA,
      }),
      digestAlgorithms: [
        new pkijs.AlgorithmIdentifier({
          algorithmId: getDigestAlgorithmOid(digestAlgorithm),
        }),
      ],
      certificates: allCerts,
      signerInfos: [this.signerInfo],
    });

    return this;
  }

  getSignatureValue(): Uint8Array {
    return this.signatureValue;
  }

  addTimestampToken(token: Uint8Array): void {
    const asn1 = fromBER(toArrayBuffer(token));

    if (asn1.offset === -1) {
      throw new Error("Failed to parse timestamp token");
    }

    if (!this.signerInfo.unsignedAttrs) {
      this.signerInfo.unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({
        type: 1,
        attributes: [],
      });
    }

    this.signerInfo.unsignedAttrs.attributes.push(
      new pkijs.Attribute({
        type: OID_TIMESTAMP_TOKEN,
        values: [asn1.result],
      }),
    );
  }

  toDER(): Uint8Array {
    const contentInfo = new pkijs.ContentInfo({
      contentType: OID_SIGNED_DATA,
      content: this.signedData.toSchema(),
    });

    return new Uint8Array(contentInfo.toSchema().toBER(false));
  }

  /**
   * Build the signed attributes for CAdES signature.
   *
   * Deliberately omitted, per ETSI EN 319 142-1 Table 1 / clause 6.3:
   * - signing-time: "shall not be present" at every level; /M carries it.
   * - cms-algorithm-protection: defined in EN 319 122-1 §5.2.13 but not
   *   listed in Table 1, and 6.3 forbids any such 122-1 attribute.
   */
  private async buildSignedAttributes(
    documentHash: Uint8Array,
    digestAlgorithm: DigestAlgorithm,
    signerCert: pkijs.Certificate,
  ): Promise<pkijs.Attribute[]> {
    const attrs: pkijs.Attribute[] = [];

    // Content Type (required)
    attrs.push(
      new pkijs.Attribute({
        type: OID_CONTENT_TYPE,
        values: [new ObjectIdentifier({ value: OID_DATA })],
      }),
    );

    // Message Digest (required)
    attrs.push(
      new pkijs.Attribute({
        type: OID_MESSAGE_DIGEST,
        values: [new OctetString({ valueHex: toArrayBuffer(documentHash) })],
      }),
    );

    // ESS signing-certificate-v2 (required for CAdES/PAdES)
    attrs.push(await this.buildSigningCertificateV2(signerCert, digestAlgorithm));

    return attrs;
  }

  /**
   * Build the ESS signing-certificate-v2 attribute (RFC 5035).
   *
   * This attribute binds the signing certificate to the signature,
   * preventing certificate substitution attacks. It is required for
   * CAdES-BES and PAdES-BES compliance.
   *
   * SigningCertificateV2 ::= SEQUENCE {
   *   certs        SEQUENCE OF ESSCertIDv2,
   *   policies     SEQUENCE OF PolicyInformation OPTIONAL
   * }
   *
   * ESSCertIDv2 ::= SEQUENCE {
   *   hashAlgorithm           AlgorithmIdentifier DEFAULT {sha256},
   *   certHash                Hash,
   *   issuerSerial            IssuerSerial OPTIONAL
   * }
   */
  private async buildSigningCertificateV2(
    signerCert: pkijs.Certificate,
    digestAlgorithm: DigestAlgorithm,
  ): Promise<pkijs.Attribute> {
    // Hash the certificate
    const certDer = signerCert.toSchema().toBER(false);
    const certHash = await hashData(new Uint8Array(certDer), digestAlgorithm);

    // Build IssuerSerial using pkijs classes for proper encoding
    // IssuerSerial ::= SEQUENCE {
    //   issuer         GeneralNames,
    //   serialNumber   CertificateSerialNumber
    // }
    const generalName = new pkijs.GeneralName({
      type: 4, // directoryName
      value: signerCert.issuer,
    });

    const generalNames = new pkijs.GeneralNames({
      names: [generalName],
    });

    const issuerSerial = new pkijs.IssuerSerial({
      issuer: generalNames,
      serialNumber: signerCert.serialNumber,
    });

    // Build ESSCertIDv2
    const essCertIdV2Parts: (Sequence | OctetString)[] = [];

    // For SHA-256 (default), we can omit hashAlgorithm per RFC 5035
    // For other algorithms, we must include it
    if (digestAlgorithm !== "SHA-256") {
      const algOid = this.getDigestAlgorithmOidForEss(digestAlgorithm);
      essCertIdV2Parts.push(
        new Sequence({
          value: [new ObjectIdentifier({ value: algOid })],
        }),
      );
    }

    // certHash
    essCertIdV2Parts.push(new OctetString({ valueHex: toArrayBuffer(certHash) }));

    // issuerSerial - convert to ASN.1 schema
    essCertIdV2Parts.push(issuerSerial.toSchema());

    const essCertIdV2 = new Sequence({ value: essCertIdV2Parts });

    // Build SigningCertificateV2: SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }
    const signingCertV2 = new Sequence({
      value: [
        new Sequence({
          value: [essCertIdV2],
        }),
      ],
    });

    return new pkijs.Attribute({
      type: OID_SIGNING_CERTIFICATE_V2,
      values: [signingCertV2],
    });
  }

  /**
   * Get the digest algorithm OID for ESS signing-certificate-v2.
   */
  private getDigestAlgorithmOidForEss(digestAlgorithm: DigestAlgorithm): string {
    switch (digestAlgorithm) {
      case "SHA-256":
        return OID_SHA256;
      case "SHA-384":
        return OID_SHA384;
      case "SHA-512":
        return OID_SHA512;
    }
  }
}
