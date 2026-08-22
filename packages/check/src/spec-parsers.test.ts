import { describe, it, expect } from "vitest";
import {
  parseEndpoints,
  parseTypeDefinitions,
  parseTestCases,
  hasEndpointsSection,
  unreadableTypeBlocks,
  unattachedFieldLines,
} from "./spec-parsers.js";

describe("parseEndpoints", () => {
  it("extracts endpoints from Endpoints section", () => {
    const content = `## Endpoints

### GET /api/users
Returns a list of users.

### POST /api/users
Creates a new user.
- Body: \`{ name: string, email: string }\`

### GET /api/users/:id
Returns a single user by ID.

### DELETE /api/users/:id
Deletes a user.
`;
    const result = parseEndpoints(content);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      method: "GET",
      path: "/api/users",
      params: [],
      description: "Returns a list of users.",
    });
    expect(result[2]).toEqual({
      method: "GET",
      path: "/api/users/:id",
      params: ["id"],
      description: "Returns a single user by ID.",
    });
  });

  it("returns empty array when no Endpoints section", () => {
    const content = `## Overview\n\nSome content.`;
    expect(parseEndpoints(content)).toEqual([]);
  });

  // A populated section that parses to nothing is the dangerous case: routes
  // leave the coverage denominator, every real route reads as unspecified, and
  // a genuinely missing endpoint is never reported. Only the heading form was
  // ever covered, so the bulleted form shipped broken.
  it("extracts endpoints from a bulleted list, backticked", () => {
    const content = `## Endpoints

- \`GET /invoices\` — list invoices, optionally filtered by customer.
- \`POST /invoices\` — create an invoice.
- \`GET /invoices/:id\` — read a single invoice.
- \`DELETE /invoices/:id\` — remove an invoice.
`;
    const result = parseEndpoints(content);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      method: "GET",
      path: "/invoices",
      params: [],
      description: "list invoices, optionally filtered by customer.",
    });
    expect(result[2]).toEqual({
      method: "GET",
      path: "/invoices/:id",
      params: ["id"],
      description: "read a single invoice.",
    });
  });

  it("extracts endpoints from a bulleted list without backticks", () => {
    const content = `## Endpoints

- GET /invoices — list invoices.
- POST /invoices: create an invoice.
- **DELETE** /invoices/:id - remove an invoice.
`;
    const result = parseEndpoints(content);
    expect(result.map((e) => `${e.method} ${e.path}`)).toEqual([
      "GET /invoices",
      "POST /invoices",
      "DELETE /invoices/:id",
    ]);
    expect(result[1]?.description).toBe("create an invoice.");
  });

  it("does not double-count an endpoint given as both a heading and a bullet", () => {
    const content = `## Endpoints

### GET /invoices

List invoices.

Summary:

- \`GET /invoices\` — list invoices.
`;
    expect(parseEndpoints(content)).toHaveLength(1);
  });

  it("ignores prose bullets that are not endpoints", () => {
    const content = `## Endpoints

- All routes require a bearer token.
- Responses are JSON: every one of them.
- GET requests are cacheable for 60 seconds.
- \`GET /health\` — liveness probe.
`;
    const result = parseEndpoints(content);
    expect(result.map((e) => `${e.method} ${e.path}`)).toEqual(["GET /health"]);
  });

  it("stops at the next section rather than reading the whole document", () => {
    const content = `## Endpoints

- \`GET /invoices\` — list invoices.

## Error Codes

- \`404\` — no invoice with that id. GET /nowhere is not an endpoint.
`;
    expect(parseEndpoints(content)).toHaveLength(1);
  });
});

describe("hasEndpointsSection", () => {
  it("is true for a section that exists but yields no endpoints", () => {
    const content = `## Endpoints\n\nSee the OpenAPI document.\n`;
    expect(hasEndpointsSection(content)).toBe(true);
    expect(parseEndpoints(content)).toEqual([]);
  });

  it("is false when there is no such section", () => {
    expect(hasEndpointsSection("## Overview\n\nSome content.")).toBe(false);
  });
});

