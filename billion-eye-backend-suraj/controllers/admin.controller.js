const adminService = require('../services/admin.service');

module.exports = {
    registerAdmin: async (req, res) => {
        const { fullname, email, password } = req.body;
        try {
            const adminId = await adminService.registerAdmin({ fullname, email, password });
            const token = adminService.generateAuthToken(adminId);

            // Set token in cookie
            res.cookie('admin_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            res.status(201).json({
                message: 'Admin registered',
                adminId,
            });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    },

    loginAdmin: async (req, res) => {
        const { email, password } = req.body;
        try {
            const { token, admin } = await adminService.loginAdmin(email, password);

            // Set token in cookie
            res.cookie('admin_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            res.status(200).json({
                message: 'Admin logged in successfully',
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
            // Clear the admin token cookie
            res.clearCookie('admin_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                path: '/'
            });
            return res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    },
};
