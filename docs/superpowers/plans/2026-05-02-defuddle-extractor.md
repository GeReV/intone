# Defuddle Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Defuddle as a second, user-selectable document parsing engine alongside Readability.

**Architecture:** Create `DefuddleExtractor` implementing the existing `Extractor` interface, widen the `extractor` settings type to include `"defuddle"`, add a factory in `index.ts` to pick the right extractor based on settings, and add the Defuddle option to the settings UI dropdown.

**Tech Stack:** TypeScript, Defuddle 0.18.1, Vitest, WebExtension APIs

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Install | `package.json` | Add `defuddle` dependency |
| Create | `src/extension/content/extractor/defuddle.ts` | DefuddleExtractor class |
| Create | `test/content/extractor/defuddle.test.ts` | Unit tests for DefuddleExtractor |
| Modify | `src/extension/content/settings.ts:6` | Widen `extractor` type to union |
| Modify | `src/extension/content/index.ts:55` | Factory to pick extractor by setting |
| Modify | `src/extension/content/ui.ts:229-236` | Add Defuddle option to `<select>` |

---

### Task 1: Install defuddle and write failing test

**Files:**
- Modify: `package.json`
- Create: `test/content/extractor/defuddle.test.ts`

- [ ] **Step 1: Install the defuddle package**

```bash
yarn add defuddle
```

Expected: `defuddle` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing test**

Create `test/content/extractor/defuddle.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { DefuddleExtractor } from "../../src/extension/content/extractor/defuddle";

function makeDoc(html: string): Document {
  return new JSDOM(html, { url: "https://example.com/" }).window.document;
}

describe("DefuddleExtractor", () => {
  it("extracts paragraphs from article content", () => {
    const doc = makeDoc(`
      <html>
        <head><title>My Article</title></head>
        <body>
          <article>
            <h1>My Article</h1>
            <p>First paragraph of content.</p>
            <p>Second paragraph of content.</p>
          </article>
        </body>
      </html>
    `);

    const extractor = new DefuddleExtractor();
    const result = extractor.extract(doc);

    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.paragraphs.some(p => p.includes("paragraph"))).toBe(true);
  });

  it("returns empty paragraphs when page has no article content", () => {
    const doc = makeDoc(`
      <html>
        <head><title>Empty</title></head>
        <body><div>Navigation only</div></body>
      </html>
    `);

    const extractor = new DefuddleExtractor();
    const result = extractor.extract(doc);

    expect(result.title).toBeDefined();
    expect(Array.isArray(result.paragraphs)).toBe(true);
  });

  it("does not mutate the original document", () => {
    const doc = makeDoc(`
      <html>
        <head><title>Test</title></head>
        <body><article><p>Content here.</p></article></body>
      </html>
    `);

    const originalParagraphCount = doc.querySelectorAll("p").length;
    const extractor = new DefuddleExtractor();
    extractor.extract(doc);

    expect(doc.querySelectorAll("p").length).toBe(originalParagraphCount);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
yarn test test/content/extractor/defuddle.test.ts
```

Expected: FAIL with "Cannot find module" or similar — `DefuddleExtractor` does not exist yet.

---

### Task 2: Implement DefuddleExtractor

**Files:**
- Create: `src/extension/content/extractor/defuddle.ts`

- [ ] **Step 1: Create the extractor**

Create `src/extension/content/extractor/defuddle.ts`:

```typescript
import { Defuddle } from 'defuddle'
import type { ExtractionResult, Extractor } from './types'

export class DefuddleExtractor implements Extractor {
  extract(document: Document): ExtractionResult {
    const clone = document.cloneNode(true) as Document
    const result = new Defuddle(clone, { url: document.location?.href }).parse()

    if (!result.content) {
      return { title: result.title ?? document.title, paragraphs: [] }
    }

    const parsed = new DOMParser().parseFromString(result.content, 'text/html')
    const paragraphs: string[] = []

    if (result.title) {
      paragraphs.push(result.title)
    }

    parsed.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li:not(:has(> p))').forEach(el => {
      const text = el.textContent?.trim() ?? ''
      if (text) paragraphs.push(text)
    })

    return { title: result.title ?? document.title, paragraphs }
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
yarn test test/content/extractor/defuddle.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock src/extension/content/extractor/defuddle.ts test/content/extractor/defuddle.test.ts
git commit -m "feat(extractor): add DefuddleExtractor"
```

