
const userModel = require('../models/users.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = {
   

    registerUser: async ({ fullname, email, password }) => {
        if (!fullname || !email || !password) {
            throw new Error('All fields are required');
        }

        // Check if the user already exists
        const existingUser = await userModel.getUserByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Hash the password and save the user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await userModel.registerUser({
            fullname,
            email,
            password: hashedPassword,
        });

        return newUser; // Return the newly created user ID
    },

    generateAuthToken: (userId) => {
        return jwt.sign({ _id: userId }, process.env.JWT_PRIVATE_KEY, { expiresIn: '24h' });
    },

    loginUser: async (email, password) => {
        if(!email || !password) {
            throw new Error('Email and Password  are required');
        }

        const user = await userModel.loginUser(email, password);
         
        //Generate JWT token
        const token = jwt.sign(
            { _id: user._id, email: user.email },
            process.env.JWT_PRIVATE_KEY,
            { expiresIn: '24h' }
        );
        console.log('Generated Token:', token);
        return { token, user };
    },

    getUserByEmail: async (email) => {
        if (!email) {
            throw new Error('Email is required');
        }

        const user = await userModel.getUserByEmail(email);
        return user;
    },
};
