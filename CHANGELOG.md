# Changelog

## [3.0.0](https://github.com/ATGardner/OMFGv2/compare/v2.3.0...v3.0.0) (2026-09-05)


### ⚠ BREAKING CHANGES

* serve packaged output over HTTP, on its own volume ([#600](https://github.com/ATGardner/OMFGv2/issues/600))

### Features

* serve packaged output over HTTP, on its own volume ([#600](https://github.com/ATGardner/OMFGv2/issues/600)) ([5e09f72](https://github.com/ATGardner/OMFGv2/commit/5e09f72e58c818fc97194ed2839e0af7ae4e0543))


### Bug Fixes

* **deps:** update dependency @xmldom/xmldom to v0.9.12 ([#605](https://github.com/ATGardner/OMFGv2/issues/605)) ([5631b5d](https://github.com/ATGardner/OMFGv2/commit/5631b5d25fa5c98dcef1da45aec1722415d8115c))
* **deps:** update dependency express-rate-limit to v8.7.0 ([#609](https://github.com/ATGardner/OMFGv2/issues/609)) ([4e71933](https://github.com/ATGardner/OMFGv2/commit/4e71933511f980ec01eb79c40bda11c541161f6f))

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
