import express from "express";
import dotenv from "dotenv";
import router from "./routes/orderRoutes.js";
import {
  expiredOrder,
  updateOrderByBillingId,
} from "./controllers/orderController.js";

const app = express();
dotenv.config();
const port = process.env.PORT || 8003;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/order", router);

updateOrderByBillingId();
expiredOrder();

app.listen(port, "0.0.0.0", () =>
  console.log(`Order service running on port ${port}`)
);
