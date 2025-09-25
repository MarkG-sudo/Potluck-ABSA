
import { Router } from "express";
import { isAuthenticated, allowTempAuth } from "../middlewares/auth.js";
import { completePotchefProfile, getProfileCompletionStatus } from "../controllers/completeprofile.js";
// import { isAdmin } from "../middlewares/isAdmin.js";

const completeProfileRouter = Router();

// ✅ POST /complete-profile (Potchef profile completion with temp token)
completeProfileRouter.post("/complete-profile", allowTempAuth, completePotchefProfile);

// ✅ GET /complete-profile/status (User checks their own completion status)
completeProfileRouter.get("/complete-profile/status", isAuthenticated, getProfileCompletionStatus);



export default completeProfileRouter;