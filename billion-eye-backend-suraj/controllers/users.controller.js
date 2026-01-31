


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

        // Send success response
        res.status(201).json({ message: 'User registered successfully', userId ,token: `Bearer ${token}`});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.loginUser = async (req, res) => {
    const { email, password  } = req.body;
     console.log("the controller log password ", password);
     
    try {
        const { token, user } = await userService.loginUser(email, password);

        res.status(200).json({
            message: 'User logged in successfully',
            token,
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
