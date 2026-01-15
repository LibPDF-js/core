import {
  beginMarkedContent,
  beginMarkedContentProps,
  beginText,
  clip,
  clipEvenOdd,
  closeAndStroke,
  closeFillAndStroke,
  closeFillAndStrokeEvenOdd,
  closePath,
  concatMatrix,
  curveTo,
  curveToFinal,
  curveToInitial,
  drawXObject,
  endMarkedContent,
  endPath,
  endText,
  fill,
  fillAndStroke,
  fillAndStrokeEvenOdd,
  fillCompat,
  fillEvenOdd,
  lineTo,
  moveAndShowText,
  moveText,
  moveTextSetLeading,
  moveTo,
  nextLine,
  paintShading,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setCharSpacing,
  setFont,
  setGraphicsState,
  setHorizontalScale,
  setLeading,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setMiterLimit,
  setNonStrokingCMYK,
  setNonStrokingColorSpace,
  setNonStrokingGray,
  setNonStrokingRGB,
  setStrokingCMYK,
  setStrokingColorSpace,
  setStrokingGray,
  setStrokingRGB,
  setTextMatrix,
  setTextRenderMode,
  setTextRise,
  setWordSpacing,
  showText,
  showTextArray,
  stroke,
} from "#src/helpers/operators.ts";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import { Op, Operator } from "./operators";

