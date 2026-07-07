const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing required .env file at ${ENV_PATH}`);
  }

  const result = dotenv.config({ path: ENV_PATH, quiet: true });
  if (result.error) {
    throw result.error;
  }
}

module.exports = {
  ROOT,
  ENV_PATH,
  loadEnv,
};
