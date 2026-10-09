import { Example } from "@/product/Example";
import { PageList } from "@/product/PageList";
import { baseURL, meta, schema } from "@/resources";
import {
  Badge,
  Button,
  Column,
  Grid,
  Heading,
  Meta,
  Row,
  Schema,
  Tag,
  Text,
} from "@once-ui-system/core";
import { CodeBlock } from "@once-ui-system/core/code";
import React from "react";

export async function generateMetadata() {
  return Meta.generate({
    title: meta.home.title,
    description: meta.home.description,
    baseURL: baseURL,
    path: meta.home.path,
    image: meta.home.image,
  });
}

const features = [
  {
    title: "Layers",
    text: "Rounded shapes, text, images, lines, curves, polygons and paths — described as plain objects or JSX.",
  },
  {
    title: "Flexbox layout",
    text: "Arrange layers with gap, padding, alignment and absolute positioning, powered by Yoga.",
  },
  {
    title: "Signals and animation",
    text: "Animate any prop with tweens, easing and generator timelines. Export to animated PNG.",
  },
  {
    title: "Node.js, browser, React",
    text: "One core, three adapters. The same scene renders on a server, in a canvas and as a React component.",
  },
];

export default function Home() {
  return (
    <Column maxWidth={56} gap="xl">
      <Schema
        as="webPage"
        title={meta.home.title}
        description={meta.home.description}
        baseURL={baseURL}
        path={meta.home.path}
        author={{ name: schema.name }}
      />

      <Column fillWidth gap="l" paddingTop="l">
        <Column gap="12">
          <Badge
            background="overlay"
            paddingLeft="12"
            paddingRight="16"
            paddingY="8"
            border="neutral-alpha-medium"
            href="/docs/migration-from-0.6"
            vertical="center"
            marginBottom="12"
          >
            <Tag marginRight="12">1.0</Tag>
            <Text variant="label-default-s" onBackground="neutral-weak">
              Coming from 0.6? Read the migration guide
            </Text>
          </Badge>
          <Heading variant="display-strong-s">LazyCanvas</Heading>
          <Text wrap="balance" onBackground="neutral-weak" variant="body-default-xl">
            Declarative 2D canvas rendering with flexbox layout, JSX and signal-based animation — for
            Node.js, the browser and React.
          </Text>
        </Column>

        <Row gap="12" wrap>
          <Button href="/docs/quick-start" size="l" suffixIcon="chevronRight" data-border="rounded">
            Quick start
          </Button>
          <Button
            href="https://github.com/NMMTY/LazyCanvas"
            size="l"
            variant="secondary"
            prefixIcon="github"
            data-border="rounded"
            weight="default"
          >
            GitHub
          </Button>
        </Row>

        <CodeBlock
          marginTop="8"
          codes={[
            {
              code: "npm install @nmmty/lazycanvas @nmmty/adapter-react @nmmty/adapter-browser",
              language: "bash",
              label: "React",
            },
            {
              code: "npm install @nmmty/lazycanvas @nmmty/adapter-node",
              language: "bash",
              label: "Node.js",
            },
            {
              code: "npm install @nmmty/lazycanvas @nmmty/adapter-browser",
              language: "bash",
              label: "Browser",
            },
          ]}
          copyButton
        />
      </Column>

      <Example name="animation" hideCode caption="Live: rendered right now by @nmmty/adapter-react." />

      <Grid fillWidth columns="2" s={{ columns: "1" }} gap="12">
        {features.map((feature) => (
          <Column
            key={feature.title}
            gap="8"
            padding="20"
            radius="l"
            border="neutral-alpha-medium"
            background="surface"
          >
            <Heading as="h3" variant="heading-strong-l">
              {feature.title}
            </Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              {feature.text}
            </Text>
          </Column>
        ))}
      </Grid>

      <Column fillWidth>
        <Heading as="h2" variant="display-default-xs" marginTop="24">
          Documentation
        </Heading>
        <Grid fillWidth columns="2" s={{ columns: "1" }} gap="8" marginTop="24">
          <PageList path={["docs"]} depth={1} description={false} />
        </Grid>
      </Column>
    </Column>
  );
}
