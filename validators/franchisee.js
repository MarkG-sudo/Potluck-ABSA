import Joi from "joi";

export const franchiseeValidator = Joi.object({
    businessName: Joi.string().required(),
    contactPerson: Joi.string().optional(),
    contactNumber: Joi.string().pattern(/^0\d{9}$/).required(),
    locationAddress: Joi.string().required(),
    googleMapsLink: Joi.string().uri().required(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    description: Joi.string().optional(),
    operatingHours: Joi.object({
        open: Joi.string().optional(),
        close: Joi.string().optional()
    }).optional(),
    isPublished: Joi.boolean().optional()
});


export const updateFranchiseeValidator = Joi.object({
    businessName: Joi.string().optional(),
    contactPerson: Joi.string().optional(),
    contactNumber: Joi.string().pattern(/^0\d{9}$/).optional(),
    locationAddress: Joi.string().optional(),
    googleMapsLink: Joi.string().uri().optional(),
    images: Joi.any().optional(),
    description: Joi.string().optional(),
    operatingHours: Joi.object({
        open: Joi.string().optional(),
        close: Joi.string().optional()
    }).optional(),
    isPublished: Joi.boolean().optional()
}).min(1); // Ensure at least one field is being updated