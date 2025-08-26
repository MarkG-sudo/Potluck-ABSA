
import { Router } from "express";
import { isAuthenticated, allowTempAuth } from "../middlewares/auth.js";
import { completeUserProfile, getProfileCompletionStatus } from "../controllers/completeprofile.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const completeProfileRouter = Router();

// POST /auth/complete-profile
completeProfileRouter.post("/complete-profile", isAuthenticated, allowTempAuth, completeUserProfile);

completeProfileRouter.get("/complete-profile/status", isAuthenticated, isAdmin, getProfileCompletionStatus);


export default completeProfileRouter;
