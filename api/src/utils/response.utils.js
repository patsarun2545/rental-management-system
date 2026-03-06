

exports.success = (res, status, message, result = null) => {
  return res.status(status).json({
    success: true,
    message,
    result,
  });
};

exports.error = (res, status, message, error = null) => {
  return res.status(status).json({
    success: false,
    message,
    error,
  });
};