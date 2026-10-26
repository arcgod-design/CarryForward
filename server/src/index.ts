import express from "express";
import path from "path";
import fs from "fs";
import { api } from "./routes";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use("/api", api);

const webDist = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`CarryForward running at http://localhost:${PORT}`);
});
