import * as fs from 'fs';
import * as path from 'path';

function postDocgen(source: string, destination: string) {
    if (fs.existsSync(destination)) {
        fs.rmSync(destination, { recursive: true, force: true });
    }

    fs.mkdirSync(destination, { recursive: true });

    copyFiles(source, destination);
}

function copyFiles(source: string, destination: string) {
    if (!fs.existsSync(source)) {
        return;
    }

    const files = fs.readdirSync(source);

    files.forEach(file => {
        const sourcePath = path.join(source, file);
        const destPath = path.join(destination, file);
        const stats = fs.statSync(sourcePath);

        if (stats.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyFiles(sourcePath, destPath);
        } else if (stats.isFile()) {
            const ext = path.extname(file).toLowerCase();
            if (ext === '.mdx' || ext === '.json') {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    });
}

postDocgen(path.join(__dirname, '..', 'public', 'lazycanvas'), path.join(__dirname, '../../..', 'apps', 'docs', 'src', 'content', 'LazyCanvas'));