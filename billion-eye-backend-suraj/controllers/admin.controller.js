const adminService = require('../services/admin.service');

module.exports = {
    registerAdmin: async (req, res) => {
        const { fullname, email, password } = req.body;
        try {
            const adminId = await adminService.registerAdmin({ fullname, email, password });
            const token = adminService.generateAuthToken(adminId);
            res.status(201).json({
                message: 'Admin registered',
                adminId,
                token: `Bearer ${token}`,
            });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    },

    loginAdmin: async (req, res) => {
        const { email, password } = req.body;
        try {
            const { token, admin } = await adminService.loginAdmin(email, password);
            res.status(200).json({
                message: 'Admin logged in successfully',
                token,
                admin: {
                    id: admin._id,
                    fullname: admin.fullname,
                    email: admin.email,
                },
            });
        } catch (err) {
            res.status(401).json({ message: err.message });
        }
    },

    logoutAdmin: async (req, res) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                return res.status(400).json({ message: 'Token is required for logout' });
            }
            // optional: add to blacklist or keep in a store
            res.clearCookie('admin_token', {
                httpOnly: true,
                sameSite: 'Strict',
                secure: process.env.NODE_ENV === 'production',
            });
            return res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    },
};
