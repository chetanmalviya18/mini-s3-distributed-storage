import express from "express";
import { getLogs } from "../utils/logger";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(getLogs());
});

export default router;
