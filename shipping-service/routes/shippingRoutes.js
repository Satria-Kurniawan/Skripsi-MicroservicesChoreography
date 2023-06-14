import express from "express";
import { createShipping } from "../controllers/shippingController.js";
import { withAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", createShipping);

export default router;
