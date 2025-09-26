
import { Router } from "express";
import { isAuthenticated, allowTempAuth } from "../middlewares/auth.js";
import { completePotchefProfile, getProfileCompletionStatus } from "../controllers/completeprofile.js";
// import { isAdmin } from "../middlewares/isAdmin.js";

const completeProfileRouter = Router();


completeProfileRouter.post("/complete-profile", allowTempAuth, completePotchefProfile);

completeProfileRouter.get("/complete-profile/status", isAuthenticated, getProfileCompletionStatus);



export default completeProfileRouter;