import express from "express";
import dotenv from "dotenv";
import router from "./routes/billingRoutes.js";
import {
  createBilling,
  expiredBilling,
  test3Microservices,
  updateBilling,
} from "./controllers/billingController.js";

const app = express();
dotenv.config();
const port = process.env.PORT || 8004;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/billing", router);

createBilling();
updateBilling();
expiredBilling();

test3Microservices();

app.listen(port, () => console.log(`Billing service running on port ${port}`));
