import express from "express";
import routes from "./routes";

const app = express();
const PORT = process.env.PORT || 4001;
app.use(express.json());

app.use("/storage", routes);

app.listen(PORT, () => {
  console.log(`Storage Node running on ${PORT}`);
});
