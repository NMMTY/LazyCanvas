import path from 'path';
import { JSONOutput, ReflectionKind } from 'typedoc';

export function getName(decl: JSONOutput.DeclarationReflection) {
    return decl.name === 'default'
        ? path.parse(getFileMetadata(decl)?.name || 'default').name
        : decl.name;
}

export function getFileMetadata(decl: JSONOutput.DeclarationReflection): FileMetadata | null {
    const src = decl.sources?.[0];
    if (!src) return null;

    return {
        name: path.basename(src.fileName),
        directory: path.dirname(src.fileName),
        line: src.line,
        url: src.url
    };
}
export interface FileMetadata {
    name: string;
    directory: string;
    line: number;
    url?: string;
}

export function escape(src: string) {
    return src
        .replace(/\[/g, '\\[')
        .replace(/\</g, '\\<')
        .replace(/\>/g, '\\>')
        .replace(/\*/g, '\\*')
        .replace(/\-/g, '\\-')
        .replace(/\|/g, '\\|')
        .replace(/\`/g, '\\`')
        .replace(/\{/g, '\\{');
}

export function escapeDesc(src: string) {
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return src.replace(regex, (match, p1, p2) => {
        return `${p1}`;
    }).replace(/\\/g, '')
      .replace(/\`/g, '');
}

export function parseType(t: JSONOutput.SomeType): string {
    if (!t?.type) return '';
    switch (t.type) {
        case 'array':
            return `Array<${parseType(t.elementType)}>`;
        case 'conditional':
            return `${parseType(t.checkType)} extends ${parseType(t.extendsType)} ? ${parseType(
                t.trueType
            )} : ${parseType(t.falseType)}`;
        case 'indexedAccess':
            return `${parseType(t.objectType)}[${parseType(t.indexType)}]`;
        case 'intersection':
            return t.types.map(parseType).join(' & ');
        case 'predicate':
            return `${t.asserts ? 'asserts ' : ''}${t.name}${
                t.targetType ? ` is ${parseType(t.targetType)}` : ''
            }`;
        case 'reference':
            return `${t.name}${
                t.typeArguments ? `<${t.typeArguments.map(parseType).join(', ')}>` : ''
            }`;
        case 'reflection': {
            const obj = {} as Record<string, any>;
            const { children, signatures } = t.declaration;

            if (children && children.length > 0) {
                for (const child of children) {
                    if (!child.type && child.signatures) {
                        obj[child.name] = parseType(child.signatures[0].type  as JSONOutput.SomeType);
                    }
                    if (child.type) obj[child.name] = parseType(child.type as JSONOutput.SomeType);
                }
                return `{\n  ${Object.entries(obj)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(',\n  ')}\n}`;
            }

            if (signatures && signatures.length > 0) {
                const s = signatures[0];
                const params = s.parameters?.map(
                    (p) =>
                        `${p.name}: ${
                            p.type ? parseType(p.type as JSONOutput.SomeType) : 'unknown'
                        }`
                );
                return `(\n  ${params?.join(',\n  ') || '...args: unknown[]'}\n) => ${
                    s.type ? parseType(s.type as JSONOutput.SomeType) : 'unknown'
                }`;
            }

            return '{}';
        }
        case 'templateLiteral':
            return t.tail
                .map((tail) => {
                    return `${t.head.replace(/\n/g, '\\n')}\\$\{${escape(
                        parseType(tail[0])
                    )}\}${tail[1].replace(/\n/g, '\\n')}`;
                })
                .join(' | ');
        case 'literal':
            return typeof t.value === 'string' ? `'${t.value}'` : `${t.value}`;
        case 'tuple':
            return `[${t.elements?.map(parseType).join(', ') || ''}]`;
        case 'typeOperator':
            return `${t.operator} ${parseType(t.target)}`;
        case 'union':
            return t.types
                .map(parseType)
                .filter((t) => !!t?.trim().length)
                .join(' | ');
        case 'query':
            return `(typeof ${parseType(t.queryType)})`;
        case 'inferred':
        case 'intrinsic':
        case 'unknown':
            return t.name;
        default:
            return 'any';
    }
}

/**
 * Breaks a type into the pieces it is written with, so the generator can turn
 * every type name among them into a link. Concatenating the pieces gives back
 * the type as written: separators (` | `, `, `, `;`) are pieces of their own.
 */
export function parseTypes(t: JSONOutput.SomeType): string[] {
    if (!t?.type) return [''];

    const join = (items: JSONOutput.SomeType[], separator: string): string[] =>
        items.flatMap((item, i) => (i === 0 ? parseTypes(item) : [separator, ...parseTypes(item)]));

    switch (t.type) {
        case 'array':
            return ['Array', '<', ...parseTypes(t.elementType), '>'];
        case 'conditional':
            return [
                ...parseTypes(t.checkType),
                ' extends ',
                ...parseTypes(t.extendsType),
                ' ? ',
                ...parseTypes(t.trueType),
                ' : ',
                ...parseTypes(t.falseType)
            ];
        case 'indexedAccess':
            return [...parseTypes(t.objectType), '[', ...parseTypes(t.indexType), ']'];
        case 'intersection':
            return join(t.types, ' & ');
        case 'predicate': {
            const res: string[] = [];
            if (t.asserts) res.push('asserts ');
            res.push(t.name);
            if (t.targetType) res.push(' is ', ...parseTypes(t.targetType));
            return res;
        }
        case 'reference': {
            const res: string[] = [t.name];
            if (t.typeArguments?.length) res.push('<', ...join(t.typeArguments, ', '), '>');
            return res;
        }
        case 'reflection': {
            const { children, signatures } = t.declaration;

            if (children && children.length > 0) {
                return [
                    '{ ',
                    ...children.flatMap((child, i) => {
                        const type = child.type
                            ? parseTypes(child.type as JSONOutput.SomeType)
                            : child.signatures?.[0]?.type
                              ? parseTypes(child.signatures[0].type as JSONOutput.SomeType)
                              : ['any'];
                        return [
                            i === 0 ? '' : '; ',
                            child.name,
                            child.flags?.isOptional ? '?' : '',
                            ': ',
                            ...type
                        ];
                    }),
                    ' }'
                ].filter((piece) => piece !== '');
            }

            if (signatures && signatures.length > 0) {
                const s = signatures[0];
                const params = (s.parameters || []).flatMap((p, i) => [
                    i === 0 ? '' : ', ',
                    p.name,
                    p.flags?.isOptional ? '?' : '',
                    ': ',
                    ...(p.type ? parseTypes(p.type as JSONOutput.SomeType) : ['unknown'])
                ]);
                return [
                    '(',
                    ...params,
                    ') => ',
                    ...(s.type ? parseTypes(s.type as JSONOutput.SomeType) : ['unknown'])
                ].filter((piece) => piece !== '');
            }

            return ['{}'];
        }
        case 'literal':
            return [typeof t.value === 'string' ? `'${t.value}'` : `${t.value}`];
        case 'templateLiteral':
            return [
                '`',
                t.head,
                ...t.tail.flatMap((tail) => ['${', ...parseTypes(tail[0]), '}', tail[1]]),
                '`'
            ].filter((piece) => piece !== '');
        case 'tuple':
            return ['[', ...join(t.elements || [], ', '), ']'];
        case 'optional':
            return [...parseTypes(t.elementType), '?'];
        case 'rest':
            return ['...', ...parseTypes(t.elementType)];
        case 'namedTupleMember':
            return [t.name, t.isOptional ? '?' : '', ': ', ...parseTypes(t.element)].filter(
                (piece) => piece !== ''
            );
        case 'typeOperator':
            return [`${t.operator} `, ...parseTypes(t.target)];
        case 'union':
            return join(
                t.types.filter((member) => !!parseType(member)?.trim().length),
                ' | '
            );
        case 'query':
            return ['typeof ', ...parseTypes(t.queryType)];
        case 'inferred':
        case 'intrinsic':
            // @ts-ignore
            if (t.type['parameters']) {
                // @ts-ignore
                return [t.name, '<', ...t.type['parameters'].flatMap(parseTypes), '>'];
            } else {
                return [t.name];
            }
        case 'unknown':
            return [t.name];
        default:
            return [parseType(t) || 'any'];
    }
}

export function makeId(src: string, prefix?: string) {
    src = src
        .replace(/ +/g, '-')
        .replace(/#/g, '-')
        .replace(/\</g, '-')
        .replace(/\>/g, '-')
        .replace(/\[/g, '-')
        .replace(/\]/g, '-');
    return `${prefix || ''}${src}`;
}

export function navIcon(type: ReflectionKind) {
    switch (type) {
        case ReflectionKind.Class:
            return 'class';
        case ReflectionKind.Interface:
            return 'interface';
        case ReflectionKind.Enum:
            return 'enum';
        case ReflectionKind.TypeAlias:
            return 'type';
        case ReflectionKind.Function:
            return 'function';
        case ReflectionKind.Variable:
            return 'variable';
        case ReflectionKind.Namespace:
            return 'namespace';
        case ReflectionKind.Module:
            return 'module';
        case ReflectionKind.Property:
            return 'property';
        case ReflectionKind.Method:
            return 'method';
        case ReflectionKind.Constructor:
            return 'constructor';
        default:
            return 'file';
    }
}