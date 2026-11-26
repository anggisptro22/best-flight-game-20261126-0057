import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier, type DossierCaps } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Ensure output directories exist
mkdirSync(out, { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });

// Copy game and screenshots assets to output directory
cpSync(join(here, "game"), join(out, "game"), { recursive: true });
const screenshotsSrc = join(here, "screenshots");
if (existsSync(screenshotsSrc)) {
  cpSync(screenshotsSrc, join(out, "screenshots"), { recursive: true });
}

// Typed helper for dossier generation capabilities configuration
const dossierCaps: DossierCaps = {
  text_max_bytes: 163840,
  screenshots: {
    max: 4,
    max_bytes: 262144,
  },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Build dossier and write to output dossier.json
const dossier = buildDossier(out, dossierCaps);
writeFileSync(join(out, "dossier.json"), dossier);

console.log(`Copied game/ and screenshots/ to ${out} and wrote dossier.json successfully.`);
