import { defineConfig } from 'vite';

// Relative asset URLs keep the build valid at both the local root and a
// GitHub Pages project path (/<repository>/).
export default defineConfig({
    base: './'
});
