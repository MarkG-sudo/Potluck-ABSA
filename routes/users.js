import express from "express";
import { registerUser, getAllUsers, signInUser, getMyProfile, updateAvatar, updateUser, deleteUser } from "../controllers/users.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';
import { upload } from "../middlewares/cloudinary.js";

const userRouter = express.Router();

// Public
userRouter.post("/users/register", upload.single("avatar"), registerUser);

userRouter.post("/users/signIn", signInUser);

userRouter.patch("/users/me", isAuthenticated, updateUser);

// Protected
userRouter.get("/users/me", isAuthenticated, hasPermission('get_profile'), getMyProfile);
userRouter.patch("/users/avatar", isAuthenticated, hasPermission('update_profile'), updateAvatar);

// Admin-only (expand with role middleware later)
userRouter.get("/admin/users", getAllUsers);
userRouter.delete("/admin/:id",  deleteUser);

export default userRouter;
