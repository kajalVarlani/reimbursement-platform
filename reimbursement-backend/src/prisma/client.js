const { PrismaClient } = require("@prisma/client");

const basePrisma = new PrismaClient();

// Wrap $transaction to apply safe defaults for cloud databases (like Neon DB)
// Default Prisma interactive transaction timeout is 5000ms (maxWait 2000ms),
// which times out over remote network latency.
const originalTransaction = basePrisma.$transaction.bind(basePrisma);

basePrisma.$transaction = function (arg, options = {}) {
  if (typeof arg === "function") {
    const txOptions = {
      maxWait: 15000, // 15s to acquire connection
      timeout: 30000, // 30s to execute transaction
      ...options,
    };
    return originalTransaction(arg, txOptions);
  }
  return originalTransaction(arg, options);
};

module.exports = basePrisma;