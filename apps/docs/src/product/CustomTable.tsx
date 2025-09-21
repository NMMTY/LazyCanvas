"use client";

import { Flex, Row, IconButton, SmartLink } from "@once-ui-system/core";
import { useState, ReactNode } from "react";
import styles from "./CustomTable.module.scss";

type TableProps = React.ComponentProps<typeof Flex> & {
    data: {
        headers: {
            content: ReactNode;
            key: string;
            sortable?: boolean;
        }[];
        rows: ReactNode[][];
    };
    onRowClick?: (rowIndex: number) => void;
};

function CustomTable({ data, onRowClick, ...flex }: TableProps) {
    const [sortConfig, setSortConfig] = useState<{
        key: string;
        direction: "ascending" | "descending";
    } | null>(null);

    const handleSort = (key: string) => {
        let direction: "ascending" | "descending" = "ascending";

        if (sortConfig && sortConfig.key === key) {
            direction = sortConfig.direction === "ascending" ? "descending" : "ascending";
        }

        setSortConfig({ key, direction });
    };

    const sortedRows = [...data.rows].sort((a, b) => {
        if (!sortConfig) return 0;

        const headerIndex = data.headers.findIndex((header) => header.key === sortConfig.key);
        if (headerIndex === -1) return 0;

        const aValue = String(a[headerIndex]);
        const bValue = String(b[headerIndex]);

        if (sortConfig.direction === "ascending") {
            return aValue.localeCompare(bValue);
        } else {
            return bValue.localeCompare(aValue);
        }
    });

    const headers = data.headers.map((header, index) => (
        <th
            style={{ textAlign: "left", borderBottom: "1px solid var(--neutral-alpha-weak)" }}
            className="px-16 py-12 font-label font-default font-s"
            key={index}
        >
            <Row gap="8" vertical="center">
                {header.content}
                {header.sortable && (
                    <IconButton
                        icon={
                            sortConfig?.key === header.key
                                ? sortConfig.direction === "ascending"
                                    ? "chevronUp"
                                    : "chevronDown"
                                : "chevronDown"
                        }
                        size="s"
                        variant="ghost"
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleSort(header.key);
                        }}
                        style={{
                            opacity: sortConfig?.key === header.key ? 1 : 0.6,
                        }}
                    />
                )}
            </Row>
        </th>
    ));

    const hyperlink = (text: string) => {
        const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }
            parts.push(
                <SmartLink key={match.index} href={match[2]}>
                    {match[1]}
                </SmartLink>
            );
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }
        return parts;
    };

    const escape = (str: string) => {
        return str.replace(/\\/g, '')
    }


    const rows = (sortConfig ? sortedRows : data.rows).map((row, index) => (
        <tr
            key={index}
            onClick={onRowClick ? () => onRowClick(index) : undefined}
            className={onRowClick ? "cursor-interactive " + styles.hover : ""}
            style={onRowClick ? { transition: "background-color 0.2s ease" } : undefined}
        >
            {row.map((cell, cellIndex) => (
                <td className="px-16 py-12 font-body font-default font-s" key={cellIndex}>
                    {hyperlink(escape(cell as string))}
                </td>
            ))}
        </tr>
    ));

    return (
        <Row
            fillWidth
            radius="l"
            overflowY="hidden"
            border="neutral-alpha-weak"
            background="surface"
            overflowX="auto"
            marginTop="8"
            marginBottom="16"
            {...flex}
        >
            <table
                className="fill-width"
                style={{ borderSpacing: 0, borderCollapse: "collapse", minWidth: "32rem" }}
            >
                <thead className="neutral-on-background-strong">
                <tr>{headers}</tr>
                </thead>
                <tbody className="neutral-on-background-medium">
                {rows.length > 0 ? (
                    rows
                ) : (
                    <tr>
                        <td colSpan={headers.length} className="px-24 py-12 font-body font-default font-s">
                            No data available
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </Row>
    );
}

export { CustomTable };