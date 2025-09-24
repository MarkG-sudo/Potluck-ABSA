
import { Router } from "express";
import bodyParser from "body-parser";
import { paystackWebhook } from "../controllers/paystack.js";
import { createPaymentController, verifyPaymentController } from "../controllers/paystack.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';

const paystackRouter = Router();

// ✅ Route 1: For your PWA to initiate a payment
paystackRouter.post("/create-payment", isAuthenticated, createPaymentController);

// ✅ Route 3: For Paystack to send you webhook events (must be raw body!)
paystackRouter.post(
    "/webhook",
    bodyParser.raw({ type: "application/json" }), // More specific than */*
    paystackWebhook
);

// For admin-initiated chef payouts
// paystackRouter.post("/initiate-payout", isAuthenticated, hasPermission("manage_payouts"), initiatePayoutController);

// ✅ Route 2: For your PWA to verify a payment immediately after redirect
paystackRouter.get("/verify-payment/:reference", verifyPaymentController);



export default paystackRouter;