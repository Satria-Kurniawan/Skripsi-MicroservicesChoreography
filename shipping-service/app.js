import express from "express";
import dotenv from "dotenv";
import router from "./routes/shippingRoutes.js";
import { createShipping } from "./controllers/shippingController.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 8005;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/shipping", router);

createShipping();

app.listen(port, () => console.log(`Shipping service running on port ${port}`));
