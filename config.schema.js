// Zod schema for config.json validation
const { z } = require('zod');

const BoardSchema = z.object({
    name: z.string(),
    version: z.string(),
    securityState: z.string().regex(/^[01]{8}$/),
    serial: z.string(),
    mac: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/),
    modernoApiUrl: z.string().url().optional(),
    modernoApiPort: z.string().optional(),
    httpPort: z.string().optional()
});

const DoorSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    status: z.enum(['closed', 'open', 'locked', 'unknown'])
});

const UserSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    card: z.string().optional().default(''),
    pin: z.string().optional().default(''),
    type: z.string().optional().default('Normal'),
    active: z.boolean().optional().default(true),
    bypass: z.string().optional().default('1')
});

const LogSchema = z.object({
    id: z.string(),
    timestamp: z.string().datetime(),
    user: z.string(),
    action: z.string(),
    door: z.string(),
    card: z.string().optional()
});

const NetworkSchema = z.object({
    ip: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).optional().default('192.168.0.66'),
    mask: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).optional().default('255.255.255.0'),
    gateway: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).optional().default('192.168.0.1')
});

const ConfigSchema = z.object({
    board: BoardSchema,
    doors: z.array(DoorSchema),
    users: z.array(UserSchema),
    logs: z.array(LogSchema).optional().default([]),
    network: NetworkSchema.optional()
});

function validateConfig(config) {
    try {
        return { valid: true, data: ConfigSchema.parse(config) };
    } catch (error) {
        return { valid: false, errors: error.errors };
    }
}

module.exports = { ConfigSchema, validateConfig };
