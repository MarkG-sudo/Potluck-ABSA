import express from "express";
import { registerUser, getAllUsers, signInUser, getMyProfile, getOneUser, updateAvatar, updateUser, deleteUser } from "../controllers/users.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';
import { upload } from "../middlewares/cloudinary.js";

const userRouter = express.Router();

// Public
userRouter.post("/users/register", upload.single("avatar"), registerUser);

userRouter.post("/users/signIn", signInUser);


userRouter.patch("/users/me", isAuthenticated, upload.single("avatar"), updateUser);

// Protected
userRouter.get("/users/me", isAuthenticated, hasPermission('get_profile'), getMyProfile);
userRouter.patch("/users/avatar", isAuthenticated, hasPermission('update_profile'), upload.single("avatar"), updateAvatar);

// Admin-only (expand with role middleware later)
userRouter.get("/admin/users", getAllUsers);
userRouter.delete("/admin/:id",  deleteUser);

userRouter.get("/users/:id", isAuthenticated, getOneUser);

export default userRouter;
