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
