import { Router } from "express";
import {
    createFranchisee,
    getAllFranchisees,
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

export default franchiseeRouter;
