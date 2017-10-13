const osmApi = require('./osmApi');
const osmtogeojson = require('osmtogeojson');

async function getFullRelation(relationId) {
  const osmJson = await osmApi.fetchRelation(relationId);
  return osmtogeojson(osmJson);
}

module.exports = {
  getFullRelation,
};
