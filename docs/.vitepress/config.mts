import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'Tech Docs',
    description: 'Engineering Knowledge System',

    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'System Design', link: '/system-design/sku/' },
            { text: 'Projects', link: '/projects/mediaaccessx/' },
            { text: 'Mobile', link: '/mobile/android/' }
        ],

        sidebar: {
            '/system-design/sku/': [
                {
                    text: 'SKU System Design',
                    items: [
                        { text: 'Overview', link: '/system-design/sku/' },
                        { text: 'Part 1', link: '/system-design/sku/sku-part1' },
                        { text: 'Part 2', link: '/system-design/sku/sku-part2' },
                        { text: 'Part 3', link: '/system-design/sku/sku-part3' }
                    ]
                }
            ],

            '/projects/mediaaccessx/': [
                {
                    text: 'MediaAccessX',
                    items: [
                        { text: 'Intro', link: '/projects/mediaaccessx/' },
                        { text: 'Chinese', link: '/projects/mediaaccessx/mediaaccessx' },
                        { text: 'English', link: '/projects/mediaaccessx/mediaaccessx-en' }
                    ]
                }
            ]
        },

        search: {
            provider: 'local'
        }
    }
})