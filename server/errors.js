/**
 * A problem that keeps the server from starting, such as an unwritable data folder or a database it can't
 * migrate. `index.js` prints just the message, so write it for whoever runs the server.
 */
export class StartupError extends Error {
  name = 'StartupError'
}
