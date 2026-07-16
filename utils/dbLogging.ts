import { Connection } from 'mongoose';
import log = require('./log');
const logger = log.scope('index');

// Mongoose queues operations and retries the connection automatically on drops;
// these listeners exist purely to make that state visible in the logs.
function attachConnectionLogging(connection: Connection): void {
    connection.on('error', (err) => logger.error('MongoDB connection error:', err));
    connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    connection.on('reconnected', () => logger.info('MongoDB reconnected'));
}

export { attachConnectionLogging };
