import {parseNamedPlans, namedPlanKey, validateComparison, ENGINE_VERSION} from './simulator-model.js?v=fdda84f09b';
import {digest} from './simulator-sync-crypto.js?v=6d43b0469b';

export const JOURNAL_KEY = 'poe2-simulator:comparison-journal:v1';
export const JOURNAL_LIMIT = 40;
export function canonical(value, depth = 0) {
  if (depth > 80) throw Error('SYNC_FORMAT');
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => canonical(v, depth + 1)).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], depth + 1)).join(',') + '}';
}
export function comparisonConditions(source) {
  const condition = saved => ({level:saved.request.character.level, questPoints:saved.questPoints,
    className:saved.request.character.class_name, ascendancy:saved.request.character.ascendancy_name || '',
    enemy:source.enemy, configuration:saved.request.config_inputs || {}, tree:saved.request.tree_version || '0_5',
    weaponSet:saved.weaponSets?.active || 1,
    mainSkill:saved.request.socket_groups?.[saved.request.main_socket_group || 0]?.gems?.[0]?.skill_id || ''});
  const a = condition(source.a), b = condition(source.b);
  return {a, b, differences:Object.keys(a).filter(key => canonical(a[key]) !== canonical(b[key]))};
}
export function parseJournal(text, presets) {
  if (!text) return [];
  if (text.length > 10000000) throw Error('JOURNAL_CAPACITY');
  const data = JSON.parse(text), ids = new Set();
  if (data?.version !== 1 || !Array.isArray(data.records) || data.records.length > JOURNAL_LIMIT) throw Error('JOURNAL_FORMAT');
  return data.records.map(record => {
    if (!record || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id || '') || ids.has(record.id)
      || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 60
      || !Number.isFinite(Date.parse(record.createdAt)) || record.kind !== 'calculation'
      || typeof record.engine !== 'string' || record.engine.length > 30
      || typeof record.dataVersion !== 'string' || record.dataVersion.length > 30) throw Error('JOURNAL_FORMAT');
    ids.add(record.id);
    // Keep frozen values readable after engine updates; reopening remains strict.
    const originalA=record.source?.a?.engine,originalB=record.source?.b?.engine;
    if(!/^\d+\.\d+\.\d+$/.test(originalA||'')||!/^\d+\.\d+\.\d+$/.test(originalB||''))throw Error('JOURNAL_FORMAT');
    const source = validateComparison({...record.source,a:{...record.source.a,engine:ENGINE_VERSION},b:{...record.source.b,engine:ENGINE_VERSION}});
    source.a.engine=originalA;source.b.engine=originalB;
    const preset = presets.find(p => p.id === source.a.preset);
    if (!preset || source.a.request.character.class_name !== preset.class || source.b.request.character.class_name !== preset.class) throw Error('JOURNAL_FORMAT');
    if (!record.snapshot || !Array.isArray(record.snapshot.rows) || record.snapshot.rows.length > 40
      || JSON.stringify(record.snapshot).length > 40000
      || record.snapshot.rows.some(row=>!row||['id','title','a','b','delta'].some(key=>typeof row[key]!=='string'||row[key].length>200))) throw Error('JOURNAL_FORMAT');
    return {...record, source, preset:preset.id, conditions:comparisonConditions(source)};
  });
}
export function makeJournalRecord(source, snapshot, name, runtime, presets) {
  const record = {id:crypto.randomUUID(), name:name.trim(), createdAt:new Date().toISOString(), kind:'calculation',
    source:structuredClone(source), snapshot:structuredClone(snapshot), engine:runtime.release || ENGINE_VERSION,
    dataVersion:runtime.dataVersion, preset:source.a.preset};
  return parseJournal(JSON.stringify({version:1, records:[record]}), presets)[0];
}
export function relevantNotices(notices, records, seen = {}) {
  const present = new Set(records.filter(r => !r.deleted && r.kind === 'plan').map(r => r.preset));
  return notices.filter(notice => notice.presets.some(p => present.has(p))).map(notice => ({...notice, unread:seen[notice.id] !== notice.revision}));
}
export function savedBuildHeaders(storage,presets){
  return presets.flatMap(preset=>{
    const raw=storage.getItem(namedPlanKey(preset.id));if(!raw)return [];
    if(raw.length>6000000)throw Error('SYNC_FORMAT');
    const data=JSON.parse(raw);
    if(data.version!==1||!Array.isArray(data.plans)||data.plans.length>12)throw Error('SYNC_FORMAT');
    return data.plans.map(entry=>{
      if(typeof entry?.name!=='string'||entry.name.length>40||entry.saved?.preset!==preset.id||entry.saved?.request?.character?.class_name!==preset.class)throw Error('SYNC_FORMAT');
      return {kind:'plan',preset:preset.id,value:{name:entry.name,saved:{engine:entry.saved.engine,calculation:entry.saved.calculation}}};
    });
  });
}

