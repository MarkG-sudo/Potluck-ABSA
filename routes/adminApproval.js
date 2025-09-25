import { Router } from "express";
import { approveUser, getPendingUsers, getPendingUserById, getUsersByStatus, getChefsPendingProfile, getApprovalReadyUsers  } from "../controllers/adminApproval.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { isAdmin } from "../middlewares/isAdmin.js";

const adminRouter = Router();

adminRouter.get("/admin/pending-users", isAuthenticated, isAdmin, getPendingUsers);
adminRouter.get("/admin/chefs/pending-profile", isAuthenticated, isAdmin, getChefsPendingProfile);
adminRouter.get("/admin/users/approval-ready", isAuthenticated, isAdmin, getApprovalReadyUsers);

adminRouter.patch("/admin/users/:id/approval", isAuthenticated, isAdmin, approveUser);
adminRouter.get("/admin/pending-users/:id", isAuthenticated, isAdmin, getPendingUserById);
adminRouter.get("/admin/users/status/:status", isAuthenticated, isAdmin, getUsersByStatus); 
 

export default adminRouter;


