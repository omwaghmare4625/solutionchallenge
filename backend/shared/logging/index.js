function write(level, payload) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    ...payload
  };

  const message = JSON.stringify(record);
  if (level === 'error') {
    console.error(message);
    return;
  }
  console.log(message);
}

const logger = {
  info(payload) {
    write('info', payload);
  },
  warn(payload) {
    write('warn', payload);
  },
  error(payload) {
    write('error', payload);
  }
};

module.exports = { logger };
