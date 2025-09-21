import * as TypeDoc from 'typedoc';
import { mkdir, readFile, rm, rmdir, writeFile } from 'fs/promises';
import tmp from 'tmp';
import path from 'path';
import {
    ClassSerializer,
    DocumentedClass,
    DocumentedFunction,
    DocumentedTypes,
    FunctionSerializer,
    TypesSerializer
} from './serializers';
import { MarkdownGenerator, MarkdownGeneratorMarkdownBuild } from './generators/MarkdownGenerator';
import { escape } from './utils';
import { hyperlink } from './utils/md';
import { existsSync } from 'fs';
import { DefaultLinksFactory } from './utils/links';

export type MicroDocgenLink = Record<string, string>;

export { LogLevel as DebugLogLevel } from 'typedoc';

export interface MicroDocgenInit {
    jsonInputPath?: string | null;
    input?: string[] | null;
    jsonName?: string;
    name: string;
    version: string;
    github?: string;
    output?: string;
    noEmit?: boolean;
    custom?: MicroDocgenCustomFile[];
    tsconfigPath?: string;
    print?: boolean;
    spaces?: number;
    markdown?: boolean;
    includeMarkdownHeaders?: boolean;
    noLinkTypes?: boolean;
    extension?: string;
    links?: MicroDocgenLink;
    debug?: TypeDoc.LogLevel | 'Verbose' | 'Info' | 'Warn' | 'Error' | 'None';
    flattenSingleModule?: boolean;
    clean?: boolean;
    typeLinker?: (type: string, ref: string[]) => string;
    typeLinkerBasePath?: string;
    omitTypeLinkerExtension?: boolean;
    customOrder?: CustomOrder;
}

export interface MicroDocgenCustomFile {
    name: string;
    path: string;
    category: string;
    type?: string;
}

export interface DocumentationMetadata {
    timestamp: number;
    generationMs: number;
}

export interface CustomOrder {
    [category: string]: string[] | Record<string, CustomOrder[] | string[]>;
}

export interface Documentation {
    name: string;
    version: string;
    github?: string;
    custom: Record<
        string,
        (MicroDocgenCustomFile & {
            content: string;
        })[]
    >;
    classes: {
        markdown: MarkdownGeneratorMarkdownBuild[];
        data: DocumentedClass;
    }[];
    types: {
        markdown: MarkdownGeneratorMarkdownBuild[];
        data: DocumentedTypes;
    }[];
    functions: {
        markdown: MarkdownGeneratorMarkdownBuild[];
        data: DocumentedFunction;
    }[];
    interfaces: {
        markdown: MarkdownGeneratorMarkdownBuild[];
        data: DocumentedTypes;
    }[];
    variables: {
        markdown: MarkdownGeneratorMarkdownBuild[];
        data: DocumentedTypes;
    }[];
    enums: {
        markdown: MarkdownGeneratorMarkdownBuild[];
        data: DocumentedTypes;
    }[];
    metadata: DocumentationMetadata;
}

