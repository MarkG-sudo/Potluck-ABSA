import { Router } from "express";
import { approveUser, getPendingUsers, getPendingUserById, getUsersByStatus, getChefsPendingProfile, getApprovalReadyUsers  } from "../controllers/adminApproval.js";
import { isAuthenticated, hasPermission } from "../middlewares/auth.js";

const adminRouter = Router();

// Admin-only: Approve or reject users
adminRouter.patch("/admin/users/:id/approval", isAuthenticated, hasPermission("approve_users"), approveUser);

adminRouter.get("/admin/pending-users", isAuthenticated, hasPermission("view_pending_users"), getPendingUsers);

adminRouter.get("/admin/pending-users/:id", isAuthenticated, hasPermission("view_pending_users"), getPendingUserById);
adminRouter.get("/users/status/:status", getUsersByStatus); 
adminRouter.get("/chefs/pending-profile", getChefsPendingProfile); 
adminRouter.get("/users/approval-ready", getApprovalReadyUsers); 
export default adminRouter;
