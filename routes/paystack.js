import { Router } from "express";
import bodyParser from "body-parser";
import {
    paystackWebhook,
    createPaymentController,
    verifyPaymentController,
    submitOtpController
} from "../controllers/paystack.js";
import { hasPermission, isAuthenticated } from '../middlewares/auth.js';

const paystackRouter = Router();

paystackRouter.post("/create-payment", isAuthenticated, createPaymentController);

paystackRouter.post(
    "/webhook",
    bodyParser.raw({ type: "application/json" }),
    paystackWebhook
);

paystackRouter.get("/verify-payment/:paymentReference", isAuthenticated, verifyPaymentController);

// ✅ Route 4: For Vodafone voucher submission
paystackRouter.post("/submit-otp", isAuthenticated, submitOtpController);

export default paystackRouter;