describe("parseTypeDefinitions", () => {
  it("extracts types from Data Model section", () => {
    const content = `## Data Model

### User
- \`id\`: string (UUID)
- \`name\`: string
- \`email\`: string
- \`role\`: "admin" | "user"
- \`createdAt\`: Date

### Post
- \`id\`: string
- \`title\`: string
- \`content\`: string
- \`authorId\`: string
- \`publishedAt?\`: Date
`;
    const result = parseTypeDefinitions(content);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("User");
    expect(result[0]!.fields).toHaveLength(5);
    expect(result[0]!.fields[0]).toEqual({ name: "id", type: "string", optional: false });
    expect(result[1]!.fields[4]).toEqual({ name: "publishedAt", type: "Date", optional: true });
  });

  it("returns empty array when no Data Model section", () => {
    expect(parseTypeDefinitions("## Architecture\n\nContent.")).toEqual([]);
  });
});

describe("parseTestCases", () => {
  it("extracts test cases from Test Cases section", () => {
    const content = `## Test Cases

### @specdx/core
- Config loader: finds config, handles missing config, validates structure
- Spec parser: parses markdown frontmatter, extracts H2 sections

### @specdx/lint
- Engine: loads rules, runs against specs, collects diagnostics
`;
    const result = parseTestCases(content);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0]!.description).toContain("Config loader");
  });

  it("returns empty array when no Test Cases section", () => {
    expect(parseTestCases("## Scope\n\nContent.")).toEqual([]);
  });
});

describe("parseTypeDefinitions — un-backticked fields (F8)", () => {
  it("reads fields written without backticks", () => {
    // The obvious markdown a person writes. Requiring backticks meant a fully
    // documented Data Model parsed to zero fields, so `check` excluded the
    // category from coverage silently and `update` told the author to add
    // fields that were already there.
    const content = `## Data Model

### User

- id: string
- email: string
- createdAt: Date
`;
    const [user] = parseTypeDefinitions(content);
    expect(user!.name).toBe("User");
    expect(user!.fields.map((f) => f.name)).toEqual(["id", "email", "createdAt"]);
    expect(user!.fields.map((f) => f.type)).toEqual(["string", "string", "Date"]);
  });

  it("still reads backticked fields, and mixes of both", () => {
    const content = `## Data Model

### Session

- \`token\`: string
- userId: string
- \`expiresAt?\`: Date
`;
    const [session] = parseTypeDefinitions(content);
    expect(session!.fields.map((f) => f.name)).toEqual(["token", "userId", "expiresAt"]);
    expect(session!.fields.find((f) => f.name === "expiresAt")!.optional).toBe(true);
  });

  it("marks un-backticked optional fields optional too", () => {
    const [t] = parseTypeDefinitions("## Data Model\n\n### T\n\n- nickname?: string\n");
    expect(t!.fields[0]).toMatchObject({ name: "nickname", type: "string", optional: true });
  });

  it("does not mistake prose bullets for fields", () => {
    // A colon in a sentence must not become a field, or every note in a Data
    // Model section turns into a phantom type to reconcile against code.
    const content = `## Data Model

### User

- id: string
- Note: this table is partitioned by tenant and replicated to the read region
`;
    const [user] = parseTypeDefinitions(content);
    expect(user!.fields.map((f) => f.name)).toEqual(["id"]);
  });
});

describe("parseTypeDefinitions — prose sub-headings are not types", () => {
  // The sibling of the prose-bullet case above: the bullets were handled, the
  // heading above them was not. `### Notes on the model` registered a type
  // called "Notes", which `check` then reported as an error telling the author
  // to implement it -- turning a clean spec into a failing CI gate.
  it("ignores a multi-word explanatory heading", () => {
    const content = `## Data Model

### Event

- id: string
- title: string

### Notes on the model

- Every event belongs to exactly one organiser account.
- Capacity is a hard limit, not a soft target.
`;
    const result = parseTypeDefinitions(content);
    expect(result.map((t) => t.name)).toEqual(["Event"]);
  });

  it("ignores a single-word heading that declares no fields", () => {
    const content = `## Data Model

### Event

- id: string

### Indexes

We index on startsAt and on the organiser id.
`;
    const result = parseTypeDefinitions(content);
    expect(result.map((t) => t.name)).toEqual(["Event"]);
  });

  it("still reads a backticked type heading", () => {
    const content = "## Data Model\n\n### `Event`\n\n- id: string\n";
    expect(parseTypeDefinitions(content).map((t) => t.name)).toEqual(["Event"]);
  });

  it("still reads a generic type heading", () => {
    const content = "## Data Model\n\n### Page<Event>\n\n- items: Event[]\n";
    expect(parseTypeDefinitions(content).map((t) => t.name)).toEqual(["Page<Event>"]);
  });
});

