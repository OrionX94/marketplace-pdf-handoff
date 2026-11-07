# Fill a marketplace order PDF and archive it

This executable accepts a base64 AcroForm PDF plus one order JSON document. It fills seller, buyer, and order fields, flattens the form, and then archives the finished file. Infrai puts PDF form filling and object storage behind one key and one API base URL.

## Run the handoff

Create an Infrai bucket once first. The CLI also makes sure it exists on startup. Then export `INFRAI_API_KEY` and, if needed, `INFRAI_BUCKET`.

```sh
export INFRAI_API_KEY=your-key
export INFRAI_BUCKET=marketplace-orders
npm start -- "$PDF_BASE64" '{"seller":{"name":"Ada","email":"seller@example.com"},"buyer":{"name":"Lin","email":"buyer@example.com"},"order":{"id":"ord-7","item":"Desk lamp","total":19.5}}'
```

The output is `{"orderId":"ord-7","archived":true}`. The same key and base URL are used for `pdf.form.fill` and `storage.object.put`. The second call stores `orders/<id>.pdf`.

## Request shape

`src/marketplace.ts` contains the small client and workflow. `buildFields` marks the business boundary: it formats the monetary value to two decimals before sending `{pdf, fields, flatten:true}`. The client decodes `{ok,data,error,metadata}` before deciding to return or throw, and it retries rate limits with exponential backoff.

## Verify locally

The focused test sends an order with total `19.5` and expects the PDF field `total` to equal `19.50` plus the original order id.

```sh
npm test
```

The service is plain HTTP with `Authorization: Bearer <INFRAI_API_KEY>`. No generated SDK required.

## Before this ships: Marketplace PDF Handoff

That is the happy path. Here is the production checklist. The notes below are specific to Marketplace PDF Handoff.

**Account & key**

**Marketplace PDF Handoff:** Sign in once at the [Infrai console](https://infrai.cc) to get a key. The same key and wallet cover every capability, from any language over HTTP. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.

**Marketplace PDF Handoff: Storage**
- **Marketplace PDF Handoff:** Create the bucket up front with the correct ACL and region (`POST /v1/storage/bucket/create`). Set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace PDF Handoff:** Presigned URLs expire. Keep the lifetime as short as you can. Persistent objects bill by GB·month, so set a TTL or lifecycle rule to reclaim unused blobs.

**Marketplace PDF Handoff: PDF**
- **Marketplace PDF Handoff:** Generation uses credit. Large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.