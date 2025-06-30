import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import userRouter from "./routes/users.js";

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
app.use('/users', userRouter);


// Start server
const PORT = 5090;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});