import express from "express";
import path from "path";
import fs from "fs";
import { api } from "./routes";

export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", api);

  const webDistCandidates = [
    path.join(__dirname, "..", "..", "..", "web", "dist"),
    path.join(__dirname, "..", "..", "web", "dist"),
  ];
  const webDist = webDistCandidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (webDist) {
    app.use(express.static(webDist));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
      res.sendFile(path.join(webDist, "index.html"));
    });
  }
  return app;
}

const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
  const PORT = Number(process.env.PORT || 8787);
  buildApp().listen(PORT, () => {
    console.log(`CarryForward running at http://localhost:${PORT}`);
  });
}
