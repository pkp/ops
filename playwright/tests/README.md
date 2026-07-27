# OPS Playwright specs

One spec file (or a small set) per feature, named after the feature, **flat** —
no subfolder taxonomy until ~25–30 specs exist and the natural groupings are
obvious, at which point clusters emerge as one refactor commit.

Specs here import `../support/fixtures.js`. The app-agnostic infrastructure
(base fixtures, shared POMs, the bootstrap seed and the login smoke) lives in
`lib/pkp/playwright/` and is shared with OJS and OMP; a feature suite belongs
here even when the scenario it implements is common to all three apps.

Write OPS specs in OPS's own vocabulary and roles: preprint (not article),
Moderator (not section editor), the single Production stage, "Post the
preprint" (not Publish). Anything a spec says about peer review, copyediting,
issues or subscriptions is absent here by definition — see `APP-GLOSSARY.md`.
