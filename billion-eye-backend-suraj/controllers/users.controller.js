


const userService = require('../services/user.service');
const { validationResult } = require('express-validator');
const { saveImageData } = require('../models/camera.model');

module.exports.registerUser = async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await userService.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Register the user
        const userId = await userService.registerUser({
            fullname,
            email,
            password,
        });

        // Generate the JWT token
        const token = userService.generateAuthToken(userId);

        // Set token in cookie
        res.cookie('user_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Send success response
        res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.loginUser = async (req, res) => {
    const { email, password  } = req.body;
     console.log("the controller log password ", password);
     
    try {
        const { token, user } = await userService.loginUser(email, password);

        // Set token in cookie
        res.cookie('user_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(200).json({
            message: 'User logged in successfully',
            user: {
                id: user._id,
                fullname: user.fullname,
                email: user.email
            },
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.logoutUser = async (req, res) => {
    try {
        // Clear the user token cookie
        res.clearCookie('user_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/'
        });
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports.uploadImage = async (req, res) => {
    try {
        const imageData = req.body;
        const imageId = await saveImageData(imageData);
        res.status(201).json({ message: 'Image data saved successfully', imageId });
    } catch (error) {
        console.error('[uploadImage] Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
