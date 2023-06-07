import express from "express";
import dotenv from "dotenv";
import router from "./routes/orderRoutes.js";

const app = express();
dotenv.config();
const port = process.env.PORT || 8003;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/order", router);

app.listen(port, () => console.log(`Listening on port ${port}`));
