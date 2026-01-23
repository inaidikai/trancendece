const fastify = require('fastify');
const app = fastify();

const PORT = 8003;

app.get('/health', async (request, reply) => {
  return { status: 'Realtime OK' };
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Realtime service running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
