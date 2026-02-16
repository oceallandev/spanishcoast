import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Helper to find all HTML files for the build input
const getHtmlInput = () => {
    const files = fs.readdirSync('./');
    const input = {};
    files.forEach(file => {
        if (file.endsWith('.html')) {
            const name = file.replace('.html', '');
            input[name] = resolve(__dirname, file);
        }
    });
    return input;
};

export default defineConfig({
    root: './',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: getHtmlInput()
        }
    },
    server: {
        open: true
    }
});
