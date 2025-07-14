import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import "./middlewares/passport.js";
import userRouter from "./routes/users.js";
import mealRouter from "./routes/meals.js";
import reviewMealRouter from "./routes/mealReview.js";
import orderRouter from "./routes/mealOrder.js";
import adminRouter from "./routes/adminApproval.js";
import gAuthRouter from "./routes/auth.js";


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
app.use(cors());




// Register routes
app.use(userRouter);
app.use(mealRouter);
app.use(reviewMealRouter);
app.use(orderRouter);
app.use(adminRouter);
app.use(gAuthRouter);



// Start server
const PORT = 5090;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});