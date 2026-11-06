// Used by `npm run start:mock`: talks to the local mock server (mock-server/server.js) instead of the Raspberry
export const env = {
    production: false,
    mock: true,
    backendApiUrl: 'http://localhost:8080',
    websocketUrl: 'http://localhost:8080',
    hlsUrl: 'http://localhost:8080',
}
