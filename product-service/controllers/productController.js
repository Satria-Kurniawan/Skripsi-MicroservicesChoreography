import { validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { createAmqpConnection } from "../../order-service/messageBroker/index.js";

const prisma = new PrismaClient();

export async function addProduct(req, res) {
  const validationErrors = validationResult(req);

  if (!validationErrors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: "Mohon lengkapi data!",
      errors: validationErrors.array(),
    });
  }

  const { name, description, price, quantities, brand } = req.body;
  const priceInt = parseInt(price);
  const quantitiesInt = parseInt(quantities);

  try {
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: priceInt,
        quantities: quantitiesInt,
        brand,
      },
    });

    res.status(201).json({
      ok: true,
      message: "Berhasil menambahkan produk.",
      statusCode: 201,
      data: { product },
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

export async function getAllProducts(req, res) {
  try {
    const products = await prisma.product.findMany();

    res.status(200).json({
      ok: true,
      message: "Success",
      statusCode: 200,
      data: { products },
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

export async function getProductById(req, res) {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.productId },
    });

    if (!product) {
      return res.status(404).json({
        ok: false,
        message: "Produk tidak ditemukan.",
        statusCode: 404,
      });
    }

    res.status(200).json({
      ok: true,
      message: "Success",
      statusCode: 200,
      data: { product },
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

export async function validateOrderProduct() {
  try {
    const { channel, connection } = await createAmqpConnection();

    channel.assertQueue("ORDER_START", { durable: true });
    channel.consume(
      "ORDER_START",
      async (message) => {
        const orderDataString = message.content.toString();
        const orderData = JSON.parse(orderDataString);

        const productFound = await prisma.product.findFirst({
          where: { id: orderData.productId },
        });

        if (productFound.quantities < parseInt(orderData.quantity)) {
          channel.assertQueue("ORDER_INVALID", { durable: true });
          channel.sendToQueue(
            "ORDER_INVALID",
            Buffer.from(
              JSON.stringify({
                success: false,
                message: "Stok habis.",
              })
            ),
            { persistent: true }
          );
        } else {
          const product = await prisma.product.update({
            where: { id: orderData.productId },
            data: { quantities: productFound.quantities - orderData.quantity },
          });

          const orderProductValidData = {
            ...orderData,
            price: product.price,
            stock: product.quantities,
          };

          channel.assertQueue("ORDER_PRODUCT_VALID", { durable: true });
          channel.sendToQueue(
            "ORDER_PRODUCT_VALID",
            Buffer.from(JSON.stringify(orderProductValidData)),
            { persistent: true }
          );
        }

        channel.ack(message);
      },
      { noAck: false }
    );
  } catch (error) {
    console.log(error);
  }
}

export async function rollbackProductStock() {
  try {
    const { channel, connection } = await createAmqpConnection();

    await channel.assertQueue("ROLLBACK_PRODUCTS_STOCK");
    await channel.bindQueue(
      "ROLLBACK_PRODUCTS_STOCK",
      "TRANSACTIONS_CANCEL_EXCHANGE",
      ""
    );
    channel.consume("ROLLBACK_PRODUCTS_STOCK", async (message) => {
      const content = message.content.toString();
      const data = JSON.parse(content);

      for (const obj of data) {
        try {
          await prisma.product.update({
            where: { id: obj.productId },
            data: { quantities: obj.productStock + obj.orderQuantity },
          });
        } catch (error) {
          console.log(error);
        }
      }

      await channel.assertExchange(
        "TRANSACTIONS_CANCEL_SUCCESS_EXCHANGE",
        "fanout",
        { durable: false }
      );
      channel.publish(
        "TRANSACTIONS_CANCEL_SUCCESS_EXCHANGE",
        "",
        Buffer.from(JSON.stringify("Cancelation success."))
      );
    });
  } catch (error) {
    console.log(error);
  }
}
