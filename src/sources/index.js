const BaseSource = require('./baseSource');

module.exports = {
  getSource(sourceDescriptor) {
    return new BaseSource(sourceDescriptor);
  }
};