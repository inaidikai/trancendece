const fastify = require('fastify');
const httpProxy = require('@fastify/http-proxy');

const app = fastify({ logger: true });
const PORT = 8001;
const UPSTREAM = process.env.USER_UPSTREAM || 'http://auth-service:8000';

app.get('/health', async () => ({ status: 'User OK' }));

app.register(httpProxy, {
  upstream: UPSTREAM,
  prefix: '/',
  replyOptions: {
    rewriteRequestHeaders: (req, headers) => ({
      ...headers,
      host: new URL(UPSTREAM).host,
    }),
  },
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`User service proxying to ${UPSTREAM}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
