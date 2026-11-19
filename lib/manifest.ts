import definition from "@/apps/test-app/sides.app.json";

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
export const manifest: AppManifest = definition;
