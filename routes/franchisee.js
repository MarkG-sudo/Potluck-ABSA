import { Router } from "express";
import {
    createFranchisee,
    getAllFranchisees,
    updateFranchiseeImages,
    updateFranchiseeText,
    removeFranchiseeImages,
    getFranchiseeById
} from "../controllers/franchisee.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';
import { isAdmin } from "../middlewares/roles.js";
import { franchiseeImageUpload } from "../middlewares/cloudinary.js";

const franchiseeRouter = Router();

// Admin only
franchiseeRouter.post("/franchisees", isAuthenticated, hasPermission('add_franchisee'), isAdmin, franchiseeImageUpload.array("images", 3), createFranchisee);



// Public
franchiseeRouter.get("/franchisees", getAllFranchisees);
franchiseeRouter.get("/franchisees/:id", getFranchiseeById);

// Admin

// Text update
franchiseeRouter.patch(
    "/franchisees/:id/text",
    isAuthenticated,
    hasPermission("update_franchisee"),
    isAdmin,
    updateFranchiseeText
);

// Image update
franchiseeRouter.patch(
    "/franchisees/:id/images",
    isAuthenticated,
    hasPermission("update_franchisee"),
    isAdmin,
    franchiseeImageUpload.array("images", 3),
    updateFranchiseeImages
);


franchiseeRouter.patch(
    "/franchisees/:id/remove-images",
    isAuthenticated,
    isAdmin,
    removeFranchiseeImages
);


export default franchiseeRouter;
