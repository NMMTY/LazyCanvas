import { createDocumentation } from '../src/docs';
import { name, version, homepage } from '../package.json';

async function generateJSON() {
    const docs = await createDocumentation({
        name,
        version,
        github: homepage,
        tsconfigPath: './tsconfig.json',
        input: ['./src'],
        markdown: false,
        output: './docs',
        jsonName: 'docs.json',
        clean: true
    });

    console.log(`Took ${docs.metadata.generationMs.toFixed(0)}ms to generate the documentation!`);
}

async function generateMarkdown() {
    const docs = await createDocumentation({
        name,
        version,
        github: homepage,
        tsconfigPath: './tsconfig.json',
        input: ['./src'],
        markdown: true,
        output: './docs/markdown',
        clean: true,
        typeLinkerBasePath: '/micro-docgen/',
        omitTypeLinkerExtension: true
    });

    console.log(`Took ${docs.metadata.generationMs.toFixed(0)}ms to generate the documentation!`);
}

async function main() {
    await generateJSON();
    await generateMarkdown();
}

main();
