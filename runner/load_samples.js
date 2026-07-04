const fs = require("fs");
const path = require("path");

function readJson(relativePath) {
  const filePath = path.join(__dirname, "..", relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadSampleEntities() {
  return readJson("scenarios/sample_entities.json");
}

function loadSampleUpdates() {
  return readJson("scenarios/sample_updates.json");
}

module.exports = {
  loadSampleEntities,
  loadSampleUpdates,
};
