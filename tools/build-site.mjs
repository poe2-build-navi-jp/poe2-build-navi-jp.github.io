// Rebuilds every generated page in the order the tools expect (`npm run build`).
// Needs ImageMagick (`convert`) for generate-image-assets and a local Chromium for the OG images
// (PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM_PATH). Each step runs in its own process because the
// generators do their work when imported.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {BUILD_STEPS as steps} from './build-steps.mjs';
const root=resolve(import.meta.dirname,'..');
for(const step of steps){
 console.log(`> ${step}`);
 execFileSync(process.execPath,[resolve(root,'tools',`${step}.mjs`)],{cwd:root,stdio:'inherit',env:process.env});
}
