import request from 'supertest';
import app from '../src/app';

describe('Health Check API', () => {
  it('should return 200 OK with status ok and service name', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'SchoolSafe API');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should return API metadata on root /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'SchoolSafe API');
    expect(res.body).toHaveProperty('documentation', '/api/docs');
  });
});
