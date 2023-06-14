import express from "express";
import dotenv from "dotenv";
import router from "./routes/userRoutes.js";
import {
  validateUserInformation,
  test2Microservices,
  test3Microservices,
} from "./controllers/userController.js";

const app = express();
dotenv.config();
const port = process.env.PORT || 8001;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/user/", router);

validateUserInformation();

test2Microservices();
test3Microservices();

app.listen(port, "0.0.0.0", () =>
  console.log(`User service running on port ${port}`)
);
