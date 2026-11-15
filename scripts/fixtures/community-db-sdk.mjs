export const tables = new Map();
export const fault = {before: null, after: null};
const table = (name, state = tables) => {
  if (!state.has(name)) state.set(name, new Map());
  return state.get(name);
};
function fail(code) { throw Object.assign(new Error(code), {code}); }
export const isAppDatabaseError = cause => typeof cause?.code === 'string' && cause.code.startsWith('AppDatabase');
function handle(kind, name, entries, options = {}) {
  let promise;
  const operation = {kind, name, entries, options, consumed: false};
  const consume = () => promise ||= (operation.consumed = true, execute([operation], false).then(result => result[0]));
  return Object.assign(operation, {then: (...args) => consume().then(...args), catch: (...args) => consume().catch(...args), finally: (...args) => consume().finally(...args)});
}
async function execute(operations, atomic) {
  if (fault.before) {const code = fault.before; fault.before = null; fail(code);}
  const state = structuredClone(tables);
  const targets = new Set();
  const results = operations.map(operation => operation.entries.map(entry => {
    const id = typeof entry === 'string' ? entry : entry.id;
    const target = operation.name + '/' + id;
    if (targets.has(target)) fail('AppDatabaseInvalidInput');
    targets.add(target);
    const records = table(operation.name, state), previous = records.get(id);
    if (operation.kind === 'add') {
      if (previous) {if (atomic) fail('AppDatabaseDuplicateId'); return null;}
      const value = structuredClone(entry); delete value.id; records.set(id, value); return id;
    }
    if (operation.kind === 'delete') return records.delete(id);
    if (!previous || Object.entries(entry.if || {}).some(([key, value]) => JSON.stringify(previous[key]) !== JSON.stringify(value))) {
      if (atomic) fail('AppDatabaseConditionFailed'); return false;
    }
    const value = operation.options.patch ? {...previous} : {};
    for (const [key, item] of Object.entries(entry.record)) {
      if (item === undefined) delete value[key]; else value[key] = structuredClone(item);
    }
    records.set(id, value); return true;
  }));
  tables.clear(); for (const [name, records] of state) tables.set(name, records);
  if (fault.after) {const code = fault.after; fault.after = null; fail(code);}
  return results;
}
export const db = {
  tx: {
    add: (name, entries) => handle('add', name, entries),
    update: (name, entries, options) => handle('update', name, entries, options),
    delete: (name, entries) => handle('delete', name, entries),
  },
  transact: operations => {
    if (operations.some(operation => operation.consumed)) fail('AppDatabaseInvocationMismatch');
    operations.forEach(operation => {operation.consumed = true;});
    return execute(operations, true);
  },
  get: async (name, ids) => ids.map(id => structuredClone(table(name).get(id) || null)),
  list: async (name, options = {}) => {
    const entries = [...table(name)], start = Number(options.nextToken || 0), end = start + options.limit;
    return {items: entries.slice(start, end).map(([id, value]) => ({id, ...structuredClone(value)})), ...(entries.length > end ? {nextToken: String(end)} : {})};
  },
};
export const json = (data, statusCode = 200) => ({statusCode, body: JSON.stringify(data)});
export const error = (code, statusCode) => json({error: code}, statusCode);
export const router = routes => async ({operation, body}) => routes['POST /api/public/' + operation][0]({body});
