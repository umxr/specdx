import { Hono } from "hono";

const app = new Hono();
const users = new Hono();

users.get("/", (c) => c.json([]));
users.post("/", (c) => c.json({}, 201));
users.get("/:id", (c) => c.json({ id: c.req.param("id") }));
users.delete("/:id", (c) => c.body(null, 204));

app.route("/api/users", users);

export default app;
