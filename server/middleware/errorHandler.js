export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.message}`);

  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message,
  });
}
