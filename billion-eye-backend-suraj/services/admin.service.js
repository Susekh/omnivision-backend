const adminModel = require('../models/admin.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

module.exports = {
    // optional registration support
    registerAdmin: async ({ fullname, email, password }) => {
        if (!fullname || !email || !password) {
            throw new Error('All fields are required');
        }
        // prevent more than one admin in system
        const any = await adminModel.hasAnyAdmin();
        if (any) {
            throw new Error('Admin account already exists');
        }
        const existing = await adminModel.getAdminByEmail(email);
        if (existing) {
            throw new Error('Admin with that email already exists');
        }
        const adminId = await adminModel.createAdmin({ fullname, email, password });
        return adminId;
    },


    loginAdmin: async (email, password) => {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        const admin = await adminModel.loginAdmin(email, password);
        // generate token with role
        const token = jwt.sign(
            { _id: admin._id, email: admin.email, role: 'admin' },
            process.env.JWT_PRIVATE_KEY,
            { expiresIn: '24h' }
        );
        return { token, admin };
    },

    generateAuthToken: (adminId) => {
        return jwt.sign({ _id: adminId, role: 'admin' }, process.env.JWT_PRIVATE_KEY, { expiresIn: '24h' });
    },

    getAdminByEmail: async (email) => {
        if (!email) throw new Error('Email is required');
        return adminModel.getAdminByEmail(email);
    },
};
