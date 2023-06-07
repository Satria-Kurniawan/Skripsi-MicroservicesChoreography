import jwt from "jsonwebtoken";

export function generateAccessToken(user) {
  const secretKey = process.env.JWT_SECRET_KEY;

  const token = jwt.sign(user, secretKey, {
    algorithm: "HS256",
    expiresIn: "7d",
  });

  return token;
}
