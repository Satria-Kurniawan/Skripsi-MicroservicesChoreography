import express from "express";
import { withAuth } from "../../billing-service/middlewares/authMiddleware.js";
import {
  confirmPayment,
  cancelTransactions,
  saveTemporaryTransaction,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/confirm", withAuth, confirmPayment);
router.post("/save-temporary", withAuth, saveTemporaryTransaction);
router.get("/cancel-transactions", cancelTransactions);

export default router;
