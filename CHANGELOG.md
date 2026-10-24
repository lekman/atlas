# Changelog

## [0.4.1](https://github.com/lekman/atlas/compare/v0.4.0...v0.4.1) (2026-10-24)


### Bug Fixes

* **deps:** move to Zod 4 and patch body-parser and fast-uri ([#26](https://github.com/lekman/atlas/issues/26)) ([ed50c0e](https://github.com/lekman/atlas/commit/ed50c0e20fcd08561050899b668d0193fc4a4e93))

## [0.4.0](https://github.com/lekman/atlas/compare/v0.3.0...v0.4.0) (2026-10-19)


### Features

* **ui:** open records as a stack of cards in the right column ([#23](https://github.com/lekman/atlas/issues/23)) ([dfc4c78](https://github.com/lekman/atlas/commit/dfc4c78a3f67d0c516bca1495403ee3d59786272))
* **worlds:** workstreams as buoys and space stations ([#25](https://github.com/lekman/atlas/issues/25)) ([6c9881e](https://github.com/lekman/atlas/commit/6c9881e6d5129b1aa38bde7aeea2795612266649))

## [0.3.0](https://github.com/lekman/atlas/compare/v0.2.0...v0.3.0) (2026-10-19)


### Features

* **server:** machine tokens bound to Tailscale nodes and scoped to clients ([#22](https://github.com/lekman/atlas/issues/22)) ([5ba025f](https://github.com/lekman/atlas/commit/5ba025f665b193ac9a2e7244d3d03ba79d30dbd9))
* **server:** MCP endpoint with status, message, work and question tools ([#20](https://github.com/lekman/atlas/issues/20)) ([7179231](https://github.com/lekman/atlas/commit/7179231a54318f376529b7e2774b738e9d0f81d7))

## [0.2.0](https://github.com/lekman/atlas/compare/v0.1.0...v0.2.0) (2026-10-19)


### Features

* **server:** seed an empty database from a JSON file ([#19](https://github.com/lekman/atlas/issues/19)) ([fcb7142](https://github.com/lekman/atlas/commit/fcb71428d16f63e4aeb9bb3011e06d882ef1a609))
* **server:** SQLite database, HTTP API and event stream on the invented dataset ([#15](https://github.com/lekman/atlas/issues/15)) ([c9fe788](https://github.com/lekman/atlas/commit/c9fe788603fa7c6d8ec2c75734a54cf818625f12))
* **web:** serve the Atlas view from the server, kept live by the event stream ([#18](https://github.com/lekman/atlas/issues/18)) ([1f8d062](https://github.com/lekman/atlas/commit/1f8d062b418d7fa2a2281968bf2ddd66c8a0ebd2))

## 0.1.0 (2026-10-19)


### Features

* day and night lighting, for each world to give its own night ([bb40c43](https://github.com/lekman/atlas/commit/bb40c430246d3aa9b5c34e91287fb1484b58ae9b))
* scaffold Atlas with the Astronomer and Mariner worlds ([a6681fa](https://github.com/lekman/atlas/commit/a6681fa9e1e44d240d9b149b8c97788d6acf146b))
* **storybook:** add iPhone Duo, laptop sidebar and laptop full-page sizes ([43a6ee2](https://github.com/lekman/atlas/commit/43a6ee232fb984a8824d7e8e369d3048f049ad57))
* **ui:** double-click a system to fly in, and again to see the whole map ([bb4f186](https://github.com/lekman/atlas/commit/bb4f186b2c541d1b0365acefd2aad5bbd7149885))
* **ui:** plan, day list and details reader stories in Astronomer ([#6](https://github.com/lekman/atlas/issues/6)) ([21669d8](https://github.com/lekman/atlas/commit/21669d84e2c1a9ef85ceeadaee84803a65a87891))
* **worlds:** add the Doctor world ([d4ed985](https://github.com/lekman/atlas/commit/d4ed985abc091c1b962dc4d7ff94e030309088e3))
* **worlds:** add the Gardener world ([f4daec2](https://github.com/lekman/atlas/commit/f4daec245bb17587f1f89d888e2754c8f019c41b))
* **worlds:** add the Samurai world ([a49a228](https://github.com/lekman/atlas/commit/a49a2284d7dd4ae4e4f2cb530aaf61051edb1235))
* **worlds:** add the Woodsman world ([640ed8d](https://github.com/lekman/atlas/commit/640ed8d689f4b1ffb8363d9f4e1495844285814c))
* **worlds:** give Doctor a day and a night shift ([a35dac0](https://github.com/lekman/atlas/commit/a35dac0e694c0aaedf33582546d28c52e669caca))
* **worlds:** give Gardener a night ([e5aa4bb](https://github.com/lekman/atlas/commit/e5aa4bbb1aa9814914f3a1d419772fec4e73fe0c))
* **worlds:** give Mariner a night ([de005b7](https://github.com/lekman/atlas/commit/de005b7cfa447b0de160c2e2d7d4d2400f627210))
* **worlds:** give Samurai a night ([e6c8833](https://github.com/lekman/atlas/commit/e6c8833901985489bca00e4159a11817b419c6db))
* **worlds:** redraw Doctor as a hospital district ([59c01a7](https://github.com/lekman/atlas/commit/59c01a724aa31065779abb23cb82663a01718d39))


### Bug Fixes

* **ci:** pass every shell, workflow and secret check before the first push ([c580d02](https://github.com/lekman/atlas/commit/c580d0278ddd4f9c0ad3cf8bd09e6be4968dcfef))
* close the gaps the pre-push review found ([7acad3e](https://github.com/lekman/atlas/commit/7acad3e2831f8c5891da68f5f6e8304f698251ab))
* **dependabot:** Bump actions/upload-artifact ([#3](https://github.com/lekman/atlas/issues/3)) ([3a8540d](https://github.com/lekman/atlas/commit/3a8540d74c01b7e59b350c51b168f0a11d508b97))
* **dependabot:** Bump the vitest group across 1 directory with 3 updates ([#1](https://github.com/lekman/atlas/issues/1)) ([3be68f2](https://github.com/lekman/atlas/commit/3be68f2944a06fc7eeceeea2c294d9bee8806ed3))
* **hooks:** check every file when there is no main to compare with ([b7b4402](https://github.com/lekman/atlas/commit/b7b44022e54d6648e881f1e182d413e274a75198))
* **scripts:** keep the client-content self-test in its own repository ([80d0e63](https://github.com/lekman/atlas/commit/80d0e63b2b906e6ece00a21f0d1f3594d7992915))
* **ui:** fit the map clear of the readout and the log ([4863204](https://github.com/lekman/atlas/commit/4863204a3f1f867b100e9bb4d822c3d081681023))
* **ui:** give the corner readout its own panel in every world ([d975530](https://github.com/lekman/atlas/commit/d9755300203e68e11eb801263b094074ef65793a))
* **ui:** keep the log to three fixed lines so the map stays clear of it ([008d55e](https://github.com/lekman/atlas/commit/008d55e2b3cf57034b3fac7dc1b89f86ad016c95))


### Miscellaneous Chores

* **release:** make the first release 0.1.0 ([#9](https://github.com/lekman/atlas/issues/9)) ([9c7b701](https://github.com/lekman/atlas/commit/9c7b70134994dbaaa0df156430473cba8356d203))
