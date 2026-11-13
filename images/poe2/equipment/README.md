Original game inventory artwork belongs to Grinding Gear Games. English and Japanese PoE2DB item records identify the images; each catalog entry records its exact source, item page, base, dimensions and SHA-256.

`python tools/vendor-equipment-images.py` refreshes the catalog and local SVG sheets. Each view embeds the original WebP bytes; original PNG sources are converted losslessly and retain a separate source hash. Identical artwork is stored once. Normal builds make no image-service requests.

Legacy equipment uses the exact matching item/base panel. Guiding Palm's Fire, Cold and Lightning variants resolve to their Heart, Eye and Mind images; the engine's default is Lightning. Rare/custom equipment displays the corresponding base image and is labeled as such. Unknown item text retains its name without a guessed illustration.

`docs/audits/equipment-image-coverage.json` maps calculation-engine items and every editable base to its identified artwork. The build rejects unidentified records.
