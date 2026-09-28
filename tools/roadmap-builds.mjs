// Which builds get a leveling roadmap diagram (desktop + mobile SVG, page figure, image
// structured data, sitemap image). Every listed (non-draft) build gets one.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const builds = JSON.parse(await readFile(resolve(root, "data/builds.json"), "utf8"));

export const ROADMAP_BUILD_IDS = builds.filter((build) => build.status !== "draft").map((build) => build.id);

// These builds use the English roadmap OG image rendered by generate-image-assets.mjs.
// Every other page's OG image comes from its Japanese title via generate-og-images.mjs.
export const ROADMAP_OG_BUILD_IDS = ["ranger-ice-shot-deadeye", "witch-minion-infernalist", "warrior-shield-wall-smith", "monk-whirling-assault", "witch-ed-contagion-lich"];
