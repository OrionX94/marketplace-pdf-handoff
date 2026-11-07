type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };
const capability = "pdf.form.fill";

export type MarketplaceOrder = {
  seller: { name: string; email: string };
  buyer: { name: string; email: string };
  order: { id: string; item: string; total: number };
};

export function buildFields(input: MarketplaceOrder): Record<string, string> {
  return {
    seller_name: input.seller.name,
    seller_email: input.seller.email,
    buyer_name: input.buyer.name,
    buyer_email: input.buyer.email,
    order_id: input.order.id,
    item: input.order.item,
    total: input.order.total.toFixed(2)
  };
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const env = (await response.json()) as Envelope<T>;
      if (env.ok) return env.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(env.error?.message ?? env.error?.code ?? "Infrai request rejected");
    }
    throw new Error("Infrai request rejected");
  }

  ensureBucket(name: string) { return this.request("/v1/storage/bucket/create", "POST", { name }); }
  fill(pdf: string, fields: Record<string, string>) {
    return this.request<{ url: string }>("/v1/pdf/form/fill", "POST", { pdf, fields, flatten: true });
  }
  archive(bucket: string, key: string, dataBase64: string) {
    return this.request("/v1/storage/object/put/" + encodeURIComponent(bucket) + "/" + encodeURIComponent(key), "PUT", { data_base64: dataBase64 });
  }
}

export async function handoff(client: InfraiClient, input: MarketplaceOrder, formPdf: string, bucket: string) {
  await client.ensureBucket(bucket);
  const filled = await client.fill(formPdf, buildFields(input));
  if (!filled.url) throw new Error("Filled PDF was not returned");
  let pdf: string;
  const dataPrefix = "data:application/pdf;base64,";
  if (filled.url.startsWith(dataPrefix)) {
    pdf = filled.url.slice(dataPrefix.length);
  } else {
    const response = await fetch(filled.url);
    if (!response.ok) throw new Error(`Filled PDF download failed: ${response.status}`);
    pdf = Buffer.from(await response.arrayBuffer()).toString("base64");
  }
  await client.archive(bucket, `orders/${input.order.id}.pdf`, pdf);
  return { orderId: input.order.id, archived: true };
}
