import { Router } from "express";
import bodyParser from "body-parser";
import { paystackWebhook } from "../controllers/paystack.js";
import { createPaymentController, verifyPaymentController } from "../controllers/paystack.js";

const paystackRouter = Router();

// ✅ Route 1: For your PWA to initiate a payment
paystackRouter.post("/create-payment", createPaymentController);

// ✅ Route 2: For your PWA to verify a payment immediately after redirect
paystackRouter.get("/verify-payment/:reference", verifyPaymentController);

// ✅ Route 3: For Paystack to send you webhook events (must be raw body!)
paystackRouter.post(
    "/webhook",
    bodyParser.raw({ type: "application/json" }), // More specific than */*
    paystackWebhook
);

export default paystackRouter;