describe("parseTypeDefinitions — table form", () => {
  // The note for an unreadable Data Model fires per spec, so one readable type
  // silenced every unreadable one beside it. A table-shaped type left the
  // denominator entirely and the percentage did not move.
  const withTable = `## Data Model

### Payment

| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| orderId | string | FK to Order |
| amountCents | number | minor units |
| refundedAt? | string | null until refunded |

### Indexes

Payments are indexed on \`orderId\`.
`;

  it("reads fields declared as a markdown table", () => {
    const types = parseTypeDefinitions(withTable);
    expect(types).toHaveLength(1);
    expect(types[0]!.name).toBe("Payment");
    expect(types[0]!.fields.map((f) => f.name)).toEqual([
      "id",
      "orderId",
      "amountCents",
      "refundedAt",
    ]);
    expect(types[0]!.fields.find((f) => f.name === "refundedAt")?.optional).toBe(true);
  });

  it("leaves a table that is not about fields alone", () => {
    const notFields = `## Data Model

### Order

| Environment | Region |
|---|---|
| production | eu-west-1 |
`;
    expect(parseTypeDefinitions(notFields)).toEqual([]);
  });

  it("still ignores a prose sub-heading with no declarations", () => {
    expect(parseTypeDefinitions(withTable).map((t) => t.name)).not.toContain("Indexes");
  });
});

describe("unreadableTypeBlocks", () => {
  it("names a type whose table cannot be read as fields", () => {
    const content = `## Data Model

### Invoice

- \`id\`: string

### Payment

| Column | Kind |
|---|---|
| id | string |
`;
    expect(unreadableTypeBlocks(content)).toEqual(["Payment"]);
  });

  it("says nothing about a prose sub-heading", () => {
    const content = `## Data Model

### Invoice

- \`id\`: string

### Indexes

Invoices are indexed on \`customerId\`.
`;
    expect(unreadableTypeBlocks(content)).toEqual([]);
  });

  it("says nothing when every table parses", () => {
    const content = `## Data Model

### Payment

| Field | Type |
|---|---|
| id | string |
`;
    expect(unreadableTypeBlocks(content)).toEqual([]);
  });
});

describe("parseTestCases — case IDs", () => {
  // The ID belongs to the spec, not to the test a user is asked to write. It
  // used to reach the suggestion verbatim: `Add a test matching: "**TC5**: …"`.
  it("lifts a bold case ID out of the description", () => {
    const cases = parseTestCases(
      "## Test Cases\n\n- **TC5**: refuses to amend an invoice that is already paid\n",
    );
    expect(cases).toHaveLength(1);
    expect(cases[0]!.id).toBe("TC5");
    expect(cases[0]!.description).toBe("refuses to amend an invoice that is already paid");
  });

  it("lifts a plain case ID too", () => {
    const cases = parseTestCases("## Test Cases\n\n- TC1: returns an empty list\n");
    expect(cases[0]!.id).toBe("TC1");
    expect(cases[0]!.description).toBe("returns an empty list");
  });

  it("leaves an ordinary labelled bullet as it was", () => {
    const cases = parseTestCases("## Test Cases\n\n- Auth: login, logout\n");
    expect(cases.map((c) => c.description)).toEqual(["Auth: login", "Auth: logout"]);
    expect(cases[0]!.id).toBeUndefined();
  });
});

