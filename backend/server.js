const path = require("node:path");
const express = require("express");
const { initializeDatabase } = require("./db/database");
const eventRoutes = require("./routes/eventRoutes");
const registrationRoutes = require("./routes/registrationRoutes");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "20kb" }));
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use(express.static(path.join(__dirname, "../public")));
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Something went wrong. Please try again." });
});

initializeDatabase().then(() => {
  app.listen(port, () => console.log(`College events app listening on http://localhost:${port}`));
}).catch((error) => {
  console.error("Could not initialize the database:", error);
  process.exitCode = 1;
});