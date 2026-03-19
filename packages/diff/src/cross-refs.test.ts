import { parseSpecFromString } from "@specdx/core";
import { checkCrossReferences } from "./cross-refs.js";
import type { ParsedSpec } from "@specdx/core";

describe("checkCrossReferences", () => {
  it("returns empty array when no references are broken", async () => {
    const prd = await parseSpecFromString(
      `---
id: prd
type: prd
title: "PRD"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement
Test.
## Goals
Test.
`,
      "specs/prd.md",
    );

    const tech = await parseSpecFromString(
      `---
id: technical
type: technical-design
title: "Tech"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
references:
  - id: prd
    relationship: depends-on
---

## Overview
Test.
`,
      "specs/tech.md",
    );

    const allSpecs: ParsedSpec[] = [prd, tech];
    const removedIds: string[] = [];
    const result = checkCrossReferences(allSpecs, removedIds);
    expect(result).toHaveLength(0);
  });

  it("flags broken reference when referenced spec is removed", async () => {
    const tech = await parseSpecFromString(
      `---
id: technical
type: technical-design
title: "Tech"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
references:
  - id: prd
    relationship: depends-on
---

## Overview
Test.
`,
      "specs/tech.md",
    );

    const allSpecs: ParsedSpec[] = [tech];
    const removedIds = ["prd"];
    const result = checkCrossReferences(allSpecs, removedIds);
    expect(result.length).toBeGreaterThan(0);
    const broken = result[0]!;
    expect(broken.specId).toBe("technical");
    expect(broken.field).toBe("references");
    expect(broken.type).toBe("broken-reference");
  });

  it("flags broken reference when referenced spec ID not found in suite", async () => {
    const tech = await parseSpecFromString(
      `---
id: technical
type: technical-design
title: "Tech"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
references:
  - id: nonexistent
    relationship: depends-on
---

## Overview
Test.
`,
      "specs/tech.md",
    );

    const allSpecs: ParsedSpec[] = [tech];
    const removedIds: string[] = [];
    const result = checkCrossReferences(allSpecs, removedIds);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.type).toBe("broken-reference");
  });

  it("returns empty when spec has no references", async () => {
    const prd = await parseSpecFromString(
      `---
id: prd
type: prd
title: "PRD"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement
Test.
## Goals
Test.
`,
      "specs/prd.md",
    );

    const result = checkCrossReferences([prd], []);
    expect(result).toHaveLength(0);
  });
});
