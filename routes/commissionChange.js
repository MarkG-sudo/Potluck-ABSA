
import { Router } from "express";
import { updateMealCommission, updateChefCommission, getCommissionAudit } from "../controllers/commissionChange.js";
import { isAuthenticated, hasPermission } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const commissionChangeRouter = Router();

// Admin-only routes
commissionChangeRouter.get("/audit", isAuthenticated, hasPermission, isAdmin, getCommissionAudit);
commissionChangeRouter.patch("/meal/:mealId", isAuthenticated, hasPermission("update_commission"), isAdmin, updateMealCommission);
commissionChangeRouter.patch("/chef/:chefId", isAuthenticated, hasPermission("update_commission"), isAdmin, updateChefCommission);


export default commissionChangeRouter;