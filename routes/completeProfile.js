
import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { updateGoogleUserProfile } from "../completeProfile.js";

const completeProfileRouter = Router();

// POST /auth/complete-profile
completeProfileRouter.post("/auth/complete-profile", isAuthenticated, updateGoogleUserProfile);

export default completeProfileRouter;
