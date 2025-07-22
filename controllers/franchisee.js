import { FranchiseeModel } from "../models/franchisee.js";
import { franchiseeValidator } from "../validators/franchisee.js";

export const createFranchisee = async (req, res) => {
    try {
        const { error, value } = franchiseeValidator.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details.map(d => d.message) });
        }

        // Collect image URLs from uploaded files
        const imageUrls = req.files?.map(file => file.path) || [];

        // Save with image URLs
        const location = await FranchiseeModel.create({
            ...value,
            images: imageUrls
        });

        res.status(201).json({
            message: "✅ Franchisee location created successfully",
            data: {
                id: location._id,
                name: location.name,
                location: location.location,
                mapUrl: location.mapUrl,
                contact: location.contact,
                description: location.description,
                images: location.images
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};


export const getAllFranchisees = async (req, res) => {
    const locations = await FranchiseeModel.find({ isPublished: true });
    res.json(locations);
};

export const getFranchiseeById = async (req, res) => {
    const location = await FranchiseeModel.findById(req.params.id);
    if (!location) return res.status(404).json({ message: "Location not found" });
    res.json(location);
};
