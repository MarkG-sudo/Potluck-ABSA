export const isAdmin = (req, res, next) => {
    if (!req.auth || req.auth.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    next();
};


export const isSuperAdmin = (req, res, next) => {
    if (!req.auth || req.auth.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Super admins only." });
    }
    next();
};


export const isAdminOrSuperAdmin = (req, res, next) => {
    const role = req.auth?.role;
    if (role !== "admin" && role !== "superadmin") {
        return res.status(403).json({ error: "Access denied. Admins or Superadmins only." });
    }
    next();
};
