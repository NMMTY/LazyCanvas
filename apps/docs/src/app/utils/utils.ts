import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Schemes } from "@once-ui-system/core";

interface Post {
  slug: string;
  content: string;
  navTag?: string;
  navLabel?: string;
  navIcon?: string;
  navTagVariant?: Schemes;
  metadata: {
    title: string;
    summary?: string;
    github?: string;
    updatedAt: string;
    image?: string;
    order?: number; // Add order field for explicit ordering
  };
}

export function getPages(customPath = ["src", "content"]): Post[] {
  const postsDir = path.join(process.cwd(), ...customPath);
  const contentBasePath = path.join(process.cwd(), "src", "content");
  
  // Check if directory exists before trying to read it
  if (!fs.existsSync(postsDir)) {
    console.warn(`Directory does not exist: ${postsDir}`);
    return [];
  }
  
  const files = fs.readdirSync(postsDir);
  const posts: Post[] = [];
  
  // Try to read meta.json if it exists in the current directory
  let metaData: { pages?: Record<string, number>, order?: number, title?: string } = {};
  const metaPath = path.join(postsDir, "meta.json");
  if (fs.existsSync(metaPath)) {
    try {
      metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (error) {
      console.warn(`Error reading meta.json: ${metaPath}`, error);
    }
  }

  files.forEach((file) => {
    const filePath = path.join(postsDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      try {
        posts.push(...getPages([...customPath, file]));
      } catch (error) {
        console.warn(`Error reading directory: ${filePath}`, error);
      }
    } else if (file.endsWith('.mdx')) {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(fileContents);

        // Create slug without src/content prefix
        const slug = path.relative(contentBasePath, filePath)
          .replace(/\.mdx?$/, '')
          .replace(/\\/g, '/');
          
        // Get order from meta.json if available
        const fileName = path.basename(file, path.extname(file));
        const metaOrder = metaData.pages?.[fileName];

        posts.push({
          slug,
          content,
          navTag: data.tag,
          navLabel: data.tagLabel,
          navIcon: data.navIcon,
          navTagVariant: data.navTagVariant,
          metadata: {
            title: data.title || '',
            summary: data.summary,
            github: data.github,
            updatedAt: data.updatedAt || '',
            image: data.image,
            // Priority: 1. Frontmatter order, 2. meta.json order, 3. undefined
            order: data.order !== undefined ? Number(data.order) : (metaOrder !== undefined ? Number(metaOrder) : undefined),
          },
        });
      } catch (error) {
        console.warn(`Error reading file: ${filePath}`, error);
      }
    }
  });

  return posts;
}

// Sort types for documentation pages
export type SortType = 'order' | 'alphabetical' | 'date' | 'section';

// Function to sort pages consistently across the application
export function sortPages(pages: Post[], sortType: SortType = 'order'): Post[] {
  if (!pages || pages.length === 0) {
    return [];
  }

  // Create a copy to avoid mutating the original array
  const sortedPages = [...pages];

  switch (sortType) {
    case 'order':
      // First sort by explicit order (if available), then alphabetically by slug as fallback
      return sortedPages.sort((a, b) => {
        // If both have order, sort by order
        if (a.metadata.order !== undefined && b.metadata.order !== undefined) {
          return a.metadata.order - b.metadata.order;
        }
        // If only a has order, a comes first
        if (a.metadata.order !== undefined) {
          return -1;
        }
        // If only b has order, b comes first
        if (b.metadata.order !== undefined) {
          return 1;
        }
        // If neither has order, sort alphabetically by slug
        return a.slug.localeCompare(b.slug);
      });

    case 'alphabetical':
      // Sort alphabetically by title
      return sortedPages.sort((a, b) => 
        a.metadata.title.localeCompare(b.metadata.title)
      );

    case 'date':
      // Sort by update date (newest first)
      return sortedPages.sort((a, b) => 
        new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime()
      );

    case 'section':
      // Sort by section (directory structure) first, then by order within section
      return sortedPages.sort((a, b) => {
        // Get the section (first part of the slug)
        const aSection = a.slug.split('/')[0];
        const bSection = b.slug.split('/')[0];
        
        // If sections are different, sort by section
        if (aSection !== bSection) {
          return aSection.localeCompare(bSection);
        }
        
        // If in the same section, use order logic
        if (a.metadata.order !== undefined && b.metadata.order !== undefined) {
          return a.metadata.order - b.metadata.order;
        }
        if (a.metadata.order !== undefined) return -1;
        if (b.metadata.order !== undefined) return 1;
        
        // Fallback to alphabetical by title
        return a.metadata.title.localeCompare(b.metadata.title);
      });

    default:
      return sortedPages;
  }
}