export function collectSyncRecords(storage, presets) {
  const records = Object.create(null), expected = new Map();
  for (const preset of presets) {
    const key = namedPlanKey(preset.id), text = storage.getItem(key);
    expected.set(key, text);
    for (const value of parseNamedPlans(text, preset.id)) {
      if (value.saved.request.character.class_name !== preset.class) throw Error('SYNC_FORMAT');
      const record = {kind:'plan', preset:preset.id, id:value.id, value};
      records[recordKey(record)] = record;
    }
  }
  const text = storage.getItem(JOURNAL_KEY);
  expected.set(JOURNAL_KEY, text);
  for (const value of parseJournal(text, presets)) {
    const record = {kind:'journal', preset:value.preset, id:value.id, value};
    records[recordKey(record)] = record;
  }
  return {records, expected};
}
export const recordKey = r => `${r.kind}:${r.preset}:${r.id}`;
export function validateVault(value, presets) {
  if (!value || value.version !== 1 || !value.records || typeof value.records !== 'object'
    || Array.isArray(value.records) || Object.keys(value.records).length > 2000
    || value.label !== undefined && (typeof value.label !== 'string' || value.label.length > 40)) throw Error('SYNC_FORMAT');
  const records = Object.create(null);
  for (const [key, record] of Object.entries(value.records)) {
    if (!record || !['plan','journal'].includes(record.kind) || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id || '')
      || !presets.some(p => p.id === record.preset) || recordKey(record) !== key) throw Error('SYNC_FORMAT');
    if (record.deleted === true) { records[key] = {kind:record.kind, preset:record.preset, id:record.id, deleted:true}; continue; }
    if (record.kind === 'plan') {
      const plans = parseNamedPlans(JSON.stringify({version:1, plans:[record.value]}), record.preset);
      if (plans[0].id !== record.id || plans[0].saved.request.character.class_name !== presets.find(p => p.id === record.preset).class) throw Error('SYNC_FORMAT');
      records[key] = {...record, value:plans[0]};
    } else {
      const journal = parseJournal(JSON.stringify({version:1, records:[record.value]}), presets)[0];
      if (journal.id !== record.id || journal.preset !== record.preset) throw Error('SYNC_FORMAT');
      records[key] = {...record, value:journal};
    }
  }
  return {version:1, records, ...(value.label ? {label:value.label} : {})};
}
export async function recordHashes(records) {
  return Object.fromEntries(await Promise.all(Object.entries(records).map(async ([key, record]) => [key, record?.deleted ? '-' : await digest(canonical(record))])));
}
function tombstone(key) {
  const [kind, preset, id] = key.split(':');
  return {kind, preset, id, deleted:true};
}
// Three-way reconciliation never selects a conflicting edit by clock time.
export async function mergeVault(local, remote, baseline = {}, {newId = () => crypto.randomUUID(), suffix = '（競合コピー）'} = {}) {
  const lh = await recordHashes(local), rh = await recordHashes(remote), records = Object.create(null), conflicts = [];
  const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(baseline)]);
  for (const key of keys) {
    const l = local[key], r = remote[key], before = baseline[key] || '-', a = lh[key] || '-', b = rh[key] || '-';
    const lc = a !== before, rc = b !== before;
    if (a === b) { records[key] = r || l || tombstone(key); continue; }
    if (lc && rc || l && !l.deleted && r?.deleted && !baseline[key]) {
      records[key] = r?.deleted || !l ? tombstone(key) : r || tombstone(key);
      const survivor = !l || l.deleted ? r : l;
      if (survivor && !survivor.deleted) {
        const content = record => record.kind === 'plan' ? record.value.saved : {
          source:record.value.source,snapshot:record.value.snapshot,engine:record.value.engine,dataVersion:record.value.dataVersion};
        const sameContent = candidate => candidate && !candidate.deleted && candidate.kind === survivor.kind
          && candidate.preset === survivor.preset && canonical(content(candidate)) === canonical(content(survivor));
        // Reconciliation after a lost network response reuses an already-preserved copy.
        if (!Object.entries(remote).some(([id, v]) => id !== key && sameContent(v))) {
          const copy = structuredClone(survivor), id = newId();
          copy.id = id; copy.value.id = id;
          copy.value.name = copy.value.name.slice(0, (copy.kind === 'plan' ? 40 : 60) - suffix.length) + suffix;
          records[recordKey(copy)] = copy;
          conflicts.push(recordKey(copy));
        }
      }
      continue;
    }
    records[key] = lc ? l || tombstone(key) : r || tombstone(key);
  }
  return {records, conflicts};
}
export function prepareSyncWrites(records, presets) {
  const writes = new Map(), journals = [];
  for (const preset of presets) {
    const plans = Object.values(records).filter(r => !r.deleted && r.kind === 'plan' && r.preset === preset.id).map(r => r.value);
    // Enforce the same limits as ordinary saves. Never silently discard an overflow.
    parseNamedPlans(JSON.stringify({version:1, plans}), preset.id);
    writes.set(namedPlanKey(preset.id), plans.length ? JSON.stringify({version:1, plans}) : null);
  }
  for (const record of Object.values(records)) if (!record.deleted && record.kind === 'journal') journals.push(record.value);
  journals.sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  parseJournal(JSON.stringify({version:1, records:journals}), presets);
  writes.set(JOURNAL_KEY, journals.length ? JSON.stringify({version:1, records:journals}) : null);
  return writes;
}
export function applySyncRecords(storage, records, expected, presets) {
  const writes = prepareSyncWrites(records, presets);
  if ([...expected].some(([key, value]) => storage.getItem(key) !== value)) return false;
  const changed = [...writes].filter(([key, value]) => storage.getItem(key) !== value), done = [];
  try {
    for (const [key, value] of changed) {
      value === null ? storage.removeItem(key) : storage.setItem(key, value);
      done.push(key);
    }
  } catch (cause) {
    for (const key of done.reverse()) {
      const previous = expected.get(key);
      previous === null ? storage.removeItem(key) : storage.setItem(key, previous);
    }
    throw cause;
  }
  return true;
}
