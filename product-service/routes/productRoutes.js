import express from "express";
import {
  addProduct,
  getAllProducts,
  getProductById,
} from "../controllers/productController.js";
import { productValidation } from "../middlewares/validator.js";
import { withAuth } from "../../billing-service/middlewares/authMiddleware.js";

const router = express.Router();

router.post("/add", [productValidation, withAuth], addProduct);
router.get("/all", getAllProducts);
router.get("/id/:productId", getProductById);

export default router;
