// utils/tokenUtils.js
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/users.js';

export const refreshAccessToken = async (refreshToken) => {
    try {
        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        // Check if user exists and token version matches
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            throw new Error('User not found');
        }

        // Optional: Check token version for invalidation
        if (user.tokenVersion !== decoded.tokenVersion) {
            throw new Error('Token revoked');
        }

        // Generate new access token
        const newAccessToken = jwt.sign(
            {
                id: user._id,
                role: user.role,
                type: 'access'
            },
            process.env.JWT_PRIVATE_KEY,
            { expiresIn: '15m' }
        );

        return {
            accessToken: newAccessToken,
            refreshToken: refreshToken, // Same refresh token (or generate new one)
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        };
    } catch (error) {
        throw new Error('Invalid refresh token: ' + error.message);
    }
};