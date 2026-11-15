import { api } from '@appdeploy/client';
import { newSyncCode, syncKeys, encryptVault, decryptVault } from './vault.js';
import './styles.css';

const operations = new Set(['create', 'read', 'write', 'revoke']);
const permittedParents = new Set([
  'https://poe2-build-navi-jp.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);
async function call(operation: string, body: unknown) {
  if (!operations.has(operation)) throw Error('SYNC_INPUT');
  const request = body as Record<string, unknown>;
  if (operation === 'write' && typeof request.ciphertext === 'string' &&
      request.ciphertext.length > 600000) {
    const ciphertext = request.ciphertext;
    const hash = await sha256(JSON.stringify([request.revision, request.iv, ciphertext]));
    const upload = {
      room: request.room,
      token: request.token,
      revision: request.revision,
      requestId: request.requestId,
      iv: request.iv,
      hash,
      count: Math.ceil(ciphertext.length / 150000),
    };
    const started = (await api.post('/api/v1/upload-start', upload)).data;
    if (started.committed) return { revision: started.revision };
    for (let index = 0; index < upload.count; index++) {
      await api.post('/api/v1/upload-chunk', {
        ...upload,
        index,
        ciphertext: ciphertext.slice(index * 150000, (index + 1) * 150000),
      });
    }
    return (await api.post('/api/v1/upload-commit', upload)).data;
  }
  const data = (await api.post('/api/v1/' + operation, body)).data;
  if (operation !== 'read' || !data.envelope?.chunked) return data;
  const envelope = data.envelope;
  if (!Number.isInteger(envelope.count) || envelope.count < 1 || envelope.count > 19)
    throw Error('SYNC_INPUT');
  let ciphertext = '';
  for (let index = 0; index < envelope.count; index++) {
    const chunk = (await api.post('/api/v1/read-chunk', {
      ...request,
      revision: data.revision,
      index,
    })).data;
    if (chunk.revision !== data.revision || typeof chunk.ciphertext !== 'string' ||
        chunk.ciphertext.length > 150000) throw Error('SYNC_INPUT');
    ciphertext += chunk.ciphertext;
  }
  if (ciphertext.length > 2800000 || await sha256(ciphertext) !== envelope.hash)
    throw Error('SYNC_INPUT');
  // Reject a snapshot superseded or revoked while its pieces were in flight.
  const latest = (await api.post('/api/v1/read', { ...request, revision: data.revision })).data;
  if (!latest.unchanged) throw { status: 409 };
  return { revision: data.revision, envelope: { iv: envelope.iv, ciphertext } };
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function apiFailure(cause: unknown) {
  const value = cause as {
    response?: { status?: number; data?: { message?: string; error?: string } };
    status?: number;
  };
  return {
    status: value.response?.status || value.status || 503,
    message: 'SYNC_SERVICE_ERROR',
  };
}

if (window.parent !== window) {
  document.body.hidden = true;
  window.addEventListener('message', async event => {
    if (event.source !== window.parent || !permittedParents.has(event.origin))
      return;
    const request = event.data;
    if (
      request?.channel !== 'poe2-sync-v1' ||
      typeof request.id !== 'string' ||
      request.id.length > 80
    )
      return;
    const respond = (data: unknown) =>
      window.parent.postMessage(
        { channel: 'poe2-sync-v1', id: request.id, ...(data as object) },
        event.origin
      );
    if (request.operation === 'ping') {
      respond({ ok: true, data: { ready: true } });
      return;
    }
    if (
      !operations.has(request.operation) ||
      JSON.stringify(request.body || {}).length > 2810000
    ) {
      respond({ ok: false, error: { status: 400 } });
      return;
    }
    try {
      respond({ ok: true, data: await call(request.operation, request.body) });
    } catch (cause) {
      respond({ ok: false, error: apiFailure(cause) });
    }
  });
} else {
  const $ = (id: string) => document.getElementById(id)!;
  const input = (id: string) => $(id) as HTMLInputElement;
  let code = '',
    keys: Awaited<ReturnType<typeof syncKeys>> | null = null,
    revision = 0;
  let vault: {
    version: number;
    records: Record<string, unknown>;
    label?: string;
  } = { version: 1, records: {} };
  let deleteReady = false;
  const status = (message: string) => {
    $('status').textContent = message;
  };
  const busy = async (action: () => Promise<void>) => {
    document.querySelectorAll('button').forEach(button => {
      button.disabled = true;
    });
    try {
      await action();
    } catch (cause) {
      const response = apiFailure(cause);
      status(
        response.status === 403
          ? '接続できません。コードが違うか、保管庫が無効化されています。'
          : '接続・保存に失敗しました。入力内容を残しています。もう一度お試しください。'
      );
    } finally {
      document.querySelectorAll('button').forEach(button => {
        button.disabled = false;
      });
    }
  };
  function render() {
    $('connected').hidden = !keys;
    $('setup').hidden = !!keys;
    input('recovery').value = code;
    input('label').value = vault.label || '';
    $('records').textContent =
      `${Object.values(vault.records || {}).filter(record => record && !(record as { deleted?: boolean }).deleted).length}件の保存データ`;
  }
  async function read() {
    if (!keys) return;
    const data = await call('read', { room: keys.room, token: keys.token });
    vault = data.envelope
      ? await decryptVault(data.envelope, keys)
      : { version: 1, records: {} };
    if (
      vault.version !== 1 ||
      !vault.records ||
      typeof vault.records !== 'object'
    )
      throw Error('Invalid snapshot');
    revision = data.revision;
    render();
  }
  async function connect(value: string, create: boolean) {
    const next = await syncKeys(value);
    if (create) await call('create', { room: next.room, token: next.token });
    const old = keys;
    keys = next;
    try {
      await read();
    } catch (cause) {
      keys = old;
      throw cause;
    }
    code = value;
    sessionStorage.setItem('poe2-sync-manager-code', code);
    render();
    status(
      create
        ? '保管庫を作成しました。接続コードを安全な場所に控えてください。'
        : '保管庫に接続しました。'
    );
  }
  $('create').addEventListener(
    'click',
    () => void busy(() => connect(newSyncCode(), true))
  );
  $('join').addEventListener(
    'click',
    () => void busy(() => connect(input('code').value.trim(), false))
  );
  $('refresh').addEventListener(
    'click',
    () =>
      void busy(async () => {
        await read();
        status('最新の保存データを読み込みました。');
      })
  );
  $('save').addEventListener(
    'click',
    () =>
      void busy(async () => {
        if (!keys) return;
        const label = input('label').value.trim();
        if (!label || label.length > 40) {
          status('保管庫の名前は1〜40文字で入力してください。');
          return;
        }
        // Read-before-write and revision checks also protect edits from the simulator.
        await read();
        const next = { ...vault, label };
        const envelope = await encryptVault(next, keys);
        const data = await call('write', {
          room: keys.room,
          token: keys.token,
          revision,
          requestId: crypto.randomUUID(),
          ...envelope,
        });
        vault = next;
        revision = data.revision;
        render();
        status('保管庫の名前を暗号化して保存しました。');
      })
  );
  $('disconnect').addEventListener('click', () => {
    keys = null;
    code = '';
    sessionStorage.removeItem('poe2-sync-manager-code');
    render();
    status('この画面の接続を解除しました。保管庫は残っています。');
  });
  $('revoke').addEventListener('click', () => {
    if (!deleteReady) {
      deleteReady = true;
      $('revoke').textContent = 'もう一度押して全端末の接続を無効にする';
      status(
        '端末内の保存構成は残ります。この保管庫の暗号文を削除し、接続コードを無効にします。'
      );
      return;
    }
    void busy(async () => {
      if (!keys) return;
      await call('revoke', { room: keys.room, token: keys.token });
      keys = null;
      code = '';
      sessionStorage.removeItem('poe2-sync-manager-code');
      deleteReady = false;
      $('revoke').textContent = '保管庫を無効化する';
      render();
      status('保管庫を無効化しました。古い接続コードは使えません。');
    });
  });
  render();
  const remembered = sessionStorage.getItem('poe2-sync-manager-code');
  if (remembered) void busy(() => connect(remembered, false));
}
