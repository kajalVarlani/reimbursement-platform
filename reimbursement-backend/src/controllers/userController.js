function getProfile(req, res) {
  res.status(200).json({
    message: "Protected route accessed",
    user: req.user,
  });
}

module.exports = {
  getProfile,
};