export async function createDocumentation(options: MicroDocgenInit): Promise<Documentation> {
    let data: TypeDoc.JSONOutput.ProjectReflection | undefined = undefined;

    options.debug ??= TypeDoc.LogLevel.Verbose;
    options.noLinkTypes ??= false;
    options.links ??= DefaultLinksFactory;
    options.extension ??= 'mdx';
    options.flattenSingleModule ??= true;
    options.clean ??= true;
    options.includeMarkdownHeaders ??= true;
    options.typeLinkerBasePath ??= '';
    options.omitTypeLinkerExtension ??= false;
    options.customOrder ??= undefined;

    const shouldLog = ![
        'None',
        'Warn',
        'Error',
        TypeDoc.LogLevel.None,
        TypeDoc.LogLevel.Error,
        TypeDoc.LogLevel.Warn
    ].includes(options.debug);

    const start = performance.now();

    if (options.jsonInputPath) {
        data = JSON.parse(
            await readFile(options.jsonInputPath, 'utf-8')
        ) as TypeDoc.JSONOutput.ProjectReflection;
    } else if (options.input) {
        const app = await TypeDoc.Application.bootstrap({
            plugin: [],
            entryPoints: options.input,
            tsconfig: options.tsconfigPath,
            logLevel: options.debug
        });
        const tmpOutputPath = path.join(tmp.dirSync().name, 'project-reflection.json');

        app.options.addReader(new TypeDoc.TSConfigReader());
        app.options.addReader(new TypeDoc.TypeDocReader());

        const _proj = await app.convert();

        if (_proj) {
            await app.generateJson(_proj, tmpOutputPath);
            data = JSON.parse(
                await readFile(tmpOutputPath, 'utf-8')
            ) as TypeDoc.JSONOutput.ProjectReflection;
        }
    }

    if (!data && !options.custom?.length) {
        throw new Error('No input files to process');
    }

    const doc: Documentation = {
        name: options.name,
        version: options.version,
        github: options.github || undefined,
        custom: {},
        classes: [],
        functions: [],
        interfaces: [],
        types: [],
        variables: [],
        enums: [],
        metadata: {
            generationMs: 0,
            timestamp: 0
        }
    };

    // Track custom paths for linker when using customOrder
    const customTypePaths = new Map<string, string>();

    // Function to recursively build custom paths map from customOrder
    const buildCustomPathsMap = (order: CustomOrder, currentPath: string = '') => {
        for (const [category, items] of Object.entries(order)) {
            if (Array.isArray(items)) {
                // Handle direct array of strings (files in root or category folder)
                const categoryPath = currentPath ? `${currentPath}/${category}` : category;

                for (const item of items) {
                    if (typeof item === 'string') {
                        // For root-level files (like '0': ['Quick Start']), use base path
                        if (category.match(/^\d+$/) && currentPath === '') {
                            // Numeric keys at root level mean files go in root directory
                            customTypePaths.set(item, `/${doc.name}`);
                        } else {
                            // Regular category
                            customTypePaths.set(item, `/${doc.name}/${categoryPath}`);
                        }
                    }
                }
            } else if (typeof items === 'object' && items !== null && Object.keys(items).length > 0) {
                // Handle nested object structure - directly process the items object
                const categoryPath = currentPath ? `${currentPath}/${category}` : category;
                buildCustomPathsMap(items as CustomOrder, categoryPath);
            }
        }
    };

    // Build the custom paths map if customOrder is provided
    if (options.customOrder) {
        buildCustomPathsMap(options.customOrder);
    }

    const modules = (() => {
        if (data?.kind === TypeDoc.ReflectionKind.Project) {
            const childs = data.children?.filter((r) => r.kind === TypeDoc.ReflectionKind.Module);
            if (!childs?.length) return [data];
            return childs;
        }

        return data?.children?.filter((r) => r.kind === TypeDoc.ReflectionKind.Module);
    })();

    const findTypeFromDoc = (type: string) => {
        const addExtension = (path: string) => {
            if (options.omitTypeLinkerExtension) return path;
            return path + '.' + options.extension;
        };

        // First check if this type has a custom path from customOrder
        if (customTypePaths.has(type)) {
            const customPath = customTypePaths.get(type);
            return addExtension(`${customPath}/${type}`);
        }

        // Fallback to standard paths
        for (const typeData of doc.interfaces) {
            if (typeData.data.name === type) {
                return addExtension(`/${doc.name}/interfaces/${type}`);
            }
        }

        for (const typeData of doc.types) {
            if (typeData.data.name === type) {
                return addExtension(`/${doc.name}/types/${type}`);
            }
        }

        for (const typeData of doc.enums) {
            if (typeData.data.name === type) {
                return addExtension(`/${doc.name}/enums/${type}`);
            }
        }

        for (const typeData of doc.variables) {
            if (typeData.data.name === type) {
                return addExtension(`/${doc.name}/variables/${type}`);
            }
        }

        for (const typeData of doc.functions) {
            if (typeData.data.name === type) {
                return addExtension(`/${doc.name}/functions/${type}`);
            }
        }

        for (const typeData of doc.classes) {
            if (typeData.data.name === type) {
                return addExtension(`/${doc.name}/classes/${type}`);
            }
        }

        for (const [category, customData] of Object.entries(doc.custom)) {
            for (const typeData of customData) {
                if (typeData.name === type) {
                    return `/${doc.name}/${category}/${type}${typeData.type ? `.${typeData.type}` : ''}`;
                }
            }
        }

        return null;
    };

    const joinWithBasePath = (path: string) => {
        const basePath = options.typeLinkerBasePath;
        if (!basePath) return path;

        if (basePath.endsWith('/') && !path.startsWith('/')) return basePath + path;
        if (basePath.endsWith('/') && path.startsWith('/')) return basePath + path.slice(1);
        if (!basePath.endsWith('/') && !path.startsWith('/')) return basePath + '/' + path;

        return basePath + path;
    };

    // First phase: Populate doc object with all data (without markdown generation)
    if (Array.isArray(modules)) {
        if (shouldLog) console.log('Processing modules (data only)...');
        modules.forEach((mod, i) => {
            if (!mod.children) return;

            if (shouldLog)
                console.log(`Processing module "${mod.name}" (${i + 1} of ${modules.length})...`);

            const currentModule = doc;
            mod.children?.forEach((child) => {
                switch (child.kind) {
                    case TypeDoc.ReflectionKind.Class:
                        {
                            const classSerializer = new ClassSerializer(child);
                            const serialized = classSerializer.serialize();
                            currentModule.classes.push({
                                data: serialized,
                                markdown: [] // Empty for now
                            });
                        }
                        break;
                    case TypeDoc.ReflectionKind.Interface:
                    case TypeDoc.ReflectionKind.TypeAlias:
                    case TypeDoc.ReflectionKind.Enum:
                    case TypeDoc.ReflectionKind.Variable:
                        {
                            const typesSerializer = new TypesSerializer(child);
                            const serialized = typesSerializer.serialize();

                            const dest =
                                TypeDoc.ReflectionKind.Enum === child.kind
                                    ? currentModule.enums
                                    : TypeDoc.ReflectionKind.Variable === child.kind
                                      ? currentModule.variables
                                      : TypeDoc.ReflectionKind.Interface === child.kind
                                        ? currentModule.interfaces
                                            : currentModule.types;

                            dest.push({
                                data: serialized,
                                markdown: [] // Empty for now
                            });
                        }
                        break;
                    case TypeDoc.ReflectionKind.Function:
                        {
                            const functionsSerializer = new FunctionSerializer(child);
                            const serialized = functionsSerializer.serialize();

                            currentModule.functions.push({
                                data: serialized,
                                markdown: [] // Empty for now
                            });
                        }
                        break;
                    default:
                        break;
                }
            });
        });
    }

    if (Array.isArray(options.custom) && options.custom.length > 0) {
        if (shouldLog) console.log('Processing custom files...');
        await Promise.all(
            options.custom.map(async (m) => {
                const cat = doc.custom[m.category || 'Custom'];
                if (!cat) doc.custom[m.category || 'Custom'] = [];

                doc.custom[m.category || 'Custom'].push({
                    category: m.category || 'Custom',
                    name: m.name,
                    path: m.path,
                    type: m.type,
                    content: await readFile(m.path, 'utf-8')
                });
            })
        );
    }

    // Second phase: Now that doc is populated, create markdown transformer with working linker
    const mdTransformer = new MarkdownGenerator({
        includeHeaders: options.includeMarkdownHeaders,
        links: options.links,
        linker: (t, r) => {
            const {noLinkTypes = false, links = {}, typeLinker} = options;
            if (noLinkTypes) return escape(t);
            const linkKeys = Object.entries(links);

            const linkTypes = (type: string) => {
                for (const [li, val] of linkKeys) {
                    if (li.toLowerCase() === type.toLowerCase()) {
                        return hyperlink(escape(type), val);
                    }
                }

                const localLink = findTypeFromDoc(type);

                if (localLink) return `[${type}](${joinWithBasePath(localLink)})`;

                if (typeLinker) {
                    const linked = typeLinker(type, r);
                    if (linked) return linked;
                }

                return escape(type);
            };

            const linkedArr = r.map((p) => linkTypes(p));

            // insert | between each type
            return linkedArr.reduce((acc, curr, i) => {
                if (i === 0) return curr;

                const prev = acc[acc.length - 1];
                const specialChars = /[\>\<\|\&\'\"\-\+\s\\\]\[\;\:]/;

                if (specialChars.test(prev) || specialChars.test(curr[0])) {
                     if (
                        specialChars.test(prev) && specialChars.test(curr[0])
                     ) return acc + ' ' + curr;
                    const isMarkdownLink = (str: string) => /\[([^\]]+)\]\(([^)]+)\)/.test(str);

                    const accIsLink = isMarkdownLink(acc);
                    const currIsLink = isMarkdownLink(curr);

                    if (accIsLink && currIsLink) return acc + ' | ' + curr;
                    if (accIsLink && !currIsLink) return acc + ' ' + curr;
                    if (!accIsLink && currIsLink) return acc + ' ' + curr;

                    return acc + curr;
                }

                return acc + ' | ' + curr;
            }, '');
        }
    });

    // Third phase: Generate markdown for all items now that linker works properly
    if (options.markdown) {
        if (shouldLog) console.log('Generating markdown documentation...');

        // Generate markdown for classes
        doc.classes.forEach((classItem) => {
            classItem.markdown = mdTransformer.transformClass([classItem.data]);
        });

        // Generate markdown for functions
        doc.functions.forEach((functionItem) => {
            functionItem.markdown = mdTransformer.transformFunctions([functionItem.data]);
        });

        // Generate markdown for types
        doc.types.forEach((typeItem) => {
            typeItem.markdown = mdTransformer.transformTypes([typeItem.data]);
        });

        // Generate markdown for interfaces
        doc.interfaces.forEach((interfaceItem) => {
            interfaceItem.markdown = mdTransformer.transformTypes([interfaceItem.data]);
        });

        // Generate markdown for variables
        doc.variables.forEach((variableItem) => {
            variableItem.markdown = mdTransformer.transformTypes([variableItem.data]);
        });

        // Generate markdown for enums
        doc.enums.forEach((enumItem) => {
            enumItem.markdown = mdTransformer.transformTypes([enumItem.data]);
        });
    }

    doc.metadata = {
        generationMs: performance.now() - start,
        timestamp: Date.now()
    };

    if (options.print) console.log(doc);

    if (!options.noEmit) {
        if (!options.output) throw new Error('Output path was not specified');
        const outputExists = existsSync(options.output);

        if (options.clean && outputExists) {
            await rm(options.output + options.jsonName, {
                recursive: true,
                force: true
            });
        }
        if (!outputExists) await mkdir(options.output, { recursive: true });

        if (options.jsonName) {
            const docStr = JSON.stringify(doc, null, options.spaces || 0);
            await writeFile(path.join(options.output, options.jsonName), docStr);
        }

        if (options.markdown) {
            const shouldFlatten =
                Object.keys(doc).length === 1 && options.flattenSingleModule;
            const createBasePath = (...loc: string[]) => {
                if (shouldFlatten) loc.pop();
                return path.join(...loc);
            };

            if (shouldFlatten && shouldLog) console.log('Flattening single module...');

                const module = doc

                if (options.customOrder) {
                    // Track all files used in customOrder
                    const usedFiles = new Set<string>();

                    const writeOrder = async (basePath: string, order: CustomOrder, parentOrderMap: Record<string, number> = {}) => {
                        for (const [category, items] of Object.entries(order)) {
                            // Check if this is a numeric key (root-level files)
                            const isNumericKey = category.match(/^\d+$/);

                            // For numeric keys, write files directly to the base path
                            const catPath = isNumericKey
                                ? basePath
                                : createBasePath(basePath, path.normalize(category));

                            // Get the order number from parent's pages mapping
                            const categoryOrder = parentOrderMap[category] || 1;

                            if (Array.isArray(items) && items.length > 0) {
                                // For numeric keys, don't create a meta.json, just write files directly
                                if (!isNumericKey) {
                                    if (shouldLog)
                                        console.log(
                                            `Writing custom order document "${catPath}/meta.json"`
                                        );

                                    if (!existsSync(catPath))
                                        await mkdir(catPath, {
                                            recursive: true
                                        });

                                    // Build pages object based on items that will be written
                                    const pages: Record<string, number> = {};
                                    let pageOrder = 1;

                                    for (const item of items) {
                                        if (typeof item === 'string') {
                                            const data = module.classes.find((e) => e.data.name === item)?.markdown ||
                                                module.types.find((e) => e.data.name === item)?.markdown ||
                                                module.enums.find((e) => e.data.name === item)?.markdown ||
                                                module.variables.find((e) => e.data.name === item)?.markdown ||
                                                module.functions.find((e) => e.data.name === item)?.markdown ||
                                                module.interfaces.find((e) => e.data.name === item)?.markdown;

                                            if (!data) {
                                                const customData = Object.values(module.custom).flat().find((e) => e.name === item);
                                                if (customData) {
                                                    pages[item] = pageOrder++;
                                                    usedFiles.add(item);
                                                }
                                            } else {
                                                pages[item] = pageOrder++;
                                                usedFiles.add(item);
                                            }
                                        }
                                    }

                                    await writeFile(
                                        path.join(catPath, `meta.json`),
                                        JSON.stringify({
                                            title: category,
                                            order: categoryOrder,
                                            pages: pages
                                        }, null, options.spaces || 0)
                                    );
                                } else {
                                    // For numeric keys, ensure the base path exists
                                    if (!existsSync(catPath))
                                        await mkdir(catPath, {
                                            recursive: true
                                        });
                                }

                                // Write the actual files
                                for (const item of items) {
                                    if (typeof item === 'string') {
                                        const data = module.classes.find((e) => e.data.name === item)?.markdown ||
                                            module.types.find((e) => e.data.name === item)?.markdown ||
                                            module.enums.find((e) => e.data.name === item)?.markdown ||
                                            module.variables.find((e) => e.data.name === item)?.markdown ||
                                            module.functions.find((e) => e.data.name === item)?.markdown ||
                                            module.interfaces.find((e) => e.data.name === item)?.markdown;

                                        usedFiles.add(item); // Always track used files

                                        if (!data) {
                                            const customData = Object.values(module.custom).flat().find((e) => e.name === item);

                                            if (customData) {
                                                if (shouldLog)
                                                    console.log(
                                                        `Writing custom file ${customData.name}${customData.type || path.extname(customData.path)}`
                                                    );

                                                await writeFile(
                                                    path.join(catPath, `${customData.name}${customData.type || path.extname(customData.path)}`),
                                                    customData.content
                                                );
                                            }
                                        } else {
                                            for (const md of data) {
                                                if (shouldLog)
                                                    console.log(
                                                        `Writing document "${md.name}.${options.extension}"`
                                                    );

                                                await writeFile(
                                                    path.join(catPath, `${md.name}.${options.extension}`),
                                                    md.content
                                                );
                                            }
                                        }
                                    }
                                }
                            } else if (typeof items === 'object' && items !== null && Object.keys(items).length > 0) {
                                if (shouldLog)
                                    console.log(
                                        `Writing custom order document "${catPath}/meta.json"`
                                    );

                                if (!existsSync(catPath))
                                    await mkdir(catPath, {
                                        recursive: true
                                    });

                                // Build pages object for nested structure
                                const pages: Record<string, number> = {};
                                let pageOrder = 1;

                                for (const [subCategory, subItems] of Object.entries(items)) {
                                    if (subCategory !== '') {
                                        pages[subCategory] = pageOrder++;
                                    }
                                }

                                await writeFile(
                                    path.join(catPath, `meta.json`),
                                    JSON.stringify({
                                        title: category,
                                        order: categoryOrder,
                                        pages: pages
                                    }, null, options.spaces || 0)
                                );

                                for (const [subCategory, subItems] of Object.entries(items)) {
                                    if (subCategory === '') {
                                        await writeOrder(catPath, {'': subItems} as unknown as CustomOrder, pages);
                                    } else {
                                        await writeOrder(catPath, {[subCategory]: subItems} as unknown as CustomOrder, pages);
                                    }
                                }
                            }
                        }
                    };

                    const basePath = createBasePath(options.output!, module.name);

                    if (!existsSync(basePath))
                        await mkdir(basePath, {
                            recursive: true
                        });

                    // Build root pages object
                    const rootPages: Record<string, number> = {};
                    let rootPageOrder = 1;

                    // Handle numeric keys and regular categories differently
                    for (const [category, items] of Object.entries(options.customOrder)) {
                        const isNumericKey = category.match(/^\d+$/);

                        if (isNumericKey && Array.isArray(items)) {
                            // For numeric keys, add the items directly to root pages
                            for (const item of items) {
                                if (typeof item === 'string') {
                                    rootPages[item] = rootPageOrder++;
                                }
                            }
                        } else {
                            // For regular categories, add the category name
                            rootPages[category] = rootPageOrder++;
                        }
                    }

                    await writeFile(
                        path.join(basePath, `meta.json`),
                        JSON.stringify({
                            title: module.name,
                            order: 1,
                            pages: rootPages
                        }, null, options.spaces || 0)
                    );

                    await writeOrder(basePath, options.customOrder, rootPages);

                    // Now create remaining files that weren't used in customOrder using standard structure
                    if (shouldLog) console.log('Creating remaining unused files in standard structure...');

                    const createRemainingFiles = async () => {
                        const standardCategories = ['classes', 'enums', 'functions', 'interfaces', 'types', 'variables'];
                        const remainingPages: Record<string, number> = {};
                        let remainingPageOrder = Object.keys(rootPages).length + 1;

                        for (const category of standardCategories) {
                            const categoryData = (module as any)[category] as any[];
                            const unusedItems = categoryData.filter(item => !usedFiles.has(item.data.name));

                            if (unusedItems.length > 0) {
                                remainingPages[category.charAt(0).toUpperCase() + category.slice(1)] = remainingPageOrder++;

                                const categoryPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    category
                                );

                                if (!existsSync(categoryPath))
                                    await mkdir(categoryPath, {
                                        recursive: true
                                    });

                                // Create meta.json for this category
                                await writeFile(
                                    path.join(categoryPath, `meta.json`),
                                    JSON.stringify({
                                        title: category.charAt(0).toUpperCase() + category.slice(1),
                                        order: remainingPageOrder - 1,
                                        pages: {}
                                    }, null, options.spaces || 0)
                                );

                                // Write all unused files in this category
                                await Promise.all(
                                    unusedItems.flatMap((item) => {
                                        return item.markdown.map(async (md: any) => {
                                            if (shouldLog)
                                                console.log(
                                                    `Writing remaining ${category} document "${md.name}.${options.extension}"`
                                                );

                                            await writeFile(
                                                path.join(categoryPath, `${md.name}.${options.extension}`),
                                                md.content
                                            );
                                        });
                                    })
                                );
                            }
                        }

                        // Handle unused custom files
                        for (const [customCategory, customFiles] of Object.entries(module.custom)) {
                            const unusedCustomFiles = customFiles.filter(file => !usedFiles.has(file.name));

                            if (unusedCustomFiles.length > 0) {
                                const categoryPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    customCategory
                                );

                                if (!existsSync(categoryPath))
                                    await mkdir(categoryPath, {
                                        recursive: true
                                    });

                                // Create meta.json for custom category if it doesn't exist
                                const metaPath = path.join(categoryPath, 'meta.json');
                                if (!existsSync(metaPath)) {
                                    remainingPages[customCategory] = remainingPageOrder++;

                                    await writeFile(
                                        metaPath,
                                        JSON.stringify({
                                            title: customCategory,
                                            order: remainingPageOrder - 1,
                                            pages: {}
                                        }, null, options.spaces || 0)
                                    );
                                }

                                // Write unused custom files
                                await Promise.all(
                                    unusedCustomFiles.map(async (file) => {
                                        if (shouldLog)
                                            console.log(
                                                `Writing remaining custom file ${file.name}${file.type || path.extname(file.path)}`
                                            );

                                        await writeFile(
                                            path.join(categoryPath, `${file.name}${file.type || path.extname(file.path)}`),
                                            file.content
                                        );
                                    })
                                );
                            }
                        }

                        // Update root meta.json with remaining pages if any were added
                        if (Object.keys(remainingPages).length > 0) {
                            const updatedRootPages = { ...rootPages, ...remainingPages };

                            await writeFile(
                                path.join(basePath, `meta.json`),
                                JSON.stringify({
                                    title: module.name,
                                    order: 1,
                                    pages: updatedRootPages
                                }, null, options.spaces || 0)
                            );
                        }
                    };

                    await createRemainingFiles();
                } else {
                    await Promise.all([
                        ...module.classes.flatMap((cl) => {
                            return cl.markdown.map(async (md) => {
                                const classPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    'classes'
                                );

                                if (shouldLog)
                                    console.log(
                                        `Writing class document "${md.name}.${options.extension}"`
                                    );

                                if (!existsSync(classPath))
                                    await mkdir(classPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(classPath, `${md.name}.${options.extension}`),
                                    md.content
                                );
                            });
                        }),
                        ...module.types.flatMap((cl) => {
                            return cl.markdown.map(async (md) => {
                                const typesPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    'types'
                                );

                                if (shouldLog)
                                    console.log(
                                        `Writing types document "${md.name}.${options.extension}"`
                                    );

                                if (!existsSync(typesPath))
                                    await mkdir(typesPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(typesPath, `${md.name}.${options.extension}`),
                                    md.content
                                );
                            });
                        }),
                        ...module.enums.flatMap((cl) => {
                            return cl.markdown.map(async (md) => {
                                const typesPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    'enums'
                                );

                                if (shouldLog)
                                    console.log(
                                        `Writing enums document "${md.name}.${options.extension}"`
                                    );

                                if (!existsSync(typesPath))
                                    await mkdir(typesPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(typesPath, `${md.name}.${options.extension}`),
                                    md.content
                                );
                            });
                        }),
                        ...module.variables.flatMap((cl) => {
                            return cl.markdown.map(async (md) => {
                                const typesPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    'variables'
                                );

                                if (shouldLog)
                                    console.log(
                                        `Writing variables document "${md.name}.${options.extension}"`
                                    );

                                if (!existsSync(typesPath))
                                    await mkdir(typesPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(typesPath, `${md.name}.${options.extension}`),
                                    md.content
                                );
                            });
                        }),
                        ...module.functions.flatMap((cl) => {
                            return cl.markdown.map(async (md) => {
                                const funcsPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    'functions'
                                );

                                if (shouldLog)
                                    console.log(
                                        `Writing functions document "${md.name}.${options.extension}"`
                                    );

                                if (!existsSync(funcsPath))
                                    await mkdir(funcsPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(funcsPath, `${md.name}.${options.extension}`),
                                    md.content
                                );
                            });
                        }),
                        ...module.interfaces.flatMap((cl) => {
                            return cl.markdown.map(async (md) => {
                                const typesPath = createBasePath(
                                    options.output!,
                                    module.name,
                                    'interfaces'
                                );

                                if (shouldLog)
                                    console.log(
                                        `Writing interfaces document "${md.name}.${options.extension}"`
                                    );

                                if (!existsSync(typesPath))
                                    await mkdir(typesPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(typesPath, `${md.name}.${options.extension}`),
                                    md.content
                                );
                            })
                        }),
                        ...[module.name, "classes", "types", "enums", "variables", "functions", "interfaces"].map(async (dir, idX) => {

                            if (dir !== module.name && (module as any)[dir as keyof typeof module]!.length === 0) return;

                            const dirPath = createBasePath(
                                options.output!,
                                module.name,
                                dir === module.name ? '' : dir
                            );

                            if (shouldLog)
                                console.log(
                                    `Writing meta document "${dirPath}/meta.json"`
                                );

                            if (!existsSync(dirPath))
                                await mkdir(dirPath, {
                                    recursive: true
                                });

                            if (idX === 0) {
                                const pages: Record<string, number> = {};
                                if (module.classes.length > 0) pages['Classes'] = 1;
                                if (module.enums.length > 0) pages['Enums'] = 2;
                                if (module.functions.length > 0) pages['Functions'] = 3;
                                if (module.interfaces.length > 0) pages['Interfaces'] = 4;
                                if (module.types.length > 0) pages['Types'] = 5;
                                if (module.variables.length > 0) pages['Variables'] = 6;


                                await writeFile(
                                    path.join(dirPath, `meta.json`),
                                    JSON.stringify({
                                        title: dir,
                                        order: idX + 1,
                                        pages
                                    }, null, options.spaces || 0)
                                );
                            } else {
                                await writeFile(
                                    path.join(dirPath, `meta.json`),
                                    JSON.stringify({
                                        title: dir.charAt(0).toUpperCase() + dir.slice(1),
                                        order: idX + 1,
                                        pages: {}
                                    }, null, options.spaces || 0)
                                )
                            }
                        })
                    ]);

                    for (const fileIdx in doc.custom) {
                        const file = doc.custom[fileIdx];

                        await Promise.all(
                            file.map(async (m) => {
                                const catPath = path.join(options.output!, doc.name, path.normalize(m.category));

                                if (shouldLog)
                                    console.log(
                                        `Writing custom file ${m.name}${m.type || path.extname(m.path)}`
                                    );

                                if (!existsSync(catPath))
                                    await mkdir(catPath, {
                                        recursive: true
                                    });

                                await writeFile(
                                    path.join(catPath, `${m.name}${m.type || path.extname(m.path)}`),
                                    m.content
                                );
                            })
                        );
                    }
                }
        }
    }

    return doc;
}

export default createDocumentation;
