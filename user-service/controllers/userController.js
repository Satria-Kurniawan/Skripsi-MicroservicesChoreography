import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateAccessToken } from "../utils/generateToken.js";
import { createAmqpConnection } from "../../order-service/messageBroker/index.js";

const prisma = new PrismaClient();

export async function signUp(req, res) {
  const { name, email, password, passwordConfirmation } = req.body;

  if (!name || !email || !password || !passwordConfirmation) {
    return res.status(400).json({
      ok: false,
      message: "Mohon lengkapi data.",
      statusCode: 400,
    });
  }

  if (password !== passwordConfirmation) {
    return res.status(400).json({
      ok: false,
      message: "Konfirmasi password tidak sesuai.",
      statusCode: 400,
    });
  }

  try {
    const emailHasBeenUsed = await prisma.user.findFirst({
      where: { email: email },
    });

    if (emailHasBeenUsed) {
      return res.status(400).json({
        ok: false,
        message: "Email sudah digunakan.",
        statusCode: 400,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      ok: true,
      message: "Berhasil melakukan pendaftaran akun.",
      statusCode: 201,
      data: { user },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      message: "Kesalahan pada server.",
      statusCode: 500,
    });
  }
}

export async function signIn(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      message: "Mohon lengkapi data.",
      statusCode: 400,
    });
  }

  try {
    const userFound = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!userFound) {
      return res.status(404).json({
        ok: false,
        message: "Email/akun belum terdaftar.",
        statusCode: 404,
      });
    }

    const passwordMatched = await bcrypt.compare(password, userFound.password);

    if (!passwordMatched) {
      return res.status(403).json({
        ok: false,
        message: "Password yang anda masukan salah.",
        statusCode: 403,
      });
    }

    const user = {
      id: userFound.id,
      name: userFound.name,
      email: userFound.email,
      avatar: userFound.avatar,
    };

    const accessToken = generateAccessToken(user);

    res.status(200).json({
      ok: true,
      message: `Berhasil login sebagai ${user.name}.`,
      statusCode: 200,
      data: { user, accessToken },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      message: "Kesalahan pada server.",
      statusCode: 500,
    });
  }
}

export async function getMe(req, res) {
  const user = req.user;

  return res.status(200).json({
    ok: true,
    data: { user },
  });
}

export async function validateUserInformation() {
  try {
    const { channel, connection } = await createAmqpConnection();

    channel.assertQueue("ORDER_PRODUCT_VALID", { durable: true });
    channel.consume(
      "ORDER_PRODUCT_VALID",
      async (message) => {
        const orderProductValidDataString = message.content.toString();
        const orderProductValidData = JSON.parse(orderProductValidDataString);

        const user = await prisma.user.findFirst({
          where: { id: orderProductValidData.userId },
        });

        if (!user.address || !user.phone) {
          channel.assertQueue("ORDER_INVALID", { durable: true });
          channel.sendToQueue(
            "ORDER_INVALID",
            Buffer.from(
              JSON.stringify({
                success: false,
                message: "Data user belum lengkap.",
              })
            ),
            { persistent: true }
          );
          return;
        }

        const { productId, quantity, price, paymentMethod, note, stock } =
          orderProductValidData;

        const orderDataValid = {
          productId,
          quantity,
          stock,
          price,
          paymentMethod,
          note,
          user: { id: user.id, shippingAddress: user.address },
        };

        channel.assertQueue("ORDER_USER_VALID", { durable: true });
        channel.sendToQueue(
          "ORDER_USER_VALID",
          Buffer.from(JSON.stringify(orderDataValid)),
          { persistent: true }
        );

        channel.ack(message);
      },
      { noAck: false }
    );
  } catch (error) {
    console.log(error);
  }
}

export async function test2Microservices() {
  try {
    const { channel } = await createAmqpConnection();

    channel.assertQueue("GET_USER", { durable: false });
    channel.consume(
      "GET_USER",
      async (message) => {
        const userId = message.content.toString();

        const user = await prisma.user.findFirst({
          where: { id: userId },
        });

        if (!user) return;

        channel.ack(message);

        channel.assertQueue(message.properties.replyTo);
        channel.sendToQueue(
          message.properties.replyTo,
          Buffer.from(JSON.stringify(user))
        );
      },
      { noAck: false }
    );
  } catch (error) {
    console.log(error);
  }
}

export async function test3Microservices() {
  try {
    const { channel } = await createAmqpConnection();

    channel.assertQueue("GET_USER_&_BILLING", { durable: false });
    channel.consume(
      "GET_USER_&_BILLING",
      async (message) => {
        const content = message.content.toString();
        const data = JSON.parse(content);

        const user = await prisma.user.findFirst({
          where: { id: data.userId },
        });

        if (!user) return;

        channel.ack(message);

        channel.assertQueue("GET_BILLING", { durable: false });
        channel.sendToQueue(
          "GET_BILLING",
          Buffer.from(JSON.stringify({ user, billingId: data.billingId }))
        );
      },
      { noAck: false }
    );
  } catch (error) {
    console.log(error);
  }
}
