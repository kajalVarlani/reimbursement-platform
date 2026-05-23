const prisma = require("../prisma/client");
const bcrypt = require("bcrypt");

const generatePassword = require("../utils/generatePassword");
const sendCredentialsEmail = require("../services/sendCredentialsEmail");

async function createUser(req, res) {
  try {
    const { name, email } = req.body;

    // check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // generate password
    const plainPassword = generatePassword();

    // hash password
    const hashedPassword = await bcrypt.hash(
      plainPassword,
      10
    );

    // create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // send email
    await sendCredentialsEmail(
      email,
      plainPassword
    );

   res.status(201).json({
  message: "User created successfully",
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

module.exports = {
  createUser,
};