import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  try {
    const token = req.headers.authorization.split(" ")[1];
    const secretKey = process.env.JWT_SECRET_KEY;
    const decodedToken = jwt.verify(token, secretKey);

    const userFound = await prisma.user.findFirst({
      where: { id: decodedToken.id },
    });

    if (!userFound) {
      return res.status(404).json({
        ok: false,
        message: "Pengguna tidak ditemukan.",
        statusCode: 404,
      });
    }

    const { id, name, email, avatar } = userFound;
    req.user = { id, name, email, avatar };

    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({
      ok: false,
      message: "Unauthorized, token tidak valid.",
      statusCode: 401,
    });
  }
}
