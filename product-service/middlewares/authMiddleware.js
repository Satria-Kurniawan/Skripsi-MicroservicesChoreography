export async function withAuth(req, res, next) {
  const tokenFound =
    req.headers.authorization && req.headers.authorization.startsWith("Bearer");

  if (!tokenFound) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized, no token.",
      statusCode: 401,
    });
  }

  const accessToken = req.headers.authorization.split(" ")[1];

  const response = await fetch(`${process.env.USER_SERVICE_HOST}/api/user/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const result = await response.json();

  if (!result.ok) return res.status(result.statusCode).json(result);

  req.user = result.data.user;

  next();
}
