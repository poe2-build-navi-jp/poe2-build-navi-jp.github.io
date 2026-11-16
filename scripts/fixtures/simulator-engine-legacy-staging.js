// Diagnostic only: the published pre-fix staging path, used for A/B startup evidence.
export async function stageVerifiedData(engine,data) {
  const files=data.files;
  for(const [path,content] of Object.entries(files))engine.stageDataFile(path,content);
  engine.initStagedData();
  return Object.fromEntries(Object.entries(files).filter(([path])=>path.includes('passive_tree')));
}
export function reserveStartupArena() {}
