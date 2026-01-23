const fastify = require('fastify');
const app = fastify();

const PORT = 8000;

app.get('/health', async (request, reply) => {
  return { status: 'Auth OK' };
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Auth service running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
