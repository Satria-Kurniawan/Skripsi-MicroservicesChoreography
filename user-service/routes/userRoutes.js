import express from "express";
import { getMe, signIn, signUp } from "../controllers/userController.js";
import { withAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/sign-up", signUp);
router.post("/sign-in", signIn);
router.get("/me", withAuth, getMe);

export default router;
