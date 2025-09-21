import React from "react";
import { 
  Column, 
  Row, 
  Heading, 
  Text, 
  Button, 
  Grid,
  Media, 
  Line, 
  StatusIndicator,
  Badge,
  Tag,
  Meta,
  Schema
} from "@once-ui-system/core";
import { baseURL, meta, schema, changelog, roadmap, routes } from "@/resources";
import { formatDate } from "./utils/formatDate";
import { PageList } from "@/product/PageList";

export async function generateMetadata() {
  return Meta.generate({
    title: meta.home.title,
    description: meta.home.description,
    baseURL: baseURL,
    path: meta.home.path,
    image: meta.home.image
  });
}

// Calculate roadmap progress stats
const calculateRoadmapStats = () => {
  let totalTasks = 0;
  let inProgressTasks = 0;
  let completedTasks = 0;
  
  roadmap.forEach(product => {
    product.columns.forEach(column => {
      totalTasks += column.tasks.length;
      
      if (column.title === "In Progress") {
        inProgressTasks += column.tasks.length;
      }
      
      if (column.title === "Done") {
        completedTasks += column.tasks.length;
      }
    });
  });
  
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  return {
    totalTasks,
    inProgressTasks,
    completedTasks,
    progressPercentage
  };
};

const roadmapStats = calculateRoadmapStats();

// Get the latest changelog entry
const latestChangelogEntry = changelog[0];

export default function Home() {
  return (
    <Column maxWidth={56} gap="xl">
      <Schema
        as="webPage"
        title={meta.home.title}
        description={meta.home.description}
        baseURL={baseURL}
        path={meta.home.path}
        author={{
          name: schema.name
        }}
      />
      
      {/* Hero Section */}
      <Column fillWidth gap="l" paddingTop="l">
        <Row fillWidth gap="l">
          <Column maxWidth="xs" gap="12">
          <Badge
              background="overlay"
              paddingLeft="12"
              paddingRight="16"
              paddingY="8"
              border="neutral-alpha-medium"
              href="/LazyCanvas/QuickStart"
              vertical="center"
              marginBottom="12"
            >
                <Tag marginRight="12">Docs</Tag>
                <Text
                  variant="label-default-s"
                  onBackground="neutral-weak"
                >
                    New to LazyCanvas? Start here!
                </Text>
            </Badge>
            <Heading variant="display-strong-s">
              RE:Docs
            </Heading>
            <Text wrap="balance" onBackground="neutral-weak" variant="body-default-xl" marginBottom="20">
                Find any documentation about NMMTY modules that interest you!
            </Text>
          </Column>
        </Row>
      </Column>

      <Column fillWidth>
        <PageList depth={1} thumbnail={true} marginTop="24" minHeight={14}/>
        <Heading as="h2" variant="display-default-xs" marginTop="48">
          LazyCanvas
        </Heading>
        <Grid fillWidth columns="2" s={{columns: "1"}} gap="8" marginTop="24">
          <PageList path={["LazyCanvas"]} depth={1} description={false}/>
        </Grid>
      </Column>
      
      {/* Latest Update Section */}
      {routes['/changelog'] && (
       <Column 
       maxWidth={56}
       background="overlay"
       radius="l"
       border="neutral-alpha-weak"
     >
       <Column paddingX="32" paddingY="24" fillWidth horizontal="between" s={{direction: "column"}} gap="4">
         <Row fillWidth vertical="center" horizontal="between" gap="16" wrap>
           <Heading as="h2" variant="display-default-xs">
             Latest Update
           </Heading>
           <Button data-border="rounded" weight="default" variant="secondary" href="/changelog" size="s" suffixIcon="chevronRight">
             All changes
           </Button>
         </Row>
         <Text variant="label-default-s" onBackground="neutral-weak">
           {formatDate(latestChangelogEntry.date)}
         </Text>
       </Column>
        
        <Column fillWidth>
          {latestChangelogEntry.image && (
            <Media
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              radius="l"
              src={latestChangelogEntry.image} 
              alt={`Illustration for ${latestChangelogEntry.title}`}
              border="neutral-alpha-weak"
              aspectRatio="16 / 9"
            />
          )}
          <Column fillWidth gap="4" paddingX="32" paddingY="24">
            <Heading as="h3">
              {latestChangelogEntry.title}
            </Heading>

            {latestChangelogEntry.description && (
              <Text variant="body-default-m" onBackground="neutral-weak">
                {latestChangelogEntry.description}
              </Text>
            )}
          </Column>
        </Column>
      </Column>
      )}
    </Column>
  );
}
