import express from "express";
import { signIn, signUp } from "../controllers/userController.js";
import { withAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/sign-up", signUp);
router.post("/sign-in", signIn);

export default router;
