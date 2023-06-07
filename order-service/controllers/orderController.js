import { PrismaClient } from "@prisma/client";
import { createAmqpConnection } from "../messageBroker/index.js";

const prisma = new PrismaClient();

export async function createOrder(req, res) {
  const productId = req.query.productId;
  const { paymentMethod, quantity, note } = req.body;

  try {
    const { connection, channel } = await createAmqpConnection();

    channel.assertQueue("ORDER_START", { durable: true });
    const orderData = JSON.stringify({
      productId,
      quantity,
      paymentMethod,
      note,
      userId: req.user.id,
    });
    channel.sendToQueue("ORDER_START", Buffer.from(orderData), {
      persistent: true,
    });

    const orderCreate = new Promise((resolve, reject) => {
      channel.assertQueue("ORDER_FINISH", { durable: true });
      channel.consume(
        "ORDER_FINISH",
        async (message) => {
          const orderDataCompleteString = message.content.toString();
          const orderDataComplete = JSON.parse(orderDataCompleteString);

          const { quantity, price, user, billing } = orderDataComplete;

          const order = await prisma.order.create({
            data: {
              status: "Menunggu pembayaran.",
              quantity: parseInt(quantity),
              price,
              amount: billing.amount,
              shippingAddress: user.shippingAddress,
              note,
              productId,
              billingId: billing.id,
              userId: user.id,
            },
          });

          if (order)
            resolve({
              success: true,
              message: "Order berhasil.",
              data: { order },
            });
          else
            reject({
              success: false,
              message: "Gagal melakukan order.",
            });

          channel.close();
          connection.close();
        },
        { noAck: true }
      );
    });

    orderCreate
      .then((result) => {
        res.status(201).json(result);
        return;
      })
      .catch((error) => {
        res.status(400).json(error);
      });

    const orderInvalid = new Promise((resolve, reject) => {
      channel.assertQueue("ORDER_INVALID", { durable: true });
      channel.consume(
        "ORDER_INVALID",
        async (message) => {
          const orderDataInvalidString = message.content.toString();
          const orderDataInvalid = JSON.parse(orderDataInvalidString);

          resolve(orderDataInvalid);
          reject({
            success: false,
            message: "Gagal melakukan order.",
          });

          channel.close();
          connection.close();
        },
        { noAck: true }
      );
    });

    orderInvalid
      .then((result) => {
        res.status(400).json({ result });
      })
      .catch((error) => {
        res.status(400).json(error);
      });
  } catch (error) {
    res.status(500).json({ error });
  }
}

// SOME SERVICE
// export async function createOrder(req, res) {
//   const productId = req.query.productId;
//   const { paymentMethod, quantity, note } = req.body;

//   try {
//     const { connection, channel } = await createAmqpConnection();

//     channel.assertQueue("ORDER_START", { durable: true });
//     const orderData = JSON.stringify({
//       productId,
//       quantity,
//       paymentMethod,
//       note,
//       userId: req.user.id,
//     });
//     channel.sendToQueue("ORDER_START", Buffer.from(orderData), {
//       persistent: true,
//     });

//     const orderInvalid = new Promise((resolve, reject) => {
//       channel.assertQueue("ORDER_INVALID", { durable: true });
//       channel.consume(
//         "ORDER_INVALID",
//         async (message) => {
//           const orderDataInvalidString = message.content.toString();
//           const orderDataInvalid = JSON.parse(orderDataInvalidString);

//           resolve(orderDataInvalid);
//           reject({
//             success: false,
//             message: "Gagal melakukan order.",
//           });

//           channel.close();
//           connection.close();
//         },
//         { noAck: true }
//       );
//     });

//     orderInvalid
//       .then((result) => {
//         res.status(400).json({ result });
//       })
//       .catch((error) => {
//         res.status(400).json(error);
//       });
//   } catch (error) {
//     res.status(500).json({ error });
//   }
// }
