import fs from "fs-extra";
import { getManifest } from "~/manifest";
import { log } from "~/utils";
import { r } from "../vite.config";

export async function writeManifest() {
  await fs.writeJSON(r("extension/manifest.json"), await getManifest(), { spaces: 2 });
  log("PRE", "write manifest.json");
}

void writeManifest();
