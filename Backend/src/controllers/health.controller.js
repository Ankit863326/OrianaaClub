import mongoose from 'mongoose';
import { logConnectionFailure } from '../config/db.js';

export async function health(request, response) {
  const unavailable = {
    status: 'unavailable',
    database: 'disconnected',
    replicaSet: 'unavailable',
  };

  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    response.status(503).json(unavailable);
    return;
  }

  try {
    const admin = mongoose.connection.db.admin();
    await admin.command({ ping: 1 });
    const hello = await admin.command({ hello: 1 });
    const replicaSetReady = typeof hello.setName === 'string'
      && (hello.isWritablePrimary === true || hello.ismaster === true);
    const data = {
      status: replicaSetReady ? 'ok' : 'unavailable',
      database: 'connected',
      replicaSet: replicaSetReady ? 'connected' : 'unavailable',
    };
    response.status(replicaSetReady ? 200 : 503).json(data);
  } catch (error) {
    logConnectionFailure(`health ${request.method} ${request.path}`, error);
    response.status(503).json(unavailable);
  }
}
