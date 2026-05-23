const transporter = require("../config/mailer");

async function sendCredentialsEmail(email, password) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Account Credentials",
    html: `
      <h2>Welcome to Reimbursement Platform</h2>
      <p>Your account has been created.</p>

      <p>
        <strong>Email:</strong> ${email}
      </p>

      <p>
        <strong>Password:</strong> ${password}
      </p>
    `,
  });
}

module.exports = sendCredentialsEmail;