import { MDXRemote, MDXRemoteProps } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import React, { ReactNode } from "react";

import { 
  Heading, 
  Row,
  Column,
  Table,
  Media, 
  SmartLink, 
  Text,
  InlineCode, 
  Accordion, 
  AccordionGroup ,
  TextProps,
  HeadingLink,
  MediaProps,
  Card,
  Grid,
  Feedback,
  Button,
  Icon,
  List,
  ListItem,
  Line,
} from "@once-ui-system/core";
import { CodeBlock } from "@once-ui-system/core/code";
import { Example } from "./Example";
import { PageList } from "./PageList";
import {CustomTable} from "@/product/CustomTable";

const onceUIComponents = {
  Table,
  Heading,
  Text,
  Row,
  Media,
  SmartLink,
  InlineCode,
  Accordion,
  AccordionGroup,
  Grid,
  HeadingLink,
  Feedback,
  Button,
  Icon,
  Card,
  Column,
};

type CustomLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

function CustomLink({ href, children, ...props }: CustomLinkProps) {
  // SmartLink picks a client-side link for internal paths, and an external
  // one (new tab, noopener) for everything else; in-page anchors work as-is.
  return (
    <SmartLink href={href} {...(props as object)}>
      {children}
    </SmartLink>
  );
}

function createImage({ alt, src, ...props }: MediaProps & { src: string }) {
  if (!src) {
    console.error("Media requires a valid 'src' property.");
    return null;
  }

  return (
    <Media
      marginTop="8"
      marginBottom="16"
      enlarge
      radius="m"
      aspectRatio="16 / 9"
      sizes="(max-width: 960px) 100vw, 960px"
      alt={alt}
      src={src}
      {...props}
    />
  );
}

// Headings can contain inline code or emphasis, so children are not always a string.
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function slugify(input: ReactNode): string {
  const str = textOf(input);
  return str
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters except for -
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

function createList({ children }: { children: ReactNode }) {
  return (
    <List>
      {children}
    </List>
  );
}

function createListItem({ children }: { children: ReactNode }) {
  return (
    <ListItem
      marginTop="4"
      marginBottom="8"
    >
      {children}
    </ListItem>
  );
}

function createHeading(as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  // Use HeadingLinkProps to ensure type compatibility
  const CustomHeading = ({ children, ...props }: Omit<React.ComponentProps<typeof HeadingLink>, 'as' | 'id'>) => {
    const slug = slugify(children);
    return (
      <HeadingLink
        marginTop="24"
        marginBottom="12"
        as={as}
        id={slug}
        {...props}
      >
        {children}
      </HeadingLink>
    );
  };

  CustomHeading.displayName = `${as}`;

  return CustomHeading;
}

function createParagraph({ children }: TextProps) {
  return (
    <Text
      style={{ lineHeight: "175%" }}
      variant="body-default-m"
      onBackground="neutral-medium"
      marginTop="8"
      marginBottom="12"
    >
      {children}
    </Text>
  );
}

function createInlineCode({ children }: { children: ReactNode }) {
  return <InlineCode>{children}</InlineCode>;
}

function createCodeBlock(props: any) {
  // For pre tags that contain code blocks
  if (props.children && props.children.props && props.children.props.className) {
    const { className, children } = props.children.props;
    
    // Extract language from className (format: language-xxx)
    const language = className.replace('language-', '');
    const label = language.charAt(0).toUpperCase() + language.slice(1);
    
    return (
      <CodeBlock
        marginTop="8"
        marginBottom="16"
        codes={[
          {
            code: children,
            language,
            label
          }
        ]}
        copyButton
      />
    );
  }
  
  // Fallback for other pre tags or empty code blocks
  return (
    <Column as="pre" fillWidth overflowX="auto" marginTop="8" marginBottom="16">
      {props.children}
    </Column>
  );
}

/**
 * GitHub-flavoured markdown tables arrive as <thead>/<tbody> element trees;
 * rebuild them as the data Once UI's Table takes.
 */
function MarkdownTable({ children }: { children: ReactNode }) {
  const sections = React.Children.toArray(children) as React.ReactElement<{ children?: ReactNode }>[];
  const rowsOf = (section?: React.ReactElement<{ children?: ReactNode }>) =>
    section
      ? (React.Children.toArray(section.props.children) as React.ReactElement<{
          children?: ReactNode;
        }>[]).map((row) => React.Children.toArray(row.props.children).map((cell) => (cell as React.ReactElement<{ children?: ReactNode }>).props.children))
      : [];

  const [head, body] = sections;
  const headers = (rowsOf(head)[0] ?? []).map((content, index) => ({
    content,
    key: `col-${index}`,
  }));

  return <Table marginTop="8" marginBottom="16" hoverable data={{ headers, rows: rowsOf(body) }} />;
}

function createHR() {
  return <Line />;
}

const components = {
  p: createParagraph as any,
  h1: createHeading("h1") as any,
  h2: createHeading("h2") as any,
  h3: createHeading("h3") as any,
  h4: createHeading("h4") as any,
  h5: createHeading("h5") as any,
  h6: createHeading("h6") as any,
  img: createImage as any,
  a: CustomLink as any,
  code: createInlineCode as any,
  pre: createCodeBlock as any,
  ul: createList as any,
  ol: createList as any,
  li: createListItem as any,
  hr: createHR as any,
  table: MarkdownTable as any,
  PageList,
  Example,
  ...onceUIComponents,
  Table: CustomTable
};

type CustomMDXProps = MDXRemoteProps & {
  components?: typeof components;
};

export function CustomMDX(props: CustomMDXProps) {
  // Add a try-catch block to handle any errors during MDX rendering
  try {
    return (
      <MDXRemote
        {...props}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        components={{ ...components, ...(props.components || {}) }}
      />
    );
  } catch (error) {
    console.error('Error rendering MDX content:', error);
    
    // Return a fallback UI when an error occurs
    return (
      <Column gap="16" padding="24" border="accent-medium" radius="m">
        <Text variant="heading-strong-m" onBackground="accent-strong">
          Error rendering content
        </Text>
        <Text variant="body-default-m" onBackground="accent-medium">
          There was an error rendering this content. Please try refreshing the page.
        </Text>
      </Column>
    );
  }
}
