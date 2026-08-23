import { describe, it, expect } from "vitest";
import { matchTypes } from "./types.js";
import type { SpecTypeDefinition, ExtractedType } from "../types.js";

describe("matchTypes", () => {
  const specTypes: SpecTypeDefinition[] = [
    {
      name: "User",
      fields: [
        { name: "id", type: "string", optional: false },
        { name: "name", type: "string", optional: false },
        { name: "email", type: "string", optional: false },
        { name: "role", type: '"admin" | "user"', optional: false },
        { name: "createdAt", type: "Date", optional: false },
      ],
    },
    {
      name: "Post",
      fields: [
        { name: "id", type: "string", optional: false },
        { name: "title", type: "string", optional: false },
        { name: "content", type: "string", optional: false },
        { name: "publishedAt", type: "Date", optional: true },
      ],
    },
  ];

  it("finds missing types (in spec but not code)", () => {
    const codeTypes: ExtractedType[] = [
      {
        name: "User",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "name", type: "string", optional: false },
          { name: "email", type: "string", optional: false },
          { name: "role", type: "string", optional: false },
          { name: "createdAt", type: "Date", optional: false },
        ],
        file: "types.ts",
        line: 1,
      },
    ];
    const findings = matchTypes(specTypes, codeTypes, "tech-design");
    const missing = findings.filter((f) => f.type === "missing" && f.expected.includes("Post"));
    expect(missing).toHaveLength(1);
    // Audit run 4, N2: the score's types denominator counts fields, so the
    // one finding for a wholly-missing type carries its field count as
    // weight — otherwise a 4-field type absent from code subtracts 1/4.
    expect(missing[0]?.weight).toBe(4);
  });

  it("finds missing fields", () => {
    const codeTypes: ExtractedType[] = [
      {
        name: "User",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "name", type: "string", optional: false },
        ],
        file: "types.ts",
        line: 1,
      },
      {
        name: "Post",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "title", type: "string", optional: false },
          { name: "content", type: "string", optional: false },
          { name: "publishedAt", type: "Date", optional: true },
        ],
        file: "types.ts",
        line: 10,
      },
    ];
    const findings = matchTypes(specTypes, codeTypes, "tech-design");
    const missingFields = findings.filter(
      (f) => f.type === "missing" && f.category === "type" && f.expected.includes("email"),
    );
    expect(missingFields.length).toBeGreaterThanOrEqual(1);
  });

  it("matches types with suffix differences (UserSchema → User)", () => {
    const codeTypes: ExtractedType[] = [
      {
        name: "UserSchema",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "name", type: "string", optional: false },
          { name: "email", type: "string", optional: false },
          { name: "role", type: "string", optional: false },
          { name: "createdAt", type: "Date", optional: false },
        ],
        file: "schemas.ts",
        line: 1,
      },
      {
        name: "PostModel",
        fields: [
          { name: "id", type: "string", optional: false },
          { name: "title", type: "string", optional: false },
          { name: "content", type: "string", optional: false },
          { name: "publishedAt", type: "Date", optional: true },
        ],
        file: "models.ts",
        line: 1,
      },
    ];
    const findings = matchTypes(specTypes, codeTypes, "tech-design");
    // Should NOT report User or Post as missing since UserSchema and PostModel match
    const missingTypes = findings.filter(
      (f) => f.type === "missing" && (f.expected === "Type: User" || f.expected === "Type: Post"),
    );
    expect(missingTypes).toHaveLength(0);
  });

  it("returns empty findings when everything matches", () => {
    const codeTypes: ExtractedType[] = specTypes.map((t) => ({
      ...t,
      file: "types.ts",
      line: 1,
    }));
    const findings = matchTypes(specTypes, codeTypes, "tech-design");
    expect(findings).toHaveLength(0);
  });
});

describe("matchTypes — the spec's status decides whether an absent type is a defect (issue #52)", () => {
  const specTypes = [
    { name: "Budget", fields: [{ name: "key", type: "string", optional: false }] },
  ];

  it("reports a not-yet-approved spec's absent type as planned", () => {
    const [finding] = matchTypes(specTypes, [], "td-001", { status: "draft" });
    expect(finding).toMatchObject({
      type: "pending",
      severity: "info",
      expected: "Type: Budget",
      weight: 1,
    });
    expect(finding!.suggestion).toBe(
      "planned by td-001 (status: draft) — not yet implemented; enforced once the spec is approved.",
    );
  });

  it("reports an approved spec's absent type as missing", () => {
    const [finding] = matchTypes(specTypes, [], "td-001", { status: "approved" });
    expect(finding).toMatchObject({ type: "missing", severity: "error" });
  });

  it("enforces when the caller says nothing about status", () => {
    // A caller that cannot state the status gets the strict reading, never a
    // silent downgrade of every finding to info.
    const [finding] = matchTypes(specTypes, [], "td-001");
    expect(finding).toMatchObject({ type: "missing", severity: "error" });
  });
});
