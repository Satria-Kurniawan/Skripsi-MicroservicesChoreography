import express from "express";
import { createOrder } from "../controllers/orderController.js";
import { withAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", withAuth, createOrder);

export default router;
