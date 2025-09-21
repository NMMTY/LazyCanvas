import { createDocumentation } from '@hitomihiumi/micro-docgen';
import { version, homepage } from './package.json';

async function main() {
    const docs = await createDocumentation({
        name: 'LazyCanvas',
        version,
        github: homepage,
        tsconfigPath: './tsconfig.json',
        input: ['src'],
        markdown: true,
        output: 'public',
        jsonName: 'docs.json',
        clean: true,
        omitTypeLinkerExtension: true,
        custom: [
            {
                name: 'QuickStart',
                category: '',
                path: './resources/QuickStart.mdx'
            },
            {
                name: 'BasicUsage',
                category: '',
                path: './resources/BasicUsage.mdx'
            }
        ],
        customOrder: {
            0: ['QuickStart', 'BasicUsage'],
            'Classes': {
                'General': [
                    'LazyCanvas',
                    'PluginManager',
                    'FontsManager',
                    'LayersManager',
                    'RenderManager',
                    'AnimationManager'
                ],
                'Components': [
                    'BaseLayer',
                    'Group',
                    'ImageLayer',
                    'TextLayer',
                    'LineLayer',
                    'MorphLayer',
                    'Path2DLayer',
                    'QuadraticLayer',
                    'BezierLayer',
                    'ClearLayer'
                ],
                'Helpers': [
                    'Font',
                    'Pattern',
                    'Gradient',
                    'Link',
                    'Exporter',
                    'JSONReader',
                    'YAMLReader'
                ]
            }
        }
    });

    console.log(`Took ${docs.metadata.generationMs}ms to generate the documentation!`);
}

main();