// Function to get adjacent pages based on the current slug
export function getAdjacentPages(currentSlug: string, sortType: SortType = 'section') {
  try {
    // Get all pages
    const allPages = getPages();
    
    if (allPages.length === 0) {
      return { prevPage: null, nextPage: null };
    }

    // Create a hierarchical structure that mirrors the file system
    const createHierarchy = (pages: Post[]): any => {
      const hierarchy: any = {};

      // First, group pages by their path structure
      pages.forEach(page => {
        const parts = page.slug.split('/');
        let current = hierarchy;

        // Navigate through the path, creating structure as needed
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];

          if (i === parts.length - 1) {
            // This is the final part (the page itself)
            if (!current._pages) current._pages = [];
            current._pages.push(page);
          } else {
            // This is a directory
            if (!current[part]) {
              current[part] = {};
            }
            current = current[part];
          }
        }
      });

      return hierarchy;
    };

    // Helper function to read meta.json for ordering
    const getMetaData = (pathParts: string[]): { pages?: Record<string, number>, folders?: Record<string, number> } => {
      try {
        const metaPath = path.join(process.cwd(), "src", "content", ...pathParts, "meta.json");
        if (fs.existsSync(metaPath)) {
          return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
      } catch (error) {
        console.warn(`Error reading meta.json at ${pathParts.join('/')}:`, error);
      }
      return {};
    };

    // Recursive function to flatten hierarchy into ordered array
    const flattenHierarchy = (node: any, currentPath: string[] = []): Post[] => {
      const result: Post[] = [];

      // Get meta data for current level
      const metaData = getMetaData(currentPath);

      // First, add direct pages in this directory
      if (node._pages) {
        const sortedPages = [...node._pages].sort((a, b) => {
          // Priority 1: Use metadata.order (already set from meta.json by getPages)
          if (a.metadata.order !== undefined && b.metadata.order !== undefined) {
            return a.metadata.order - b.metadata.order;
          }
          if (a.metadata.order !== undefined) return -1;
          if (b.metadata.order !== undefined) return 1;

          // Priority 2: Use meta.json order lookup (fallback)
          const aName = a.slug.split('/').pop()!;
          const bName = b.slug.split('/').pop()!;

          const aOrder = metaData.pages?.[aName];
          const bOrder = metaData.pages?.[bName];

          if (aOrder !== undefined && bOrder !== undefined) {
            return aOrder - bOrder;
          }
          if (aOrder !== undefined) return -1;
          if (bOrder !== undefined) return 1;


          // Final fallback to alphabetical by title
          return a.metadata.title.localeCompare(b.metadata.title);
        });

        result.push(...sortedPages);
      }

      // Then, process subdirectories
      const subdirs = Object.keys(node).filter(key => key !== '_pages');

      // Sort subdirectories based on meta.json pages order
      const sortedSubdirs = [...subdirs].sort((a, b) => {
        // Use pages field from meta.json for subdirectory ordering
        const aOrder = metaData.pages?.[a];
        const bOrder = metaData.pages?.[b];

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;

        // Fallback to alphabetical
        return a.localeCompare(b);
      });
      
      // Recursively process each subdirectory
      sortedSubdirs.forEach(subdir => {
        const subResult = flattenHierarchy(node[subdir], [...currentPath, subdir]);
        result.push(...subResult);
      });
      
      return result;
    };

    // Create the hierarchy and flatten it
    const hierarchy = createHierarchy(allPages);
    const orderedPages: Post[] = [];

    // Handle root-level pages first
    const rootMetaData = getMetaData([]);

    // Process top-level items (both pages and sections)
    const topLevelItems = Object.keys(hierarchy);
    const sortedTopLevel = [...topLevelItems].sort((a, b) => {
      const aOrder = rootMetaData.pages?.[a];
      const bOrder = rootMetaData.pages?.[b];

      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;

      return a.localeCompare(b);
    });

    // Add root-level pages first if they exist
    if (hierarchy._pages) {
      const sortedRootPages = [...hierarchy._pages].sort((a, b) => {
        const aOrder = rootMetaData.pages?.[a.slug];
        const bOrder = rootMetaData.pages?.[b.slug];

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;

        return a.metadata.title.localeCompare(b.metadata.title);
      });
      orderedPages.push(...sortedRootPages);
    }

    // Then process each top-level section
    sortedTopLevel.forEach(item => {
      if (item !== '_pages' && hierarchy[item]) {
        const sectionPages = flattenHierarchy(hierarchy[item], [item]);
        orderedPages.push(...sectionPages);
      }
    });

    // Find current page index
    const currentIndex = orderedPages.findIndex(page => page.slug === currentSlug);

    if (currentIndex === -1) {
      return { prevPage: null, nextPage: null };
    }
    
    // Get adjacent pages with proper navigation logic
    const currentPage = orderedPages[currentIndex];
    const currentParts = currentPage.slug.split('/');

    let prevPage = currentIndex > 0 ? orderedPages[currentIndex - 1] : null;
    let nextPage = currentIndex < orderedPages.length - 1 ? orderedPages[currentIndex + 1] : null;

    // Apply navigation constraints based on directory structure
    if (prevPage) {
      const prevParts = prevPage.slug.split('/');

      // Check if pages are in the same logical section
      if (!areInSameNavigationContext(currentParts, prevParts)) {
        prevPage = null;
      }
    }

    if (nextPage) {
      const nextParts = nextPage.slug.split('/');

      // Check if pages are in the same logical section
      if (!areInSameNavigationContext(currentParts, nextParts)) {
        nextPage = null;
      }
    }
    
    return { prevPage, nextPage };
  } catch (error) {
    console.error("Error getting adjacent pages:", error);
    return { prevPage: null, nextPage: null };
  }
}

