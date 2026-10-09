"use client";

import { SmartLink, Table, type TableProps } from "@once-ui-system/core";
import type { ReactNode } from "react";

/**
 * The API reference generator emits table cells as strings with markdown links
 * (`[Scene](/reference/…)`) and backslash escapes. Turn them into nodes before
 * handing the table to Once UI.
 */
function hyperlink(text: string): ReactNode[] {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    parts.push(
      <SmartLink key={match.index} href={match[2]}>
        {match[1]}
      </SmartLink>,
    );
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts;
}

function CustomTable({ data, ...rest }: TableProps) {
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
