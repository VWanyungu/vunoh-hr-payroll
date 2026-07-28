import express from "express";
import v1Router from "../../../index.js";

// Mounts v1 router
export function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(v1Router);
  return app;
}
