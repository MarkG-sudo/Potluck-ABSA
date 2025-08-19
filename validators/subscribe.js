import Joi from "joi";

export const subscribeValidator = Joi.object({
    endpoint: Joi.string().uri().required(),
    keys: Joi.object({
        p256dh: Joi.string().required(),
        auth: Joi.string().required()
    }).required()
});
