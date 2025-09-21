let imageRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;

export function image(str: string) {
    return str.replace(imageRegex, (match, alt, link) => {
        return `![${alt}](${link})` as const;
    });
}
