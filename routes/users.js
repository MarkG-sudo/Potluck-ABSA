import express from "express";
import { registerUser, getAllUsers, signInUser, getMyProfile, getOneUser, updateAvatar, updateUser, deleteUser, registerAdminBySuperAdmin } from "../controllers/users.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';
// import { loginRateLimiter } from "../middlewares/rateLimiter.js";
import { upload } from "../middlewares/cloudinary.js";
import { isSuperAdmin, isAdminOrSuperAdmin } from "../middlewares/isAdmin.js";
import { refreshToken } from '../controllers/users.js';


const userRouter = express.Router();

// Public
userRouter.post("/users/register",  registerUser);

userRouter.post("/users/signIn",  signInUser);

userRouter.patch("/users/me", isAuthenticated,  updateUser);

// Superadmin-only admin creation route
userRouter.post("/superadmin/create-admin", isAuthenticated, isSuperAdmin, registerAdminBySuperAdmin);

// Protected
userRouter.get("/users/me", isAuthenticated, hasPermission('get_profile'), getMyProfile);
userRouter.patch("/users/avatar", isAuthenticated,  upload.single("avatar"), updateAvatar);

// Admin-only (expand with role middleware later)
userRouter.get("/admin/users", isAuthenticated, isAdminOrSuperAdmin, getAllUsers);
userRouter.delete("/admin/delete/:id", isAuthenticated, isAdminOrSuperAdmin,  deleteUser);

userRouter.get("/users/:id", isAuthenticated, getOneUser);
userRouter.post("/users/refresh-token", refreshToken);

export default userRouter;




