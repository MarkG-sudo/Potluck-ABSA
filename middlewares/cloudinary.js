import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import "dotenv/config";

// Cloudinary base config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Avatar storage (already present)
const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "Potluck-Profiles",
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'svg', 'avif'],
        public_id: (req, file) => {
            const userId = req.auth?.id || "anonymous";
            const timestamp = Date.now();
            const ext = file.originalname.split('.').pop();
            return `avatar-${userId}-${timestamp}.${ext}`;
        }
    }
});

// 🥘 Meal image storage for Potchefs
const mealImageStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "Potluck-Meals",
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'svg', 'avif'],
        public_id: (req, file) => {
            const userId = req.auth?.id || "anonymous";
            const timestamp = Date.now();
            const ext = file.originalname.split('.').pop();
            return `meal-${userId}-${timestamp}.${ext}`;
        }
    }
});

// Multer upload middlewares
export const upload = multer({ storage: profileStorage });
export const mealImageUpload = multer({ storage: mealImageStorage });

// Export cloudinary instance
export default cloudinary;
