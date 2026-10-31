import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { owner, configured } from "@/lib/supabase";
import { demoOrg } from "@/lib/demo";
import { failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const o = configured()
      ? await (async () => {
          const { db, orgId } = await owner();
          const { data, error } = await db
            .from("organizations")
            .select("*")
            .eq("id", orgId)
            .single();
          if (error) throw error;
          return data;
        })()
      : demoOrg;
    const url = `${process.env.APP_URL || new URL(req.url).origin}/b/${o.slug}`;
    const format = new URL(req.url).searchParams.get("format") || "png";
    let bytes: Uint8Array | string;
    let type: string;
    if (format === "svg") {
      bytes = await QRCode.toString(url, {
        type: "svg",
        width: 1200,
        margin: 3,
      });
      type = "image/svg+xml";
    } else {
      const png = await QRCode.toBuffer(url, {
        width: 1600,
        margin: 3,
        color: { dark: o.brand_color, light: "#ffffff" },
      });
      if (format === "pdf") {
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        const image = await pdf.embedPng(png);
        const safe = (s: string) => s.replace(/[^\x20-\x7E]/g, "").slice(0, 75);
        for (let side = 0; side < 2; side++) {
          const page = pdf.addPage([420, 595]);
          page.drawText(safe(o.name), {
            x: 30,
            y: 540,
            size: 22,
            font: bold,
            color: rgb(0.16, 0.2, 0.4),
          });
          page.drawText(
            safe(
              o.branding_config?.counter_cta || "Share your honest experience",
            ),
            { x: 30, y: 495, size: 16, font },
          );
          page.drawImage(image, { x: 65, y: 170, width: 290, height: 290 });
          page.drawText(
            "Scan to leave a Google review. All experiences welcome.",
            { x: 30, y: 125, size: 12, font },
          );
          page.drawText(
            "Optional private feedback is available on the same page.",
            { x: 30, y: 100, size: 11, font },
          );
          page.drawText(
            side === 0
              ? "Counter card - print at actual size"
              : "Table tent reverse - fold and place at your counter",
            { x: 30, y: 35, size: 10, font },
          );
        }
        // Second page is an actual foldable table tent, with opposing panels.
        pdf.removePage(1);
        const tent = pdf.addPage([420, 842]);
        tent.drawLine({
          start: { x: 15, y: 421 },
          end: { x: 405, y: 421 },
          dashArray: [4, 4],
          color: rgb(0.65, 0.65, 0.65),
          thickness: 0.5,
        });
        tent.drawText("Fold on dotted line", { x: 155, y: 414, size: 8, font });
        for (const flip of [false, true]) {
          const rot = degrees(flip ? 180 : 0);
          const x = flip ? 390 : 30;
          const y = (v: number) => (flip ? 842 - v : v);
          tent.drawText(safe(o.name), {
            x,
            y: y(370),
            size: 19,
            font: bold,
            rotate: rot,
          });
          tent.drawText(
            safe(
              o.branding_config?.counter_cta || "Share your honest experience",
            ),
            { x, y: y(335), size: 13, font, rotate: rot },
          );
          tent.drawImage(image, {
            x: flip ? 320 : 100,
            y: flip ? 752 : 90,
            width: 220,
            height: 220,
            rotate: rot,
          });
          tent.drawText("All experiences welcome. Scan to review.", {
            x,
            y: y(55),
            size: 11,
            font,
            rotate: rot,
          });
        }
        bytes = await pdf.save();
        type = "application/pdf";
      } else if (format === "png") {
        bytes = png;
        type = "image/png";
      } else throw new Error("Choose png, svg or pdf");
    }
    return new Response(
      typeof bytes === "string" ? bytes : (new Uint8Array(bytes) as BodyInit),
      {
        headers: {
          "Content-Type": type,
          "Content-Disposition": `attachment; filename="${o.slug}-review-card.${format}"`,
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
