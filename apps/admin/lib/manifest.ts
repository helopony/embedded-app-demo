import definition from "./installed-app.json";
import { partnerOrigin } from "./origins";

export type AppManifest = typeof definition;

// The admin keeps a snapshot of the partner manifest it approved at installation.
export function installedManifest(): AppManifest {
  return { ...definition, origin: partnerOrigin() };
}