// Helper function to determine if two pages should be navigable between each other
function areInSameNavigationContext(currentParts: string[], otherParts: string[]): boolean {
  // Allow navigation between all pages in the same top-level section
  // This enables recursive folder navigation
  if (currentParts.length > 0 && otherParts.length > 0) {
    // If both pages are in the same top-level section, allow navigation
    return currentParts[0] === otherParts[0];
  }

  // If both are top-level pages, they can navigate between each other
  if (currentParts.length === 1 && otherParts.length === 1) {
    return true;
  }

  return false;
}

// Function to get all sections with their pages
export function getSections(sortType: SortType = 'order'): { section: string, pages: Post[] }[] {
  try {
    // Get all pages
    const allPages = getPages();
    
    // Group pages by section
    const sectionMap = new Map<string, Post[]>();
    
    allPages.forEach(page => {
      const section = page.slug.split('/')[0];
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section)!.push(page);
    });
    
    // Sort sections based on meta.json order if available
    const sections: { section: string, pages: Post[] }[] = [];
    
    // Try to read root meta.json for section ordering
    let rootMetaData: { pages?: Record<string, number>, folders?: Record<string, number> } = {};
    const rootMetaPath = path.join(process.cwd(), "src", "content", "meta.json");
    if (fs.existsSync(rootMetaPath)) {
      try {
        rootMetaData = JSON.parse(fs.readFileSync(rootMetaPath, 'utf8'));
      } catch (error) {
        console.warn(`Error reading root meta.json: ${rootMetaPath}`, error);
      }
    }
    
    // Convert map to array and sort sections
    for (const [section, pages] of sectionMap.entries()) {
      sections.push({
        section,
        pages: sortPages(pages, sortType)
      });
    }
    
    // Sort sections based on meta.json order if available, otherwise alphabetically
    return sections.sort((a, b) => {
      // Use pages order from meta.json (as per user's requirement)
      const aOrder = rootMetaData.pages?.[a.section];
      const bOrder = rootMetaData.pages?.[b.section];

      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;

      // Fallback to alphabetical order
      return a.section.localeCompare(b.section);
    });
  } catch (error) {
    console.error("Error getting sections:", error);
    return [];
  }
}