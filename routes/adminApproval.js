import { Router } from "express";
import { approveUser, getPendingUsers, getPendingUserById, getUsersByStatus, getChefsPendingProfile, getApprovalReadyUsers  } from "../controllers/adminApproval.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { isAdmin, isSuperAdmin } from "../middlewares/isAdmin.js";

const adminRouter = Router();

adminRouter.get("/admin/pending-users", isAuthenticated, isAdmin, isSuperAdmin, getPendingUsers);
adminRouter.get("/admin/chefs/pending-profile", isAuthenticated, isAdmin, isSuperAdmin, getChefsPendingProfile);
adminRouter.get("/admin/users/approval-ready", isAuthenticated, isAdmin, isSuperAdmin, getApprovalReadyUsers);

adminRouter.patch("/admin/users/:id/approval", isAuthenticated, isAdmin, isSuperAdmin, approveUser);
adminRouter.get("/admin/pending-users/:id", isAuthenticated, isAdmin, isSuperAdmin, getPendingUserById);
adminRouter.get("/admin/users/status/:status", isAuthenticated, isAdmin, isSuperAdmin, getUsersByStatus); 
 

export default adminRouter;


