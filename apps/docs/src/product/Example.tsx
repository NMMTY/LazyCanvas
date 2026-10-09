import fs from "node:fs";
import path from "node:path";
import { examples } from "@/examples";
import { Column, Text } from "@once-ui-system/core";
import { CodeBlock } from "@once-ui-system/core/code";
import React from "react";

interface ExampleProps {
  /** File name in `src/examples`, without the extension. */
  name: string;
  /** Hide the source and show only the live result. */
  hideCode?: boolean;
  caption?: string;
}

/**
 * A live example: the component in `src/examples/<name>.tsx` is rendered next
 * to its own source, so the code on the page is exactly the code that runs.
 */
export function Example({ name, hideCode = false, caption }: ExampleProps) {
  const Live = examples[name];
  if (!Live) throw new Error(`<Example name="${name}" />: no such example in src/examples`);

  const source = fs
    .readFileSync(path.join(process.cwd(), "src", "examples", `${name}.tsx`), "utf8")
    .replace(/^"use client";\s*/, "")
    .trimEnd();

  return (
    <Column fillWidth gap="8" marginTop="8" marginBottom="16">
      <Column
        fillWidth
        padding="16"
        radius="l"
        border="neutral-alpha-medium"
        background="surface"
        horizontal="center"
        style={{ overflowX: "auto" }}
      >
        <Live />
      </Column>
      {caption && (
        <Text variant="label-default-s" onBackground="neutral-weak">
          {caption}
        </Text>
      )}
      {!hideCode && (
        <CodeBlock
          marginTop="0"
          marginBottom="0"
          codes={[{ code: source, language: "tsx", label: "TSX" }]}
          copyButton
        />
      )}
    </Column>
  );
}
