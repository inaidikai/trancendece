const validate = () => {
  return (req, res, next) => next();
};

const schemas = {};

module.exports = {
  validate,
  schemas,
};
