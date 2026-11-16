// Use the pinned engine's byte-staging API and release parsed pack text before indexing.
const encoder = new TextEncoder();
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const invalid = () => {throw Error('ENGINE_DATA_INTEGRITY');};
export async function stageVerifiedData(engine, data, {digest = sha256, yieldControl = () => new Promise(resolve=>setTimeout(resolve,0)), onProgress = () => {}} = {}) {
  const files = data?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files) || typeof files['manifest.json'] !== 'string') invalid();
  let manifest; try {manifest = JSON.parse(files['manifest.json']);} catch {invalid();}
  const digests = manifest.files;
  if (!digests || typeof digests !== 'object' || Array.isArray(digests) || manifest.poe_version !== data.version) invalid();
  const paths = Object.keys(files);
  if (Object.keys(digests).some(path=>!Object.hasOwn(files,path) || !/^[a-f0-9]{64}$/.test(digests[path]))) invalid();
  const kept = Object.create(null);
  async function stage(path) {
    if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith('/') || path.split('/').some(part=>part==='..'||!part) || typeof files[path] !== 'string') invalid();
    const text = files[path], bytes = encoder.encode(text);
    if (Object.hasOwn(digests,path) && await digest(bytes) !== digests[path]) invalid();
    engine.stageDataBytes(path,bytes);
    if (path.includes('passive_tree')) kept[path] = text;
    delete files[path];
  }
  for (let index=0;index<paths.length;index++) {
    await stage(paths[index]);
    onProgress(index+1,paths.length);
    // Let temporary buffers and large strings leave the JS stack before the WASM index build.
    await yieldControl();
  }
  // Every inventoried file was hashed above; schema/inventory checks still run inside the engine.
  engine.initStagedDataVerified();
  return kept;
}
