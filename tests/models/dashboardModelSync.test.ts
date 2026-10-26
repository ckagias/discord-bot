import fs from 'fs';
import path from 'path';
import { Schema } from 'mongoose';

// The dashboard keeps its own copy of the models it reads and writes. Nothing else ties a copy to the bot's schema,
// so this test fails when a field, its type, requiredness, default, enum or an index differs between the two.

const ROOT = path.join(__dirname, '../..');
const DASHBOARD_MODELS = path.join(ROOT, 'dashboard/lib/models');

// Each side defines the indexes its own queries need, and both processes build them on the same collection.
// An entry here is a difference that is deliberate. The test pins both sides, so any further change still fails.
const INTENTIONAL_INDEX_DIFFERENCES: Record<string, { bot: string[]; dashboard: string[]; reason: string }> = {
    Level: {
        bot: ['[{"guildId":1,"xp":-1},{}]', '[{"userId":1,"guildId":1},{"unique":true}]'],
        dashboard: ['[{"guildId":1,"level":-1,"xp":-1},{}]', '[{"userId":1,"guildId":1},{"unique":true}]'],
        reason: 'The bot ranks by xp, the dashboard leaderboard sorts by level then xp.',
    },
    Shop: {
        bot: ['[{"guildId":1,"enabled":1},{}]', '[{"itemId":1},{"unique":true}]'],
        dashboard: ['[{"guildId":1},{}]', '[{"itemId":1},{"unique":true}]'],
        reason: 'The bot lists enabled items only, the dashboard lists every item.',
    },
};

function describePath(p: any): Record<string, unknown> {
    const out: Record<string, unknown> = { type: p.instance };
    if (p.isRequired) out.required = true;
    const def = p.options?.default;
    if (def !== undefined) out.default = typeof def === 'function' ? `function ${def.name || 'anonymous'}` : def;
    if (p.enumValues?.length) out.enum = [...p.enumValues];
    if (p.options?.unique) out.unique = true;
    if (p.options?.index) out.index = p.options.index;
    if (p.options?.min !== undefined) out.min = p.options.min;
    if (p.options?.max !== undefined) out.max = p.options.max;
    if (p.options?.trim) out.trim = true;
    if (p.options?.lowercase) out.lowercase = true;
    if (p.options?.ref) out.ref = p.options.ref;
    if (p.schema) out.fields = describeSchema(p.schema);
    else if (p.embeddedSchemaType?.instance ?? p.caster?.instance) out.of = p.embeddedSchemaType?.instance ?? p.caster?.instance;
    return out;
}

function describeSchema(schema: any): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(schema.paths).sort()) {
        if (key === '_id' || key === '__v') continue;
        out[key] = describePath(schema.paths[key]);
    }
    return out;
}

function describeIndexes(schema: any): string[] {
    return schema.indexes().map(([fields, options]: any) => JSON.stringify([fields, options])).sort();
}

// Names every field that differs, with both sides, so a failure says what to fix.
function fieldDifferences(bot: any, dashboard: any): string[] {
    const a = describeSchema(bot);
    const b = describeSchema(dashboard);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
        .map(key => `${key}\n  bot:       ${JSON.stringify(a[key])}\n  dashboard: ${JSON.stringify(b[key])}`);
}

// Loads a model file with its own copy of mongoose. The dashboard models are written as `models.X || model(...)`, so
// when both sides share one mongoose (as in CI, where dashboard/node_modules is not installed) the dashboard "copy"
// would just be the bot's model and the comparison would pass without comparing anything.
function loadIsolated(file: string): any {
    let loaded: any;
    jest.isolateModules(() => {
        loaded = require(file);
    });
    return loaded;
}

const dashboardFiles = fs.readdirSync(DASHBOARD_MODELS).filter(f => f.endsWith('.ts')).sort();

describe('dashboard model copies match the bot models', () => {
    test('finds the dashboard model copies', () => {
        expect(dashboardFiles.length).toBeGreaterThan(0);
    });

    test.each(dashboardFiles)('%s has a matching bot schema', file => {
        const name = file.replace(/\.ts$/, '');
        expect(fs.existsSync(path.join(ROOT, 'models', `${name}Schema.ts`))).toBe(true);
    });

    describe.each(dashboardFiles.map(file => file.replace(/\.ts$/, '')))('%s', name => {
        const bot = loadIsolated(path.join(ROOT, 'models', `${name}Schema.ts`));
        const dashboard = loadIsolated(path.join(DASHBOARD_MODELS, `${name}.ts`)).default;

        test('compares two separate models, not the bot model against itself', () => {
            expect(dashboard).not.toBe(bot);
            expect(dashboard.schema).not.toBe(bot.schema);
        });

        test('registers under the same model name, so both use the same collection', () => {
            expect(dashboard.modelName).toBe(bot.modelName);
            expect(dashboard.collection.name).toBe(bot.collection.name);
        });

        test('has the same fields, types, required flags, defaults and enums', () => {
            expect(fieldDifferences(bot.schema, dashboard.schema)).toEqual([]);
        });

        test('has the same indexes, apart from the documented differences', () => {
            const intentional = INTENTIONAL_INDEX_DIFFERENCES[name];
            if (intentional) {
                expect(describeIndexes(bot.schema)).toEqual(intentional.bot);
                expect(describeIndexes(dashboard.schema)).toEqual(intentional.dashboard);
            } else {
                expect(describeIndexes(dashboard.schema)).toEqual(describeIndexes(bot.schema));
            }
        });
    });

    test('every documented index difference still names a dashboard model', () => {
        const names = dashboardFiles.map(file => file.replace(/\.ts$/, ''));
        for (const name of Object.keys(INTENTIONAL_INDEX_DIFFERENCES)) expect(names).toContain(name);
    });
});

describe('the drift detector', () => {
    const base = () => new Schema({
        guildId: { type: String, required: true },
        count: { type: Number, default: 0 },
        mode: { type: String, enum: ['a', 'b'], default: 'a' },
        tags: { type: [String], default: [] },
        rows: { type: [new Schema({ action: { type: String, enum: ['x', 'y'], required: true } })], default: [] },
        seenAt: { type: Date, default: null },
    });

    test('reports nothing for identical schemas', () => {
        expect(fieldDifferences(base(), base())).toEqual([]);
    });

    test.each([
        ['a missing field', (s: Schema) => s.remove('count')],
        ['an extra field', (s: Schema) => s.add({ extra: String })],
        ['a different type', (s: Schema) => s.add({ count: String })],
        ['a lost required flag', (s: Schema) => s.add({ guildId: { type: String } })],
        ['a changed default', (s: Schema) => s.add({ count: { type: Number, default: 1 } })],
        ['a lost enum', (s: Schema) => s.add({ mode: { type: String, default: 'a' } })],
        ['a different array element type', (s: Schema) => s.add({ tags: { type: [Number], default: [] } })],
        ['a lost enum inside a subdocument', (s: Schema) => s.add({
            rows: { type: [new Schema({ action: { type: String, required: true } })], default: [] },
        })],
    ])('reports %s', (_label, change) => {
        const drifted = base();
        change(drifted);
        expect(fieldDifferences(base(), drifted)).not.toEqual([]);
    });

    test('reports a differing index', () => {
        const a = base();
        const b = base();
        a.index({ guildId: 1, count: -1 });
        expect(describeIndexes(a)).not.toEqual(describeIndexes(b));
    });
});
