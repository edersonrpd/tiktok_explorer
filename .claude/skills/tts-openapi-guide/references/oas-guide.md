# OAS Reference Guide

Use the split OAS files under `references/oas/` as the first source for TikTok Shop OpenAPI structure.

## Coverage

Snapshot **reduzido** do OAS distribuído em `@tts-open-toolkit/cli@0.1.7`
(ByteDance, MIT). Só os módulos que este projeto consulta foram mantidos.

- OpenAPI version: 3.0.0
- Path count: 90 (do total de 405 do snapshot original)
- Split index: `references/oas/index.json`
- Split files: `references/oas/paths/<first_level_path>.json`

| First-level path | File | Path count |
| --- | --- | ---: |
| product | `paths/product.json` | 72 |
| order | `paths/order.json` | 9 |
| finance | `paths/finance.json` | 9 |

Módulos **não** incluídos aqui (logistics, fulfillment, return_refund,
affiliate*, analytics, promotion, seller, authorization, e os demais do
snapshot original): trate como lacuna de cobertura e responda pelo docv2
oficial, conforme `## Source Priority`. Para reidratar o snapshot completo:

```bash
npx @tts-open-toolkit/cli skill add --target .claude/skills
```

## API Version Selection

Treat the version segment as part of operation selection. Do not default to the version you remember or the newest version visible in the bundled snapshot.

For this guide, the newest version is the numerically greatest six-digit `YYYYMM` value among official operations that implement the same requested capability and satisfy the request's constraints. A larger version under the same domain is not automatically a replacement: paths for different capabilities are not comparable.

Use this decision process:

1. Define the capability and preserve any exact method/path or version required by the user or a registered workflow.
2. Collect matching candidates from the relevant bundled OAS split file. Compare operation purpose and schema, not only path wording.
3. Search official Partner Center docv2 by API name, endpoint, and module to discover current candidates missing from bundled OAS.
4. Record each candidate's method, path, six-digit version, source, and relevant capability, region, authorization, rollout, lifecycle, or workflow constraints.
5. Remove candidates that do not implement the same capability or do not satisfy those constraints.
6. Select the highest version that remains. For multi-step workflows, repeat this decision per required capability without changing the required sequence.
7. If an explicit pin or documented constraint requires an older version, keep it and report `Older-version reason: <constraint>. Source: <official source>.`
8. If the sources conflict or a newer candidate cannot be verified, state the gap. Do not invent an operation, assume the bundled snapshot is current, or substitute a nearby operation.

Version selection does not authorize extra validation calls or changes to prerequisite steps, ordering, or repetitions. Those are separate workflow decisions.

## How To Read API Structure

1. Determine the first-level path from the endpoint. For `/product/202309/products`, the first-level path is `product`.
2. If the endpoint is not known, inspect `references/oas/index.json` and use `sample_paths`, `versions`, and `path_count` to choose the closest split file.
3. Open `references/oas/paths/<first_level_path>.json`.
4. Search within that split file by exact endpoint, API summary, or module/version tag.
5. Open the matched path object and choose the HTTP method.
6. Use `parameters[]` for path, query, and header fields. Check `required`, `schema.type`, `schema.format`, `description`, and `example`.
7. Use `requestBody.content["application/json"].schema` for body fields. Preserve nested `properties`, arrays, enum values, required fields, and descriptions.
8. Use `responses["200"].content["application/json"].schema` for response structure.
9. When the online page is useful, construct it with the docv2 page pattern below.
10. If a schema, lifecycle rule, current policy, page-specific guide, or code example is missing, fall back to `https://partner.tiktokshop.com/docv2`.

## Online Doc URL Pattern

Use this pattern to locate the Partner Center online page for a known API:

```text
https://partner.tiktokshop.com/docv2/page/{api}-{version}
```

- `{api}` is the API slug, usually the API name converted to lower-case kebab-case.
- `{version}` is the six-digit API version from the endpoint path.
- Example: `Search Creator Target Collaborations` with version `202405` maps to `https://partner.tiktokshop.com/docv2/page/search-creator-target-collaborations-202405`.
- If the generated URL does not resolve, fall back to searching `https://partner.tiktokshop.com/docv2` by API name, endpoint, or module.

## Source Priority

| Question type | First source | Fallback |
| --- | --- | --- |
| Endpoint path and method | Bundled OAS candidate baseline, then current Partner Center docv2 version check | Partner Center support |
| Headers, query params, body fields, response fields | Selected operation's official schema: bundled OAS when present, otherwise Partner Center docv2 | State the gap |
| Required flags, enum values, field descriptions | Selected operation's official schema: bundled OAS when present, otherwise Partner Center docv2 | State the gap |
| Current policy, deprecation, onboarding flow, UI screenshots | Partner Center docv2 | TTSPC support ticket |
| Missing or conflicting information | State the gap | Partner Center docv2 |

## Do Not Guess

- Do not invent request or response fields from memory.
- Do not answer exact schema questions from FAQ text if OAS is available.
- Do not select an older API merely because it is familiar or present in bundled OAS.
- Do not treat a newer but semantically different operation as a version upgrade.
- Do not paste a full split OAS file into the response.
- If no source resolves the issue, tell the developer to use Partner Center support or TTSPC `Contact Us` with the app key, API name, request/response payload, error code, timestamp, and shop/region context.