---

### Task 3: Widen the settings type

**Files:**
- Modify: `src/extension/content/settings.ts`

- [ ] **Step 1: Update the Settings type**

In `src/extension/content/settings.ts`, change line 6 from:

```typescript
  extractor: "readability"
```

to:

```typescript
  extractor: "readability" | "defuddle"
```

The default on line 17 stays `"readability"` — no change needed there.

- [ ] **Step 2: Verify typecheck passes**

```bash
yarn typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/extension/content/settings.ts
git commit -m "feat(settings): add defuddle to extractor union type"
```

---

### Task 4: Wire up extractor factory in index.ts

**Files:**
- Modify: `src/extension/content/index.ts`

- [ ] **Step 1: Add DefuddleExtractor import**

At the top of `src/extension/content/index.ts`, after the existing `ReadabilityExtractor` import (line 4), add:

```typescript
import { DefuddleExtractor } from './extractor/defuddle'
```

- [ ] **Step 2: Replace hardcoded extractor with factory**

In `src/extension/content/index.ts`, replace lines 55-56:

```typescript
    const extractor = new ReadabilityExtractor()
    let result = extractor.extract(document)
```

with:

```typescript
    const extractor = settings.extractor === 'defuddle'
      ? new DefuddleExtractor()
      : new ReadabilityExtractor()
    let result = extractor.extract(document)
```

- [ ] **Step 3: Verify typecheck passes**

```bash
yarn typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/extension/content/index.ts
git commit -m "feat(content): select extractor based on settings"
```

---

### Task 5: Add Defuddle option to the settings UI

**Files:**
- Modify: `src/extension/content/ui.ts`

- [ ] **Step 1: Add the Defuddle option to the extractor select**

In `src/extension/content/ui.ts`, find the `selectExtractor` block (around line 229). It currently reads:

```typescript
    this.selectExtractor = document.createElement('select')
    const opt = document.createElement('option')
    opt.value = 'readability'
    opt.textContent = 'Readability (default)'
    this.selectExtractor.appendChild(opt)
    this.selectExtractor.addEventListener('change', () => {
      this.onSettingsChange?.({ extractor: this.selectExtractor.value as 'readability' })
    })
```

Replace it with:

```typescript
    this.selectExtractor = document.createElement('select')
    const optReadability = document.createElement('option')
    optReadability.value = 'readability'
    optReadability.textContent = 'Readability (default)'
    const optDefuddle = document.createElement('option')
    optDefuddle.value = 'defuddle'
    optDefuddle.textContent = 'Defuddle'
    this.selectExtractor.append(optReadability, optDefuddle)
    this.selectExtractor.addEventListener('change', () => {
      this.onSettingsChange?.({ extractor: this.selectExtractor.value as 'readability' | 'defuddle' })
    })
```

- [ ] **Step 2: Verify typecheck passes**

```bash
yarn typecheck
```

Expected: No errors.

- [ ] **Step 3: Run the full test suite**

```bash
yarn test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/extension/content/ui.ts
git commit -m "feat(ui): add Defuddle option to extractor dropdown"
```

---

### Task 6: Verify the build

- [ ] **Step 1: Run a production build**

```bash
yarn build
```

Expected: Build completes with no errors. Output in `extension/dist/`.

- [ ] **Step 2: Verify defuddle is bundled**

```bash
grep -r "defuddle" extension/dist/ --include="*.js" -l
```

Expected: At least one JS file in `extension/dist/` contains defuddle code.
