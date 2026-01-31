const winston = require("winston");

// Create a winston logger instance
const auditLogger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: "audit.log" }),
        new winston.transports.Console()
    ]
});

// Middleware to log audit data
module.exports = (req, res, next) => {
    const auditData = {
        method: req.method,
        url: req.originalUrl,
        // Be careful with sensitive data in production
        body: req.body,
        timestamp: new Date().toISOString()
    };
    auditLogger.info(auditData);
    next();
};