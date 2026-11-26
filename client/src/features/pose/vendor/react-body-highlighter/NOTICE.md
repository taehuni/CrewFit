# Body model source

`body-model.js` contains the anterior and posterior SVG polygon data from
[react-body-highlighter](https://github.com/giavinh79/react-body-highlighter),
by GV79, distributed under the MIT License (see `LICENSE`).

Pinned upstream commit: `28035c2c11d49038026e5c7e038c623f331edb60`.

Source file:
https://github.com/giavinh79/react-body-highlighter/blob/28035c2c11d49038026e5c7e038c623f331edb60/src/assets/index.ts

Local changes are limited to removing TypeScript declarations, expanding
`MuscleType` constants to the corresponding strings from upstream
`src/component/metadata.ts`, and retaining the MIT notice in the JavaScript.
All polygon coordinate strings are unchanged.

The upstream project attributes its SVG polygons to
[react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter).
That project's MIT notice is included in `LICENSE.react-native-body-highlighter`.

CrewFit's `BodyRegionIcon.jsx` chooses the view, highlight groups and colors.
It does not include the upstream interactive component or add a runtime dependency.
