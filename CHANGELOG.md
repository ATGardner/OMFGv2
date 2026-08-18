# Changelog

## [2.3.0](https://github.com/ATGardner/OMFGv2/compare/v2.2.0...v2.3.0) (2026-08-18)


### Features

* add /healthz and /readyz probes, and drop the pm2 leftovers ([#595](https://github.com/ATGardner/OMFGv2/issues/595)) ([826c3f8](https://github.com/ATGardner/OMFGv2/commit/826c3f8f6da0ab5d1823e4290e20872099712bb9))
* fetch relations from the OSM API instead of Overpass ([#598](https://github.com/ATGardner/OMFGv2/issues/598)) ([ca21b55](https://github.com/ATGardner/OMFGv2/commit/ca21b5584f04a3e415cc0c68d092719dcecdd891))

## [2.2.0](https://github.com/ATGardner/OMFGv2/compare/v2.1.0...v2.2.0) (2026-08-17)


### Features

* **chart:** add a Grafana dashboard for the exported metrics ([#593](https://github.com/ATGardner/OMFGv2/issues/593)) ([b34bc97](https://github.com/ATGardner/OMFGv2/commit/b34bc974265fb2c9170fd392989ab1e81eff5a5a))

## [2.1.0](https://github.com/ATGardner/OMFGv2/compare/v2.0.1...v2.1.0) (2026-08-17)


### Features

* **chart:** add a Helm chart with a persistent tile cache ([#580](https://github.com/ATGardner/OMFGv2/issues/580)) ([8fd86ad](https://github.com/ATGardner/OMFGv2/commit/8fd86ad1a4e45c41aa548cec68c1160d614b9d02))
* **metrics:** export prometheus metrics on a separate port ([#583](https://github.com/ATGardner/OMFGv2/issues/583)) ([2eb076a](https://github.com/ATGardner/OMFGv2/commit/2eb076a053cac1086e00ac62a5c8c70225233f1f))


### Bug Fixes

* **deps:** pin dependencies ([#591](https://github.com/ATGardner/OMFGv2/issues/591)) ([cdf8963](https://github.com/ATGardner/OMFGv2/commit/cdf896308523a0adf0c52f3c61fdd2c9032602c4))
