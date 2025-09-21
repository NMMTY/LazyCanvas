import {
    DocumentedClass,
    DocumentedClassConstructor,
    DocumentedClassMethod,
    DocumentedClassProperty,
    DocumentedFunction,
    DocumentedTypes
} from '../serializers';
import {bold, code, codeBlock, escape, escapeDesc, FileMetadata, heading, hyperlink, navIcon} from '../utils';
import {MicroDocgenLink} from '..';
import {ReflectionKind} from "typedoc";

export interface MarkdownGeneratorMarkdownBuild {
    name: string;
    metadata: FileMetadata | null;
    content: string;
}

export interface MarkdownGeneratorMdBuilderOptions {
    linker: (t: string, s: string[]) => string;
    links: MicroDocgenLink;
    includeHeaders: boolean;
}

const escapeMultiLine = (src: string) => src.replace(/\n|\r/g, ' ');

/**
 * MarkdownGenerator is a class that generates markdown documentation for classes, functions, and types.
 * It transforms the JSON output from the serializer into markdown and applies the necessary formatting or linking.
 */
export class MarkdownGenerator {
    public linker: typeof this.options.linker;

    public constructor(public options: MarkdownGeneratorMdBuilderOptions) {
        this.linker = this.options.linker;
    }

    private createTable(data: Array<{ content: string, key: string, sortable?: boolean }>, rows: Array<string[]>) {
        return `<Table data={{ headers: ${JSON.stringify(data)}, rows: ${JSON.stringify(rows)} }} />`;
    }

    public getHeaders(value: DocumentedClass | DocumentedTypes | DocumentedFunction) {
        let date = new Date();
        const headers = [
            '---',
            `title: "${escapeMultiLine(escape(value.name))}"`,
            `summary: "${escapeMultiLine(escapeDesc(escape(value.description || 'No description provided')))}"`,
            `updatedAt: "${date.toISOString()}"`,
            `navIcon: "${value.objectType ? navIcon(value.objectType) : ''}"`,
            '---',
            ''
        ];

        return headers.join('\n');
    }

    public getClassHeading(c: DocumentedClass) {
        return `${
            c.extends ? `extends ${this.linker(c.extends, [c.extends])}` : ''
        }${c.implements ? `implements ${this.linker(c.implements, [c.implements])}` : ''}${
            c.description ? `\n\n${c.description}\n` : ''
        }`;
    }

    public getCtor(c: DocumentedClassConstructor) {
        if (!c) return '';

        const ctor = codeBlock(
            `${escape(c.constructor)}(${c.parameters
                .filter((p) => !p.name.includes('.'))
                .map((m) => m.name)
                .join(', ')})`,
            'typescript'
        );

        if (c.parameters.length) {
            const tableBody = c.parameters.map((m) => {
                const params = [
                    escape(m.name),
                    this.linker(m.type || 'any', [m.type || 'any']),
                    m.optional ? 'Yes' : 'No',
                    m.description || '-'
                ]

                return params;
            });

            return `\n${ctor}\n${this.createTable(
                [
                    { content: 'Parameter', key: 'parameter', sortable: true },
                    { content: 'Type', key: 'type', sortable: true },
                    { content: 'Optional', key: 'optional', sortable: true },
                    { content: 'Description', key: 'description' }
                ], tableBody
            )}\n`;
        }

        return `\n${ctor}\n`;
    }

    public transformClass(classes: DocumentedClass[]): MarkdownGeneratorMarkdownBuild[] {
        return classes.map((c) => {
            return {
                name: c.name,
                metadata: c.metadata,
                content: this.getMarkdown(c)
            };
        });
    }

    public transformFunctions(types: DocumentedFunction[]): MarkdownGeneratorMarkdownBuild[] {
        return types.map((t) => {
            return {
                name: t.name,
                metadata: t.metadata,
                content: this.getFunctions(t)
            };
        });
    }

    public transformTypes(types: DocumentedTypes[]): MarkdownGeneratorMarkdownBuild[] {
        return types.map((t) => {
            return {
                name: t.name,
                metadata: t.metadata,
                content: this.getTypeMarkdown(t)
            };
        });
    }

    public getTypeMarkdown(t: DocumentedTypes) {
        const md = [
            t.description ? '\n' + t.description : '',
            t.deprecated ? `\n- ${bold('⚠️ Deprecated')}` : '',
            t.properties.length
                ? (() => {
                    const tableBody = t.properties.map((n) => {
                        return t.objectType === ReflectionKind.Enum ?
                            [
                                escape(n.name),
                                this.linker(n.type || 'any', [n.type || 'any'])
                            ] : [
                            escape(n.name),
                            this.linker(n.type || 'any', [n.type || 'any']),
                            escape(n.value || '-'),
                            n.description || '-'
                        ];
                    });
                    return `\n${this.createTable(t.objectType === ReflectionKind.Enum ?
                        [
                            { content: 'Member', key: 'member', sortable: true },
                            { content: 'Type', key: 'type', sortable: true },
                        ] :
                        [
                            { content: 'Property', key: 'property', sortable: true },
                            { content: 'Type', key: 'type', sortable: true },
                            { content: 'Value', key: 'value', sortable: true },
                            { content: 'Description', key: 'description' }
                        ], tableBody)}\n`;
                })()
                : t.type
                    ? `\n${this.linker(t.type, [t.type])}`
                    : '',
            t.metadata?.url ? `\n- ${hyperlink('Source', t.metadata.url)}` : ''
        ];

        if (this.options.includeHeaders) {
            md.unshift(this.getHeaders(t));
        }

        return md
            .filter((r) => r.length > 0)
            .join('\n')
            .trim();
    }

