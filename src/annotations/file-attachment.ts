/**
 * PDFFileAttachmentAnnotation - File attachment annotations.
 *
 * File attachment annotations display an icon representing an
 * embedded file attachment.
 *
 * PDF Reference: Section 12.5.6.15 "File Attachment Annotations"
 */

import type { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import type { PdfRef } from "#src/objects/pdf-ref";

import { PDFMarkupAnnotation } from "./markup";
import type { FileAttachmentIcon } from "./types";

/**
 * File attachment annotation - embedded file icon.
 */
export class PDFFileAttachmentAnnotation extends PDFMarkupAnnotation {
  /**
   * Icon to display.
   */
  get icon(): FileAttachmentIcon {
    const name = this.dict.getName("Name");

    if (!name) {
      return "PushPin";
    }

    const validIcons: FileAttachmentIcon[] = ["Graph", "Paperclip", "PushPin", "Tag"];

    if (validIcons.includes(name.value as FileAttachmentIcon)) {
      return name.value as FileAttachmentIcon;
    }

    return "PushPin";
  }

  /**
   * Set the icon.
   */
  setIcon(icon: FileAttachmentIcon): void {
    this.dict.set("Name", PdfName.of(icon));
    this.markModified();
  }

  /**
   * Reference to the file specification.
   */
  get fileSpecRef(): PdfRef | null {
    const fs = this.dict.get("FS");

    return fs?.type === "ref" ? fs : null;
  }

  /**
   * Get the file specification dictionary.
   */
  async getFileSpec(): Promise<PdfDict | null> {
    const fsRef = this.fileSpecRef;

    if (!fsRef) {
      // Check for direct file spec
      const fsDict = this.dict.getDict("FS");

      return fsDict ?? null;
    }

    const resolved = await this.registry.resolve(fsRef);

    if (resolved && resolved.type === "dict") {
      return resolved as PdfDict;
    }

    return null;
  }

  /**
   * Get the file name from the file specification.
   */
  async getFileName(): Promise<string | null> {
    const fs = await this.getFileSpec();

    if (!fs) {
      return null;
    }

    // Try UF (Unicode file name) first, then F, then DOS/Unix names
    const uf = fs.getString("UF");

    if (uf) {
      return uf.asString();
    }

    const f = fs.getString("F");

    if (f) {
      return f.asString();
    }

    return null;
  }
}
