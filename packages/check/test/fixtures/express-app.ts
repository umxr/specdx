import express from "express";

const app = express();
const router = express.Router();

router.get("/users", (_req, res) => {
  res.json([]);
});

router.post("/users", (_req, res) => {
  res.status(201).json({});
});

router.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

router.delete("/users/:id", (req, res) => {
  res.status(204).send();
});

router.put("/users/:id/profile", (req, res) => {
  res.json({});
});

app.use("/api", router);

export default app;
