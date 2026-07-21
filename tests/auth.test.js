const request = require('supertest');
const app = require('../server');

describe('Authentication', () => {
    describe('Auth Middleware', () => {
        it('blocks requests without credentials', async () => {
            const res = await request(app).get('/status.cgi');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toContain('Basic');
        });

        it('accepts valid credentials', async () => {
            const res = await request(app)
                .get('/status.cgi')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
        });

        it('rejects invalid credentials', async () => {
            const res = await request(app)
                .get('/status.cgi')
                .auth('admin', 'wrongpassword');
            expect(res.status).toBe(401);
        });

        it('rejects with empty username', async () => {
            const res = await request(app)
                .get('/status.cgi')
                .auth('', 'admin');
            expect(res.status).toBe(401);
        });

        it('rejects with empty password', async () => {
            const res = await request(app)
                .get('/status.cgi')
                .auth('admin', '');
            expect(res.status).toBe(401);
        });
    });

    describe('Protected Endpoints', () => {
        const protectedEndpoints = [
            '/status.cgi',
            '/man.cgi?type=door_on&securitystate=10000000',
            '/if.cgi?type=go_log_page',
            '/if.cgi?type=go_user_page'
        ];

        protectedEndpoints.forEach(endpoint => {
            it(`protects ${endpoint}`, async () => {
                const res = await request(app).get(endpoint);
                expect(res.status).toBe(401);
            });
        });
    });
});
