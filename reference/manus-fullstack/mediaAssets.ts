import { storageGet } from "./storage";

const STORAGE_KEYS = {
  logo: "phantom-logo-white_2b15fdb0.webp",
  background: "london-background-texture_bf986f30.webp",
  oldMaster: "old_master_bb4d01c0.mp3",
  newMaster: "new_master_1dec4f5f.mp3",
  oldMasterSource: "1-06PhantomOfTheOpera_9210ccfa.wav",
  newMasterSource:
    "POTO_OriginalAlbumRemix_07_ThePhantomOfTheOpera_100726_M11b_MASTERED_48kHz_24bit_593a8b46.wav",
  stemsZip: "GroupedStems-ForWebsite_6beea406.zip",
  christine_vocal: "christine_vocal_1dcc1373.mp3",
  phantom_vocal: "phantom_vocal_1c731948.mp3",
  organ: "organ_872c84c9.mp3",
  guitar: "guitar_65cf68bc.mp3",
  bass: "bass_ee97b15e.mp3",
  kick: "kick_c721736e.mp3",
  perc: "perc_f6911ae1.mp3",
  orchestra: "orchestra_272cb199.mp3",
} as const;

const STEM_METADATA = [
  { id: "christine_vocal", name: "Christine Vocal", group: "Vocals" },
  { id: "phantom_vocal", name: "Phantom Vocal", group: "Vocals" },
  { id: "organ", name: "Organ", group: "Keys" },
  { id: "guitar", name: "Guitar", group: "Guitar" },
  { id: "bass", name: "Bass", group: "Low End" },
  { id: "kick", name: "Kick", group: "Drums" },
  { id: "perc", name: "Percussion", group: "Drums" },
  { id: "orchestra", name: "Orchestra", group: "Orchestra" },
] as const;

export async function getMediaManifest() {
  const entries = await Promise.all(
    Object.entries(STORAGE_KEYS).map(async ([name, key]) => {
      const stored = await storageGet(key);
      return [name, stored.url] as const;
    }),
  );
  const urls = Object.fromEntries(entries) as Record<keyof typeof STORAGE_KEYS, string>;

  return {
    provider: "manus-file-storage" as const,
    assets: {
      logo: urls.logo,
      background: urls.background,
      oldMaster: urls.oldMaster,
      newMaster: urls.newMaster,
      oldMasterSource: urls.oldMasterSource,
      newMasterSource: urls.newMasterSource,
      stemsZip: urls.stemsZip,
    },
    stems: STEM_METADATA.map(stem => ({
      ...stem,
      file: urls[stem.id],
    })),
  };
}

export type MediaManifest = Awaited<ReturnType<typeof getMediaManifest>>;
