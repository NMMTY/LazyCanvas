import { createDocumentation } from '../../src/docs';

async function main() {
    const docs = await createDocumentation({
        name: 'Markdown Example',
        version: '1.0.0',
        tsconfigPath: './tsconfig.json',
        input: ['./lib'],
        markdown: true,
        custom: [
            {
                category: 'Welcome',
                name: 'Introduction',
                path: 'README.md'
            }
        ],
        output: './docs'
    });

    console.log(`Took ${docs.metadata.generationMs}ms to generate the documentation!`);
}

main();
