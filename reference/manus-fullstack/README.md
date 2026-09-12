# Original Manus full-stack backend

These files are the backend from the project's first incarnation on the Manus
WebDev platform, kept verbatim for reference. **They are not part of the
build** — nothing in `src/` imports them and they are excluded from typechecking.

| File | Role |
| --- | --- |
| `routers.ts` | tRPC root router: `media.manifest`, `auth.me`, `auth.logout` |
| `mediaAssets.ts` | Mapped hashed File Storage keys to signed URLs for the frontend |
| `mediaAssets.test.ts` | Vitest regression test over the manifest shape |
| `storage.ts` | Manus Forge presigned PUT/GET helpers |
| `db.ts` | Drizzle/MySQL user upsert and lookup |
| `schema.ts` | `users` table backing Manus OAuth |
| `0000_mean_grim_reaper.sql` | Initial migration |
| `STORAGE_VERIFICATION.md` | Verification notes from the File Storage migration |

They depend on platform modules that were never part of the export — a
`server/_core/*` tree (tRPC setup, env, cookies, system router), `@shared/const`
and Manus-issued `BUILT_IN_FORGE_API_*` credentials. Without those, and without
a Manus-hosted MySQL instance and OAuth client, this code cannot run.

The static build replaces all of it: `media.manifest` returned the asset URLs
the page needed, which is now just `src/assets.ts`. The `users` table and auth
existed only because the Manus scaffold shipped with them — the page itself has
no accounts and no protected routes.
