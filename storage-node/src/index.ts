import express from "express";
import routes from "./routes";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4001;
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/storage", routes);

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.listen(PORT, () => {
  console.log(`Storage Node running on ${PORT}`);
});
