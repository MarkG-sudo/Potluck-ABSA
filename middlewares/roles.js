export const isAdmin = (req, res, next) => {
    if (!req.auth || req.auth.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    next();
};