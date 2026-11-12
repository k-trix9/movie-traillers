export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error?.name === "ZodError") {
    return res.status(422).json({
      error: {
        message: "Please check the submitted information.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      }
    });
  }

  if (error?.code === "P2002") {
    return res.status(409).json({ error: { message: "A record with one of these values already exists." } });
  }

  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);

  res.status(status).json({
    error: {
      message: status >= 500 ? "An unexpected server error occurred." : error.message,
      ...(error.details ? { details: error.details } : {})
    }
  });
}
