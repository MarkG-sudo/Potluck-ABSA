import express from "express";
import { registerUser, getAllUsers, signInUser, getMyProfile, updateAvatar, deleteUser } from "../controllers/users.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';
import { upload } from "../middlewares/cloudinary.js";

const userRouter = express.Router();

// Public
userRouter.post("/register", upload.single("avatar"), registerUser);

userRouter.post('/signIn', signInUser);

// Protected
userRouter.get("/me", isAuthenticated, hasPermission('get_profile'), getMyProfile);
userRouter.patch("/avatar", isAuthenticated, hasPermission('update_profile'), updateAvatar);

// Admin-only (expand with role middleware later)
userRouter.get("/", getAllUsers);
userRouter.delete("/:id",  deleteUser);

export default userRouter;
