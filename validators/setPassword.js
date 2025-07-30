import Joi from "joi";

export const setPasswordValidator = Joi.object({
    password: Joi.string()
        .min(8)
        .max(30)
        .pattern(new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+]).+$"))
        .required()
        .messages({
            "string.pattern.base":
                "Password must include uppercase, lowercase, number, and special character.",
        }),
    confirmPassword: Joi.any()
        .equal(Joi.ref("password"))
        .required()
        .label("Confirm password")
        .messages({ "any.only": "{{#label}} does not match" })
});
