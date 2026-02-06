const mongoose = require("mongoose");
const dbConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Mongo Db Connection successfully");
  } catch (error) {
    console.log("error mongo db connection == >", error);
    process.exit(1);
  }
};
module.exports = dbConnection;