    public getMarkdown(c: DocumentedClass) {
        const md = [
            this.getClassHeading(c),
            this.getCtor(c.constructor!),
            this.getProperties(c.properties),
            this.getMethods(c.methods)
        ];

        if (this.options.includeHeaders) {
            md.unshift(this.getHeaders(c));
        }

        return md.join('\n\n');
    }

    public getProperties(properties: DocumentedClassProperty[]) {
        if (!properties.length) return '';

        const head = heading('Properties', 2);
        const body = properties.map((m) => {
            return [
                `${escape(
                    m.name
                )}`.trim(),
                `${m.private ? 'private' : 'public'} ${m.static ? 'static ' : ''}`,
                `${this.linker(m.type || 'any', m.rawType || ['any'])}`,
                [
                    m.description || '-',
                    m.deprecated ? `\n- ${bold('⚠️ Deprecated')}` : ''
                ]
                    .filter((r) => r.length > 0)
                    .join('\n')
                    .trim()
            ];
        });

        return `${head}\n${this.createTable(
            [
                { content: "Name", key: "name", sortable: true }, 
                { content: "Access Modifier", key: 'access', sortable: true }, 
                { content: "Type", key: "type", sortable: true }, 
                { content: "Description", key: "desc" }
            ], body)}`;
    }

    public getMethods(methods: DocumentedClassMethod[]) {
        if (!methods.length) return '';

        const head = heading('Methods', 2);
        const body = methods.map((m) => {
            const name = `${m.private ? `private` : `public`} ${m.static ? 'static ' : ''}${escape(
                m.name
            )}(${m.parameters
                .filter((r) => !r.name.includes('.'))
                .map((m) => {
                    return `${m.name}${m.optional ? '?' : ''}`;
                })
                .join(', ')})`.trim();
            const title = '\n' + heading(
                `${name}`,
                3
            ) + `\nReturns ${
                m.returns?.type
                    ? `${this.linker(m.returns.type || 'any', m.returns.rawType || ['any'])}`
                    : 'any'
            }\n`;
            const desc = [
                m.description || '',
                m.deprecated ? `\n- ${bold('⚠️ Deprecated')}` : '',
                m.examples
                    ? '\n' +
                    m.examples
                        .map((m) => (m.includes('```') ? m : codeBlock(m, 'typescript')))
                        .join('\n\n')
                    : '',
                m.parameters.length
                    ? (() => {
                        const tableBody = m.parameters.map((n) => {
                            return [
                                n.default
                                    ? `${escape(n.name)}=${code(escape(n.default))}`
                                    : escape(n.name),
                                this.linker(n.type || 'any', n.rawType || ['any']),
                                n.optional ? 'Yes' : 'No',
                                n.description || '-'
                            ]
                        });

                        return `\n${this.createTable([
                            { content: 'Parameter', key: 'parameter', sortable: true },
                            { content: 'Type', key: 'type', sortable: true },
                            { content: 'Optional', key: 'optional', sortable: true },
                            { content: 'Description', key: 'description' }
                        ], tableBody)}\n\n`;
                    })()
                    : '',
                m.metadata?.url ? `\n- ${hyperlink('Source', m.metadata.url)}` : ''
            ]
                .filter((r) => r.length > 0)
                .join('\n')
                .trim();

            return `${title}\n${desc}`;
        });

        return `${head}\n${body.join('\n')}`;
    }

    public getFunctions(m: DocumentedFunction) {
        const name = `${escape(m.name)}(${m.parameters
            .filter((r) => !r.name.includes('.'))
            .map((m) => {
                return `${m.name}${m.optional ? '?' : ''}`;
            })
            .join(', ')})`.trim();
        const title = heading(
            `${name}`,
            3
        ) + `\nReturns ${
            m.returns?.type
                ? `${this.linker(m.returns.type || 'any', m.returns.rawType || ['any'])}`
                : 'any'
        }\n`;
        const desc = [
            m.description || '',
            m.deprecated ? `\n- ${bold('⚠️ Deprecated')}` : '',
            m.examples
                ? '\n' +
                m.examples
                    .map((m) => (m.includes('```') ? m : codeBlock(m, 'typescript')))
                    .join('\n\n')
                : '',
            m.parameters.length
                ? (() => {
                    const tableBody = m.parameters.map((n) => {
                        return [
                            n.default
                                ? `${escape(n.name)}=${code(escape(n.default))}`
                                : escape(n.name),
                            this.linker(n.type || 'any', n.rawType || ['any']),
                            n.optional ? 'Yes' : 'No',
                            n.description || '-'
                        ];
                    });

                    return `\n${this.createTable([
                        { content: 'Parameter', key: 'parameter', sortable: true },
                        { content: 'Type', key: 'type', sortable: true },
                        { content: 'Optional', key: 'optional', sortable: true },
                        { content: 'Description', key: 'desc' }
                    ], tableBody)}\n`;
                })()
                : '',
            m.metadata?.url ? `\n- ${hyperlink('Source', m.metadata.url)}` : ''
        ]
            .filter((r) => r.length > 0)
            .join('\n')
            .trim();

        const md = [title, desc];

        if (this.options.includeHeaders) {
            md.unshift(this.getHeaders(m));
        }

        return md.join('\n\n');
    }
}
