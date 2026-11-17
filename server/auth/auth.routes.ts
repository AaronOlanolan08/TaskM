import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  loginController,
  logoutController,
  meController,
  registerController,
  refreshController,
} from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again later." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many session requests. Try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many account creation attempts. Try again later." },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, loginController);
authRouter.post("/register", registerLimiter, registerController);
authRouter.post("/refresh", refreshLimiter, refreshController);
authRouter.post("/logout", logoutController);
authRouter.get("/me", requireAuth, meController);
