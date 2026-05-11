module.exports = async function(req, res) {
  res.status(200).json({ status: "ok", method: req.method });
};
