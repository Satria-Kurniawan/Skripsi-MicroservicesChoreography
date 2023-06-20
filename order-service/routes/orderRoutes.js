import express from "express";
import {
  createOrder,
  test2Microservices,
  test3Microservices,
} from "../controllers/orderController.js";
import { withAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", withAuth, createOrder);

// router.get("/test/2-microservices", test2Microservices);
// router.get("/test/3-microservices", test3Microservices);

export default router;