describe("Operator", () => {
  describe("Operator.of", () => {
    it("creates operator with no operands", () => {
      const op = Operator.of(Op.PushGraphicsState);
      expect(op.op).toBe(Op.PushGraphicsState);
      expect(op.operands).toEqual([]);
    });

    it("creates operator with operands", () => {
      const op = Operator.of(Op.MoveTo, 100, 200);
      expect(op.op).toBe(Op.MoveTo);
      expect(op.operands).toEqual([100, 200]);
    });

    it("freezes operands array", () => {
      const op = Operator.of(Op.MoveTo, 100, 200);
      expect(Object.isFrozen(op.operands)).toBe(true);
    });
  });

  describe("serialization", () => {
    describe("zero-operand operators", () => {
      it("serializes q (push graphics state)", () => {
        expect(pushGraphicsState().toString()).toBe("q");
      });

      it("serializes Q (pop graphics state)", () => {
        expect(popGraphicsState().toString()).toBe("Q");
      });

      it("serializes BT (begin text)", () => {
        expect(beginText().toString()).toBe("BT");
      });

      it("serializes ET (end text)", () => {
        expect(endText().toString()).toBe("ET");
      });

      it("serializes h (close path)", () => {
        expect(closePath().toString()).toBe("h");
      });

      it("serializes S (stroke)", () => {
        expect(stroke().toString()).toBe("S");
      });

      it("serializes s (close and stroke)", () => {
        expect(closeAndStroke().toString()).toBe("s");
      });

      it("serializes f (fill)", () => {
        expect(fill().toString()).toBe("f");
      });

      it("serializes F (fill compat)", () => {
        expect(fillCompat().toString()).toBe("F");
      });

      it("serializes f* (fill even-odd)", () => {
        expect(fillEvenOdd().toString()).toBe("f*");
      });

      it("serializes B (fill and stroke)", () => {
        expect(fillAndStroke().toString()).toBe("B");
      });

      it("serializes B* (fill and stroke even-odd)", () => {
        expect(fillAndStrokeEvenOdd().toString()).toBe("B*");
      });

      it("serializes b (close, fill, stroke)", () => {
        expect(closeFillAndStroke().toString()).toBe("b");
      });

      it("serializes b* (close, fill, stroke even-odd)", () => {
        expect(closeFillAndStrokeEvenOdd().toString()).toBe("b*");
      });

      it("serializes n (end path)", () => {
        expect(endPath().toString()).toBe("n");
      });

      it("serializes W (clip)", () => {
        expect(clip().toString()).toBe("W");
      });

      it("serializes W* (clip even-odd)", () => {
        expect(clipEvenOdd().toString()).toBe("W*");
      });

      it("serializes T* (next line)", () => {
        expect(nextLine().toString()).toBe("T*");
      });

      it("serializes EMC (end marked content)", () => {
        expect(endMarkedContent().toString()).toBe("EMC");
      });
    });

    describe("single number operand", () => {
      it("serializes w (line width)", () => {
        expect(setLineWidth(2).toString()).toBe("2 w");
      });

      it("serializes g (non-stroking gray)", () => {
        expect(setNonStrokingGray(0.5).toString()).toBe("0.5 g");
      });

      it("serializes G (stroking gray)", () => {
        expect(setStrokingGray(0).toString()).toBe("0 G");
      });

      it("serializes J (line cap)", () => {
        expect(setLineCap(1).toString()).toBe("1 J");
      });

      it("serializes j (line join)", () => {
        expect(setLineJoin(2).toString()).toBe("2 j");
      });

      it("serializes M (miter limit)", () => {
        expect(setMiterLimit(10).toString()).toBe("10 M");
      });

      it("serializes Tc (char spacing)", () => {
        expect(setCharSpacing(0.5).toString()).toBe("0.5 Tc");
      });

      it("serializes Tw (word spacing)", () => {
        expect(setWordSpacing(1.5).toString()).toBe("1.5 Tw");
      });

      it("serializes Tz (horizontal scale)", () => {
        expect(setHorizontalScale(100).toString()).toBe("100 Tz");
      });

      it("serializes TL (leading)", () => {
        expect(setLeading(14).toString()).toBe("14 TL");
      });

      it("serializes Tr (text render mode)", () => {
        expect(setTextRenderMode(0).toString()).toBe("0 Tr");
      });

      it("serializes Ts (text rise)", () => {
        expect(setTextRise(5).toString()).toBe("5 Ts");
      });
    });

    describe("multiple number operands", () => {
      it("serializes m (move to)", () => {
        expect(moveTo(100, 200).toString()).toBe("100 200 m");
      });

      it("serializes l (line to)", () => {
        expect(lineTo(150, 250).toString()).toBe("150 250 l");
      });

      it("serializes Td (move text)", () => {
        expect(moveText(10, 20).toString()).toBe("10 20 Td");
      });

      it("serializes TD (move text set leading)", () => {
        expect(moveTextSetLeading(0, -14).toString()).toBe("0 -14 TD");
      });

      it("serializes rg (non-stroking RGB)", () => {
        expect(setNonStrokingRGB(1, 0, 0).toString()).toBe("1 0 0 rg");
      });

      it("serializes RG (stroking RGB)", () => {
        expect(setStrokingRGB(0, 1, 0).toString()).toBe("0 1 0 RG");
      });

      it("serializes k (non-stroking CMYK)", () => {
        expect(setNonStrokingCMYK(0, 1, 1, 0).toString()).toBe("0 1 1 0 k");
      });

      it("serializes K (stroking CMYK)", () => {
        expect(setStrokingCMYK(1, 0, 0, 0).toString()).toBe("1 0 0 0 K");
      });

      it("serializes re (rectangle)", () => {
        expect(rectangle(10, 20, 100, 50).toString()).toBe("10 20 100 50 re");
      });

      it("serializes v (curve to initial)", () => {
        expect(curveToInitial(50, 60, 70, 80).toString()).toBe("50 60 70 80 v");
      });

      it("serializes y (curve to final)", () => {
        expect(curveToFinal(10, 20, 30, 40).toString()).toBe("10 20 30 40 y");
      });
    });

    describe("six number operands (matrices)", () => {
      it("serializes cm (concat matrix)", () => {
        expect(concatMatrix(1, 0, 0, 1, 10, 20).toString()).toBe("1 0 0 1 10 20 cm");
      });

      it("serializes Tm (text matrix)", () => {
        expect(setTextMatrix(1, 0, 0, 1, 50, 700).toString()).toBe("1 0 0 1 50 700 Tm");
      });

      it("serializes c (curve to)", () => {
        expect(curveTo(10, 20, 30, 40, 50, 60).toString()).toBe("10 20 30 40 50 60 c");
      });
    });

    describe("name operand", () => {
      it("serializes Tf (set font)", () => {
        expect(setFont("/Helv", 12).toString()).toBe("/Helv 12 Tf");
      });

      it("serializes gs (set graphics state)", () => {
        expect(setGraphicsState("/GS0").toString()).toBe("/GS0 gs");
      });

      it("serializes Do (draw XObject)", () => {
        expect(drawXObject("/Im0").toString()).toBe("/Im0 Do");
      });

      it("serializes sh (paint shading)", () => {
        expect(paintShading("/Sh0").toString()).toBe("/Sh0 sh");
      });

      it("serializes CS (set stroking color space)", () => {
        expect(setStrokingColorSpace("/DeviceRGB").toString()).toBe("/DeviceRGB CS");
      });

      it("serializes cs (set non-stroking color space)", () => {
        expect(setNonStrokingColorSpace("/DeviceCMYK").toString()).toBe("/DeviceCMYK cs");
      });
    });

    describe("string operand", () => {
      it("serializes Tj (show text)", () => {
        const text = PdfString.fromString("Hello");
        expect(showText(text).toString()).toBe("(Hello) Tj");
      });

      it("serializes ' (move and show text)", () => {
        const text = PdfString.fromString("World");
        expect(moveAndShowText(text).toString()).toBe("(World) '");
      });
    });

    describe("array operand", () => {
      it("serializes TJ (show text array)", () => {
        const array = new PdfArray([
          PdfString.fromString("H"),
          PdfNumber.of(-10),
          PdfString.fromString("ello"),
        ]);
        expect(showTextArray(array).toString()).toBe("[(H) -10 (ello)] TJ");
      });
    });

    describe("marked content", () => {
      it("serializes BMC (begin marked content)", () => {
        expect(beginMarkedContent("/Tx").toString()).toBe("/Tx BMC");
      });

      it("serializes BDC with string props", () => {
        expect(beginMarkedContentProps("/Span", "/P").toString()).toBe("/Span /P BDC");
      });
    });
  });

  describe("number formatting", () => {
    it("formats integers without decimal point", () => {
      expect(moveTo(100, 200).toString()).toBe("100 200 m");
    });

    it("formats simple decimals", () => {
      expect(setNonStrokingGray(0.5).toString()).toBe("0.5 g");
    });

    it("removes trailing zeros", () => {
      expect(setLineWidth(2.5).toString()).toBe("2.5 w");
    });

    it("handles negative numbers", () => {
      expect(moveText(0, -14).toString()).toBe("0 -14 Td");
    });

    it("formats zero correctly", () => {
      expect(setNonStrokingGray(0).toString()).toBe("0 g");
    });

    it("limits precision to avoid floating point noise", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      const result = setNonStrokingGray(0.1 + 0.2).toString();
      expect(result).toBe("0.3 g");
    });
  });

  describe("PdfName operand", () => {
    it("serializes PdfName objects", () => {
      const op = Operator.of(Op.SetFont, PdfName.of("Helvetica"), 12);
      expect(op.toString()).toBe("/Helvetica 12 Tf");
    });
  });

  describe("byteLength", () => {
    it("returns correct length for operator", () => {
      const op = pushGraphicsState();
      expect(op.byteLength()).toBe(1); // "q"
    });

    it("returns correct length for operator with operands", () => {
      const op = moveTo(100, 200);
      expect(op.byteLength()).toBe(9); // "100 200 m" (3 + 1 + 3 + 1 + 1 = 9)
    });
  });
});
