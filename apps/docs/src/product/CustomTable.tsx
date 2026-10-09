"use client";

import { InlineCode, SmartLink, Table, type TableProps } from "@once-ui-system/core";
import type { ReactNode } from "react";

/**
 * The API reference generator emits table cells as strings with markdown links
 * (`[Scene](/reference/…)`) and backslash escapes. Turn them into nodes before
 * handing the table to Once UI.
 */
function withCode(text: string, keyBase: number): ReactNode[] {
  // `inline code` in descriptions
  return text
    .split(/(`[^`]+`)/)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
        <InlineCode key={`${keyBase}-${i}`}>{part.slice(1, -1)}</InlineCode>
      ) : (
        part
      ),
    );
}

function hyperlink(text: string): ReactNode[] {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) parts.push(...withCode(text.substring(lastIndex, match.index), lastIndex));
    parts.push(
      <SmartLink key={match.index} href={match[2]}>
        {match[1]}
      </SmartLink>,
    );
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) parts.push(...withCode(text.substring(lastIndex), lastIndex));
  return parts;
}

type CustomTableProps = Omit<TableProps, "data"> & {
  /** The table data, or the same JSON as a URL-encoded string (how the generated MDX passes it). */
  data: TableProps["data"] | string;
};

function CustomTable({ data: input, ...rest }: CustomTableProps) {
  const data: TableProps["data"] =
    typeof input === "string" ? JSON.parse(decodeURIComponent(input)) : input;
  const rows = data.rows.map((row) =>
    row.map((cell) => (typeof cell === "string" ? hyperlink(cell.replace(/\\/g, "")) : cell)),
  );

  return (
    <Table
      marginTop="8"
      marginBottom="16"
      hoverable
      data={{ headers: data.headers, rows }}
      {...rest}
    />
  );
}

export { CustomTable };
