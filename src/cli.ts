import { InfraiClient, handoff, type MarketplaceOrder } from "./marketplace.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the handoff");
const [pdf, json] = process.argv.slice(2);
if (!pdf || !json) throw new Error("Usage: npm start -- <pdf-base64> '<order-json>'");
const order = JSON.parse(json) as MarketplaceOrder;
const result = await handoff(new InfraiClient(key), order, pdf, process.env.INFRAI_BUCKET ?? "marketplace-orders");
console.log(JSON.stringify(result));
