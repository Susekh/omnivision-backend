
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    console.log('Incoming request to:', req.path); // Log the requested endpoint
    console.log('Authorization Header:', req.header('Authorization')); // Log the Authorization header

    let token;
    const authHeader = req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.user_token) {
        token = req.cookies.user_token;
    }

    if (!token) {
        console.log('No token found in header or cookie'); // Log missing token
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    console.log('Extracted Token:', token); // Log the extracted token

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
