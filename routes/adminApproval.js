import { Router } from "express";
import { approveUser, getPendingUsers, getPendingUserById, getUsersByStatus, getChefsPendingProfile, getApprovalReadyUsers  } from "../controllers/adminApproval.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { isAdminOrSuperAdmin } from "../middlewares/isAdmin.js";

const adminRouter = Router();

adminRouter.get("/admin/pending-users", isAuthenticated, isAdminOrSuperAdmin, getPendingUsers);
adminRouter.get("/admin/chefs/pending-profile", isAuthenticated, isAdminOrSuperAdmin, getChefsPendingProfile);
adminRouter.get("/admin/users/approval-ready", isAuthenticated, isAdminOrSuperAdmin, getApprovalReadyUsers);

adminRouter.patch("/admin/users/:id/approval", isAuthenticated, isAdminOrSuperAdmin, approveUser);
adminRouter.get("/admin/pending-users/:id", isAuthenticated, isAdminOrSuperAdmin, getPendingUserById);
adminRouter.get("/admin/users/status/:status", isAuthenticated, isAdminOrSuperAdmin, getUsersByStatus); 
 

export default adminRouter;


