# Changelog

## [0.12.0](https://github.com/lekman/atlas/compare/v0.11.0...v0.12.0) (2026-10-25)


### Features

* **worlds:** workstreams as planets, and the log keeps the last day ([#64](https://github.com/lekman/atlas/issues/64)) ([edb76c4](https://github.com/lekman/atlas/commit/edb76c499e001ced316a45dc9c71b4b373007353))


### Bug Fixes

* **dependabot:** Bump the all-actions group with 4 updates ([#62](https://github.com/lekman/atlas/issues/62)) ([e31cb55](https://github.com/lekman/atlas/commit/e31cb5517db7a533d7f280a380a21810628efb60))
* **dependabot:** Bump the storybook group with 5 updates ([#59](https://github.com/lekman/atlas/issues/59)) ([95a2c48](https://github.com/lekman/atlas/commit/95a2c48bacc2be39ca4abba18d0c0a3f45be916d))
* **dependabot:** Bump turbo from 2.11.9 to 2.11.10 ([#61](https://github.com/lekman/atlas/issues/61)) ([8733c4c](https://github.com/lekman/atlas/commit/8733c4ce7fa482ab96515558e2c69a0ea54e8a04))
* **dependabot:** Bump vite from 8.3.4 to 8.3.5 ([#60](https://github.com/lekman/atlas/issues/60)) ([eb20786](https://github.com/lekman/atlas/commit/eb20786dcbb128e7782de10d0922552024b96ba2))

## [0.11.0](https://github.com/lekman/atlas/compare/v0.10.0...v0.11.0) (2026-10-24)


### Features

* **server:** live agent status from the Claude Code sessions on this machine ([#57](https://github.com/lekman/atlas/issues/57)) ([64fa49b](https://github.com/lekman/atlas/commit/64fa49bcf15f1ecf9b4e00428b15b33a52192ef6))

## [0.10.0](https://github.com/lekman/atlas/compare/v0.9.0...v0.10.0) (2026-10-24)


### Features

* **server:** read GitHub pull request and issue state from gh-events ([#50](https://github.com/lekman/atlas/issues/50)) ([34aba3d](https://github.com/lekman/atlas/commit/34aba3d0f5e7f3c33afa20e83f6df520c8369c9b))
* **server:** show pull requests closed without merging, and finish rotated logs after a restart ([#53](https://github.com/lekman/atlas/issues/53)) ([285f2bc](https://github.com/lekman/atlas/commit/285f2bc4a34c9a5a5cf36f568b575c0d4e87db1f))
* **ui:** the Comms Log is a drawer, shut until asked ([#51](https://github.com/lekman/atlas/issues/51)) ([e7a9e81](https://github.com/lekman/atlas/commit/e7a9e81a008f38e50037457b93e980e0be2a6de4))
* **worlds:** workstreams on an orbit, and shortened item titles ([#54](https://github.com/lekman/atlas/issues/54)) ([07bce5e](https://github.com/lekman/atlas/commit/07bce5e5c32bff14397812c497602a871b60c04e))

## [0.9.0](https://github.com/lekman/atlas/compare/v0.8.0...v0.9.0) (2026-10-24)


### Features

* **server:** limit the task source to some clients ([#42](https://github.com/lekman/atlas/issues/42)) ([9fa80a8](https://github.com/lekman/atlas/commit/9fa80a8a7365e21619788faf4bb4caf816313f8f))
* **ui:** details in columns, with development tracking ([#48](https://github.com/lekman/atlas/issues/48)) ([fd5fddb](https://github.com/lekman/atlas/commit/fd5fddbc173bc06c83bd942b6348964f978d4d77))
* **ui:** keep the view through a reload ([#46](https://github.com/lekman/atlas/issues/46)) ([993f0ce](https://github.com/lekman/atlas/commit/993f0ce4367f3082cbe14f190b9151050dbfa43c))
* **ui:** the Comms Log as a full-height column, with the selected item's log ([#49](https://github.com/lekman/atlas/issues/49)) ([2b2570a](https://github.com/lekman/atlas/commit/2b2570a6afb0130b2e699fdb98e2f3c4e75817fd))
* **web:** reload open pages after a deploy ([#44](https://github.com/lekman/atlas/issues/44)) ([6e13e8c](https://github.com/lekman/atlas/commit/6e13e8caec5dea5690e3aef865e00ac3d54cb6e6))


### Bug Fixes

* **ui:** do not refit over a restored view on the first render ([#47](https://github.com/lekman/atlas/issues/47)) ([21a2eed](https://github.com/lekman/atlas/commit/21a2eede1f5f6946e7d8a78d20a99d6d96c743d6))
* **web:** reopen the event stream when the browser gives up on it ([#45](https://github.com/lekman/atlas/issues/45)) ([192ebaa](https://github.com/lekman/atlas/commit/192ebaa726f5a88fb84ac3ff4d5a5c9990ecdb5e))

## [0.8.0](https://github.com/lekman/atlas/compare/v0.7.0...v0.8.0) (2026-10-24)


### Features

* **ui:** background ambiences, a Sound switch and a settings cog ([#41](https://github.com/lekman/atlas/issues/41)) ([2f94772](https://github.com/lekman/atlas/commit/2f94772b8b99b472339b7fcb6ea2a7c907b5a9c2))
* **web:** only the Sound button in the bar, and remember sound on ([#39](https://github.com/lekman/atlas/issues/39)) ([09cbcc6](https://github.com/lekman/atlas/commit/09cbcc6b7ae6e73807fd40b49594a4b0d3586502))

## [0.7.0](https://github.com/lekman/atlas/compare/v0.6.0...v0.7.0) (2026-10-24)


### Features

* **server:** read clients, workstreams and tasks from the task database ([#37](https://github.com/lekman/atlas/issues/37)) ([5387b60](https://github.com/lekman/atlas/commit/5387b6071ed48e432948e1ffa3b4751918ecf600))

## [0.6.0](https://github.com/lekman/atlas/compare/v0.5.0...v0.6.0) (2026-10-24)


### Features

* **ui:** work an item from the HUD, with a details pane ([#35](https://github.com/lekman/atlas/issues/35)) ([444c2dc](https://github.com/lekman/atlas/commit/444c2dc93d2c6c3ef9c842ba1883e3efee948a8d))
* **web:** offer only the Astronomer world for now ([#34](https://github.com/lekman/atlas/issues/34)) ([602daee](https://github.com/lekman/atlas/commit/602daee09c3cdb15f8750017328969d6da6d4a5a))
* **worlds:** agents fly to their tasks and work them ([#32](https://github.com/lekman/atlas/issues/32)) ([4db25ff](https://github.com/lekman/atlas/commit/4db25ffa63834ef6a0e08e7779f815d30d3ee570))
* **worlds:** subagents launch from their ship as small vessels ([#36](https://github.com/lekman/atlas/issues/36)) ([f5a8254](https://github.com/lekman/atlas/commit/f5a825488550880a0cb8f94cea7f7ea097e5c259))

## [0.5.0](https://github.com/lekman/atlas/compare/v0.4.1...v0.5.0) (2026-10-24)


### Features

* **ui:** a handle on the readout opens what needs you ([#29](https://github.com/lekman/atlas/issues/29)) ([9b01e26](https://github.com/lekman/atlas/commit/9b01e26b4d73bbe0aed49d79a043c2df4071563b))
* **ui:** title the corner readout HUD ([#31](https://github.com/lekman/atlas/issues/31)) ([9b7effa](https://github.com/lekman/atlas/commit/9b7effab42f1706f57173696f4a777a3f018e55a))

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
