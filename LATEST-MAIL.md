# Dingsty Mail — current source passport

Founder-confirmed Mail identity, 18 November 2026. This is **Dingsty Mail / Paket**, the five-step letter tool, distinct from Dingsty Phone / Hold the Line (`SUPERMAGIC1111/igotya-backup`, PR1).

- Published reference identified by founder: https://supermagic1111.github.io/dingsty-demo/paket-test-8f3c9a2e/
- Confirmed baseline: `7a93a29cbc8fca9ae9fba40f9275e0978b319cb2`, entry `paket-test-8f3c9a2e/index.html`, blob `2d1ce4d59fc2d1069fa4fd66e8b4843fb6b45457`.
- Latest requested header revision, exact tested application: `e84101aeb7af1c531942e3062f14d12d2b20084c` (header visual revision `92742fd` plus explicit Mail browser title), branch `codex/dingsty-mail-progress-20261118`.
- The original logo image itself includes **Paket inside its bubble**. Preserve the exact embedded image. The hidden legacy `<small>paket</small>` is redundant; exposing it adds a duplicate badge. Do not replace this logo with a plain historical wordmark.
- Header change only: progress dots align with card content at every step; counter and language are grouped to the right, Back remains accessible; language has a 44px target. Original card, typography, colors, eight script blocks, logo image and rollover animations remain unchanged.
- Verification: `evidence/two-demo-sprint/results.json` — 172 PASS, 0 FAIL at 1280/390/320px and reduced motion, including all five steps, Back, restart, language switching, rolling-letter hover and asset/error checks. `protected-source.json` verifies only the isolated header CSS and explicit Mail page title differ.
- Dashboard screenshot: `evidence/two-demo-sprint/after-1280.png`; full page: `mail-dashboard-1280.png`; mobile: `after-390.png`, `after-320.png`.
- This revision is saved for review, **not merged or deployed**. The published reference remains the baseline until a separately authorized release. Founder approved identifying the baseline, not every future revision.

Canonical HQ reference index: `SUPERMAGIC1111/aigotya-hq:brand/FACTORY-DESIGN-REFERENCES.json`. Always fetch current refs and read the Mail/Phone passport first; dated SHA checkpoints are not automatically live heads. Historical originals remain historical.
