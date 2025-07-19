import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import passport from "passport"; // Only initialize passport
import "./middlewares/passport.js"; // Your existing passport config
import userRouter from "./routes/users.js";
import mealRouter from "./routes/meals.js";
import reviewMealRouter from "./routes/mealReview.js";
import orderRouter from "./routes/mealOrder.js";
import adminRouter from "./routes/adminApproval.js";
import gAuthRouter from "./routes/auth.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Database connected successfully");
    } catch (error) {
        console.error("❌ Database connection error:", error);
        process.exit(1);
    }
};
connectDB();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.FRONTEND_URL // No credentials needed for JWT
}));
app.set('trust proxy', 1); // Still required for Render.com

// Initialize Passport WITHOUT sessions
app.use(passport.initialize());

// Register routes
app.use(userRouter);
app.use(mealRouter);
app.use(reviewMealRouter);
app.use(orderRouter);
app.use(adminRouter);
app.use(gAuthRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5090;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});














// // Initialize Express app
// const app = express();


// // Connect to MongoDB
// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGO_URI);
//         console.log("✅ Database connected successfully");
//     } catch (error) {
//         console.error("❌ Database connection error:", error);
//         process.exit(1);
//     }
// };
// connectDB();

// // Middleware setup
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cors());
// app.set('trust proxy', 1); 




// // Register routes
// app.use(userRouter);
// app.use(mealRouter);
// app.use(reviewMealRouter);
// app.use(orderRouter);
// app.use(adminRouter);
// app.use(gAuthRouter);



// // Start server
// const PORT = 5090;
// app.listen(PORT, () => {
//     console.log(`🚀 Server running on port ${PORT}`);
// });