const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    let token;
    const authHeader = req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && (req.cookies.admin_token || req.cookies.agency_token)) {
        token = req.cookies.admin_token || req.cookies.agency_token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        if (decoded.role !== 'admin' && decoded.role !== 'agency') {
            return res.status(403).json({ message: 'Access denied. Admin or Agency access required.' });
        }
        req.user = decoded; // Attach to req.user for consistency
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Invalid token' });
    }
};