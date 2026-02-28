process.env.NODE_ENV = 'test';

if (!process.env.PEOPLEPORTAL_TOKEN_SECRET) {
  process.env.PEOPLEPORTAL_TOKEN_SECRET = 'test-token-secret';
}

if (!process.env.PEOPLEPORTAL_MONGO_URL) {
  process.env.PEOPLEPORTAL_MONGO_URL = 'mongodb://127.0.0.1:27017/peopleportal-test';
}

if (!process.env.PEOPLEPORTAL_GITEA_ENDPOINT) {
  process.env.PEOPLEPORTAL_GITEA_ENDPOINT = 'http://localhost:3001';
}

if (!process.env.PEOPLEPORTAL_GITEA_TOKEN) {
  process.env.PEOPLEPORTAL_GITEA_TOKEN = 'test-gitea-token';
}

if (!process.env.PEOPLEPORTAL_SLACK_INVITE_URL) {
  process.env.PEOPLEPORTAL_SLACK_INVITE_URL = 'https://example.com/invite';
}

if (!process.env.PEOPLEPORTAL_SLACK_BOT_TOKEN) {
  process.env.PEOPLEPORTAL_SLACK_BOT_TOKEN = 'xoxb-test-token';
}

if (!process.env.PEOPLEPORTAL_AUTHENTIK_ENDPOINT) {
  process.env.PEOPLEPORTAL_AUTHENTIK_ENDPOINT = 'http://localhost:3002';
}

if (!process.env.PEOPLEPORTAL_AUTHENTIK_TOKEN) {
  process.env.PEOPLEPORTAL_AUTHENTIK_TOKEN = 'test-authentik-token';
}
