import { FranchiseeModel } from "../models/franchisee.js";
import { franchiseeValidator, updateFranchiseeValidator } from "../validators/franchisee.js";
import cloudinary from "../middlewares/cloudinary.js";
import mongoose from "mongoose";

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
                name: location.businessName,
                location: location.locationAddress,
                mapUrl: location.googleMapsLink,
                contact: location.contactNumber,
                description: location.description,
                images: location.images
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};

export const updateFranchiseeText = async (req, res) => {
    try {
        const { error, value } = updateFranchiseeValidator.validate(req.body);

        if (error || !value || Object.keys(value).length === 0) {
            return res.status(422).json({
                error: error ? error.details.map(d => d.message) : ["Update at least one field."]
            });
        }

        const updated = await FranchiseeModel.findByIdAndUpdate(
            req.params.id,
            value,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Franchisee not found" });
        }

        res.status(200).json({
            message: "✅ Franchisee text fields updated successfully",
            data: updated
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};


export const updateFranchiseeImages = async (req, res) => {
    try {
        const imageUrls = req.files?.map(file => file.path) || [];

        if (imageUrls.length === 0) {
            return res.status(400).json({ error: "Please upload at least one image." });
        }

        const franchisee = await FranchiseeModel.findById(req.params.id);
        if (!franchisee) {
            return res.status(404).json({ message: "Franchisee not found" });
        }

        const existingImages = franchisee.images || [];
        const combinedImages = [...existingImages, ...imageUrls].slice(0, 3);

        franchisee.images = combinedImages;
        await franchisee.save();

        res.status(200).json({
            message: "✅ Franchisee images updated successfully",
            data: franchisee
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
};




export const removeFranchiseeImages = async (req, res) => {
    try {
        const { id } = req.params;
        const { imagesToRemove } = req.body;

        if (!Array.isArray(imagesToRemove) || imagesToRemove.length === 0) {
            return res.status(400).json({ error: "Provide an array of image URLs to remove." });
        }

        const franchisee = await FranchiseeModel.findById(id);
        if (!franchisee) {
            return res.status(404).json({ error: "Franchisee not found" });
        }

        // Filter out removed images
        const updatedImages = franchisee.images.filter(img => !imagesToRemove.includes(img));

        // Extract public_id and delete from Cloudinary
        for (const url of imagesToRemove) {
            const match = url.match(/\/Potluck-Franchisees\/([^\.\/]+)\.[a-z]+$/i);
            if (match && match[1]) {
                const publicId = `Potluck-Franchisees/${match[1]}`;
                await cloudinary.uploader.destroy(publicId);
            }
        }

        // Save updated images
        franchisee.images = updatedImages;
        await franchisee.save();

        res.status(200).json({
            message: "✅ Selected images removed successfully",
            remainingImages: updatedImages
        });
    } catch (err) {
        res.status(500).json({ error: "Server error", details: err.message });
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