describe("parseTypeDefinitions — a description after the type (issue #51)", () => {
  // `- GET /path — description` has always parsed. The same em-dash after a
  // field's type dropped the field, so a Data Model written in the house style
  // reported "no fields recognised" and the type half of `check` sat inert.
  it("reads a field whose type is followed by an em-dash description", () => {
    const content = `## Data Model

### TagEntry

- tag: string — the raw frontmatter token, kebab-case, also the URL segment
- label: string — display form
- posts: Post[] — published posts carrying the tag, newest first
`;
    const [entry] = parseTypeDefinitions(content);
    expect(entry!.name).toBe("TagEntry");
    expect(entry!.fields).toEqual([
      { name: "tag", type: "string", optional: false },
      { name: "label", type: "string", optional: false },
      { name: "posts", type: "Post[]", optional: false },
    ]);
  });

  it("reads en-dash and hyphen descriptions too", () => {
    const content = `## Data Model

### Budget

- key: string – the quantity's name
- bytes: number - the ceiling
`;
    const [budget] = parseTypeDefinitions(content);
    expect(budget!.fields.map((f) => f.type)).toEqual(["string", "number"]);
  });

  it("still reads a trailing parenthetical note", () => {
    const [t] = parseTypeDefinitions("## Data Model\n\n### T\n\n- id: string (UUID)\n");
    expect(t!.fields[0]).toEqual({ name: "id", type: "string", optional: false });
  });

  it("strips a description from a backticked field too", () => {
    const content = "## Data Model\n\n### T\n\n- `id`: string — the primary key\n";
    const [t] = parseTypeDefinitions(content);
    expect(t!.fields[0]).toEqual({ name: "id", type: "string", optional: false });
  });

  it("keeps a hyphen that is part of the type", () => {
    const [t] = parseTypeDefinitions('## Data Model\n\n### T\n\n- slug: "kebab-case"\n');
    expect(t!.fields[0]!.type).toBe('"kebab-case"');
  });
});

describe("parseTypeDefinitions — type shapes that are not bare identifiers (issue #51)", () => {
  it("reads a quoted string-literal union", () => {
    const [t] = parseTypeDefinitions('## Data Model\n\n### T\n\n- theme: "light" | "dark"\n');
    expect(t!.fields[0]).toEqual({ name: "theme", type: '"light" | "dark"', optional: false });
  });

  it("reads a generic with more than one parameter", () => {
    const [t] = parseTypeDefinitions(
      "## Data Model\n\n### T\n\n- counts: Record<string, number>\n- pairs: Map<string, Set<number>>\n",
    );
    expect(t!.fields.map((f) => f.type)).toEqual([
      "Record<string, number>",
      "Map<string, Set<number>>",
    ]);
  });

  it("reads an object literal and a function type", () => {
    const [t] = parseTypeDefinitions(
      "## Data Model\n\n### T\n\n- meta: { id: string }\n- onDone: () => void\n",
    );
    expect(t!.fields.map((f) => f.name)).toEqual(["meta", "onDone"]);
  });

  it("still refuses a sentence", () => {
    const content = `## Data Model

### User

- id: string
- Note: this table is partitioned by tenant and replicated to the read region
- Retention: rows older than 90 days are dropped, in a nightly job
`;
    const [user] = parseTypeDefinitions(content);
    expect(user!.fields.map((f) => f.name)).toEqual(["id"]);
  });

  it("reads a description after a table's type column", () => {
    const content = `## Data Model

### Payment

| Field | Type | Notes |
|---|---|---|
| id | string — UUID | primary key |
`;
    const [payment] = parseTypeDefinitions(content);
    expect(payment!.fields[0]).toEqual({ name: "id", type: "string", optional: false });
  });
});

describe("unattachedFieldLines (issues #38, #51)", () => {
  it("says nothing about a Data Model written as prose", () => {
    // The whole point of #38: prose is not a failed field list, and warning
    // about it every run trains people to ignore the warnings that matter.
    const content = `## Data Model

Logs are written to an object key of \`\${date}/\${host}.ndjson\`. Duplicates are
tolerated: the drain is at-least-once, and the reader de-duplicates by request id.

- Segmentation: one object per host per day, never per request.
- Retention: 30 days, enforced by a lifecycle rule rather than by the drain.
`;
    expect(unattachedFieldLines(content)).toEqual([]);
  });

  it("names field lines that no `### TypeName` heading claims", () => {
    const content = `## Data Model

- id: string
- email: string
`;
    expect(unattachedFieldLines(content)).toEqual(["- id: string", "- email: string"]);
  });

  it("names field lines under a prose heading", () => {
    const content = `## Data Model

### The user record

- id: string
`;
    expect(unattachedFieldLines(content)).toEqual(["- id: string"]);
  });

  it("says nothing when every field line sits under a type heading", () => {
    const content = "## Data Model\n\n### User\n\n- id: string\n";
    expect(unattachedFieldLines(content)).toEqual([]);
  });
});
