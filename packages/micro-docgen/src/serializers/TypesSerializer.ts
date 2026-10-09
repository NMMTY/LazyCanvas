import { ReflectionKind } from 'typedoc';
import type { JSONOutput } from 'typedoc';
import { FileMetadata, getFileMetadata, getName, parseType, parseTypes } from '../utils';
import { AbstractSerializer } from './AbstractSerializer';
import { DocumentedClassProperty, DocumentedParameter } from './ClassSerializer';

export interface DocumentedTypes {
    name: string;
    description: string | null;
    see: string[];
    private: boolean;
    deprecated: boolean;
    type: string | null;
    rawType: string[] | null;
    properties: DocumentedTypeProperty[];
    parameters: DocumentedParameter[];
    returns: {
        type: string;
        description: string | null;
    } | null;
    metadata: FileMetadata | null;
    objectType: ReflectionKind | null;
}

export interface DocumentedTypeProperty extends DocumentedClassProperty {
    value: string | null;
}

export class TypesSerializer extends AbstractSerializer {
    public serialize(): DocumentedTypes {
        const base = {
            deprecated: !!this.declaration.comment?.blockTags?.some((r) => r.tag === '@deprecated'),
            description: this.declaration.comment?.summary?.map((t) => t.text).join('') || null,
            metadata: getFileMetadata(this.declaration),
            name: getName(this.declaration),
            parameters: [],
            private: !!this.declaration.flags.isPrivate,
            properties: [],
            returns: null,
            see: [],
            type: this.declaration.type ? parseType(this.declaration.type) : 'any',
            rawType: this.declaration.type ? parseTypes(this.declaration.type) : ['any'],
            objectType: this.declaration.kind
        } as DocumentedTypes;

        if (
            this.declaration.kind === ReflectionKind.Enum ||
            this.declaration.kind === ReflectionKind.Interface
        ) {
            if (this.declaration.children) {
                base.properties = this.declaration.children.map((m) => {
                    // A method has no `type`, only call signatures: describe it as the
                    // function type it is, instead of `any`.
                    const memberType: JSONOutput.SomeType | undefined =
                        m.type ??
                        (m.signatures?.length
                            ? ({
                                  type: 'reflection',
                                  declaration: { signatures: [m.signatures[0]] }
                              } as unknown as JSONOutput.SomeType)
                            : undefined);

                    if (memberType?.type !== 'reflection')
                        return {
                            name: m.name,
                            description:
                                (m.comment?.summary || m.signatures?.[0]?.comment?.summary)
                                    ?.map((t: { text: string }) => t.text)
                                    .join('') || null,
                            value: m.defaultValue || null,
                            abstract: !!m.flags.isAbstract,
                            default: m.defaultValue || null,
                            deprecated: !!m.comment?.blockTags?.some(
                                (r) => r.tag === '@deprecated'
                            ),
                            metadata: getFileMetadata(m),
                            private: !!m.flags.isPrivate,
                            readonly: !!m.flags.isReadonly,
                            see:
                                this.declaration.comment?.blockTags
                                    ?.find((r) => r.tag === '@see')
                                    ?.content?.map((m) => m.text) || [],
                            static: !!m.flags.isStatic,
                            type: memberType ? parseType(memberType) : 'any',
                            rawType: memberType ? parseTypes(memberType) : ['any']
                        };

                    return {
                        name: m.name,
                        description:
                            (
                                (memberType as any)?.declaration?.signatures?.[0]?.comment?.summary ||
                                m.comment?.summary
                            )
                                ?.map((t: { text: string }) => t.text)
                                .join('') || null,
                        value: m.defaultValue || null,
                        abstract: !!m.flags.isAbstract,
                        default: m.defaultValue || null,
                        deprecated: !!m.comment?.blockTags?.some((r) => r.tag === '@deprecated'),
                        metadata: getFileMetadata((memberType as any)?.declaration || m),
                        private: !!m.flags.isPrivate,
                        readonly: !!m.flags.isReadonly,
                        see:
                            this.declaration.comment?.blockTags
                                ?.find((r) => r.tag === '@see')
                                ?.content?.map((m) => m.text) || [],
                        static: !!m.flags.isStatic,
                        type: memberType ? parseType(memberType) : 'any',
                        rawType: memberType ? parseTypes(memberType) : ['any']
                    };
                });
            }
        }

        return base;
    }
}
