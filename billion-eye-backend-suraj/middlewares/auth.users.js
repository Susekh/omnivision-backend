
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    console.log('Incoming request to:', req.path); // Log the requested endpoint
    console.log('Authorization Header:', req.header('Authorization')); // Log the Authorization header

    const authHeader = req.header('Authorization');

    if (!authHeader) {
        console.log('Authorization header missing'); // Log missing Authorization header
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Extracted Token:', token); // Log the extracted token

    if (!token) {
        console.log('Token format invalid'); // Log invalid token format
        return res.status(401).json({ message: 'Invalid token format.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        console.log('Decoded Token:', decoded); // Log the decoded token payload
        req.user = decoded; // Attach decoded payload to request
        console.log('Token verification successful, proceeding to next middleware');
        next();
    } catch (err) {
        console.error('Token verification error:', err.message); // Log the error message
        res.status(400).json({ message: 'Invalid token' });
    }
};
