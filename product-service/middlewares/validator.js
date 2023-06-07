import { check } from "express-validator";

export const productValidation = [
  check("name").notEmpty().withMessage("Nama produk wajib diisi!"),
  check("price").notEmpty().withMessage("Harga produk wajib diisi!"),
  check("quantities").notEmpty().withMessage("Kuantitas produk wajib diisi!"),
  check("brand").notEmpty().withMessage("Brand produk wajib diisi!"),
];
