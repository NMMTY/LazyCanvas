import { common, prettier, typescript } from "eslint-config-neon";
import merge from "lodash.merge";

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
const config = [
    ...[...common, ...typescript, ...prettier].map((config) =>
        merge(config, {
            files: ["src/**/*.ts"],
            languageOptions: {
                parserOptions: {
                    project: "tsconfig.json",
                },
            },
        }),
    ),
];

export default config;