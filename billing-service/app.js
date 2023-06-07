import express from "express";
import dotenv from "dotenv";
import router from "./routes/billingRoutes.js";
import { createBilling } from "./controllers/billingController.js";

const app = express();
dotenv.config();
const port = process.env.PORT || 8004;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/billing", router);

createBilling();

app.listen(port, () => console.log(`Listening on port ${port}`));
