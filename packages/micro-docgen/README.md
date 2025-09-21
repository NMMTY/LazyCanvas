# micro-docgen (Forked)

[![npm version](https://badge.fury.io/js/%40hitomihiumi%2Fmicro-docgen.svg)](https://badge.fury.io/js/%40hitomihiumi%2Fmicro-docgen)

[![downloads](https://img.shields.io/npm/dm/%40hitomihiumi%2Fmicro-docgen.svg)](https://www.npmjs.com/package/%40hitomihiumi%2Fmicro-docgen)

TypeScript documentation generator on steroids 💉. MicroDocgen is built on top of typedoc to leverage its power and add more features.

[Link to the original repository](https://github.com/neplextech/micro-docgen/tree/main)

## Installation

```sh
$ npm install @hitomihiumi/micro-docgen
```

## Usage

```js
import { createDocumentation } from '@hitomihiumi/micro-docgen';
import { name, version } from './package.json'; 
/* 
    ^
    | --- To use this, make sure you have the “resolveJsonModule” flag set to “true” inside your tsconfig.json
*/

await createDocumentation({
    // project name
    name,
    // project version
    version,
    // source files
    input: ['src'],
    // output directory
    output: 'docs',
    // tsconfig path
    tsconfigPath: './tsconfig.json',
    // to generate markdown files
    markdown: true,
    // to generate json file
    jsonName: 'docs.json',
    // include custom files such as readme
    custom: [...]
});
```
