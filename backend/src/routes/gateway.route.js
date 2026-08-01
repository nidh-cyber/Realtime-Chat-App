import express from "express";
import crypto from "crypto";
import authRoutes from "./auth.route.js";
import messageRoutes from "./message.route.js";
import groupRoutes from "./group.route.js";
import { apiRateLimit } from "../middleware/rateLimit.middleware.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();
const PUBLIC_GATEWAY_PATHS = [
  "/health",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
];

router.use((req, res, next) => {
  req.apiGateway = {
    requestId: crypto.randomUUID(),
    path: req.originalUrl,
  };
  next();
});

router.use(apiRateLimit);

router.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "api-gateway",
    requestId: req.apiGateway?.requestId,
  });
});

router.use((req, res, next) => {
  const isPublicRoute = PUBLIC_GATEWAY_PATHS.some((path) => req.path === path || req.path.startsWith(path));
  if (isPublicRoute) return next();
  return protectRoute(req, res, next);
});

router.use("/auth", authRoutes);
router.use("/messages", messageRoutes);
router.use("/groups", groupRoutes);

router.use((req, res) => {
  res.status(404).json({ message: "API route not found" });
});

export default router;
