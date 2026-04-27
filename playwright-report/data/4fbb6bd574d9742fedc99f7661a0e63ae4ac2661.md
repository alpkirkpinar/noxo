# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: maintenance-certificate-layout.spec.ts >> maintenance certificate layout >> 5 machines fit on one page and footer stays anchored
- Location: tests\maintenance-certificate-layout.spec.ts:52:7

# Error details

```
Error: Could not find text "Sertifika No" in PDF output

expect(received).toBeTruthy()

Received: undefined
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { PDFDocument } from "pdf-lib";
  3  | 
  4  | type MachineListResponse = {
  5  |   machines?: Array<{ id: string }>;
  6  | };
  7  | 
  8  | async function fetchCertificate(request: Parameters<typeof test>[0]["request"], ids: string[]) {
  9  |   const response = await request.get(`/api/machines/maintenance-certificate?ids=${ids.join(",")}`);
  10 |   expect(response.ok()).toBeTruthy();
  11 |   return Buffer.from(await response.body());
  12 | }
  13 | 
  14 | async function extractTextPositions(pdfBytes: Buffer, pageNumber: number) {
  15 |   const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  16 |   const pdf = await getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true }).promise;
  17 |   const page = await pdf.getPage(pageNumber);
  18 |   const textContent = await page.getTextContent();
  19 | 
  20 |   return textContent.items
  21 |     .filter((item): item is { str: string; transform: number[] } => "str" in item && "transform" in item)
  22 |     .map((item) => ({
  23 |       text: item.str,
  24 |       y: item.transform[5],
  25 |     }));
  26 | }
  27 | 
  28 | function groupLines(items: Array<{ text: string; y: number }>) {
  29 |   const lines = new Map<number, string[]>();
  30 | 
  31 |   for (const item of items) {
  32 |     const yKey = Math.round(item.y);
  33 |     const bucket = lines.get(yKey) ?? [];
  34 |     bucket.push(item.text);
  35 |     lines.set(yKey, bucket);
  36 |   }
  37 | 
  38 |   return Array.from(lines.entries()).map(([y, parts]) => ({
  39 |     y,
  40 |     text: parts.join(" ").replace(/\s+/g, " ").trim(),
  41 |   }));
  42 | }
  43 | 
  44 | function findY(items: Array<{ text: string; y: number }>, needle: string) {
  45 |   const lines = groupLines(items);
  46 |   const match = lines.find((line) => line.text.includes(needle));
> 47 |   expect(match, `Could not find text "${needle}" in PDF output`).toBeTruthy();
     |                                                                  ^ Error: Could not find text "Sertifika No" in PDF output
  48 |   return match!.y;
  49 | }
  50 | 
  51 | test.describe("maintenance certificate layout", () => {
  52 |   test("5 machines fit on one page and footer stays anchored", async ({ request }) => {
  53 |     const machinesResponse = await request.get("/api/machines");
  54 |     expect(machinesResponse.ok()).toBeTruthy();
  55 | 
  56 |     const payload = (await machinesResponse.json()) as MachineListResponse;
  57 |     const machineIds = (payload.machines ?? []).map((machine) => machine.id).filter(Boolean);
  58 | 
  59 |     test.skip(machineIds.length < 5, "Need at least 5 machines to validate single-certificate layout.");
  60 | 
  61 |     const oneMachinePdf = await fetchCertificate(request, [machineIds[0]]);
  62 |     const fiveMachinesPdf = await fetchCertificate(request, machineIds.slice(0, 5));
  63 | 
  64 |     const oneMachineDoc = await PDFDocument.load(oneMachinePdf);
  65 |     const fiveMachinesDoc = await PDFDocument.load(fiveMachinesPdf);
  66 | 
  67 |     expect(oneMachineDoc.getPageCount()).toBe(1);
  68 |     expect(fiveMachinesDoc.getPageCount()).toBe(1);
  69 | 
  70 |     const oneMachineText = await extractTextPositions(oneMachinePdf, 1);
  71 |     const fiveMachinesText = await extractTextPositions(fiveMachinesPdf, 1);
  72 | 
  73 |     const oneMachineFooterY = findY(oneMachineText, "Sertifika No");
  74 |     const fiveMachinesFooterY = findY(fiveMachinesText, "Sertifika No");
  75 |     const oneMachineValidityY = findY(oneMachineText, "Bu belge");
  76 |     const fiveMachinesValidityY = findY(fiveMachinesText, "Bu belge");
  77 | 
  78 |     expect(Math.abs(oneMachineFooterY - fiveMachinesFooterY)).toBeLessThan(8);
  79 |     expect(Math.abs(oneMachineValidityY - fiveMachinesValidityY)).toBeLessThan(8);
  80 |   });
  81 | });
  82 | 
```