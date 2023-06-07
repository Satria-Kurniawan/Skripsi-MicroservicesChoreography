import express from "express";
import { createBilling } from "../controllers/billingController.js";
import { withAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", withAuth, createBilling);

export default router;
