import * as fs from 'fs';
import * as path from 'path';
import '@hitomihiumi/colors.ts';

const fontsDir = path.join(__dirname, '../resources/fonts');
const fonts: { [key: string]: string } = {};
let fontWeights: { [key: string]: { [key: number]: string } } = {};

fs.readdirSync(fontsDir).forEach((file) => {
    const ext = path.extname(file);
    if (ext === '.ttf' || ext === '.otf') {
        const fontName = path.basename(file, ext);
        if (!fontName.includes('-')) {
            console.error(`❌ | Font name must contain a weight: ${file}`.bgRed);
            return;
        }
        console.log(`🔍 | ${fontName} found!`.yellow);
        if (fonts[fontName]) {
            console.error(`❌ | Font with name ${fontName} already exists!`.bgRed);
            return;
        }
        if (!fontWeights[fontName.split('-')[0]]) {
            fontWeights[fontName.split('-')[0]] = {};
        }
        fonts[fontName] = Buffer.from(fs.readFileSync(path.join(fontsDir, file))).toString('base64');
    }
});

function getFontWeight(fontName: string) {
    const weight = fontName.split('-')[1];
    if (!isNaN(Number(fontName))) {
        switch (Number(fontName)) {
            case 100:
                return 'Thin';
            case 200:
                return 'ExtraLight';
            case 300:
                return 'Light';
            case 400:
                return 'Regular';
            case 500:
                return 'Medium';
            case 600:
                return 'SemiBold';
            case 700:
                return 'Bold';
            case 800:
                return 'ExtraBold';
            case 900:
                return 'Black';
            case 950:
                return 'ExtraBlack';
        }
    } else if (isNaN(Number(weight))) {
        if (weight) {
            switch (weight.toLowerCase()) {
                case 'thin':
                    return 100;
                case 'ultralight':
                case 'extralight':
                    return 200;
                case 'light':
                    return 300;
                case 'regular':
                case 'normal':
                    return 400;
                case 'medium':
                    return 500;
                case 'semibold':
                case 'demibold':
                    return 600;
                case 'bold':
                    return 700;
                case 'extrabold':
                case 'ultrabold':
                    return 800;
                case 'black':
                case 'heavy':
                    return 900;
                case 'extrablack':
                case 'ultrablack':
                    return 950;
            }
        }
    } else {
        return Number(weight);
    }
    return 400;
}

let str = '';
let str2 = '';

for (const fontName in fonts) {
    const font = fonts[fontName];
    const weight = getFontWeight(fontName) as number;
    const family = fontName.split('-')[0];

    if (!fontWeights[family]) {
        fontWeights[family] = {};
    }

    fontWeights[family][weight] = font;
}

for (const family in fontWeights) {
    str += `    ${family}: {\n`;
    for (const weight in fontWeights[family]) {
        str += `        ${weight}: 'Buffer.from(${fontWeights[family][weight]}, "base64")',\n`;
        str2 += `    ${family}_${getFontWeight(weight)}(size: number) {\n`;
        str2 += `        return { family: '${family}', size, weight: FontWeight.${getFontWeight(weight)} } \n`;
        str2 += '    },\n';
        console.log(`✔️ | ${family} ${getFontWeight(weight)} loaded!`.green);
    }
    str += '    },\n';
}

const fonts_ts = `
/**
 * The bundled fonts in this package.
 * Used fonts:
 * @see https://vercel.com/font
 */
export const Fonts = {
${str}
};
`;

const fonts_list = `
import { FontWeight } from "../types/enum";
/**
 * The bundled fonts in this package.
 * Used fonts:
 * @see https://vercel.com/font
 */
 export const FontsList = {
${str2}
};
`

fs.writeFileSync(path.join(__dirname, 'Fonts.ts'), fonts_ts);
fs.writeFileSync(path.join(__dirname, 'FontsList.ts'), fonts_list);
console.log('-------------------------\n✔️ | Fonts.ts and FontsList.ts are generated!'.green);
