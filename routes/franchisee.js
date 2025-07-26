import { Router } from "express";
import {
    createFranchisee,
    getAllFranchisees,
    updateFranchisee,
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

franchiseeRouter.post("/franchisees/:id", isAuthenticated, hasPermission('add_franchisee'), isAdmin, franchiseeImageUpload.array("images", 3), updateFranchisee);

franchiseeRouter.patch(
    "/franchisees/:id/remove-images",
    isAuthenticated,
    isAdmin,
    removeFranchiseeImages
);


export default franchiseeRouter;
