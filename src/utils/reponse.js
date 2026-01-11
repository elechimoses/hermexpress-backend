export const success = (res, message, payload = null, statusCode = 200) => {
  return res.status(statusCode).json({
    status: true,
    message,
    payload,
  });
};

export const error = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({
    status: false,
    message,
    payload: null,
  });
};