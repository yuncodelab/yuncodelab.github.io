import {defineConfig} from 'vitepress'

export default defineConfig({
    title: '技术文档',
    description: '技术知识体系',

    themeConfig: {
        nav: [
            {text: '主页', link: '/'},
            {text: '系统设计', link: '/system-design/sku/'},
            {text: '项目', link: '/projects/mediaaccessx/'},
            {text: '移动开发', link: '/mobile/android/'}
        ],

        sidebar: {
            '/system-design/sku/': [
                {
                    text: 'SKU 系统设计',
                    items: [
                        {text: '方案总览 (Overview)', link: '/system-design/sku/'},
                        {text: '数据结构设计', link: '/system-design/sku/sku-part1'},
                        {text: '服务端实现', link: '/system-design/sku/sku-part2'},
                        {text: 'Android端实现', link: '/system-design/sku/sku-part3'}
                    ]
                }
            ],

            '/projects/mediaaccessx/': [
                {
                    text: 'MediaAccessX',
                    items: [
                        {text: '项目简介', link: '/projects/mediaaccessx/'},
                    ]
                }
            ]
        },

        search: {
            provider: 'local'
        }
    }
})