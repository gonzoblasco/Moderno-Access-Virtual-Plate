const request = require('supertest');
const app = require('../server');

describe('CGI Endpoints', () => {
    describe('GET /status.htm', () => {
        it('requires auth for status page', async () => {
            const res = await request(app).get('/status.htm');
            expect(res.status).toBe(401);
        });

        it('returns HTML with system status when authenticated', async () => {
            const res = await request(app)
                .get('/status.htm')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
            expect(res.text).toContain('System Status');
            expect(res.text).toContain('ESTADO DEL TERMINAL');
        });
    });

    describe('GET /status.cgi', () => {
        it('returns CGI variables without auth', async () => {
            // With new default auth-enabled, this should fail without credentials
            const res = await request(app).get('/status.cgi');
            expect(res.status).toBe(401);
        });

        it('returns CGI variables with auth', async () => {
            const res = await request(app)
                .get('/status.cgi')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
            expect(res.text).toContain('var ver=');
            expect(res.text).toContain('var mac=');
            expect(res.text).toContain('var users=');
        });
    });

    describe('GET /man.cgi?door_on', () => {
        it('rejects door open without auth', async () => {
            const res = await request(app)
                .get('/man.cgi?type=door_on&securitystate=10000000');
            expect(res.status).toBe(401);
        });

        it('opens relay 1 with valid auth', async () => {
            const res = await request(app)
                .get('/man.cgi?type=door_on&securitystate=10000000')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.relay).toBe(1);
        });

        it('opens multiple relays', async () => {
            const res = await request(app)
                .get('/man.cgi?type=door_on&securitystate=11000000')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /if.cgi?type=go_log_page', () => {
        it('requires auth for logs', async () => {
            const res = await request(app).get('/if.cgi?type=go_log_page');
            expect(res.status).toBe(401);
        });

        it('returns HTML table with logs', async () => {
            // First create a log entry by opening a door
            await request(app)
                .get('/man.cgi?type=door_on&securitystate=10000000')
                .auth('admin', 'admin');
            
            const res = await request(app)
                .get('/if.cgi?type=go_log_page&page=0')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
            expect(res.type).toContain('html');
            expect(res.text).toContain('<table');
        });
    });

    describe('GET /if.cgi?type=go_user_page', () => {
        it('requires auth for users', async () => {
            const res = await request(app).get('/if.cgi?type=go_user_page');
            expect(res.status).toBe(401);
        });

        it('returns HTML table with users', async () => {
            const res = await request(app)
                .get('/if.cgi?type=go_user_page&page=0')
                .auth('admin', 'admin');
            expect(res.status).toBe(200);
            expect(res.type).toContain('html');
            expect(res.text).toContain('Registered Users');
            expect(res.text).toContain('<table');
        });
    });
});
