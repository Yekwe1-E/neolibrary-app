const errorHandler = (err, req, res, next) => {
  console.error("Global Error Handler Caught:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    errors: err.errors || null,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
};

module.exports = errorHandler;
