import { describe, expect, it } from "vitest";
import { getMediaManifest } from "./mediaAssets";

describe("media asset manifest", () => {
  it("returns every player asset through managed File Storage paths", async () => {
    const manifest = await getMediaManifest();

    expect(manifest.provider).toBe("manus-file-storage");
    expect(manifest.stems).toHaveLength(8);
    expect(manifest.assets.oldMaster).toMatch(/^\/manus-storage\//);
    expect(manifest.assets.newMaster).toMatch(/^\/manus-storage\//);
    expect(manifest.assets.oldMasterSource).toMatch(/\.wav$/);
    expect(manifest.assets.newMasterSource).toMatch(/\.wav$/);
    expect(manifest.assets.stemsZip).toMatch(/\.zip$/);

    for (const stem of manifest.stems) {
      expect(stem.file).toMatch(/^\/manus-storage\/.+\.mp3$/);
    }
  });
});
