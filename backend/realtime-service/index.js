const fastify = require("fastify")({ logger: true });
const createWebSocketServer = require("./websocket/websocketServer");

// Register JSON body parser
fastify.register(require('@fastify/formbody'));

fastify.get("/health", async () => ({ 
  status: "Realtime OK",
  timestamp: new Date().toISOString()
}));

// ⭐ NEW: WebSocket trigger endpoint
fastify.post("/trigger/notification", async (request, reply) => {
  const { userId, notification } = request.body;
  
  if (!userId || !notification) {
    return reply.code(400).send({ 
      error: 'userId and notification are required'
    });
  }

  try {
    const io = fastify.io;
    
    io.to(`user_${userId}`).emit('notification:created', {
      notification,
      timestamp: Date.now()
    });

    request.log.info(`Notification sent to user: ${userId}`);
    
    return { success: true, userId };
  } catch (error) {
    request.log.error('Trigger notification error:', error);
    return reply.code(500).send({ error: 'Failed to trigger notification' });
  }
});

const io = createWebSocketServer(fastify.server);
fastify.decorate('io', io);

fastify.listen({ port: 8003, host: "0.0.0.0" });
