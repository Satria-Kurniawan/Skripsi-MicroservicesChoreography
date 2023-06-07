import express from "express";
import dotenv from "dotenv";
import router from "./routes/productRoutes.js";
import { validateOrderProduct } from "./controllers/productController.js";

const app = express();
dotenv.config();
const port = process.env.PORT || 8002;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/product", router);

validateOrderProduct();

app.listen(port, () => console.log(`Listening on port ${port}`));
