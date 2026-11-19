import definition from "@/apps/test-app/app.manifest.json";
import { partnerOrigin } from "./origins";

export interface AppManifest {
  schemaVersion: number;
  id: string;
  name: string;
  origin: string;
  home: string;
  bridgeVersion: number;
  scopes: string[];
}

// A single reviewed release is bundled with the prototype.
export function installedManifest(): AppManifest {
  return { ...definition, origin: partnerOrigin() };
}
