const joi = require("joi");
const config = require("../config/config");

const pingRequestSchema = joi.object({
  ip: joi.string().ip().required(),
  timeout: joi
    .number()
    .min(config.ping.minTimeout)
    .max(config.ping.maxTimeout)
    .default(1000),
  packetSize: joi
    .number()
    .min(config.ping.minPacketSize)
    .max(config.ping.maxPacketSize)
    .default(32),
  duration: joi
    .number()
    .min(config.ping.minDuration)
    .max(config.ping.maxDuration)
    .default(60000),
});

module.exports = {
  validatePingRequest: (data) => pingRequestSchema.validate(data),
};
