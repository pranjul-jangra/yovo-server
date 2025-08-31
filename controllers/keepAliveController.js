import userModel from "../models/userSchema.js";


export const keepAlive = async (req, res) => {
  try {
    await userModel.findOne({ email: "dummy@gamil.com" });
    res.status(200).json({ success: true, message: "Server is alive" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error in keep-alive endpoint" });
  }
};
