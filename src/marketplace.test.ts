import assert from "node:assert/strict";
import { buildFields } from "./marketplace.ts";

const fields = buildFields({ seller: { name: "Ada", email: "seller@example.com" }, buyer: { name: "Lin", email: "buyer@example.com" }, order: { id: "ord-7", item: "Desk lamp", total: 19.5 } });
assert.equal(fields.total, "19.50");
assert.equal(fields.order_id, "ord-7");
console.log("form fields: order total and id are formatted for the PDF");

const { InfraiClient, handoff } = await import("./marketplace.ts");
const originalFetch = globalThis.fetch;
const pdfBase64 = Buffer.from("%PDF-1.4\nfixture").toString("base64");
try {
  for (const url of [`data:application/pdf;base64,${pdfBase64}`, "https://example.com/filled.pdf"]) {
    let archived = false;
    globalThis.fetch = async (input, init) => {
      const path = String(input);
      if (path === "https://example.com/filled.pdf") return new Response(Buffer.from(pdfBase64, "base64"));
      if (path.endsWith("/pdf/form/fill")) {
        assert.deepEqual(JSON.parse(init!.body as string), { pdf: "input-pdf", fields, flatten: true });
        return Response.json({ ok: true, data: { pdf_id: "pdf_test", url, size_bytes: 16, page_count: 1, sha256: "0".repeat(64), created_at: new Date().toISOString(), source: "form" } });
      }
      if (path.includes("/storage/object/put/")) {
        assert.deepEqual(JSON.parse(init!.body as string), { data_base64: pdfBase64 });
        archived = true;
      }
      return Response.json({ ok: true, data: {} });
    };
    assert.deepEqual(await handoff(new InfraiClient("test"), { seller: { name: "Ada", email: "seller@example.com" }, buyer: { name: "Lin", email: "buyer@example.com" }, order: { id: "ord-7", item: "Desk lamp", total: 19.5 } }, "input-pdf", "test"), { orderId: "ord-7", archived: true });
    assert.equal(archived, true);
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log("handoff: PdfDocument inline and download URLs are archived");
